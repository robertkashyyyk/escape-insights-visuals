import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogOut, Check } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

interface CleanTask {
  id: string;
  status: string;
  route_order: number;
  estimated_start_time: string | null;
  travel_time_from_previous_minutes: number | null;
  is_same_day_turnaround: boolean;
  checkout_time: string | null;
  checkin_time: string | null;
  cleaning_duration_minutes: number;
  listing_id: string;
  property_name: string;
  location_group: string | null;
  bedrooms: number | null;
}

interface CleanerProfile {
  id: string;
  name: string;
  daily_working_hours: number;
}

export default function CleanerPortal() {
  const { user, loading: authLoading, signOut, role } = useAuth();
  const [cleaner, setCleaner] = useState<CleanerProfile | null>(null);
  const [tasks, setTasks] = useState<CleanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const pageLoadTime = useRef(new Date().toISOString());
  const isCleaner = (role as string) === "cleaner";

  useEffect(() => {
    if (!user) return;
    fetchData();

    // Poll every 5 minutes for new tasks
    const interval = setInterval(() => pollNewTasks(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Get cleaner profile
    const { data: cleanerData } = await supabase
      .from("cleaners")
      .select("id, name, daily_working_hours")
      .eq("user_id", user.id)
      .single();

    if (!cleanerData) {
      setLoading(false);
      return;
    }
    setCleaner(cleanerData);

    // Get today's tasks
    const today = format(new Date(), "yyyy-MM-dd");
    const { data: taskData } = await supabase
      .from("clean_tasks")
      .select(`
        id, status, route_order, estimated_start_time,
        travel_time_from_previous_minutes, is_same_day_turnaround,
        checkout_time, checkin_time, cleaning_duration_minutes,
        listing_id,
        listings!clean_tasks_listing_id_fkey (name, location_group, bedrooms)
      `)
      .eq("assigned_cleaner_id", cleanerData.id)
      .eq("scheduled_date", today)
      .order("route_order", { ascending: true });

    if (taskData) {
      setTasks(
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
        }))
      );
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
        listings!clean_tasks_listing_id_fkey (name, location_group, bedrooms)
      `)
      .eq("assigned_cleaner_id", cleaner.id)
      .eq("scheduled_date", today)
      .gt("created_at", pageLoadTime.current)
      .order("route_order", { ascending: true });

    if (data && data.length > 0) {
      pageLoadTime.current = new Date().toISOString();
      const newTasks = data.map((t: any) => ({
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
      }));

      setTasks((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const onlyNew = newTasks.filter((n: CleanTask) => !existingIds.has(n.id));
        if (onlyNew.length === 0) return prev;
        const merged = [...prev, ...onlyNew].sort(
          (a, b) => a.route_order - b.route_order
        );
        onlyNew.forEach((n: CleanTask) => {
          toast(`⚡ New job added — ${n.property_name} — tap to view`);
        });
        return merged;
      });
    }
  };

  const handleMarkComplete = async (task: CleanTask) => {
    setCompletingId(task.id);

    // Optimistic update
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
      // Revert
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
    // time is HH:MM:SS, show HH:MM
    return time.substring(0, 5);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect non-cleaners
  if (!authLoading && role && !isCleaner) {
    return <Navigate to="/today" replace />;
  }

  if (!cleaner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="text-muted-foreground text-center">
          No cleaner profile linked to your account. Please contact your manager.
        </p>
      </div>
    );
  }

  const firstName = cleaner.name.split(" ")[0];
  const initial = firstName.charAt(0).toUpperCase();
  const todayFormatted = format(new Date(), "EEEE, d MMMM yyyy");

  const totalMinutes = tasks.reduce(
    (sum, t) =>
      sum +
      t.cleaning_duration_minutes +
      (t.travel_time_from_previous_minutes ?? 0),
    0
  );
  const maxMinutes = cleaner.daily_working_hours * 60;
  const capacityPct = maxMinutes > 0 ? Math.round((totalMinutes / maxMinutes) * 100) : 0;
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const maxHours = Math.floor(maxMinutes / 60);

  const completedCount = tasks.filter((t) => t.status === "complete").length;
  const allComplete = tasks.length > 0 && completedCount === tasks.length;

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[430px] flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <img
            src="/images/eg_icon_standalone.png"
            alt="Escape Grids"
            className="h-7 w-7 object-contain opacity-60"
          />
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[48px] flex items-center"
          >
            <LogOut className="h-3.5 w-3.5 mr-1" />
            Sign out
          </button>
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
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-6">
              <span className="text-5xl mb-4">🌅</span>
              <p className="text-foreground font-display font-semibold text-lg">
                No cleans scheduled for today.
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                Enjoy your day off, {firstName}.
              </p>
            </div>
          ) : allComplete ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-6">
              <span className="text-5xl mb-4">✅</span>
              <p className="text-foreground font-display font-semibold text-lg">
                All done for today!
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {completedCount} propert{completedCount !== 1 ? "ies" : "y"} cleaned. Great work, {firstName}.
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              <AnimatePresence initial={false}>
                {tasks.map((task, idx) => {
                  const isComplete = task.status === "complete";
                  const isNewlyAdded = false; // Could track for pulsing border

                  return (
                    <div key={task.id}>
                      {/* Travel connector */}
                      {idx > 0 && task.travel_time_from_previous_minutes != null && task.travel_time_from_previous_minutes > 0 && (
                        <div className="flex items-center justify-center py-2">
                          <span className="text-xs text-muted-foreground">
                            🚗 ~{task.travel_time_from_previous_minutes} min travel
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
                        {/* Status + Property name */}
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

                            {/* Location badge */}
                            {task.location_group && (
                              <span className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                                {task.location_group}
                              </span>
                            )}

                            {/* Same-day turnaround badge */}
                            {task.is_same_day_turnaround && (
                              <span className="inline-block mt-1.5 ml-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                                SAME-DAY TURNAROUND
                              </span>
                            )}

                            {/* Info row */}
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

                            {/* Mark Complete button */}
                            {!isComplete && (
                              <motion.button
                                onClick={() => handleMarkComplete(task)}
                                disabled={completingId === task.id}
                                className="w-full mt-4 min-h-[48px] rounded-lg bg-success text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
                                whileTap={{ scale: 0.98 }}
                              >
                                {completingId === task.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    Mark Complete
                                  </>
                                )}
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
              </AnimatePresence>

              {/* Footer: last property → home */}
              {tasks.length > 0 && (
                <div className="text-center text-xs text-muted-foreground pt-4 pb-2">
                  🏠 {tasks[tasks.length - 1].property_name} → Home
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
