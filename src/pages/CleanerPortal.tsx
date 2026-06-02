import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogOut, Check, Eye, Sun, Moon, Flag, Sunrise, Play, X } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { Navigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { FlagIssueModal } from "@/components/cleaner/FlagIssueModal";

interface CleanTask {
  id: string;
  status: string;
  scheduled_date: string;
  route_order: number;
  estimated_start_time: string | null;
  travel_time_from_previous_minutes: number | null;
  is_same_day_turnaround: boolean;
  priority_level: number | null;
  checkout_time: string | null;
  checkin_time: string | null;
  cleaning_duration_minutes: number;
  listing_id: string;
  property_name: string;
  location_group: string | null;
  bedrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  started_at: string | null;
}

interface CleanerProfile {
  id: string;
  name: string;
  daily_working_hours: number;
  home_latitude: number | null;
  home_longitude: number | null;
}

type PeriodKey = "today" | "tomorrow" | "rest_week" | "next_week";

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
  return Math.round((km / 40) * 60);
}

function distanceKm(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number | null {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  return haversineKm(lat1, lon1, lat2, lon2);
}

// Proposed Clean Time: if there's a checkout, later of estimated_start and 11:00; else estimated_start
function proposedCleanTime(task: CleanTask): string | null {
  if (!task.checkout_time) return task.estimated_start_time;
  const eleven = "11:00:00";
  const est = task.estimated_start_time ?? eleven;
  return est > eleven ? est : eleven;
}

export default function CleanerPortal() {
  const { user, loading: authLoading, signOut, role } = useAuth();
  const [cleaner, setCleaner] = useState<CleanerProfile | null>(null);
  const [tasks, setTasks] = useState<CleanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [flagTask, setFlagTask] = useState<CleanTask | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodKey>("today");
  const pageLoadTime = useRef(new Date().toISOString());
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCleaner = (role as string) === "cleaner";
  const isAdmin = (role as string) === "super" || (role as string) === "senior";
  const isPreviewMode = isAdmin;

  // Admin cleaner selector state
  const [allCleaners, setAllCleaners] = useState<CleanerProfile[]>([]);
  const [selectedCleanerId, setSelectedCleanerId] = useState<string | null>(null);

  // Date boundaries
  const today = useMemo(() => new Date(), []);
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
  const thisWeekEnd = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
  const nextWeekStart = useMemo(() => addDays(thisWeekEnd, 1), [thisWeekEnd]);
  const nextWeekEnd = useMemo(() => endOfWeek(nextWeekStart, { weekStartsOn: 1 }), [nextWeekStart]);
  const rangeEndStr = format(addDays(today, 13), "yyyy-MM-dd");

  useEffect(() => {
    if (!isAdmin || !user) return;
    const fetchCleaners = async () => {
      const { data } = await supabase
        .from("cleaners")
        .select("id, name, daily_working_hours, home_latitude, home_longitude")
        .eq("active", true)
        .order("name");
      if (data && data.length > 0) {
        setAllCleaners(data as any as CleanerProfile[]);
        setSelectedCleanerId(data[0].id);
      }
    };
    fetchCleaners();
  }, [isAdmin, user]);

  useEffect(() => {
    if (!user) return;
    if (isAdmin) {
      if (selectedCleanerId) fetchDataForCleaner(selectedCleanerId);
    } else {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedCleanerId, isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) return;
    const interval = setInterval(() => pollNewTasks(), 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, cleaner]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const fetchTasksFor = async (cleanerId: string) => {
    const { data } = await supabase
      .from("clean_tasks")
      .select(`
        id, status, scheduled_date, route_order, estimated_start_time,
        travel_time_from_previous_minutes, is_same_day_turnaround, priority_level,
        checkout_time, checkin_time, cleaning_duration_minutes,
        listing_id, started_at,
        listings!clean_tasks_listing_id_fkey (name, location_group, bedrooms, latitude, longitude)
      `)
      .eq("assigned_cleaner_id", cleanerId)
      .gte("scheduled_date", todayStr)
      .lte("scheduled_date", rangeEndStr)
      .not("status", "in", "(cancelled,canceled)")
      .order("scheduled_date", { ascending: true })
      .order("priority_level", { ascending: true, nullsFirst: false })
      .order("estimated_start_time", { ascending: true, nullsFirst: false });
    return data ?? [];
  };

  const fetchDataForCleaner = async (cleanerId: string) => {
    setLoading(true);
    const selected = allCleaners.find(c => c.id === cleanerId);
    if (!selected) { setLoading(false); return; }
    setCleaner(selected);
    const taskData = await fetchTasksFor(cleanerId);
    setTasks(mapTaskData(taskData));
    setLoading(false);
  };

  const mapTaskData = (taskData: any[]): CleanTask[] =>
    taskData.map((t: any) => ({
      id: t.id,
      status: t.status,
      scheduled_date: t.scheduled_date,
      route_order: t.route_order,
      estimated_start_time: t.estimated_start_time,
      travel_time_from_previous_minutes: t.travel_time_from_previous_minutes,
      is_same_day_turnaround: t.is_same_day_turnaround,
      priority_level: t.priority_level ?? null,
      checkout_time: t.checkout_time,
      checkin_time: t.checkin_time,
      cleaning_duration_minutes: t.cleaning_duration_minutes,
      listing_id: t.listing_id,
      property_name: t.listings?.name ?? "Unknown",
      location_group: t.listings?.location_group ?? null,
      bedrooms: t.listings?.bedrooms ?? null,
      latitude: t.listings?.latitude ?? null,
      longitude: t.listings?.longitude ?? null,
      started_at: t.started_at ?? null,
    }));

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data: cleanerData } = await supabase
      .from("cleaners")
      .select("id, name, daily_working_hours, home_latitude, home_longitude")
      .eq("user_id", user.id)
      .single();
    if (!cleanerData) { setLoading(false); return; }
    setCleaner(cleanerData as any as CleanerProfile);
    const taskData = await fetchTasksFor(cleanerData.id);
    setTasks(mapTaskData(taskData));
    setLoading(false);
  };

  const pollNewTasks = async () => {
    if (!cleaner) return;
    const { data } = await supabase
      .from("clean_tasks")
      .select(`
        id, status, scheduled_date, route_order, estimated_start_time,
        travel_time_from_previous_minutes, is_same_day_turnaround, priority_level,
        checkout_time, checkin_time, cleaning_duration_minutes,
        listing_id, started_at, created_at,
        listings!clean_tasks_listing_id_fkey (name, location_group, bedrooms, latitude, longitude)
      `)
      .eq("assigned_cleaner_id", cleaner.id)
      .gte("scheduled_date", todayStr)
      .lte("scheduled_date", rangeEndStr)
      .not("status", "in", "(cancelled,canceled)")
      .gt("created_at", pageLoadTime.current);

    if (data && data.length > 0) {
      pageLoadTime.current = new Date().toISOString();
      const newTasks = mapTaskData(data);
      setTasks((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const onlyNew = newTasks.filter((n: CleanTask) => !existingIds.has(n.id));
        if (onlyNew.length === 0) return prev;
        const merged = [...prev, ...onlyNew].sort((a, b) => {
          if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date);
          return (a.estimated_start_time ?? "99:99").localeCompare(b.estimated_start_time ?? "99:99");
        });
        onlyNew.forEach((n) => toast(`⚡ New job added — ${n.property_name}`));
        return merged;
      });
    }
  };

  const requestConfirmComplete = (taskId: string) => {
    if (isPreviewMode) {
      toast.info("Preview mode — actions are disabled");
      return;
    }
    setConfirmingId(taskId);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmingId(null), 8000);
  };

  const cancelConfirm = () => {
    setConfirmingId(null);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  };

  const handleMarkComplete = async (task: CleanTask) => {
    if (isPreviewMode) {
      toast.info("Preview mode — actions are disabled");
      return;
    }
    setCompletingId(task.id);
    setConfirmingId(null);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: "completed" } : t))
    );

    const [taskRes, listingRes] = await Promise.all([
      supabase
        .from("clean_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", task.id),
      supabase.from("listings").update({ is_clean: true }).eq("id", task.listing_id),
    ]);

    if (taskRes.error || listingRes.error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: "scheduled" } : t))
      );
      toast.error("Failed to mark complete. Please try again.");
    } else {
      toast.success(`✓ ${task.property_name} marked complete`);
    }
    setCompletingId(null);
  };

  const handleStartJob = async (task: CleanTask) => {
    if (isPreviewMode) {
      toast.info("Preview mode — actions are disabled");
      return;
    }
    setStartingId(task.id);
    const startedAt = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: "in_progress", started_at: startedAt } : t))
    );
    const { error } = await (supabase.from("clean_tasks") as any)
      .update({ status: "in_progress", started_at: startedAt })
      .eq("id", task.id);
    if (error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: "scheduled", started_at: null } : t))
      );
      toast.error("Failed to start job. Please try again.");
    } else {
      toast.success(`Started — ${task.property_name}`);
    }
    setStartingId(null);
  };

  const formatTime = (time: string | null) => {
    if (!time) return "—";
    return time.substring(0, 5);
  };

  if (authLoading || (loading && !isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!authLoading && role && !isCleaner && !isAdmin) return <Navigate to="/today" replace />;

  if (!isAdmin && !cleaner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="text-muted-foreground text-center">
          No cleaner profile linked to your account. Please contact your manager.
        </p>
      </div>
    );
  }

  const displayCleaner = cleaner;
  const firstName = displayCleaner?.name.split(" ")[0] ?? "Cleaner";
  const initial = firstName.charAt(0).toUpperCase();
  const todayFormatted = format(today, "EEEE, d MMMM yyyy");

  // Bucket tasks by period
  const isInPeriod = (date: string, period: PeriodKey): boolean => {
    if (period === "today") return date === todayStr;
    if (period === "tomorrow") return date === tomorrowStr;
    if (period === "rest_week") {
      const d = parseISO(date);
      return d > addDays(today, 1) && d <= thisWeekEnd;
    }
    if (period === "next_week") {
      const d = parseISO(date);
      return d >= nextWeekStart && d <= nextWeekEnd;
    }
    return false;
  };

  const counts: Record<PeriodKey, number> = {
    today: tasks.filter((t) => isInPeriod(t.scheduled_date, "today")).length,
    tomorrow: tasks.filter((t) => isInPeriod(t.scheduled_date, "tomorrow")).length,
    rest_week: tasks.filter((t) => isInPeriod(t.scheduled_date, "rest_week")).length,
    next_week: tasks.filter((t) => isInPeriod(t.scheduled_date, "next_week")).length,
  };

  const visibleTasks = tasks.filter((t) => isInPeriod(t.scheduled_date, activePeriod));
  const isReadOnlyPeriod = activePeriod !== "today";


  // Capacity is computed against today only (working day metric)
  const todayTasks = tasks.filter((t) => t.scheduled_date === todayStr);
  const totalMinutes = todayTasks.reduce(
    (sum, t) => sum + t.cleaning_duration_minutes + (t.travel_time_from_previous_minutes ?? 0),
    0
  );
  const maxMinutes = (displayCleaner?.daily_working_hours ?? 8) * 60;
  const capacityPct = maxMinutes > 0 ? Math.round((totalMinutes / maxMinutes) * 100) : 0;
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const maxHours = Math.floor(maxMinutes / 60);

  const completedCount = visibleTasks.filter((t) => t.status === "completed").length;
  const allComplete = visibleTasks.length > 0 && completedCount === visibleTasks.length;

  const periodBanner =
    activePeriod === "today" ? "TODAY"
    : activePeriod === "tomorrow" ? "TOMORROW"
    : activePeriod === "rest_week" ? `WEEK OF ${format(startOfWeek(today, { weekStartsOn: 1 }), "d MMM")}`
    : `NEXT WEEK · ${format(nextWeekStart, "d MMM")}`;

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[430px] flex flex-col min-h-screen">
        {/* Preview banner for admins */}
        {isPreviewMode && (
          <div className="bg-primary/15 border-b border-primary/30 px-4 py-2.5 flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-primary">Preview Mode</span>
            <div className="flex-1" />
            <select
              value={selectedCleanerId ?? ""}
              onChange={(e) => setSelectedCleanerId(e.target.value)}
              className="text-xs bg-background/50 border border-border/30 rounded-md px-2 py-1 text-foreground"
            >
              {allCleaners.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <img
            src="/images/eg_icon_standalone.png"
            alt="Escape Grids"
            className="h-7 w-7 object-contain opacity-60"
          />
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            {!isPreviewMode ? (
              <button
                onClick={signOut}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[48px] flex items-center"
              >
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Sign out
              </button>
            ) : (
              <a
                href="/today"
                className="text-xs text-primary hover:text-primary/80 transition-colors min-h-[48px] flex items-center font-medium"
              >
                ← Back to app
              </a>
            )}
          </div>
        </div>

        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/30 px-4 pt-3 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-lg shrink-0">
                {initial}
              </div>
              <div>
                <h1 className="text-xl font-bold font-display text-foreground leading-tight">
                  {firstName}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">{todayFormatted}</p>
              </div>
            </div>
            <div
              className={`text-xs font-semibold px-2.5 py-1 rounded-full mt-1 ${
                capacityPct > 100 ? "bg-destructive/20 text-destructive" : "bg-primary/15 text-primary"
              }`}
            >
              {capacityPct}% today
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{totalHours}h {totalMins}m / {maxHours}h working day</span>
            </div>
            <Progress
              value={Math.min(capacityPct, 100)}
              className={`h-2 ${capacityPct > 90 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
            />
          </div>
        </div>

        {/* Temporal navigation */}
        <div className="px-4 pt-4 space-y-2">
          <PeriodCard
            label="Today"
            count={counts.today}
            active={activePeriod === "today"}
            onClick={() => setActivePeriod("today")}
            fullWidth
          />
          <div className="grid grid-cols-3 gap-2">
            <PeriodCard label="Tomorrow" count={counts.tomorrow} active={activePeriod === "tomorrow"} onClick={() => setActivePeriod("tomorrow")} />
            <PeriodCard label="Rest of Week" count={counts.rest_week} active={activePeriod === "rest_week"} onClick={() => setActivePeriod("rest_week")} />
            <PeriodCard label="Next Week" count={counts.next_week} active={activePeriod === "next_week"} onClick={() => setActivePeriod("next_week")} />
          </div>
        </div>

        {/* Period banner */}
        <div className="px-4 mt-4">
          <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Viewing</p>
            <p className="text-2xl font-display font-bold text-primary tracking-tight">{periodBanner}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 pt-4 pb-8" style={{ paddingBottom: "env(safe-area-inset-bottom, 2rem)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-6">
              <span className="text-5xl mb-4">🌅</span>
              <p className="text-foreground font-display font-semibold text-lg">No jobs scheduled</p>
              <p className="text-muted-foreground text-sm mt-1">
                {activePeriod === "today" && (isPreviewMode ? `${firstName} has no tasks today.` : `Enjoy your day off, ${firstName}.`)}
                {activePeriod === "tomorrow" && "Nothing on tomorrow's list."}
                {activePeriod === "rest_week" && "Rest of the week is clear."}
                {activePeriod === "next_week" && "Next week is empty so far."}
              </p>
            </div>
          ) : allComplete ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-6">
              <span className="text-5xl mb-4">✅</span>
              <p className="text-foreground font-display font-semibold text-lg">All done!</p>
              <p className="text-muted-foreground text-sm mt-1">
                {completedCount} propert{completedCount !== 1 ? "ies" : "y"} cleaned.
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              <AnimatePresence initial={false}>
                {visibleTasks.map((task, idx) => {
                  const isComplete = task.status === "completed";
                  const isInProgress = task.status === "in_progress";
                  const canStart = task.status === "scheduled" || task.status === "unassigned";
                  const isConfirming = confirmingId === task.id;
                  const prev = idx > 0 ? visibleTasks[idx - 1] : null;
                  const sameDayAsPrev = prev && prev.scheduled_date === task.scheduled_date;
                  const km = sameDayAsPrev ? distanceKm(prev!.latitude, prev!.longitude, task.latitude, task.longitude) : null;
                  const mins = sameDayAsPrev ? travelMinutes(prev!.latitude, prev!.longitude, task.latitude, task.longitude) : null;
                  const proposed = proposedCleanTime(task);
                  const showDateHeader = activePeriod !== "today" && (!prev || prev.scheduled_date !== task.scheduled_date);
                  const taskDate = parseISO(task.scheduled_date);

                  return (
                    <div key={task.id}>
                      {showDateHeader && (
                        <div className="mt-3 mb-2 first:mt-0">
                          <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-border/40" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                              {format(taskDate, "EEE d MMM")}
                            </span>
                            <div className="h-px flex-1 bg-border/40" />
                          </div>
                        </div>
                      )}
                      {idx === 0 && cleaner && activePeriod === "today" && (
                        <div className="flex items-center justify-center py-2">
                          <span className="text-xs text-muted-foreground">
                            🏠 ~{travelMinutes(cleaner.home_latitude, cleaner.home_longitude, task.latitude, task.longitude)} min from home
                          </span>
                        </div>
                      )}
                      {idx > 0 && sameDayAsPrev && (
                        <div className="flex flex-col items-center justify-center py-2 gap-0.5">
                          <span className="text-xs text-muted-foreground">
                            🚗 ~{task.travel_time_from_previous_minutes ?? mins} min travel
                          </span>
                          {isPreviewMode && km !== null && (
                            <span className="text-[10px] text-primary/70 font-mono">
                              [{km.toFixed(2)}km · {mins} min haversine]
                            </span>
                          )}
                        </div>
                      )}


                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className={`glass-card p-4 mb-1 transition-all duration-300 ${
                          isComplete ? "border-l-2 border-l-success opacity-60" : ""
                        } ${isInProgress ? "border-2 border-primary/60 animate-pulse-slow" : ""}`}
                      >
                        {task.priority_level === 0 && (
                          <span
                            className="inline-flex items-center gap-1 mb-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30"
                            title="Property already vacant — pre-11am clean possible"
                          >
                            <Sunrise className="h-3 w-3" /> EARLY START
                          </span>
                        )}
                        {isInProgress && (
                          <span className="inline-flex items-center gap-1 mb-2 ml-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                            IN PROGRESS
                          </span>
                        )}
                        <div className="flex items-start gap-3">
                          <div className="mt-1 shrink-0">
                            {isComplete ? (
                              <div className="h-5 w-5 rounded-full bg-success flex items-center justify-center">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-foreground/30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display font-bold text-foreground text-[18px] leading-tight">
                              {task.property_name}
                              {task.bedrooms && (
                                <span className="text-muted-foreground font-normal text-sm ml-1.5">
                                  · {task.bedrooms} bed
                                </span>
                              )}
                            </h3>

                            {task.location_group && (
                              <span className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                                {task.location_group}
                              </span>
                            )}
                            {task.is_same_day_turnaround && (
                              <span className="inline-block mt-1.5 ml-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                                SAME-DAY TURNAROUND
                              </span>
                            )}

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-[14px] text-muted-foreground">
                              {proposed && (
                                <span title="Proposed Clean Time">🕐 Proposed {formatTime(proposed)}</span>
                              )}
                              <span>⏱ {task.cleaning_duration_minutes}m</span>
                              {task.checkout_time && (
                                <span>📋 CO {formatTime(task.checkout_time)}</span>
                              )}
                              {task.is_same_day_turnaround && task.checkin_time && (
                                <span>🔑 CI {formatTime(task.checkin_time)}</span>
                              )}
                            </div>

                            {/* Start Job */}
                            {canStart && (
                              <button
                                onClick={() => handleStartJob(task)}
                                disabled={startingId === task.id || isPreviewMode}
                                className={`w-full mt-4 min-h-[48px] rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                                  isPreviewMode
                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : "bg-primary text-primary-foreground"
                                }`}
                              >
                                {startingId === task.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Play className="h-4 w-4" />
                                    Start Job
                                  </>
                                )}
                              </button>
                            )}

                            {/* Mark Complete / Confirm */}
                            {!isComplete && (
                              <div className={canStart ? "mt-2" : "mt-4"}>
                                {!isConfirming ? (
                                  <motion.button
                                    onClick={() => requestConfirmComplete(task.id)}
                                    disabled={completingId === task.id || isPreviewMode}
                                    className={`w-full min-h-[48px] rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 ${
                                      isPreviewMode
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-success text-primary-foreground"
                                    }`}
                                    whileTap={isPreviewMode ? undefined : { scale: 0.98 }}
                                  >
                                    {completingId === task.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Check className="h-4 w-4" />
                                        {isPreviewMode ? "Mark Complete (disabled in preview)" : "Mark Complete"}
                                      </>
                                    )}
                                  </motion.button>
                                ) : (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex gap-2"
                                  >
                                    <button
                                      onClick={() => handleMarkComplete(task)}
                                      disabled={completingId === task.id}
                                      className="flex-1 min-h-[48px] rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-success text-primary-foreground active:scale-[0.98] disabled:opacity-50"
                                    >
                                      {completingId === task.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="h-4 w-4" />
                                          Yes, confirm
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={cancelConfirm}
                                      className="flex-1 min-h-[48px] rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-muted text-muted-foreground active:scale-[0.98]"
                                    >
                                      <X className="h-4 w-4" />
                                      Cancel
                                    </button>
                                  </motion.div>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() => isPreviewMode ? toast.info("Preview mode — actions disabled") : setFlagTask(task)}
                              className="w-full mt-2 min-h-[44px] rounded-lg border border-destructive/30 text-destructive text-sm font-medium flex items-center justify-center gap-2 hover:bg-destructive/10 transition-colors"
                            >
                              <Flag className="h-3.5 w-3.5" />
                              Flag an Issue
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
              </AnimatePresence>

              {activePeriod === "today" && visibleTasks.length > 0 && (
                <div className="text-center text-xs text-muted-foreground pt-4 pb-2">
                  🏠 {visibleTasks[visibleTasks.length - 1].property_name} → Home
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {flagTask && cleaner && (
        <FlagIssueModal
          open={!!flagTask}
          onClose={() => setFlagTask(null)}
          task={{ id: flagTask.id, listing_id: flagTask.listing_id, property_name: flagTask.property_name }}
          cleanerId={cleaner.id}
          cleanerName={cleaner.name}
        />
      )}
    </div>
  );
}

function PeriodCard({
  label,
  count,
  active,
  onClick,
  fullWidth,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`${fullWidth ? "w-full" : ""} min-h-[72px] rounded-xl px-3 py-2.5 flex flex-col items-center justify-center transition-all active:scale-[0.98] ${
        active
          ? "bg-primary text-primary-foreground shadow-md"
          : "bg-card border border-border/40 text-foreground hover:border-primary/40"
      }`}
    >
      <span className={`text-xs font-medium uppercase tracking-wide ${active ? "opacity-90" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span className={`font-display font-bold ${fullWidth ? "text-2xl" : "text-xl"} mt-0.5`}>
        {count}
      </span>
      <span className={`text-[10px] ${active ? "opacity-80" : "text-muted-foreground"}`}>
        {count === 1 ? "job" : "jobs"}
      </span>
    </button>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="text-muted-foreground hover:text-foreground transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
