import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const AVG_SPEED_KMH = 40;
const DEFAULT_CHECKOUT = "10:00";
const DEFAULT_CHECKIN = "15:00";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Accept optional date param; default to today in Europe/London
    let targetDate: string;
    try {
      const body = await req.json();
      targetDate = body.date || todayLondon();
    } catch {
      targetDate = todayLondon();
    }

    const targetDayOfWeek = DAY_NAMES[new Date(targetDate + "T12:00:00Z").getDay()];

    // 1. Get checkouts for target date
    const { data: checkouts, error: coErr } = await supabase
      .from("reservations")
      .select("id, listing_id, check_in, check_out, status")
      .eq("check_out", targetDate)
      .not("status", "in", '("cancelled","declined")');
    if (coErr) throw coErr;

    // 2. Get listings
    const listingIds = [...new Set((checkouts || []).map((r: any) => r.listing_id))];
    if (listingIds.length === 0) {
      // Log empty run
      await supabase.from("automation_logs").insert({
        tasks_created: 0, tasks_unassigned: 0, status: "success", triggered_by: "edge_function",
      });
      return new Response(JSON.stringify({ tasks_created: 0, tasks_unassigned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: listings } = await supabase
      .from("listings")
      .select("id, name, location_group, cleaning_duration_minutes, latitude, longitude")
      .in("id", listingIds);
    const listingMap = new Map((listings || []).map((l: any) => [l.id, l]));

    // 3. Get next check-ins for priority detection
    const { data: nextCheckins } = await supabase
      .from("reservations")
      .select("listing_id, check_in")
      .in("listing_id", listingIds)
      .gte("check_in", targetDate)
      .not("status", "in", '("cancelled","declined")')
      .order("check_in");

    const nextCheckinMap = new Map<string, string>();
    for (const r of nextCheckins || []) {
      if (!nextCheckinMap.has(r.listing_id)) {
        nextCheckinMap.set(r.listing_id, r.check_in);
      }
    }

    // 4. Check existing tasks to avoid duplicates
    const reservationIds = (checkouts || []).map((r: any) => r.id);
    const { data: existingTasks } = await supabase
      .from("clean_tasks")
      .select("reservation_id, scheduled_date")
      .in("reservation_id", reservationIds)
      .eq("scheduled_date", targetDate);
    const existingSet = new Set(
      (existingTasks || []).map((t: any) => `${t.reservation_id}_${t.scheduled_date}`)
    );

    // 5. Get active cleaners
    const { data: cleanersRaw } = await supabase
      .from("cleaners")
      .select("*")
      .eq("active", true);
    const cleaners = (cleanersRaw || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      location_groups: c.location_groups || [],
      workload_share: c.workload_share || {},
      non_working_days: c.non_working_days || [],
      daily_working_hours: c.daily_working_hours ?? 8,
      latitude: null as number | null,
      longitude: null as number | null,
    }));

    // 6. Get already-scheduled tasks for today (for capacity calculation)
    const { data: todayExistingTasks } = await supabase
      .from("clean_tasks")
      .select("assigned_cleaner_id, cleaning_duration_minutes, travel_time_from_previous_minutes")
      .eq("scheduled_date", targetDate)
      .not("status", "eq", "cancelled");

    const cleanerScheduledMinutes: Record<string, number> = {};
    const cleanerTaskList: Record<string, Array<{ latitude: number | null; longitude: number | null }>> = {};
    const cleanerRegionCount: Record<string, Record<string, number>> = {};

    for (const c of cleaners) {
      cleanerScheduledMinutes[c.id] = 0;
      cleanerTaskList[c.id] = [];
      cleanerRegionCount[c.id] = {};
    }

    // Account for existing tasks
    for (const t of todayExistingTasks || []) {
      if (t.assigned_cleaner_id && cleanerScheduledMinutes[t.assigned_cleaner_id] !== undefined) {
        cleanerScheduledMinutes[t.assigned_cleaner_id] +=
          (t.cleaning_duration_minutes || 0) + (t.travel_time_from_previous_minutes || 0);
      }
    }

    // 7. Build new tasks
    interface NewTask {
      listing_id: string;
      reservation_id: string;
      scheduled_date: string;
      priority: string;
      cleaning_duration_minutes: number;
      latitude: number | null;
      longitude: number | null;
      location_group: string;
      assigned_cleaner_id: string | null;
      status: string;
      estimated_start_time: string | null;
      travel_time_from_previous_minutes: number;
    }

    const newTasks: NewTask[] = [];

    for (const r of checkouts || []) {
      const key = `${r.id}_${targetDate}`;
      if (existingSet.has(key)) continue;

      const listing = listingMap.get(r.listing_id);
      if (!listing) continue;

      const nextCI = nextCheckinMap.get(r.listing_id);
      const isSameDay = nextCI === targetDate;
      const priority = isSameDay ? "same_day_turnaround" : "standard";

      newTasks.push({
        listing_id: r.listing_id,
        reservation_id: r.id,
        scheduled_date: targetDate,
        priority,
        cleaning_duration_minutes: listing.cleaning_duration_minutes || 90,
        latitude: listing.latitude,
        longitude: listing.longitude,
        location_group: listing.location_group || "Other",
        assigned_cleaner_id: null,
        status: "unassigned",
        estimated_start_time: null,
        travel_time_from_previous_minutes: 0,
      });
    }

    // Sort: same-day turnarounds first
    newTasks.sort((a, b) => {
      if (a.priority === "same_day_turnaround" && b.priority !== "same_day_turnaround") return -1;
      if (b.priority === "same_day_turnaround" && a.priority !== "same_day_turnaround") return 1;
      return 0;
    });

    // 8. Allocate cleaners
    let unassignedCount = 0;

    for (const task of newTasks) {
      const eligible = cleaners.filter((c: any) => {
        if (!c.location_groups.includes(task.location_group)) return false;
        if (c.non_working_days.includes(targetDayOfWeek)) return false;

        const lastTask = cleanerTaskList[c.id]?.[cleanerTaskList[c.id].length - 1];
        const travel = lastTask
          ? travelMinutes(lastTask.latitude, lastTask.longitude, task.latitude, task.longitude)
          : 0;
        const projected = cleanerScheduledMinutes[c.id] + travel + task.cleaning_duration_minutes;
        const maxMins = (c.daily_working_hours ?? 8) * 60;
        return projected <= maxMins;
      });

      if (eligible.length === 0) {
        unassignedCount++;
        continue;
      }

      // Pick cleaner with lowest workload share for this region
      let best = eligible[0];
      let bestDeficit = -Infinity;
      for (const c of eligible) {
        const targetShare = c.workload_share[task.location_group] ?? 100;
        const totalInRegion = eligible.reduce(
          (s: number, ec: any) => s + (cleanerRegionCount[ec.id]?.[task.location_group] ?? 0),
          0
        );
        const actual = totalInRegion > 0
          ? ((cleanerRegionCount[c.id]?.[task.location_group] ?? 0) / totalInRegion) * 100
          : 0;
        const deficit = targetShare - actual;
        if (deficit > bestDeficit) {
          bestDeficit = deficit;
          best = c;
        }
      }

      const lastTask = cleanerTaskList[best.id]?.[cleanerTaskList[best.id].length - 1];
      const travel = lastTask
        ? travelMinutes(lastTask.latitude, lastTask.longitude, task.latitude, task.longitude)
        : 0;

      // Calculate estimated start time
      const totalBefore = cleanerScheduledMinutes[best.id];
      const startTime = addMinutesToTime(DEFAULT_CHECKOUT, totalBefore + travel);

      task.assigned_cleaner_id = best.id;
      task.status = "scheduled";
      task.estimated_start_time = startTime;
      task.travel_time_from_previous_minutes = travel;

      cleanerScheduledMinutes[best.id] += travel + task.cleaning_duration_minutes;
      cleanerTaskList[best.id].push({ latitude: task.latitude, longitude: task.longitude });
      cleanerRegionCount[best.id][task.location_group] =
        (cleanerRegionCount[best.id][task.location_group] ?? 0) + 1;
    }

    // 9. Insert tasks
    if (newTasks.length > 0) {
      const rows = newTasks.map((t) => ({
        listing_id: t.listing_id,
        reservation_id: t.reservation_id,
        scheduled_date: t.scheduled_date,
        assigned_cleaner_id: t.assigned_cleaner_id,
        status: t.status,
        priority: t.priority,
        estimated_start_time: t.estimated_start_time,
        cleaning_duration_minutes: t.cleaning_duration_minutes,
        travel_time_from_previous_minutes: t.travel_time_from_previous_minutes,
      }));

      const { error: insertErr } = await supabase.from("clean_tasks").insert(rows);
      if (insertErr) throw insertErr;
    }

    // 10. Set is_clean = false for all checkout listings
    if (listingIds.length > 0) {
      const { error: updateErr } = await supabase
        .from("listings")
        .update({ is_clean: false })
        .in("id", listingIds);
      if (updateErr) throw updateErr;
    }

    // 11. Log the run
    await supabase.from("automation_logs").insert({
      tasks_created: newTasks.length,
      tasks_unassigned: unassignedCount,
      status: "success",
      triggered_by: "edge_function",
    });

    return new Response(
      JSON.stringify({
        tasks_created: newTasks.length,
        tasks_unassigned: unassignedCount,
        date: targetDate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Schedule generation error:", err);

    await supabase.from("automation_logs").insert({
      tasks_created: 0,
      tasks_unassigned: 0,
      status: "error",
      error_message: (err as Error).message,
      triggered_by: "edge_function",
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function todayLondon(): string {
  const now = new Date();
  // Simple Europe/London approximation — use Intl for accurate TZ
  const londonStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return londonStr; // Returns YYYY-MM-DD
}
