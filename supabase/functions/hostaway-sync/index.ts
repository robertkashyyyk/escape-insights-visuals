import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const HOSTAWAY_API = "https://api.hostaway.com/v1";
const LIMIT = 100;
const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const batchId = crypto.randomUUID();
  const syncLogId = crypto.randomUUID();
  let totalReservations = 0;
  let totalListings = 0;
  let skippedReservations = 0;
  const errors: string[] = [];

  try {
    // Create sync log entry
    await supabase.from("sync_logs").insert({
      id: syncLogId,
      sync_type: "full",
      status: "running",
      started_at: new Date().toISOString(),
    });

    // 1. Get credentials
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

    // 3. Sync listings (all pages, batched upserts)
    console.log("Syncing listings...");
    let listingOffset = 0;
    while (true) {
      const url = `${HOSTAWAY_API}/listings?limit=${LIMIT}&offset=${listingOffset}`;
      const res = await fetch(url, { headers: authHeaders });
      const body = await res.json();
      if (!res.ok) throw new Error(`Listings fetch failed: ${JSON.stringify(body)}`);

      const listings = body.result || [];
      if (listings.length === 0) break;

      const rows = listings.map((l: any) => ({
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
      }));

      const { error } = await supabase.from("listings").upsert(rows, {
        onConflict: "hostaway_listing_id",
        ignoreDuplicates: false,
      });
      if (error) {
        const msg = `Listing batch upsert error: ${error.message}`;
        console.warn(msg);
        errors.push(msg);
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

    // 5. Sync reservations (all pages, batched upserts)
    console.log("Syncing reservations...");
    let resOffset = 0;
    while (true) {
      const url = `${HOSTAWAY_API}/reservations?limit=${LIMIT}&offset=${resOffset}&sortOrder=arrivalDate&includeResources=0`;
      const res = await fetch(url, { headers: authHeaders });
      const body = await res.json();
      if (!res.ok) throw new Error(`Reservations fetch failed: ${JSON.stringify(body)}`);

      const reservations = body.result || [];
      if (reservations.length === 0) break;

      const rows: Record<string, unknown>[] = [];
      for (const r of reservations) {
        const hostawayListingId = r.listingMapId || r.listingId;
        const listingUuid = listingMap.get(hostawayListingId);
        if (!listingUuid) {
          console.warn(`No listing for hostaway_listing_id=${hostawayListingId}, skipping reservation ${r.id}`);
          skippedReservations++;
          continue;
        }

        const checkIn = r.arrivalDate;
        const checkOut = r.departureDate;
        const reservationDate = r.insertedOn?.split("T")[0] || r.createdOn?.split("T")[0] || null;
        const guestName = r.guestName || r.guestFirstName
          ? `${r.guestFirstName || ""} ${r.guestLastName || ""}`.trim()
          : "Unknown Guest";

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

        let status = "confirmed";
        const rawStatus = (r.status || "").toLowerCase();
        if (rawStatus === "cancelled" || rawStatus === "canceled" || rawStatus === "declined") {
          status = "cancelled";
        } else if (rawStatus === "inquiry" || rawStatus === "enquiry") {
          status = "inquiry";
        }

        const platform = r.channelName || r.source || "hostaway";

        rows.push({
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
        });
      }

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("reservations").upsert(chunk, {
          onConflict: "hostaway_reservation_id",
          ignoreDuplicates: false,
        });
        if (error) {
          const msg = `Reservation batch error (offset=${resOffset}, chunk=${i}): ${error.message}`;
          console.warn(msg);
          errors.push(msg);
        }
      }

      totalReservations += rows.length;
      skippedReservations += reservations.length - rows.length;
      resOffset += LIMIT;
      console.log(`Processed ${totalReservations} reservations so far (offset=${resOffset})`);
      if (reservations.length < LIMIT) break;
    }

    // Update batch log
    await supabase
      .from("upload_batches")
      .update({ status: "completed", row_count: totalReservations })
      .eq("id", batchId);

    // Update sync log
    await supabase
      .from("sync_logs")
      .update({
        status: errors.length > 0 ? "completed_with_errors" : "success",
        listings_synced: totalListings,
        reservations_synced: totalReservations,
        reservations_skipped: skippedReservations,
        errors: errors.length > 0 ? errors.slice(0, 50) : [],
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLogId);

    console.log(`Sync complete: ${totalListings} listings, ${totalReservations} reservations, ${skippedReservations} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        listings: totalListings,
        reservations: totalReservations,
        skipped: skippedReservations,
        errors: errors.length,
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

    await supabase
      .from("sync_logs")
      .update({
        status: "error",
        errors: [...errors, (err as Error).message].slice(0, 50),
        completed_at: new Date().toISOString(),
        listings_synced: totalListings,
        reservations_synced: totalReservations,
        reservations_skipped: skippedReservations,
      })
      .eq("id", syncLogId);

    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
