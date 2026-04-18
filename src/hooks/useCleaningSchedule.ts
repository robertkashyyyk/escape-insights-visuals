import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";

/* ── types ── */
export type Priority = "SAME_DAY" | "TIGHT_WINDOW" | "STANDARD";
export type TaskStatus = "unassigned" | "scheduled" | "in_progress" | "complete";

export interface CleanTask {
  id: string;
  listingId: string;
  propertyName: string;
  locationGroup: string;
  checkoutDate: string;
  checkoutTime: string;
  nextCheckinDate: string | null;
  nextCheckinTime: string | null;
  cleaningDuration: number;
  assignedCleanerId: string | null;
  assignedCleanerName: string | null;
  status: TaskStatus;
  priority: Priority;
  reason?: string;
  latitude: number | null;
  longitude: number | null;
  estimatedStart?: string;
  travelMinutes?: number;
  reservationId?: string;
  dbTaskId?: string; // actual clean_tasks.id from DB
}

export interface CleanerDay {
  id: string;
  name: string;
  dailyWorkingHours: number;
  totalScheduledMinutes: number;
  tasks: CleanTask[];
  homeLatitude: number | null;
  homeLongitude: number | null;
  homeToFirstMinutes?: number;
  lastToHomeMinutes?: number;
}

export interface WeekDaySummary {
  date: string;
  dayLabel: string;
  totalCleans: number;
  totalMinutes: number;
}

interface Cleaner {
  id: string;
  name: string;
  location_groups: string[];
  workload_share: Record<string, number>;
  non_working_days: string[];
  daily_working_hours: number;
  rate_per_clean: number;
  active: boolean;
  home_latitude: number | null;
  home_longitude: number | null;
}

interface Listing {
  id: string;
  name: string;
  location_group: string | null;
  cleaning_duration_minutes: number | null;
  latitude: number | null;
  longitude: number | null;
  default_check_in_time: string | null;
  default_check_out_time: string | null;
}

interface Reservation {
  id: string;
  listing_id: string;
  check_in: string;
  check_out: string;
  status: string;
  guest_name: string;
  check_in_time: string | null;
  check_out_time: string | null;
}

/* ── helpers ── */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_CHECKOUT = "10:00";
const DEFAULT_CHECKIN = "15:00";
const AVG_SPEED_KMH = 40;

function normaliseTime(t: string | null | undefined, fallback: string): string {
  if (!t) return fallback;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function travelMinutes(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 15;
  const km = haversineKm(lat1, lon1, lat2, lon2);
  return Math.round((km / AVG_SPEED_KMH) * 60);
}

function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/* ── hook ── */
export function useCleaningSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [filterCleaner, setFilterCleaner] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Date range for queries
  const rangeStart = viewMode === "week" ? startOfWeek(selectedDate, { weekStartsOn: 1 }) : selectedDate;
  const rangeEnd = viewMode === "week" ? endOfWeek(selectedDate, { weekStartsOn: 1 }) : selectedDate;
  const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
  const rangeEndStr = format(rangeEnd, "yyyy-MM-dd");
  const lookAheadStr = format(addDays(rangeEnd, 7), "yyyy-MM-dd");

  const { data: cleaners = [] } = useQuery({
    queryKey: ["cleaners-schedule"],
    queryFn: async () => {
      const { data } = await supabase.from("cleaners" as any).select("*").eq("active", true).order("name");
      return ((data || []) as any[]).map((c): Cleaner => ({
        id: c.id,
        name: c.name,
        location_groups: c.location_groups || [],
        workload_share: c.workload_share || {},
        non_working_days: c.non_working_days || [],
        daily_working_hours: c.daily_working_hours ?? 8,
        rate_per_clean: c.rate_per_clean ?? 0,
        active: c.active,
        home_latitude: c.home_latitude ?? null,
        home_longitude: c.home_longitude ?? null,
      }));
    },
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["listings-schedule"],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, name, location_group, cleaning_duration_minutes, latitude, longitude, default_check_in_time, default_check_out_time")
        .eq("status", "active");
      return (data || []) as Listing[];
    },
  });

  // Query DB clean_tasks for the date range
  const { data: dbCleanTasks = [] } = useQuery({
    queryKey: ["clean-tasks", rangeStartStr, rangeEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("clean_tasks" as any)
        .select("*")
        .gte("scheduled_date", rangeStartStr)
        .lte("scheduled_date", rangeEndStr);
      return (data || []) as any[];
    },
  });

  const { data: checkoutReservations = [] } = useQuery({
    queryKey: ["reservations-checkouts", rangeStartStr, rangeEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("reservations")
        .select("id, listing_id, check_in, check_out, status, guest_name, check_in_time, check_out_time")
        .gte("check_out", rangeStartStr)
        .lte("check_out", rangeEndStr)
        .eq("status", "confirmed")
        .order("check_out");
      return (data || []) as Reservation[];
    },
  });

  const { data: checkinReservations = [] } = useQuery({
    queryKey: ["reservations-checkins", rangeStartStr, lookAheadStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("reservations")
        .select("id, listing_id, check_in, check_out, status, guest_name, check_in_time, check_out_time")
        .gte("check_in", rangeStartStr)
        .lte("check_in", lookAheadStr)
        .eq("status", "confirmed")
        .order("check_in");
      return (data || []) as Reservation[];
    },
  });

  const listingMap = useMemo(() => {
    const m = new Map<string, Listing>();
    listings.forEach(l => m.set(l.id, l));
    return m;
  }, [listings]);

  const cleanerMap = useMemo(() => {
    const m = new Map<string, Cleaner>();
    cleaners.forEach(c => m.set(c.id, c));
    return m;
  }, [cleaners]);

  // Build schedule for a specific date — use DB tasks if available, otherwise compute
  const buildDaySchedule = useCallback((date: Date): { tasks: CleanTask[]; cleanerDays: CleanerDay[]; unassigned: CleanTask[] } => {
    const ds = format(date, "yyyy-MM-dd");
    const dayName = DAY_NAMES[date.getDay()];

    // Check if we have DB tasks for this date
    const dbTasksForDate = dbCleanTasks.filter((t: any) => t.scheduled_date === ds);

    if (dbTasksForDate.length > 0) {
      // Use DB tasks
      const tasks: CleanTask[] = dbTasksForDate.map((t: any) => {
        const listing = listingMap.get(t.listing_id);
        const cleaner = t.assigned_cleaner_id ? cleanerMap.get(t.assigned_cleaner_id) : null;
        const checkout = checkoutReservations.find(r => r.id === t.reservation_id);
        const nextCheckIn = checkinReservations
          .filter(nr => nr.listing_id === t.listing_id && nr.check_in >= ds && nr.id !== t.reservation_id)
          .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];

        return {
          id: t.id,
          dbTaskId: t.id,
          listingId: t.listing_id,
          reservationId: t.reservation_id,
          propertyName: listing?.name ?? "Unknown Property",
          locationGroup: listing?.location_group ?? "Other",
          checkoutDate: ds,
          checkoutTime: DEFAULT_CHECKOUT,
          nextCheckinDate: nextCheckIn?.check_in ?? null,
          nextCheckinTime: nextCheckIn?.check_in === ds ? DEFAULT_CHECKIN : null,
          cleaningDuration: t.cleaning_duration_minutes ?? 90,
          assignedCleanerId: t.assigned_cleaner_id,
          assignedCleanerName: cleaner?.name ?? null,
          status: (t.status === "completed" ? "complete" : t.status) as TaskStatus,
          priority: t.priority === "same_day_turnaround" ? "SAME_DAY" as Priority : "STANDARD" as Priority,
          latitude: listing?.latitude ?? null,
          longitude: listing?.longitude ?? null,
          estimatedStart: t.estimated_start_time ? t.estimated_start_time.slice(0, 5) : undefined,
          travelMinutes: t.travel_time_from_previous_minutes > 0 ? t.travel_time_from_previous_minutes : undefined,
        };
      });

      const cleanerDays: CleanerDay[] = cleaners.map(c => {
        const cTasks = tasks.filter(t => t.assignedCleanerId === c.id);
        const totalMins = cTasks.reduce((s, t) => s + t.cleaningDuration + (t.travelMinutes ?? 0), 0);
        const firstTask = cTasks[0];
        const lastTask = cTasks[cTasks.length - 1];
        const homeToFirst = firstTask ? travelMinutes(c.home_latitude, c.home_longitude, firstTask.latitude, firstTask.longitude) : undefined;
        const lastToHome = lastTask ? travelMinutes(lastTask.latitude, lastTask.longitude, c.home_latitude, c.home_longitude) : undefined;
        return {
          id: c.id, name: c.name, dailyWorkingHours: c.daily_working_hours, totalScheduledMinutes: totalMins, tasks: cTasks,
          homeLatitude: c.home_latitude, homeLongitude: c.home_longitude,
          homeToFirstMinutes: homeToFirst, lastToHomeMinutes: lastToHome,
        };
      }).filter(cd => cd.tasks.length > 0);

      const unassigned = tasks.filter(t => t.status === "unassigned");

      return { tasks, cleanerDays, unassigned };
    }

    // Fallback: compute from reservations (for dates without DB tasks)
    const checkouts = checkoutReservations.filter(r => r.check_out === ds);

    const tasks: CleanTask[] = checkouts.map(r => {
      const listing = listingMap.get(r.listing_id);
      const nextCheckIn = checkinReservations
        .filter(nr => nr.listing_id === r.listing_id && nr.check_in >= ds && nr.id !== r.id)
        .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];

      const sameDay = nextCheckIn?.check_in === ds;
      let priority: Priority = "STANDARD";
      if (sameDay) {
        const [coH, coM] = DEFAULT_CHECKOUT.split(":").map(Number);
        const [ciH, ciM] = DEFAULT_CHECKIN.split(":").map(Number);
        const gap = (ciH * 60 + ciM) - (coH * 60 + coM);
        priority = gap < 180 ? "TIGHT_WINDOW" : "SAME_DAY";
      }

      return {
        id: `${r.id}-clean`,
        listingId: r.listing_id,
        reservationId: r.id,
        propertyName: listing?.name ?? "Unknown Property",
        locationGroup: listing?.location_group ?? "Other",
        checkoutDate: ds,
        checkoutTime: DEFAULT_CHECKOUT,
        nextCheckinDate: nextCheckIn?.check_in ?? null,
        nextCheckinTime: sameDay ? DEFAULT_CHECKIN : null,
        cleaningDuration: listing?.cleaning_duration_minutes ?? 90,
        assignedCleanerId: null,
        assignedCleanerName: null,
        status: "unassigned" as TaskStatus,
        priority,
        latitude: listing?.latitude ?? null,
        longitude: listing?.longitude ?? null,
      };
    });

    const priorityOrder: Record<Priority, number> = { TIGHT_WINDOW: 0, SAME_DAY: 1, STANDARD: 2 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Auto-allocate (client-side preview only)
    const cleanerScheduledMinutes: Record<string, number> = {};
    const cleanerTaskCount: Record<string, number> = {};
    const cleanerTotalForRegion: Record<string, Record<string, number>> = {};
    const cleanerTaskList: Record<string, CleanTask[]> = {};

    cleaners.forEach(c => {
      cleanerScheduledMinutes[c.id] = 0;
      cleanerTaskCount[c.id] = 0;
      cleanerTaskList[c.id] = [];
      cleanerTotalForRegion[c.id] = {};
      c.location_groups.forEach(lg => { cleanerTotalForRegion[c.id][lg] = 0; });
    });

    for (const task of tasks) {
      const eligible = cleaners.filter(c => {
        if (!c.location_groups.includes(task.locationGroup)) return false;
        if (c.non_working_days.includes(dayName)) return false;
        const lastTask = cleanerTaskList[c.id]?.[cleanerTaskList[c.id].length - 1];
        const travel = lastTask ? travelMinutes(lastTask.latitude, lastTask.longitude, task.latitude, task.longitude) : 0;
        const projectedMinutes = cleanerScheduledMinutes[c.id] + travel + task.cleaningDuration;
        const maxMinutes = (c.daily_working_hours ?? 8) * 60;
        if (projectedMinutes > maxMinutes) return false;
        return true;
      });

      if (eligible.length === 0) {
        task.reason = `No cleaner available for ${task.locationGroup} on ${dayName}`;
        continue;
      }

      let bestCleaner = eligible[0];
      let bestDeficit = -Infinity;
      for (const c of eligible) {
        const targetShare = c.workload_share[task.locationGroup] ?? 100;
        const totalInRegion = eligible.reduce((sum, ec) => sum + (cleanerTotalForRegion[ec.id]?.[task.locationGroup] ?? 0), 0);
        const actualShare = totalInRegion > 0 ? ((cleanerTotalForRegion[c.id]?.[task.locationGroup] ?? 0) / totalInRegion) * 100 : 0;
        const deficit = targetShare - actualShare;
        if (deficit > bestDeficit) { bestDeficit = deficit; bestCleaner = c; }
      }

      const lastTask = cleanerTaskList[bestCleaner.id]?.[cleanerTaskList[bestCleaner.id].length - 1];
      const travelMins = lastTask ? travelMinutes(lastTask.latitude, lastTask.longitude, task.latitude, task.longitude) : 0;

      task.assignedCleanerId = bestCleaner.id;
      task.assignedCleanerName = bestCleaner.name;
      task.status = "scheduled";
      task.travelMinutes = travelMins > 0 ? travelMins : undefined;
      cleanerTaskCount[bestCleaner.id]++;
      cleanerScheduledMinutes[bestCleaner.id] += travelMins + task.cleaningDuration;
      cleanerTaskList[bestCleaner.id].push(task);
      cleanerTotalForRegion[bestCleaner.id][task.locationGroup] = (cleanerTotalForRegion[bestCleaner.id][task.locationGroup] ?? 0) + 1;
    }

    // Route optimization per cleaner (using home location)
    const cleanerDays: CleanerDay[] = cleaners.map(c => {
      const cTasks = tasks.filter(t => t.assignedCleanerId === c.id);
      const totalMins = cleanerScheduledMinutes[c.id] ?? 0;

      if (cTasks.length === 0) {
        return { id: c.id, name: c.name, dailyWorkingHours: c.daily_working_hours, totalScheduledMinutes: totalMins, tasks: cTasks, homeLatitude: c.home_latitude, homeLongitude: c.home_longitude };
      }

      if (cTasks.length === 1) {
        const homeTravel = travelMinutes(c.home_latitude, c.home_longitude, cTasks[0].latitude, cTasks[0].longitude);
        cTasks[0].estimatedStart = addMinutesToTime(DEFAULT_CHECKOUT, homeTravel);
        cTasks[0].travelMinutes = homeTravel;
        return {
          id: c.id, name: c.name, dailyWorkingHours: c.daily_working_hours, totalScheduledMinutes: totalMins, tasks: cTasks,
          homeLatitude: c.home_latitude, homeLongitude: c.home_longitude,
          homeToFirstMinutes: homeTravel,
          lastToHomeMinutes: travelMinutes(cTasks[0].latitude, cTasks[0].longitude, c.home_latitude, c.home_longitude),
        };
      }

      // Route: start nearest to home, nearest-next for middle, last goes home
      const ordered: CleanTask[] = [];
      const remaining = [...cTasks];

      // First: nearest to home
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineKm(c.home_latitude ?? 54.35, c.home_longitude ?? -7.64, remaining[i].latitude ?? 54.35, remaining[i].longitude ?? -7.64);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      ordered.push(remaining.splice(bestIdx, 1)[0]);

      // Middle: nearest-next
      while (remaining.length > 1) {
        const last = ordered[ordered.length - 1];
        let nearestIdx = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const d = haversineKm(last.latitude ?? 54.35, last.longitude ?? -7.64, remaining[i].latitude ?? 54.35, remaining[i].longitude ?? -7.64);
          if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
        }
        ordered.push(remaining.splice(nearestIdx, 1)[0]);
      }

      // Last task
      if (remaining.length === 1) ordered.push(remaining[0]);

      // Calculate times from home
      const homeToFirst = travelMinutes(c.home_latitude, c.home_longitude, ordered[0].latitude, ordered[0].longitude);
      ordered[0].travelMinutes = homeToFirst;
      let currentTime = addMinutesToTime(DEFAULT_CHECKOUT, homeToFirst);
      ordered[0].estimatedStart = currentTime;

      for (let i = 1; i < ordered.length; i++) {
        const travel = travelMinutes(ordered[i - 1].latitude, ordered[i - 1].longitude, ordered[i].latitude, ordered[i].longitude);
        ordered[i].travelMinutes = travel;
        currentTime = addMinutesToTime(currentTime, ordered[i - 1].cleaningDuration + travel);
        ordered[i].estimatedStart = currentTime;
      }

      const lastTask = ordered[ordered.length - 1];
      const lastToHome = travelMinutes(lastTask.latitude, lastTask.longitude, c.home_latitude, c.home_longitude);

      return {
        id: c.id, name: c.name, dailyWorkingHours: c.daily_working_hours, totalScheduledMinutes: totalMins, tasks: ordered,
        homeLatitude: c.home_latitude, homeLongitude: c.home_longitude,
        homeToFirstMinutes: homeToFirst, lastToHomeMinutes: lastToHome,
      };
    }).filter(cd => cd.tasks.length > 0);

    const unassigned = tasks.filter(t => t.status === "unassigned");
    return { tasks, cleanerDays, unassigned };
  }, [checkoutReservations, checkinReservations, cleaners, listingMap, cleanerMap, dbCleanTasks]);

  const daySchedule = useMemo(() => buildDaySchedule(selectedDate), [selectedDate, buildDaySchedule]);

  const weekSummary = useMemo((): WeekDaySummary[] => {
    if (viewMode !== "week") return [];
    const days: WeekDaySummary[] = [];
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const { tasks } = buildDaySchedule(d);
      days.push({
        date: format(d, "yyyy-MM-dd"),
        dayLabel: format(d, "EEE d"),
        totalCleans: tasks.length,
        totalMinutes: tasks.reduce((s, t) => s + t.cleaningDuration, 0),
      });
    }
    return days;
  }, [selectedDate, viewMode, buildDaySchedule]);

  const monthlyInvoice = useMemo(() => {
    return cleaners.map(c => ({
      id: c.id,
      name: c.name,
      cleans: daySchedule.cleanerDays.find(cd => cd.id === c.id)?.tasks.length ?? 0,
      rate: c.rate_per_clean,
      total: (daySchedule.cleanerDays.find(cd => cd.id === c.id)?.tasks.length ?? 0) * c.rate_per_clean,
    })).filter(c => c.cleans > 0);
  }, [cleaners, daySchedule]);

  const filteredCleanerDays = useMemo(() => {
    let days = daySchedule.cleanerDays;
    if (filterCleaner !== "all") days = days.filter(d => d.id === filterCleaner);
    if (filterLocation !== "all") {
      days = days.map(d => ({
        ...d,
        tasks: d.tasks.filter(t => t.locationGroup === filterLocation),
      })).filter(d => d.tasks.length > 0);
    }
    return days;
  }, [daySchedule.cleanerDays, filterCleaner, filterLocation]);

  const filteredUnassigned = useMemo(() => {
    let u = daySchedule.unassigned;
    if (filterLocation !== "all") u = u.filter(t => t.locationGroup === filterLocation);
    return u;
  }, [daySchedule.unassigned, filterLocation]);

  // Regenerate calls the edge function
  const regenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase.functions.invoke("generate-daily-cleaning-schedule", {
        body: { date: dateStr },
      });
      if (error) throw error;
      toast({
        title: "Schedule generated",
        description: `${data?.tasks_created ?? 0} tasks created, ${data?.tasks_unassigned ?? 0} unassigned.`,
      });
      // Refresh all queries
      queryClient.invalidateQueries({ queryKey: ["clean-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["reservations-checkouts"] });
      queryClient.invalidateQueries({ queryKey: ["reservations-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["cleaners-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["listings-schedule"] });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  }, [selectedDate, queryClient, toast]);

  // Complete a task
  const completeTask = useCallback(async (taskId: string, listingId: string) => {
    try {
      // Update clean_tasks status
      await (supabase.from("clean_tasks" as any) as any)
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", taskId);
      // Set is_clean = true on listing
      await supabase.from("listings").update({ is_clean: true } as any).eq("id", listingId);
      toast({ title: "Clean completed", description: "Property marked as clean." });
      queryClient.invalidateQueries({ queryKey: ["clean-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["listings-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [queryClient, toast]);

  const goBack = useCallback(() => setSelectedDate(d => addDays(d, -1)), []);
  const goForward = useCallback(() => setSelectedDate(d => addDays(d, 1)), []);
  const isToday = isSameDay(selectedDate, new Date());

  const locationGroups = useMemo(() => {
    const s = new Set<string>();
    listings.forEach(l => { if (l.location_group) s.add(l.location_group); });
    return Array.from(s).sort();
  }, [listings]);

  return {
    selectedDate, setSelectedDate, viewMode, setViewMode,
    filterCleaner, setFilterCleaner, filterLocation, setFilterLocation,
    cleanerDays: filteredCleanerDays, unassigned: filteredUnassigned,
    weekSummary, monthlyInvoice, cleaners, locationGroups,
    totalTasks: daySchedule.tasks.length,
    regenerate, completeTask, goBack, goForward, isToday, isRegenerating,
    buildDaySchedule,
  };
}
