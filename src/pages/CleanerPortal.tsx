import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogOut, Check, Eye, Sun, Moon, Flag, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { FlagIssueModal } from "@/components/cleaner/FlagIssueModal";

interface CleanTask {
  id: string;
  status: string;
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
}

interface CleanerProfile {
  id: string;
  name: string;
  daily_working_hours: number;
  home_latitude: number | null;
  home_longitude: number | null;
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
  return Math.round((km / 40) * 60);
}

export default function CleanerPortal() {
  const { user, loading: authLoading, signOut, role } = useAuth();
  const [cleaner, setCleaner] = useState<CleanerProfile | null>(null);
  const [tasks, setTasks] = useState<CleanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [flagTask, setFlagTask] = useState<CleanTask | null>(null);
  const pageLoadTime = useRef(new Date().toISOString());
  const isCleaner = (role as string) === "cleaner";
  const isAdmin = (role as string) === "super" || (role as string) === "senior";
  const isPreviewMode = isAdmin;

  // Admin cleaner selector state
  const [allCleaners, setAllCleaners] = useState<CleanerProfile[]>([]);
  const [selectedCleanerId, setSelectedCleanerId] = useState<string | null>(null);

  // Fetch all cleaners for admin preview
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
  }, [user, selectedCleanerId, isAdmin]);

  // Poll for cleaners (non-admin only)
  useEffect(() => {
    if (!user || isAdmin) return;
    const interval = setInterval(() => pollNewTasks(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, isAdmin, cleaner]);

  const fetchDataForCleaner = async (cleanerId: string) => {
    setLoading(true);
    const selected = allCleaners.find(c => c.id === cleanerId);
    if (!selected) { setLoading(false); return; }
    setCleaner(selected);

    const today = format(new Date(), "yyyy-MM-dd");
    const { data: taskData } = await supabase
      .from("clean_tasks")
      .select(`
        id, status, route_order, estimated_start_time,
        travel_time_from_previous_minutes, is_same_day_turnaround,
        checkout_time, checkin_time, cleaning_duration_minutes,
        listing_id,
        listings!clean_tasks_listing_id_fkey (name, location_group, bedrooms, latitude, longitude)
      `)
      .eq("assigned_cleaner_id", cleanerId)
      .eq("scheduled_date", today)
      .order("estimated_start_time", { ascending: true, nullsFirst: false });

    if (taskData) {
      setTasks(mapTaskData(taskData));
    }
    setLoading(false);
  };

  const mapTaskData = (taskData: any[]): CleanTask[] =>
    taskData.map((t: any) => ({
      id: t.id,
      status: t.status,
      route_order: t.route_order,
      estimated_start_time: t.estimated_start_time,
      travel_time_from_previous_minutes: t.travel_time_from_previous_minutes,
      is_same_day_turnaround: t.is_same_day_turnaround,
      checkout_time: t.checkout_time,
      checkin_time: t.checkin_time,
      cleaning_duration_minutes: t.cleaning_duration_minutes,
      listing_id: t.listing_id,
      property_name: t.listings?.name ?? "Unknown",
      location_group: t.listings?.location_group ?? null,
      bedrooms: t.listings?.bedrooms ?? null,
      latitude: t.listings?.latitude ?? null,
      longitude: t.listings?.longitude ?? null,
    }));

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: cleanerData } = await supabase
      .from("cleaners")
      .select("id, name, daily_working_hours, home_latitude, home_longitude")
      .eq("user_id", user.id)
      .single();

    if (!cleanerData) {
      setLoading(false);
      return;
    }
    setCleaner(cleanerData as any as CleanerProfile);

    const today = format(new Date(), "yyyy-MM-dd");
    const { data: taskData } = await supabase
      .from("clean_tasks")
      .select(`
        id, status, route_order, estimated_start_time,
        travel_time_from_previous_minutes, is_same_day_turnaround,
        checkout_time, checkin_time, cleaning_duration_minutes,
        listing_id,
        listings!clean_tasks_listing_id_fkey (name, location_group, bedrooms, latitude, longitude)
      `)
      .eq("assigned_cleaner_id", cleanerData.id)
      .eq("scheduled_date", today)
      .order("estimated_start_time", { ascending: true, nullsFirst: false });

    if (taskData) {
      setTasks(mapTaskData(taskData));
    }
    setLoading(false);
  };

  const pollNewTasks = async () => {
    if (!cleaner) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("clean_tasks")
      .select(`
        id, status, route_order, estimated_start_time,
        travel_time_from_previous_minutes, is_same_day_turnaround,
        checkout_time, checkin_time, cleaning_duration_minutes,
        listing_id, created_at,
        listings!clean_tasks_listing_id_fkey (name, location_group, bedrooms, latitude, longitude)
      `)
      .eq("assigned_cleaner_id", cleaner.id)
      .eq("scheduled_date", today)
      .gt("created_at", pageLoadTime.current)
      .order("estimated_start_time", { ascending: true, nullsFirst: false });

    if (data && data.length > 0) {
      pageLoadTime.current = new Date().toISOString();
      const newTasks = mapTaskData(data);

      setTasks((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const onlyNew = newTasks.filter((n: CleanTask) => !existingIds.has(n.id));
        if (onlyNew.length === 0) return prev;
        const merged = [...prev, ...onlyNew].sort(
          (a, b) => (a.estimated_start_time ?? "99:99").localeCompare(b.estimated_start_time ?? "99:99")
        );
        onlyNew.forEach((n: CleanTask) => {
          toast(`⚡ New job added — ${n.property_name} — tap to view`);
        });
        return merged;
      });
    }
  };

  const handleMarkComplete = async (task: CleanTask) => {
    if (isPreviewMode) {
      toast.info("Preview mode — actions are disabled");
      return;
    }
    setCompletingId(task.id);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: "complete" } : t
      )
    );

    const [taskRes, listingRes] = await Promise.all([
      supabase
        .from("clean_tasks")
        .update({ status: "complete", completed_at: new Date().toISOString() })
        .eq("id", task.id),
      supabase
        .from("listings")
        .update({ is_clean: true })
        .eq("id", task.listing_id),
    ]);

    if (taskRes.error || listingRes.error) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "scheduled" } : t
        )
      );
      toast.error("Failed to mark complete. Please try again.");
    } else {
      toast.success(`✓ ${task.property_name} marked complete`);
    }
    setCompletingId(null);
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

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect non-cleaners and non-admins
  if (!authLoading && role && !isCleaner && !isAdmin) {
    return <Navigate to="/today" replace />;
  }

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
  const todayFormatted = format(new Date(), "EEEE, d MMMM yyyy");

  const totalMinutes = tasks.reduce(
    (sum, t) =>
      sum +
      t.cleaning_duration_minutes +
      (t.travel_time_from_previous_minutes ?? 0),
    0
  );
  const maxMinutes = (displayCleaner?.daily_working_hours ?? 8) * 60;
  const capacityPct = maxMinutes > 0 ? Math.round((totalMinutes / maxMinutes) * 100) : 0;
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const maxHours = Math.floor(maxMinutes / 60);

  const completedCount = tasks.filter((t) => t.status === "complete").length;
  const allComplete = tasks.length > 0 && completedCount === tasks.length;

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
                <p className="text-xs text-muted-foreground mt-0.5">
                  {todayFormatted}
                </p>
              </div>
            </div>
            <div
              className={`text-xs font-semibold px-2.5 py-1 rounded-full mt-1 ${
                capacityPct > 100
                  ? "bg-destructive/20 text-destructive"
                  : "bg-primary/15 text-primary"
              }`}
            >
              {capacityPct}% capacity
            </div>
          </div>

          {/* Capacity bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>
                {totalHours}h {totalMins}m / {maxHours}h working day
              </span>
            </div>
            <Progress
              value={Math.min(capacityPct, 100)}
              className={`h-2 ${capacityPct > 90 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
            />
          </div>

          {/* Route summary */}
          {tasks.length > 0 && (
            <div className="mt-3 text-center text-xs text-muted-foreground">
              🏠 Home → {tasks.length} stop{tasks.length !== 1 ? "s" : ""} → 🏠 Home
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-4 pt-4 pb-8" style={{ paddingBottom: "env(safe-area-inset-bottom, 2rem)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-6">
              <span className="text-5xl mb-4">🌅</span>
              <p className="text-foreground font-display font-semibold text-lg">
                No cleans scheduled for today.
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {isPreviewMode ? `${firstName} has no tasks today.` : `Enjoy your day off, ${firstName}.`}
              </p>
            </div>
          ) : allComplete ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-6">
              <span className="text-5xl mb-4">✅</span>
              <p className="text-foreground font-display font-semibold text-lg">
                All done for today!
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {completedCount} propert{completedCount !== 1 ? "ies" : "y"} cleaned. {isPreviewMode ? "" : `Great work, ${firstName}.`}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              <AnimatePresence initial={false}>
                {tasks.map((task, idx) => {
                  const isComplete = task.status === "complete";

                  return (
                    <div key={task.id}>
                      {/* Home → first travel connector */}
                      {idx === 0 && cleaner && (
                        <div className="flex items-center justify-center py-2">
                          <span className="text-xs text-muted-foreground">
                            🏠 ~{travelMinutes(cleaner.home_latitude, cleaner.home_longitude, task.latitude, task.longitude)} min from home
                          </span>
                        </div>
                      )}
                      {/* Travel connector between tasks */}
                      {idx > 0 && (
                        <div className="flex items-center justify-center py-2">
                          <span className="text-xs text-muted-foreground">
                            🚗 ~{task.travel_time_from_previous_minutes ?? travelMinutes(tasks[idx - 1].latitude, tasks[idx - 1].longitude, task.latitude, task.longitude)} min travel
                          </span>
                        </div>
                      )}

                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className={`glass-card p-4 mb-1 transition-all duration-300 ${
                          isComplete
                            ? "border-l-2 border-l-success opacity-60"
                            : ""
                        }`}
                      >
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
                              {task.estimated_start_time && (
                                <span>🕐 {formatTime(task.estimated_start_time)}</span>
                              )}
                              <span>⏱ {task.cleaning_duration_minutes}m</span>
                              {task.checkout_time && (
                                <span>📋 CO {formatTime(task.checkout_time)}</span>
                              )}
                              {task.is_same_day_turnaround && task.checkin_time && (
                                <span>🔑 CI {formatTime(task.checkin_time)}</span>
                              )}
                            </div>

                            {!isComplete && (
                              <motion.button
                                onClick={() => handleMarkComplete(task)}
                                disabled={completingId === task.id || isPreviewMode}
                                className={`w-full mt-4 min-h-[48px] rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 ${
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

              {tasks.length > 0 && (
                <div className="text-center text-xs text-muted-foreground pt-4 pb-2">
                  🏠 {tasks[tasks.length - 1].property_name} → Home
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

