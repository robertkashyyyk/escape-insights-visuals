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

  // Check for incremental mode (cron sends this, manual sync does full)
  let syncMode = "full";
  let lookbackDays = 0;
  try {
    const body = await req.json();
    if (body?.mode === "incremental" || body?.lookback_days) {
      syncMode = "incremental";
      lookbackDays = body.lookback_days || 14; // Default 14-day lookback
    }
  } catch {
    // No body = full sync
  }

  const batchId = crypto.randomUUID();
  const syncLogId = crypto.randomUUID();
  let totalReservations = 0;
  let totalListings = 0;
  let skippedReservations = 0;
  const errors: string[] = [];

  try {
    await supabase.from("sync_logs").insert({
      id: syncLogId,
      sync_type: syncMode,
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

    await supabase.from("upload_batches").insert({
      id: batchId,
      file_name: `hostaway-api-sync-${syncMode}`,
      status: "processing",
      row_count: 0,
    });

    // 3. Sync listings (always full — small dataset)
    console.log("Syncing listings...");
    let listingOffset = 0;
    while (true) {
      const url = `${HOSTAWAY_API}/listings?limit=${LIMIT}&offset=${listingOffset}`;
      const res = await fetch(url, { headers: authHeaders });
      const body = await res.json();
      if (!res.ok) throw new Error(`Listings fetch failed: ${JSON.stringify(body)}`);

      const listings = body.result || [];
      if (listings.length === 0) break;

      const rows = listings.map((l: any) => {
        // Hostaway: checkInTimeStart/checkOutTime are integers (hour 0-23)
        const ciHour = l.checkInTimeStart ?? l.checkInTime;
        const coHour = l.checkOutTime;
        const fmtHour = (h: any) => {
          if (h === null || h === undefined || h === "") return null;
          const n = Number(h);
          if (Number.isNaN(n) || n < 0 || n > 23) return null;
          return `${String(n).padStart(2, "0")}:00:00`;
        };

        // Hostaway listingAmenities: array of { id, amenityId, amenityName } objects
        const rawAmenities: any[] = Array.isArray(l.listingAmenities) ? l.listingAmenities : [];
        const amenityNames: string[] = rawAmenities
          .map((a: any) => (typeof a === "string" ? a : a?.amenityName || a?.name || ""))
          .filter((n: string) => !!n);
        const amenityLower = amenityNames.map((n) => n.toLowerCase());
        const hasAmenity = (...keywords: string[]) =>
          amenityLower.some((n) => keywords.some((k) => n.includes(k)));

        const has_hot_tub = hasAmenity("hot tub", "jacuzzi", "whirlpool");
        const has_ev_charger = hasAmenity("ev charger", "electric vehicle", "ev charging");
        const pet_friendly = hasAmenity("pets allowed", "pet friendly", "pet-friendly", "pets welcome");
        const self_check_in = hasAmenity("self check-in", "self check in", "self-check", "smart lock", "keypad", "lockbox", "key safe");

        return {
          hostaway_listing_id: l.id,
          name: l.name || `Listing ${l.id}`,
          address: l.address || null,
          city: l.city || null,
          country: l.countryCode || null,
          property_type: l.propertyTypeId ? String(l.propertyTypeId) : null,
          // Hostaway uses bedroomsNumber / bathroomsNumber on the listing object
          bedrooms: l.bedroomsNumber ?? l.bedrooms ?? null,
          bathrooms: l.bathroomsNumber ?? l.bathrooms ?? null,
          max_guests: l.personCapacity ?? l.maxGuests ?? null,
          latitude: l.lat || null,
          longitude: l.lng || null,
          image_url: l.imageUrl || l.thumbnailUrl || null,
          default_check_in_time: fmtHour(ciHour) ?? "15:00:00",
          default_check_out_time: fmtHour(coHour) ?? "10:00:00",
          amenities: amenityNames,
          has_hot_tub,
          has_ev_charger,
          pet_friendly,
          self_check_in,
        };
      });

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

    // 4. Build listing ID map
    const { data: dbListings } = await supabase
      .from("listings")
      .select("id, hostaway_listing_id")
      .not("hostaway_listing_id", "is", null);

    const listingMap = new Map<number, string>();
    for (const dl of dbListings || []) {
      if (dl.hostaway_listing_id) listingMap.set(dl.hostaway_listing_id, dl.id);
    }

    // 5. Sync reservations
    // For incremental: only fetch reservations modified in the last N days
    // includeResources=1 is REQUIRED for customFieldValues / hostNote / guestNote to be
    // returned (they come back empty otherwise — Hostaway's #1 silent gotcha).
    let reservationUrlBase = `${HOSTAWAY_API}/reservations?limit=${LIMIT}&sortOrder=arrivalDate&includeResources=1`;
    if (syncMode === "incremental" && lookbackDays > 0) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - lookbackDays);
      const sinceStr = sinceDate.toISOString().split("T")[0];
      reservationUrlBase += `&modifiedDateFrom=${sinceStr}`;
      console.log(`Incremental sync: fetching reservations modified since ${sinceStr}`);
    } else {
      console.log("Full sync: fetching all reservations");
    }

    // Fetch custom-field definitions once so customFieldValues can be shown with names.
    const customFieldNames = new Map<number, string>();
    try {
      const cfRes = await fetch(`${HOSTAWAY_API}/customFields`, { headers: authHeaders });
      if (cfRes.ok) {
        const cfBody = await cfRes.json();
        for (const cf of (cfBody.result || [])) {
          if (cf?.id != null) customFieldNames.set(cf.id, cf.name || cf.label || `Field ${cf.id}`);
        }
      }
    } catch (e) {
      console.warn(`Custom field definitions fetch failed (continuing): ${e}`);
    }

    let resOffset = 0;
    while (true) {
      const url = `${reservationUrlBase}&offset=${resOffset}`;
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

        // Hostaway reservation arrival/departure times: integer hour (0-23) or "HH:MM"
        const fmtResTime = (v: any) => {
          if (v === null || v === undefined || v === "") return null;
          if (typeof v === "string" && /^\d{1,2}:\d{2}/.test(v)) {
            const [h, m] = v.split(":").map(Number);
            if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
              return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
            }
            return null;
          }
          const n = Number(v);
          if (Number.isNaN(n) || n < 0 || n > 23) return null;
          return `${String(n).padStart(2, "0")}:00:00`;
        };
        const checkInTime = fmtResTime(r.arrivalTime ?? r.checkInTime);
        const checkOutTime = fmtResTime(r.departureTime ?? r.checkOutTime);

        // Financial fields from Hostaway
        // totalPrice = full gross amount the guest paid
        // hostPayout = net amount actually paid to the host (after channel commission, taxes withheld by channel, etc.)
        const totalPrice = Number(r.totalPrice ?? r.basePrice ?? 0);
        const hostPayout = r.hostPayout != null ? Number(r.hostPayout) : null;
        const cleaningFee = Number(r.cleaningFee ?? r.cleaningFeeValue ?? 0);
        const channelCommission = Number(
          r.channelCommissionAmount ?? r.channelCommission ?? r.hostChannelFee ?? 0
        );
        const taxAmount = Number(r.totalTax ?? r.taxAmount ?? r.cityTax ?? 0);
        const guestFees = Number(r.guestFeeAmount ?? 0);

        // Notes + custom fields (require includeResources=1). guestNote also captures
        // Booking.com special requests, which don't arrive through the channel otherwise.
        const hostNote = r.hostNote ?? null;
        const guestNote = r.guestNote ?? null;
        const customFields = Array.isArray(r.customFieldValues)
          ? r.customFieldValues.map((cf: any) => ({
              field_id: cf.customFieldId ?? cf.customField?.id ?? null,
              name: cf.customField?.name ?? customFieldNames.get(cf.customFieldId) ?? `Field ${cf.customFieldId ?? "?"}`,
              value: cf.value ?? null,
            })).filter((cf: any) => cf.value != null && cf.value !== "")
          : [];

        rows.push({
          hostaway_reservation_id: r.id,
          listing_id: listingUuid,
          guest_name: guestName,
          check_in: checkIn,
          check_out: checkOut,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          status,
          platform: platform.toLowerCase(),
          total_amount: totalPrice,
          host_payout: hostPayout,
          owner_payout: hostPayout ?? totalPrice,
          cleaning_fee: cleaningFee,
          channel_commission: channelCommission,
          tax_amount: taxAmount,
          guest_fees: guestFees,
          reservation_date: reservationDate,
          host_note: hostNote,
          guest_note: guestNote,
          custom_fields: customFields,
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

    await supabase
      .from("upload_batches")
      .update({ status: "completed", row_count: totalReservations })
      .eq("id", batchId);

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

    console.log(`Sync complete (${syncMode}): ${totalListings} listings, ${totalReservations} reservations, ${skippedReservations} skipped`);

    // Trigger cleaning schedule generation for next 90 days (fire-and-forget)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/generate-daily-cleaning-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ days_ahead: 90 }),
      }).catch((e) => console.warn("Post-sync cleaning trigger failed:", e));
      console.log("Triggered cleaning schedule regeneration (90-day rolling)");
    } catch (e) {
      console.warn("Failed to trigger post-sync cleaning generation:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: syncMode,
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
