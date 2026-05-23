import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const AVG_SPEED_KMH = 40;
const DEFAULT_CHECKOUT = "10:00";
const DEFAULT_CHECKIN = "15:00";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function normaliseTime(t: string | null | undefined, fallback: string): string {
  if (!t) return fallback;
  // Accept "HH:MM" or "HH:MM:SS"
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function travelMinutes(
  lat1: number | null, lon1: number | null,
  lat2: number | null, lon2: number | null
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 15;
  const km = haversineKm(lat1, lon1, lat2, lon2);
  return Math.round((km / AVG_SPEED_KMH) * 60);
}

function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface TaskInfo {
  listing_id: string;
  reservation_id: string | null;
  scheduled_date: string;
  priority: string;
  /** 0=P0 arrival-risk orphan carryover, 1=P1 STO, 2=P2 standard checkout, 3=P3 orphan-gap fill */
  priority_level: number;
  cleaning_duration_minutes: number;
  latitude: number | null;
  longitude: number | null;
  location_group: string;
  assigned_cleaner_id: string | null;
  status: string;
  estimated_start_time: string | null;
  travel_time_from_previous_minutes: number;
  checkout_time: string;
  checkin_time: string | null;
  is_same_day_turnaround: boolean;
  existing_task_id?: string | null; // present if this is a pre-existing unassigned row to UPDATE rather than INSERT
  source?: string;
  notes?: string;
  overloaded?: boolean;
  override_assignment?: boolean;
  warning_reason?: string | null;
}


interface CleanerInfo {
  id: string;
  name: string;
  location_groups: string[];
  workload_share: Record<string, number>;
  non_working_days: string[];
  daily_working_hours: number;
  home_latitude: number | null;
  home_longitude: number | null;
  /** [{start_date, end_date}] in yyyy-MM-dd */
  holidays: Array<{ start_date: string; end_date: string; reason: string }>;
}

const CLUSTER_RADIUS_KM = 8; // ~5 miles
const CLUSTER_SOFT_MAX = 3;  // 1–3 → one cleaner; 4+ → split
const ROLLING_WINDOW_DAYS = 28;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let targetDate: string | null = null;
    let daysAhead = 0;
    let targetListingId: string | null = null;
    try {
      const body = await req.json();
      if (body?.date) targetDate = body.date;
      if (typeof body?.days_ahead === "number") daysAhead = body.days_ahead;
      if (typeof body?.listing_id === "string" && body.listing_id) targetListingId = body.listing_id;
    } catch {
      // no body
    }

    // Build list of dates to process
    const dates: string[] = [];
    if (targetDate && daysAhead === 0) {
      dates.push(targetDate);
    } else {
      // Default: rolling 30-day window starting today (London)
      const start = targetDate || todayLondon();
      const span = daysAhead > 0 ? daysAhead : 30;
      const startDate = new Date(start + "T12:00:00Z");
      for (let i = 0; i < span; i++) {
        const d = new Date(startDate);
        d.setUTCDate(d.getUTCDate() + i);
        dates.push(d.toISOString().slice(0, 10));
      }
    }

    let grandTotalCreated = 0;
    let grandTotalUnassigned = 0;
    const perDayResults: Array<{ date: string; created: number; unassigned: number }> = [];

    for (const targetDate of dates) {
      const { created, unassigned } = await processDate(supabase, targetDate, targetListingId);
      grandTotalCreated += created;
      grandTotalUnassigned += unassigned;
      perDayResults.push({ date: targetDate, created, unassigned });
    }

    await supabase.from("automation_logs").insert({
      tasks_created: grandTotalCreated,
      tasks_unassigned: grandTotalUnassigned,
      status: "success",
      triggered_by: "edge_function",
    });

    return new Response(
      JSON.stringify({
        tasks_created: grandTotalCreated,
        tasks_unassigned: grandTotalUnassigned,
        days_processed: dates.length,
        per_day: perDayResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Schedule generation error:", err);
    try {
      await supabase.from("automation_logs").insert({
        tasks_created: 0,
        tasks_unassigned: 0,
        status: "error",
        error_message: (err as Error).message,
        triggered_by: "edge_function",
      });
    } catch { /* ignore */ }
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processDate(supabase: any, targetDate: string): Promise<{ created: number; unassigned: number }> {
  const targetDayOfWeek = DAY_NAMES[new Date(targetDate + "T12:00:00Z").getDay()];

  // 0. P0 PROMOTION: only on the actual current day. Future week regeneration
  // must keep cleans on checkout day; the early-morning refresh promotes them
  // to P0 only if they are still incomplete on arrival day.
  const isCurrentDayRefresh = targetDate === todayLondon();
  let arrivalListingIds: string[] = [];

  if (isCurrentDayRefresh) {
    const { data: arrivalsTodayRaw } = await supabase
      .from("reservations")
      .select("listing_id")
      .eq("check_in", targetDate)
      .eq("status", "confirmed");
    arrivalListingIds = Array.from(
      new Set((arrivalsTodayRaw || []).map((r: any) => String(r.listing_id)))
    );
  }

  if (isCurrentDayRefresh && arrivalListingIds.length > 0) {
    // Promote ANY incomplete prior-day task for a listing with arrival today.
    // Operational rule: the clean did not happen yesterday, so the active
    // responsibility moves to today as P0. The prior-day row is repurposed
    // (UPDATE moves scheduled_date to today) — never duplicated. If multiple
    // prior tasks exist for the same listing, keep one and delete the rest so
    // we never end up with consecutive-day duplicate active cleans.
    const { data: priorOpen } = await supabase
      .from("clean_tasks")
      .select("id, listing_id, scheduled_date, status, override_assignment, assigned_cleaner_id, notes, priority_level, priority, source, reservation_id")
      .in("listing_id", arrivalListingIds)
      .lt("scheduled_date", targetDate)
      .not("status", "in", "(completed,done,cancelled)")
      .order("scheduled_date", { ascending: false });

    // Don't promote into a listing that already has a clean scheduled for today.
    const { data: existingToday } = await supabase
      .from("clean_tasks")
      .select("listing_id")
      .in("listing_id", arrivalListingIds)
      .eq("scheduled_date", targetDate);
    const haveToday = new Set((existingToday || []).map((r: any) => String(r.listing_id)));
    const promotedListings = new Set<string>();

    for (const t of priorOpen || []) {
      const lid = String(t.listing_id);
      if (haveToday.has(lid) || promotedListings.has(lid)) {
        // Already covered today (or sibling just promoted) — delete the
        // redundant prior task so no duplicate active cleans remain.
        await supabase.from("clean_tasks").delete().eq("id", t.id);
        continue;
      }
      // Preserve any existing assignment (manual override OR routine assignment)
      // so the carryover is owned by the same cleaner today.
      const keepCleaner = !!t.assigned_cleaner_id;
      const priorDate = t.scheduled_date;
      await supabase
        .from("clean_tasks")
        .update({
          scheduled_date: targetDate,
          priority: "arrival_risk_orphan",
          priority_level: 0,
          status: keepCleaner ? "scheduled" : "unassigned",
          assigned_cleaner_id: keepCleaner ? t.assigned_cleaner_id : null,
          override_assignment: false,
          estimated_start_time: null,
          warning_reason: keepCleaner
            ? `Carried over from ${priorDate} — clean not completed`
            : "Promoted from prior incomplete clean — property already vacant, guest arriving today",
          overloaded: false,
        })
        .eq("id", t.id);
      promotedListings.add(lid);
      haveToday.add(lid);
    }
  }

  // Self-heal rows incorrectly promoted into a future P0 during an earlier
  // manual week regeneration. Future arrivals must not steal checkout-day
  // cleans; only the real current-day refresh may promote P0.
  const { data: healCheckouts } = await supabase
    .from("reservations")
    .select("id, listing_id")
    .eq("check_out", targetDate)
    .eq("status", "confirmed");
  const healReservationIds = (healCheckouts || []).map((r: any) => String(r.id));
  if (!isCurrentDayRefresh && healReservationIds.length > 0) {
    const { data: futureP0Rows } = await supabase
      .from("clean_tasks")
      .select("id, listing_id, reservation_id, scheduled_date")
      .in("reservation_id", healReservationIds)
      .gt("scheduled_date", targetDate)
      .eq("priority_level", 0)
      .not("status", "in", "(completed,done,cancelled)")
      .eq("override_assignment", false);

    const movedListingIds = Array.from(new Set((futureP0Rows || []).map((t: any) => String(t.listing_id))));
    if (movedListingIds.length > 0) {
      const { data: existingAtCheckout } = await supabase
        .from("clean_tasks")
        .select("listing_id")
        .in("listing_id", movedListingIds)
        .eq("scheduled_date", targetDate)
        .neq("source", "manual");
      const covered = new Set((existingAtCheckout || []).map((t: any) => String(t.listing_id)));

      const { data: sameDayArrivals } = await supabase
        .from("reservations")
        .select("listing_id")
        .in("listing_id", movedListingIds)
        .eq("check_in", targetDate)
        .eq("status", "confirmed");
      const sameDayListings = new Set((sameDayArrivals || []).map((r: any) => String(r.listing_id)));

      for (const t of futureP0Rows || []) {
        const lid = String(t.listing_id);
        if (covered.has(lid)) continue;
        const isSto = sameDayListings.has(lid);
        await supabase
          .from("clean_tasks")
          .update({
            scheduled_date: targetDate,
            priority: isSto ? "same_day_turnaround" : "standard",
            priority_level: isSto ? 1 : 2,
            assigned_cleaner_id: null,
            status: "unassigned",
            estimated_start_time: null,
            travel_time_from_previous_minutes: 0,
            warning_reason: null,
            overloaded: false,
          })
          .eq("id", t.id);
        covered.add(lid);
      }
    }
  }

  // 1. Get checkouts for target date (with checkout time)
  const { data: checkouts, error: coErr } = await supabase
    .from("reservations")
    .select("id, listing_id, check_in, check_out, status, check_out_time")
    .eq("check_out", targetDate)
    .eq("status", "confirmed");
  if (coErr) throw coErr;

  // 1b. Get any pre-existing unassigned tasks for this date — these need re-assignment too
  const { data: orphanUnassigned } = await supabase
    .from("clean_tasks")
    .select("id, listing_id, reservation_id, scheduled_date, priority, priority_level, cleaning_duration_minutes, checkout_time, checkin_time, is_same_day_turnaround, source, warning_reason")
    .eq("scheduled_date", targetDate)
    .eq("status", "unassigned");

  const orphanListingIds = (orphanUnassigned || []).map((t: any) => String(t.listing_id));

  // 2. Get listings (including bundles so we can expand components)
  const rawListingIds: string[] = Array.from(new Set([
    ...((checkouts || []).map((r: any) => String(r.listing_id))),
    ...orphanListingIds,
  ]));
  if (rawListingIds.length === 0 && (orphanUnassigned || []).length === 0) {
    return { created: 0, unassigned: 0 };
  }


  const { data: rawListings } = await supabase
    .from("listings")
    .select("id, name, location_group, cleaning_duration_minutes, latitude, longitude, is_bundle, bundle_components, default_check_in_time, default_check_out_time")
    .in("id", rawListingIds);

  // Expand bundles → component listing IDs
  const bundleMap = new Map<string, string[]>(); // bundle listing id → component listing ids
  const componentIdsFromBundles: string[] = [];
  for (const l of rawListings || []) {
    if (l.is_bundle && l.bundle_components) {
      const components = (l.bundle_components as any[]) || [];
      const compIds = components.map((c: any) => c.listing_id).filter(Boolean);
      bundleMap.set(l.id, compIds);
      componentIdsFromBundles.push(...compIds);
    }
  }

  // Fetch component listings if needed
  let componentListings: any[] = [];
  if (componentIdsFromBundles.length > 0) {
    const { data } = await supabase
      .from("listings")
      .select("id, name, location_group, cleaning_duration_minutes, latitude, longitude, is_bundle, default_check_in_time, default_check_out_time")
      .in("id", componentIdsFromBundles)
      .eq("is_bundle", false);
    componentListings = data || [];
  }

  // Build final listing map: non-bundle direct checkouts + component listings from bundles
  const allListings = [
    ...(rawListings || []).filter((l: any) => !l.is_bundle),
    ...componentListings,
  ];
  const listingMap = new Map(allListings.map((l: any) => [l.id, l]));

  // Build the effective listing IDs for cleaning (components replace bundles)
  const listingIds: string[] = [];
  for (const id of rawListingIds) {
    if (bundleMap.has(id)) {
      listingIds.push(...bundleMap.get(id)!);
    } else if (listingMap.has(id)) {
      listingIds.push(id);
    }
  }

  // 3. Get next check-ins for priority detection (with check-in time)
  const { data: nextCheckins } = await supabase
    .from("reservations")
    .select("listing_id, check_in, check_in_time")
    .in("listing_id", listingIds)
    .gte("check_in", targetDate)
    .eq("status", "confirmed")
    .order("check_in");

  const nextCheckinMap = new Map<string, { date: string; time: string | null }>();
  for (const r of nextCheckins || []) {
    if (!nextCheckinMap.has(r.listing_id)) {
      nextCheckinMap.set(r.listing_id, { date: r.check_in, time: r.check_in_time });
    }
  }

  // 4. Check existing tasks to avoid duplicates — dedupe by (listing_id, scheduled_date)
  // because Hostaway often returns multiple sibling reservations sharing the same checkout date
  // for the same listing (split stays, channel re-imports, modified bookings). One clean per
  // property per day is the operational truth.
  const { data: existingTasks } = await supabase
    .from("clean_tasks")
    .select("listing_id, reservation_id, scheduled_date")
    .eq("scheduled_date", targetDate);
  const existingByListing = new Set(
    (existingTasks || []).map((t: any) => `${t.listing_id}_${t.scheduled_date}`)
  );
  const existingByReservation = new Set(
    (existingTasks || [])
      .filter((t: any) => t.reservation_id)
      .map((t: any) => `${t.reservation_id}_${t.scheduled_date}`)
  );
  // Keep the historical name available for downstream code that referenced it.
  const existingSet = existingByReservation;

  // 5. Get active cleaners (including home location)
  const { data: cleanersRaw } = await supabase
    .from("cleaners")
    .select("*")
    .eq("active", true);

  // 5b. Load holidays overlapping the target date for these cleaners
  const cleanerIds = (cleanersRaw || []).map((c: any) => c.id);
  const { data: holidaysRaw } = await supabase
    .from("cleaner_holidays")
    .select("cleaner_id, start_date, end_date, reason")
    .in("cleaner_id", cleanerIds.length ? cleanerIds : ["00000000-0000-0000-0000-000000000000"])
    .lte("start_date", targetDate)
    .gte("end_date", targetDate);

  const holidaysByCleaner: Record<string, Array<{ start_date: string; end_date: string; reason: string }>> = {};
  for (const h of holidaysRaw || []) {
    if (!holidaysByCleaner[h.cleaner_id]) holidaysByCleaner[h.cleaner_id] = [];
    holidaysByCleaner[h.cleaner_id].push(h);
  }

  const cleaners: CleanerInfo[] = (cleanersRaw || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    location_groups: c.location_groups || [],
    workload_share: c.workload_share || {},
    non_working_days: c.non_working_days || [],
    daily_working_hours: c.daily_working_hours ?? 8,
    home_latitude: c.home_latitude ?? null,
    home_longitude: c.home_longitude ?? null,
    holidays: holidaysByCleaner[c.id] || [],
  }));

  // 6. Get already-scheduled tasks for today (for capacity calculation)
  const { data: todayExistingTasks } = await supabase
    .from("clean_tasks")
    .select("assigned_cleaner_id, cleaning_duration_minutes, travel_time_from_previous_minutes")
    .eq("scheduled_date", targetDate)
    .not("status", "eq", "cancelled");

  const cleanerScheduledMinutes: Record<string, number> = {};
  const cleanerRegionCount: Record<string, Record<string, number>> = {};

  for (const c of cleaners) {
    cleanerScheduledMinutes[c.id] = 0;
    cleanerRegionCount[c.id] = {};
  }

  for (const t of todayExistingTasks || []) {
    if (t.assigned_cleaner_id && cleanerScheduledMinutes[t.assigned_cleaner_id] !== undefined) {
      cleanerScheduledMinutes[t.assigned_cleaner_id] +=
        (t.cleaning_duration_minutes || 0) + (t.travel_time_from_previous_minutes || 0);
    }
  }

  // 6b. Rolling actual share (last N days, per region) — drives fair-share deficit
  const windowStartDate = new Date(targetDate + "T12:00:00Z");
  windowStartDate.setUTCDate(windowStartDate.getUTCDate() - ROLLING_WINDOW_DAYS);
  const windowStart = windowStartDate.toISOString().slice(0, 10);

  const { data: rollingTasks } = await supabase
    .from("clean_tasks")
    .select("assigned_cleaner_id, listing_id, scheduled_date")
    .gte("scheduled_date", windowStart)
    .lt("scheduled_date", targetDate)
    .not("status", "eq", "cancelled");

  // listing_id -> location_group lookup (use already-loaded listings + fetch unknowns)
  const listingGroupCache = new Map<string, string>();
  for (const l of [...(rawListings || []), ...componentListings]) {
    listingGroupCache.set(l.id, l.location_group || "Other");
  }
  const missingIds = Array.from(new Set(
    (rollingTasks || [])
      .map((t: any) => String(t.listing_id))
      .filter((id: string) => !listingGroupCache.has(id))
  ));
  if (missingIds.length > 0) {
    const { data: extraListings } = await supabase
      .from("listings")
      .select("id, location_group")
      .in("id", missingIds);
    for (const l of extraListings || []) listingGroupCache.set(l.id, l.location_group || "Other");
  }

  // rollingRegionCount[cleanerId][group] / rollingRegionTotal[group]
  const rollingRegionCount: Record<string, Record<string, number>> = {};
  const rollingRegionTotal: Record<string, number> = {};
  for (const c of cleaners) rollingRegionCount[c.id] = {};
  for (const t of rollingTasks || []) {
    const grp = listingGroupCache.get(String(t.listing_id)) || "Other";
    rollingRegionTotal[grp] = (rollingRegionTotal[grp] || 0) + 1;
    if (t.assigned_cleaner_id && rollingRegionCount[t.assigned_cleaner_id]) {
      rollingRegionCount[t.assigned_cleaner_id][grp] =
        (rollingRegionCount[t.assigned_cleaner_id][grp] || 0) + 1;
    }
  }

  function actualSharePct(cleanerId: string, group: string): number {
    const total = (rollingRegionTotal[group] || 0)
      + Object.values(cleanerRegionCount).reduce((s, m) => s + (m[group] || 0), 0);
    if (total === 0) return 0;
    const actual = (rollingRegionCount[cleanerId]?.[group] || 0)
      + (cleanerRegionCount[cleanerId]?.[group] || 0);
    return (actual / total) * 100;
  }

  function isEligibleBase(c: CleanerInfo, task: TaskInfo): boolean {
    if (!c.location_groups.includes(task.location_group)) return false;
    if (c.non_working_days.includes(targetDayOfWeek)) return false;
    // Holiday filter — any holiday range covering targetDate disqualifies
    for (const h of c.holidays) {
      if (targetDate >= h.start_date && targetDate <= h.end_date) return false;
    }
    return true;
  }

  function hasCapacity(c: CleanerInfo, addMins: number): boolean {
    const projected = cleanerScheduledMinutes[c.id] + addMins + 15;
    return projected <= c.daily_working_hours * 60;
  }

  function pickByDeficit(pool: CleanerInfo[], group: string): CleanerInfo | null {
    if (pool.length === 0) return null;
    let best = pool[0];
    let bestDeficit = -Infinity;
    for (const c of pool) {
      const target = c.workload_share[group] ?? 0;
      const actual = actualSharePct(c.id, group);
      const deficit = target - actual;
      // Tie-break: prefer fewer minutes scheduled today
      const score = deficit - cleanerScheduledMinutes[c.id] / 10000;
      if (score > bestDeficit) { bestDeficit = score; best = c; }
    }
    return best;
  }

  // 7. Build new tasks — at most ONE per (listing_id, scheduled_date).
  const newTasks: TaskInfo[] = [];
  const plannedListingDate = new Set<string>();

  for (const r of checkouts || []) {
    const key = `${r.id}_${targetDate}`;
    if (existingSet.has(key)) continue;

    // If this checkout is on a bundle, create tasks for each component instead
    const componentIds = bundleMap.get(r.listing_id);
    const targetListingIds = componentIds && componentIds.length > 0
      ? componentIds
      : [r.listing_id];

    for (const targetLid of targetListingIds) {
      const listing = listingMap.get(targetLid);
      if (!listing) continue;

      // Dedupe: skip if a task for this listing+date already exists in DB or was
      // planned earlier in this run (handles Hostaway returning sibling reservations
      // with the same listing+checkout date).
      const ldKey = `${targetLid}_${targetDate}`;
      if (existingByListing.has(ldKey)) continue;
      if (plannedListingDate.has(ldKey)) continue;
      plannedListingDate.add(ldKey);

      const nextCI = nextCheckinMap.get(targetLid);
      const isSameDay = nextCI?.date === targetDate;
      // P1 = same-day turnaround, P2 = standard checkout
      const priorityLevel = isSameDay ? 1 : 2;
      const priority = isSameDay ? "same_day_turnaround" : "standard";

      // Resolve checkout time: reservation > listing default > 10:00
      const checkoutTime = normaliseTime(
        r.check_out_time,
        normaliseTime(listing.default_check_out_time, DEFAULT_CHECKOUT)
      );
      // Next checkin time only matters when same-day; resolve from next reservation > listing default > 15:00
      const checkinTime = isSameDay
        ? normaliseTime(
            nextCI?.time,
            normaliseTime(listing.default_check_in_time, DEFAULT_CHECKIN)
          )
        : null;

      newTasks.push({
        listing_id: targetLid,
        reservation_id: r.id,
        scheduled_date: targetDate,
        priority,
        priority_level: priorityLevel,
        cleaning_duration_minutes: listing.cleaning_duration_minutes || 90,
        latitude: listing.latitude,
        longitude: listing.longitude,
        location_group: listing.location_group || "Other",
        assigned_cleaner_id: null,
        status: "unassigned",
        estimated_start_time: null,
        travel_time_from_previous_minutes: 0,
        checkout_time: checkoutTime,
        checkin_time: checkinTime,
        is_same_day_turnaround: isSameDay,
      });
    }
  }

  // 7b. Add pre-existing unassigned tasks into the allocation pool so they get re-evaluated.
  // Orphan-promoted carryovers (set above) will arrive here as priority_level=0 (P0).
  for (const orphan of orphanUnassigned || []) {
    const listing = listingMap.get(String(orphan.listing_id));
    if (!listing) continue;
    // Trust an explicit priority_level on the row; otherwise infer from priority text.
    let lvl: number = typeof orphan.priority_level === "number" ? orphan.priority_level : 2;
    if (orphan.priority === "arrival_risk_orphan") lvl = 0;
    else if (orphan.priority === "same_day_turnaround") lvl = 1;
    else if (orphan.priority === "orphan_gap_fill") lvl = 3;
    newTasks.push({
      listing_id: String(orphan.listing_id),
      reservation_id: orphan.reservation_id ?? null,
      scheduled_date: orphan.scheduled_date,
      priority: orphan.priority || "standard",
      priority_level: lvl,
      cleaning_duration_minutes: orphan.cleaning_duration_minutes || listing.cleaning_duration_minutes || 90,
      latitude: listing.latitude,
      longitude: listing.longitude,
      location_group: listing.location_group || "Other",
      assigned_cleaner_id: null,
      status: "unassigned",
      estimated_start_time: null,
      travel_time_from_previous_minutes: 0,
      checkout_time: normaliseTime(orphan.checkout_time, normaliseTime(listing.default_check_out_time, DEFAULT_CHECKOUT)),
      checkin_time: orphan.checkin_time ? normaliseTime(orphan.checkin_time, DEFAULT_CHECKIN) : null,
      is_same_day_turnaround: !!orphan.is_same_day_turnaround,
      existing_task_id: orphan.id,
      source: orphan.source || "hostaway",
      warning_reason: orphan.warning_reason ?? null,
    });
  }

  // Sort by priority level: P0 first, then P1, P2, P3
  newTasks.sort((a, b) => a.priority_level - b.priority_level);


  // 8. Allocate cleaners — fair-share deficit + nearby-property clustering.
  let unassignedCount = 0;
  const overloadFlags: Array<{ cleaner_id: string; cluster_size: number; group: string }> = [];

  const cleanerBuckets: Record<string, TaskInfo[]> = {};
  for (const c of cleaners) cleanerBuckets[c.id] = [];

  // Same-day turnarounds were already sorted to the front of newTasks.
  // Group remaining tasks by location_group, build geo-clusters within each group.
  const tasksByGroup: Record<string, TaskInfo[]> = {};
  for (const t of newTasks) {
    const g = t.location_group || "Other";
    if (!tasksByGroup[g]) tasksByGroup[g] = [];
    tasksByGroup[g].push(t);
  }

  // Greedy proximity clustering (≤ CLUSTER_RADIUS_KM)
  function clusterByProximity(tasks: TaskInfo[]): TaskInfo[][] {
    const clusters: TaskInfo[][] = [];
    const remaining = [...tasks];
    while (remaining.length > 0) {
      const seed = remaining.shift()!;
      const cluster = [seed];
      for (let i = remaining.length - 1; i >= 0; i--) {
        const t = remaining[i];
        if (t.latitude == null || t.longitude == null || seed.latitude == null || seed.longitude == null) {
          // No coords → cluster by group only (treat as same cluster as seed)
          cluster.push(t);
          remaining.splice(i, 1);
          continue;
        }
        const d = haversineKm(seed.latitude, seed.longitude, t.latitude, t.longitude);
        if (d <= CLUSTER_RADIUS_KM) {
          cluster.push(t);
          remaining.splice(i, 1);
        }
      }
      clusters.push(cluster);
    }
    return clusters;
  }

  function assignTaskTo(cleanerOrNull: CleanerInfo | null, task: TaskInfo, overload = false): boolean {
    if (!cleanerOrNull) {
      unassignedCount++;
      return false;
    }
    task.assigned_cleaner_id = cleanerOrNull.id;
    task.status = "scheduled";
    if (overload) {
      task.overloaded = true;
      task.warning_reason = "Only eligible cleaner for nearby cluster — workload exceeds soft cap";
    } else {
      task.overloaded = false;
      task.warning_reason = null;
    }
    cleanerBuckets[cleanerOrNull.id].push(task);
    cleanerScheduledMinutes[cleanerOrNull.id] += task.cleaning_duration_minutes + 15;
    cleanerRegionCount[cleanerOrNull.id][task.location_group] =
      (cleanerRegionCount[cleanerOrNull.id][task.location_group] ?? 0) + 1;
    return true;
  }

  for (const [group, groupTasks] of Object.entries(tasksByGroup)) {
    const clusters = clusterByProximity(groupTasks);

    for (const cluster of clusters) {
      // Base eligibility (region + non-working + holiday) — capacity checked per-task or per-cluster
      const baseEligible = cleaners.filter((c) => isEligibleBase(c, cluster[0]));

      if (baseEligible.length === 0) {
        for (const t of cluster) assignTaskTo(null, t);
        continue;
      }

      // Sole-cleaner-region case → assign cluster to that cleaner, flag overload if 4+
      if (baseEligible.length === 1) {
        const sole = baseEligible[0];
        for (const t of cluster) assignTaskTo(sole, t, cluster.length > CLUSTER_SOFT_MAX);
        if (cluster.length > CLUSTER_SOFT_MAX) {
          overloadFlags.push({ cleaner_id: sole.id, cluster_size: cluster.length, group });
        }
        continue;
      }

      if (cluster.length <= CLUSTER_SOFT_MAX) {
        // Try one cleaner for the whole cluster
        const totalMins = cluster.reduce((s, t) => s + t.cleaning_duration_minutes + 15, 0);
        const capable = baseEligible.filter((c) => hasCapacity(c, totalMins - 15));
        const pick = pickByDeficit(capable.length > 0 ? capable : baseEligible, group);
        if (pick && capable.length > 0) {
          for (const t of cluster) assignTaskTo(pick, t);
        } else {
          // Fall back: assign each task individually by deficit + capacity
          for (const t of cluster) {
            const elig = baseEligible.filter((c) => hasCapacity(c, t.cleaning_duration_minutes));
            assignTaskTo(pickByDeficit(elig.length > 0 ? elig : baseEligible, group), t);
          }
        }
      } else {
        // 4+ → split: assign each task to the current largest-deficit cleaner with capacity
        for (const t of cluster) {
          const elig = baseEligible.filter((c) => hasCapacity(c, t.cleaning_duration_minutes));
          assignTaskTo(pickByDeficit(elig.length > 0 ? elig : baseEligible, group), t);
        }
      }
    }
  }


  // 9. Route-optimise each cleaner's tasks: cluster by location group, then sequence
  for (const c of cleaners) {
    const tasks = cleanerBuckets[c.id];
    if (tasks.length === 0) continue;

    const homeLat = c.home_latitude;
    const homeLon = c.home_longitude;

    if (tasks.length === 1) {
      const travel = travelMinutes(homeLat, homeLon, tasks[0].latitude, tasks[0].longitude);
      tasks[0].travel_time_from_previous_minutes = travel;
      tasks[0].estimated_start_time = addMinutesToTime(tasks[0].checkout_time, travel);
      continue;
    }

    // Step A: Group tasks by location_group
    const clusters: Record<string, TaskInfo[]> = {};
    for (const t of tasks) {
      const key = t.location_group || "Other";
      if (!clusters[key]) clusters[key] = [];
      clusters[key].push(t);
    }

    // Step B: Order clusters by proximity to home (centroid of each cluster)
    const clusterKeys = Object.keys(clusters);
    const clusterCentroids = clusterKeys.map(key => {
      const group = clusters[key];
      const avgLat = group.reduce((s, t) => s + (t.latitude ?? 54.35), 0) / group.length;
      const avgLon = group.reduce((s, t) => s + (t.longitude ?? -7.64), 0) / group.length;
      return { key, avgLat, avgLon };
    });

    // Order clusters: nearest-next from home
    const orderedClusters: typeof clusterCentroids = [];
    const remainingClusters = [...clusterCentroids];
    let currentLat = homeLat ?? 54.35;
    let currentLon = homeLon ?? -7.64;

    while (remainingClusters.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remainingClusters.length; i++) {
        const d = haversineKm(currentLat, currentLon, remainingClusters[i].avgLat, remainingClusters[i].avgLon);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const picked = remainingClusters.splice(bestIdx, 1)[0];
      orderedClusters.push(picked);
      currentLat = picked.avgLat;
      currentLon = picked.avgLon;
    }

    // Step C: Within each cluster, do nearest-next from the entry point
    const ordered: TaskInfo[] = [];
    let entryLat = homeLat ?? 54.35;
    let entryLon = homeLon ?? -7.64;

    for (const cluster of orderedClusters) {
      const group = [...clusters[cluster.key]];
      // Nearest-next within the cluster
      while (group.length > 0) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < group.length; i++) {
          const d = haversineKm(entryLat, entryLon, group[i].latitude ?? 54.35, group[i].longitude ?? -7.64);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        const picked = group.splice(bestIdx, 1)[0];
        ordered.push(picked);
        entryLat = picked.latitude ?? 54.35;
        entryLon = picked.longitude ?? 54.35;
      }
    }

    // Step D: Check if reversing the last cluster puts cleaner closer to home
    if (orderedClusters.length >= 2) {
      const lastClusterKey = orderedClusters[orderedClusters.length - 1].key;
      const lastTask = ordered[ordered.length - 1];
      const homeDistCurrent = haversineKm(lastTask.latitude ?? 54.35, lastTask.longitude ?? -7.64, homeLat ?? 54.35, homeLon ?? -7.64);
      // Find first task of last cluster
      const lastClusterStart = ordered.findIndex(t => t.location_group === lastClusterKey);
      if (lastClusterStart >= 0) {
        const firstOfLastCluster = ordered[lastClusterStart];
        const homeDistReversed = haversineKm(firstOfLastCluster.latitude ?? 54.35, firstOfLastCluster.longitude ?? -7.64, homeLat ?? 54.35, homeLon ?? -7.64);
        if (homeDistReversed < homeDistCurrent) {
          // Reverse the last cluster portion
          const prefix = ordered.slice(0, lastClusterStart);
          const suffix = ordered.slice(lastClusterStart).reverse();
          ordered.length = 0;
          ordered.push(...prefix, ...suffix);
        }
      }
    }

    // Step E: Calculate travel times and estimated start times.
    // P0 carryovers (level 0) may start before checkout — property is already empty.
    // The earliest morning start is 08:00.
    const P0_EARLIEST = "08:00";
    function earliestStartFor(t: TaskInfo, arrival: string): string {
      if (t.priority_level === 0) {
        return arrival >= P0_EARLIEST ? arrival : P0_EARLIEST;
      }
      return arrival >= t.checkout_time ? arrival : t.checkout_time;
    }

    const firstTravel = travelMinutes(homeLat, homeLon, ordered[0].latitude, ordered[0].longitude);
    ordered[0].travel_time_from_previous_minutes = firstTravel;
    const firstArrival = addMinutesToTime(
      ordered[0].priority_level === 0 ? P0_EARLIEST : ordered[0].checkout_time,
      firstTravel
    );
    ordered[0].estimated_start_time = earliestStartFor(ordered[0], firstArrival);

    let currentTime = addMinutesToTime(ordered[0].estimated_start_time, ordered[0].cleaning_duration_minutes);

    for (let i = 1; i < ordered.length; i++) {
      const travel = travelMinutes(
        ordered[i - 1].latitude, ordered[i - 1].longitude,
        ordered[i].latitude, ordered[i].longitude
      );
      ordered[i].travel_time_from_previous_minutes = travel;
      const arrivalAfterTravel = addMinutesToTime(currentTime, travel);
      ordered[i].estimated_start_time = earliestStartFor(ordered[i], arrivalAfterTravel);
      currentTime = addMinutesToTime(ordered[i].estimated_start_time, ordered[i].cleaning_duration_minutes);
    }

    // Step F: STO completion-window check. For same-day turnaround tasks,
    // flag if the projected finish time runs past the guest check-in time.
    for (const t of ordered) {
      if (t.is_same_day_turnaround && t.checkin_time && t.estimated_start_time) {
        const finish = addMinutesToTime(t.estimated_start_time, t.cleaning_duration_minutes);
        if (finish > t.checkin_time) {
          t.overloaded = true;
          t.warning_reason = `Tight window — projected finish ${finish} is after guest check-in ${t.checkin_time}`;
        }
      }
    }

    cleanerBuckets[c.id] = ordered;
  }

  // 10. Insert new tasks / update existing orphan unassigned tasks
  const allOrderedTasks = Object.values(cleanerBuckets).flat();
  const unassignedTasks = newTasks.filter(t => t.status === "unassigned");
  const allTasks = [...allOrderedTasks, ...unassignedTasks];

  // Split: rows with existing_task_id → UPDATE, others → INSERT
  const toInsert = allTasks.filter(t => !t.existing_task_id);
  const toUpdate = allTasks.filter(t => !!t.existing_task_id);
  let createdCount = 0;

  if (toInsert.length > 0) {
    const rows = toInsert.map((t) => ({
      listing_id: t.listing_id,
      reservation_id: t.reservation_id,
      scheduled_date: t.scheduled_date,
      assigned_cleaner_id: t.assigned_cleaner_id,
      status: t.status,
      priority: t.priority,
      priority_level: t.priority_level,
      estimated_start_time: t.estimated_start_time,
      cleaning_duration_minutes: t.cleaning_duration_minutes,
      travel_time_from_previous_minutes: t.travel_time_from_previous_minutes,
      checkout_time: t.checkout_time,
      checkin_time: t.checkin_time,
      is_same_day_turnaround: t.is_same_day_turnaround,
      notes: t.notes ?? null,
      overloaded: t.overloaded ?? false,
      override_assignment: t.override_assignment ?? false,
      warning_reason: t.warning_reason ?? null,
      source: t.source ?? "hostaway",

    }));
    const { error: insertErr } = await supabase.from("clean_tasks").insert(rows);
    if (insertErr) throw insertErr;
    createdCount = rows.length;
  }

  for (const t of toUpdate) {
    const { error: updErr } = await supabase
      .from("clean_tasks")
      .update({
        assigned_cleaner_id: t.assigned_cleaner_id,
        status: t.status,
        priority: t.priority,
        priority_level: t.priority_level,
        estimated_start_time: t.estimated_start_time,
        travel_time_from_previous_minutes: t.travel_time_from_previous_minutes,
        checkout_time: t.checkout_time,
        ...(t.notes ? { notes: t.notes } : {}),
        overloaded: t.overloaded ?? false,
        warning_reason: t.warning_reason ?? null,
      })
      .eq("id", t.existing_task_id!);
    if (updErr) throw updErr;
  }

  // 11. Set is_clean = false for component listings (not bundles)
  const dirtyIds = [...new Set(listingIds)];
  if (dirtyIds.length > 0) {
    const { error: updateErr } = await supabase
      .from("listings")
      .update({ is_clean: false })
      .in("id", dirtyIds)
      .eq("is_bundle", false);
    if (updateErr) throw updateErr;
  }

  return { created: createdCount, unassigned: unassignedCount };
}

function todayLondon(): string {
  const now = new Date();
  const londonStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return londonStr;
}