import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, differenceInMinutes, parseISO } from "date-fns";

/* ── types ── */
export type Priority = "SAME_DAY" | "TIGHT_WINDOW" | "STANDARD";
export type TaskStatus = "unassigned" | "scheduled" | "in_progress" | "complete";

export interface CleanTask {
  id: string;
  listingId: string;
  propertyName: string;
  locationGroup: string;
  checkoutDate: string;        // ISO date
  checkoutTime: string;        // "10:00"
  nextCheckinDate: string | null;
  nextCheckinTime: string | null;
  cleaningDuration: number;    // minutes
  assignedCleanerId: string | null;
  assignedCleanerName: string | null;
  status: TaskStatus;
  priority: Priority;
  reason?: string;             // why unassigned
  latitude: number | null;
  longitude: number | null;
  estimatedStart?: string;     // "HH:mm"
  travelMinutes?: number;
}

export interface CleanerDay {
  id: string;
  name: string;
  maxPerDay: number;
  tasks: CleanTask[];
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
  max_cleans_per_day: number;
  rate_per_clean: number;
  active: boolean;
}

interface Listing {
  id: string;
  name: string;
  location_group: string | null;
  cleaning_duration_minutes: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface Reservation {
  id: string;
  listing_id: string;
  check_in: string;
  check_out: string;
  status: string;
  guest_name: string;
}

/* ── helpers ── */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_CHECKOUT = "10:00";
const DEFAULT_CHECKIN = "15:00";
const AVG_SPEED_MPH = 30;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function travelMinutes(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 15; // default 15 min if no coords
  const km = haversineKm(lat1, lon1, lat2, lon2);
  const miles = km * 0.621371;
  return Math.ceil((miles / AVG_SPEED_MPH) * 60);
}

function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/* ── hook ── */
export function useCleaningSchedule() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [filterCleaner, setFilterCleaner] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [regenerateKey, setRegenerateKey] = useState(0);

  // Date range for queries
  const rangeStart = viewMode === "week" ? startOfWeek(selectedDate, { weekStartsOn: 1 }) : selectedDate;
  const rangeEnd = viewMode === "week" ? endOfWeek(selectedDate, { weekStartsOn: 1 }) : selectedDate;
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
  const rangeEndStr = format(rangeEnd, "yyyy-MM-dd");

  // Also look 7 days ahead for next check-ins
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
        max_cleans_per_day: c.max_cleans_per_day ?? 3,
        rate_per_clean: c.rate_per_clean ?? 0,
        active: c.active,
      }));
    },
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["listings-schedule"],
    queryFn: async () => {
      const { data } = await supabase.from("listings").select("id, name, location_group, cleaning_duration_minutes, latitude, longitude").eq("status", "active");
      return (data || []) as Listing[];
    },
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ["reservations-schedule", rangeStartStr, lookAheadStr],
    queryFn: async () => {
      // Get all reservations where checkout is in our range OR checkin is near our range (for next-guest lookups)
      const { data } = await supabase
        .from("reservations")
        .select("id, listing_id, check_in, check_out, status, guest_name")
        .or(`check_out.gte.${rangeStartStr},check_in.lte.${lookAheadStr}`)
        .in("status", ["confirmed", "new", "modified"])
        .order("check_out");
      return (data || []) as Reservation[];
    },
  });

  const listingMap = useMemo(() => {
    const m = new Map<string, Listing>();
    listings.forEach(l => m.set(l.id, l));
    return m;
  }, [listings]);

  // Build schedule for a specific date
  const buildDaySchedule = useCallback((date: Date): { tasks: CleanTask[]; cleanerDays: CleanerDay[]; unassigned: CleanTask[] } => {
    const ds = format(date, "yyyy-MM-dd");
    const dayName = DAY_NAMES[date.getDay()];

    // Find checkouts on this date
    const checkouts = reservations.filter(r => r.check_out === ds);

    // For each checkout, find the next check-in at the same listing
    const tasks: CleanTask[] = checkouts.map(r => {
      const listing = listingMap.get(r.listing_id);
      const nextCheckIn = reservations
        .filter(nr => nr.listing_id === r.listing_id && nr.check_in >= ds && nr.id !== r.id)
        .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];

      const sameDay = nextCheckIn?.check_in === ds;
      let priority: Priority = "STANDARD";
      if (sameDay) {
        const coTime = DEFAULT_CHECKOUT;
        const ciTime = DEFAULT_CHECKIN;
        const [coH, coM] = coTime.split(":").map(Number);
        const [ciH, ciM] = ciTime.split(":").map(Number);
        const gap = (ciH * 60 + ciM) - (coH * 60 + coM);
        const duration = listing?.cleaning_duration_minutes ?? 90;
        priority = gap < 180 ? "TIGHT_WINDOW" : "SAME_DAY";
      }

      return {
        id: `${r.id}-clean`,
        listingId: r.listing_id,
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

    // Sort: priority tasks first
    const priorityOrder: Record<Priority, number> = { TIGHT_WINDOW: 0, SAME_DAY: 1, STANDARD: 2 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Auto-allocate
    const cleanerTaskCount: Record<string, number> = {};
    const cleanerTotalForRegion: Record<string, Record<string, number>> = {};

    // Initialize counts
    cleaners.forEach(c => {
      cleanerTaskCount[c.id] = 0;
      cleanerTotalForRegion[c.id] = {};
      c.location_groups.forEach(lg => { cleanerTotalForRegion[c.id][lg] = 0; });
    });

    for (const task of tasks) {
      const eligible = cleaners.filter(c => {
        if (!c.location_groups.includes(task.locationGroup)) return false;
        if (c.non_working_days.includes(dayName)) return false;
        if (cleanerTaskCount[c.id] >= c.max_cleans_per_day) return false;
        return true;
      });

      if (eligible.length === 0) {
        task.reason = `No cleaner available for ${task.locationGroup} on ${dayName}`;
        continue;
      }

      // Find cleaner furthest below their workload share target
      let bestCleaner = eligible[0];
      let bestDeficit = -Infinity;

      for (const c of eligible) {
        const targetShare = c.workload_share[task.locationGroup] ?? 100;
        const totalInRegion = eligible.reduce((sum, ec) => sum + (cleanerTotalForRegion[ec.id]?.[task.locationGroup] ?? 0), 0);
        const actualShare = totalInRegion > 0
          ? ((cleanerTotalForRegion[c.id]?.[task.locationGroup] ?? 0) / totalInRegion) * 100
          : 0;
        const deficit = targetShare - actualShare;
        if (deficit > bestDeficit) {
          bestDeficit = deficit;
          bestCleaner = c;
        }
      }

      task.assignedCleanerId = bestCleaner.id;
      task.assignedCleanerName = bestCleaner.name;
      task.status = "scheduled";
      cleanerTaskCount[bestCleaner.id]++;
      cleanerTotalForRegion[bestCleaner.id][task.locationGroup] = (cleanerTotalForRegion[bestCleaner.id][task.locationGroup] ?? 0) + 1;
    }

    // Route optimization per cleaner (nearest-neighbor)
    const cleanerDays: CleanerDay[] = cleaners.map(c => {
      const cTasks = tasks.filter(t => t.assignedCleanerId === c.id);
      if (cTasks.length <= 1) {
        // Set start time for single task
        if (cTasks.length === 1) {
          cTasks[0].estimatedStart = DEFAULT_CHECKOUT;
        }
        return { id: c.id, name: c.name, maxPerDay: c.max_cleans_per_day, tasks: cTasks };
      }

      // Nearest-neighbor routing
      const ordered: CleanTask[] = [];
      const remaining = [...cTasks];

      // Start with highest priority task
      ordered.push(remaining.shift()!);
      while (remaining.length > 0) {
        const last = ordered[ordered.length - 1];
        let nearestIdx = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const d = haversineKm(
            last.latitude ?? 54.35, last.longitude ?? -7.64,
            remaining[i].latitude ?? 54.35, remaining[i].longitude ?? -7.64
          );
          if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
        }
        ordered.push(remaining.splice(nearestIdx, 1)[0]);
      }

      // Calculate estimated start times
      let currentTime = DEFAULT_CHECKOUT;
      for (let i = 0; i < ordered.length; i++) {
        ordered[i].estimatedStart = currentTime;
        if (i < ordered.length - 1) {
          const travel = travelMinutes(ordered[i].latitude, ordered[i].longitude, ordered[i + 1].latitude, ordered[i + 1].longitude);
          ordered[i + 1].travelMinutes = travel;
          currentTime = addMinutesToTime(currentTime, ordered[i].cleaningDuration + travel);
        }
      }

      return { id: c.id, name: c.name, maxPerDay: c.max_cleans_per_day, tasks: ordered };
    }).filter(cd => cd.tasks.length > 0);

    const unassigned = tasks.filter(t => t.status === "unassigned");

    return { tasks, cleanerDays, unassigned };
  }, [reservations, listings, cleaners, listingMap]);

  // Build for selected date
  const daySchedule = useMemo(() => buildDaySchedule(selectedDate), [selectedDate, buildDaySchedule, regenerateKey]);

  // Week summary
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
  }, [selectedDate, viewMode, buildDaySchedule, regenerateKey]);

  // Monthly invoice data
  const monthlyInvoice = useMemo(() => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cleanerCounts: Record<string, { name: string; cleans: number; rate: number }> = {};
    cleaners.forEach(c => { cleanerCounts[c.id] = { name: c.name, cleans: 0, rate: c.rate_per_clean }; });

    for (let i = 0; i < daysInMonth; i++) {
      const d = addDays(firstOfMonth, i);
      const ds = format(d, "yyyy-MM-dd");
      const dayCheckouts = reservations.filter(r => r.check_out === ds);
      // Simple count — each checkout is a clean
      dayCheckouts.forEach(r => {
        const listing = listingMap.get(r.listing_id);
        const lg = listing?.location_group ?? "Other";
        // Find who would be assigned — simplified: just count from existing tasks
      });
    }

    // For accuracy, use only current selected day's actual assignment data
    // A proper implementation would persist completed tasks — for now, show based on current day's schedule
    return cleaners.map(c => ({
      id: c.id,
      name: c.name,
      cleans: daySchedule.cleanerDays.find(cd => cd.id === c.id)?.tasks.length ?? 0,
      rate: c.rate_per_clean,
      total: (daySchedule.cleanerDays.find(cd => cd.id === c.id)?.tasks.length ?? 0) * c.rate_per_clean,
    })).filter(c => c.cleans > 0);
  }, [cleaners, daySchedule, selectedDate, reservations, listingMap]);

  // Filtered cleaner days
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

  const regenerate = useCallback(() => setRegenerateKey(k => k + 1), []);
  const goBack = useCallback(() => setSelectedDate(d => addDays(d, -1)), []);
  const goForward = useCallback(() => setSelectedDate(d => addDays(d, 1)), []);

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
    regenerate, goBack, goForward,
  };
}
