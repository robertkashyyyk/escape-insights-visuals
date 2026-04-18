import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const AVG_SPEED_KMH = 40;
const DEFAULT_CHECKOUT = "10:00";
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

interface TaskInfo {
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

interface CleanerInfo {
  id: string;
  name: string;
  location_groups: string[];
  workload_share: Record<string, number>;
  non_working_days: string[];
  daily_working_hours: number;
  home_latitude: number | null;
  home_longitude: number | null;
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
      .eq("status", "confirmed");
    if (coErr) throw coErr;

    // 2. Get listings (including bundles so we can expand components)
    const rawListingIds = [...new Set((checkouts || []).map((r: any) => r.listing_id))];
    if (rawListingIds.length === 0) {
      await supabase.from("automation_logs").insert({
        tasks_created: 0, tasks_unassigned: 0, status: "success", triggered_by: "edge_function",
      });
      return new Response(JSON.stringify({ tasks_created: 0, tasks_unassigned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rawListings } = await supabase
      .from("listings")
      .select("id, name, location_group, cleaning_duration_minutes, latitude, longitude, is_bundle, bundle_components")
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
        .select("id, name, location_group, cleaning_duration_minutes, latitude, longitude, is_bundle")
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

    // 3. Get next check-ins for priority detection
    const { data: nextCheckins } = await supabase
      .from("reservations")
      .select("listing_id, check_in")
      .in("listing_id", listingIds)
      .gte("check_in", targetDate)
      .eq("status", "confirmed")
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

    // 5. Get active cleaners (including home location)
    const { data: cleanersRaw } = await supabase
      .from("cleaners")
      .select("*")
      .eq("active", true);
    const cleaners: CleanerInfo[] = (cleanersRaw || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      location_groups: c.location_groups || [],
      workload_share: c.workload_share || {},
      non_working_days: c.non_working_days || [],
      daily_working_hours: c.daily_working_hours ?? 8,
      home_latitude: c.home_latitude ?? null,
      home_longitude: c.home_longitude ?? null,
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

    // 7. Build new tasks
    const newTasks: TaskInfo[] = [];

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

        const nextCI = nextCheckinMap.get(targetLid);
        const isSameDay = nextCI === targetDate;
        const priority = isSameDay ? "same_day_turnaround" : "standard";

        newTasks.push({
          listing_id: targetLid,
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
    }

    // Sort: same-day turnarounds first
    newTasks.sort((a, b) => {
      if (a.priority === "same_day_turnaround" && b.priority !== "same_day_turnaround") return -1;
      if (b.priority === "same_day_turnaround" && a.priority !== "same_day_turnaround") return 1;
      return 0;
    });

    // 8. Allocate cleaners — group tasks by eligible cleaner pool, then sequence per cleaner
    let unassignedCount = 0;

    // Per-cleaner task buckets for route optimisation
    const cleanerBuckets: Record<string, TaskInfo[]> = {};
    for (const c of cleaners) cleanerBuckets[c.id] = [];

    for (const task of newTasks) {
      const eligible = cleaners.filter((c) => {
        if (!c.location_groups.includes(task.location_group)) return false;
        if (c.non_working_days.includes(targetDayOfWeek)) return false;
        // Rough capacity check (will refine after route ordering)
        const projected = cleanerScheduledMinutes[c.id] + task.cleaning_duration_minutes + 15; // 15 min est travel
        const maxMins = c.daily_working_hours * 60;
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
          (s, ec) => s + (cleanerRegionCount[ec.id]?.[task.location_group] ?? 0),
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

      task.assigned_cleaner_id = best.id;
      task.status = "scheduled";
      cleanerBuckets[best.id].push(task);
      cleanerScheduledMinutes[best.id] += task.cleaning_duration_minutes + 15;
      cleanerRegionCount[best.id][task.location_group] =
        (cleanerRegionCount[best.id][task.location_group] ?? 0) + 1;
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
        tasks[0].estimated_start_time = addMinutesToTime(DEFAULT_CHECKOUT, travel);
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

      // Step E: Calculate travel times and estimated start times
      const firstTravel = travelMinutes(homeLat, homeLon, ordered[0].latitude, ordered[0].longitude);
      ordered[0].travel_time_from_previous_minutes = firstTravel;
      ordered[0].estimated_start_time = addMinutesToTime(DEFAULT_CHECKOUT, firstTravel);

      let currentTime = addMinutesToTime(DEFAULT_CHECKOUT, firstTravel + ordered[0].cleaning_duration_minutes);

      for (let i = 1; i < ordered.length; i++) {
        const travel = travelMinutes(
          ordered[i - 1].latitude, ordered[i - 1].longitude,
          ordered[i].latitude, ordered[i].longitude
        );
        ordered[i].travel_time_from_previous_minutes = travel;
        ordered[i].estimated_start_time = addMinutesToTime(currentTime, travel);
        currentTime = addMinutesToTime(currentTime, travel + ordered[i].cleaning_duration_minutes);
      }

      cleanerBuckets[c.id] = ordered;
    }

    // 10. Insert tasks
    const allOrderedTasks = Object.values(cleanerBuckets).flat();
    // Also include unassigned tasks
    const unassignedTasks = newTasks.filter(t => t.status === "unassigned");
    const allTasks = [...allOrderedTasks, ...unassignedTasks];

    if (allTasks.length > 0) {
      const rows = allTasks.map((t) => ({
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

    // 12. Log the run
    await supabase.from("automation_logs").insert({
      tasks_created: allTasks.length,
      tasks_unassigned: unassignedCount,
      status: "success",
      triggered_by: "edge_function",
    });

    return new Response(
      JSON.stringify({
        tasks_created: allTasks.length,
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
  const londonStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return londonStr;
}