import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const HOSTAWAY_API = "https://api.hostaway.com/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const batchId = crypto.randomUUID();
  let totalReservations = 0;
  let totalListings = 0;

  try {
    // 1. Get credentials from app_settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["hostaway_account_id", "hostaway_client_secret"]);

    const settingsMap = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
    const accountId = settingsMap.hostaway_account_id;
    const clientSecret = settingsMap.hostaway_client_secret;

    if (!accountId || !clientSecret) {
      throw new Error("Hostaway credentials not configured in Settings → Integrations");
    }

    // 2. OAuth token
    const tokenRes = await fetch(`${HOSTAWAY_API}/accessTokens`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: accountId,
        client_secret: clientSecret,
        scope: "general",
      }),
    });
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok || !tokenBody.access_token) {
      throw new Error(`Hostaway auth failed: ${JSON.stringify(tokenBody)}`);
    }
    const token = tokenBody.access_token;
    const authHeaders = { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" };

    // Log batch start
    await supabase.from("upload_batches").insert({
      id: batchId,
      file_name: "hostaway-api-sync",
      status: "processing",
      row_count: 0,
    });

    // 3. Sync listings (all pages)
    console.log("Syncing listings...");
    let listingOffset = 0;
    const LIMIT = 100;
    while (true) {
      const url = `${HOSTAWAY_API}/listings?limit=${LIMIT}&offset=${listingOffset}`;
      const res = await fetch(url, { headers: authHeaders });
      const body = await res.json();
      if (!res.ok) throw new Error(`Listings fetch failed: ${JSON.stringify(body)}`);

      const listings = body.result || [];
      if (listings.length === 0) break;

      for (const l of listings) {
        const { error } = await supabase.from("listings").upsert(
          {
            hostaway_listing_id: l.id,
            name: l.name || `Listing ${l.id}`,
            address: l.address || null,
            city: l.city || null,
            country: l.countryCode || null,
            property_type: l.propertyTypeId ? String(l.propertyTypeId) : null,
            bedrooms: l.bedrooms || null,
            bathrooms: l.bathrooms || null,
            max_guests: l.maxGuests || l.personCapacity || null,
            latitude: l.lat || null,
            longitude: l.lng || null,
            image_url: l.imageUrl || l.thumbnailUrl || null,
          },
          { onConflict: "hostaway_listing_id", ignoreDuplicates: false }
        );
        if (error) console.warn(`Listing upsert error for ${l.id}:`, error.message);
      }

      totalListings += listings.length;
      listingOffset += LIMIT;
      if (listings.length < LIMIT) break;
    }
    console.log(`Synced ${totalListings} listings`);

    // 4. Build listing ID map (hostaway_listing_id → uuid)
    const { data: dbListings } = await supabase
      .from("listings")
      .select("id, hostaway_listing_id")
      .not("hostaway_listing_id", "is", null);

    const listingMap = new Map<number, string>();
    for (const dl of dbListings || []) {
      if (dl.hostaway_listing_id) listingMap.set(dl.hostaway_listing_id, dl.id);
    }

    // 5. Sync reservations (all pages)
    console.log("Syncing reservations...");
    let resOffset = 0;
    while (true) {
      const url = `${HOSTAWAY_API}/reservations?limit=${LIMIT}&offset=${resOffset}&sortOrder=arrivalDate&includeResources=0`;
      const res = await fetch(url, { headers: authHeaders });
      const body = await res.json();
      if (!res.ok) throw new Error(`Reservations fetch failed: ${JSON.stringify(body)}`);

      const reservations = body.result || [];
      if (reservations.length === 0) break;

      for (const r of reservations) {
        const hostawayListingId = r.listingMapId || r.listingId;
        const listingUuid = listingMap.get(hostawayListingId);
        if (!listingUuid) {
          console.warn(`No listing found for hostaway_listing_id=${hostawayListingId}, skipping reservation ${r.id}`);
          continue;
        }

        const checkIn = r.arrivalDate;
        const checkOut = r.departureDate;
        const reservationDate = r.insertedOn?.split("T")[0] || r.createdOn?.split("T")[0] || null;
        const guestName = r.guestName || r.guestFirstName
          ? `${r.guestFirstName || ""} ${r.guestLastName || ""}`.trim()
          : "Unknown Guest";

        // Derived fields
        let bookingLeadDays: number | null = null;
        let dayOfWeek: number | null = null;
        let weekNumber: number | null = null;
        let month: number | null = null;
        let quarter: number | null = null;
        let year: number | null = null;

        if (checkIn) {
          const ciDate = new Date(checkIn);
          dayOfWeek = ciDate.getUTCDay();
          const startOfYear = new Date(ciDate.getUTCFullYear(), 0, 1);
          weekNumber = Math.ceil(((ciDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
          month = ciDate.getUTCMonth() + 1;
          quarter = Math.ceil(month / 3);
          year = ciDate.getUTCFullYear();

          if (reservationDate) {
            const rdDate = new Date(reservationDate);
            bookingLeadDays = Math.max(0, Math.floor((ciDate.getTime() - rdDate.getTime()) / 86400000));
          }
        }

        // Map status
        let status = "confirmed";
        const rawStatus = (r.status || "").toLowerCase();
        if (rawStatus === "cancelled" || rawStatus === "canceled" || rawStatus === "declined") {
          status = "cancelled";
        } else if (rawStatus === "inquiry" || rawStatus === "enquiry") {
          status = "inquiry";
        } else if (rawStatus === "new" || rawStatus === "pending" || rawStatus === "confirmed" || rawStatus === "modified") {
          status = "confirmed";
        }

        // Platform
        const platform = r.channelName || r.source || "hostaway";

        const row: Record<string, unknown> = {
          hostaway_reservation_id: r.id,
          listing_id: listingUuid,
          guest_name: guestName,
          check_in: checkIn,
          check_out: checkOut,
          status,
          platform: platform.toLowerCase(),
          total_amount: r.totalPrice || r.basePrice || 0,
          owner_payout: r.hostPayout || r.totalPrice || 0,
          guest_fees: r.guestFeeAmount || 0,
          reservation_date: reservationDate,
          booking_lead_days: bookingLeadDays,
          day_of_week: dayOfWeek,
          week_number: weekNumber,
          month,
          quarter,
          year,
        };

        // Try upsert by hostaway_reservation_id first
        const { error } = await supabase.from("reservations").upsert(row, {
          onConflict: "hostaway_reservation_id",
          ignoreDuplicates: false,
        });

        if (error) {
          // Fallback: try matching on listing+checkin+guest (legacy CSV rows)
          const { data: existing } = await supabase
            .from("reservations")
            .select("id")
            .eq("listing_id", listingUuid)
            .eq("check_in", checkIn)
            .eq("guest_name", guestName)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("reservations")
              .update(row)
              .eq("id", existing.id);
          } else {
            const { error: insertErr } = await supabase
              .from("reservations")
              .insert(row);
            if (insertErr) console.warn(`Reservation insert error for ${r.id}:`, insertErr.message);
          }
        }
      }

      totalReservations += reservations.length;
      resOffset += LIMIT;
      console.log(`Processed ${totalReservations} reservations so far (offset=${resOffset})`);
      if (reservations.length < LIMIT) break;
    }

    // Update batch log
    await supabase
      .from("upload_batches")
      .update({ status: "completed", row_count: totalReservations })
      .eq("id", batchId);

    console.log(`Sync complete: ${totalListings} listings, ${totalReservations} reservations`);

    return new Response(
      JSON.stringify({
        success: true,
        listings: totalListings,
        reservations: totalReservations,
        batchId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync error:", err);

    await supabase
      .from("upload_batches")
      .update({ status: "failed", row_count: totalReservations })
      .eq("id", batchId);

    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
