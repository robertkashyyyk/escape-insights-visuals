import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek } from "date-fns";

export interface MatrixListing {
  id: string;
  name: string;
  location_group: string | null;
  default_check_out_time: string | null;
  default_check_in_time: string | null;
  min_stay_nights: number;
}

export interface MatrixCleaner {
  id: string;
  name: string;
  active: boolean;
  location_groups?: string[];
  color?: string | null;
  non_working_days?: string[];
}

export interface CleanerHolidayRow {
  id: string;
  cleaner_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export interface MatrixTask {
  id: string;
  listing_id: string;
  scheduled_date: string;
  status: string;            // 'unassigned' | 'scheduled' | 'in_progress' | 'completed'
  assigned_cleaner_id: string | null;
  reservation_id: string | null;
  checkout_time: string | null;
  checkin_time: string | null;
  is_same_day_turnaround: boolean | null;
  cleaning_duration_minutes: number;
  source: string;            // 'hostaway' | 'manual'
  task_type: string;         // 'clean' | 'interim' | 'maintenance'
  notes: string | null;
  priority: string;
  completed_at: string | null;
  overloaded?: boolean | null;
  override_assignment?: boolean | null;
  warning_reason?: string | null;
}

export interface MatrixReservation {
  id: string;
  listing_id: string;
  check_in: string;
  check_out: string;
  guest_name: string;
  check_in_time: string | null;
  check_out_time: string | null;
}

export function useMatrixSchedule(weekAnchor: Date) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  // Days of the week
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Listings
  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["matrix-listings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, name, location_group, default_check_in_time, default_check_out_time, status, is_bundle, min_stay_nights")
        .eq("status", "active");
      return ((data || []) as any[])
        .filter(l => !l.is_bundle)
        .map(l => ({
          id: l.id,
          name: l.name,
          location_group: l.location_group,
          default_check_in_time: l.default_check_in_time,
          default_check_out_time: l.default_check_out_time,
          min_stay_nights: l.min_stay_nights ?? 2,
        })) as MatrixListing[];
    },
  });

  // Cleaners
  const { data: cleaners = [] } = useQuery({
    queryKey: ["matrix-cleaners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cleaners" as any)
        .select("id, name, active, location_groups, color, non_working_days")
        .eq("active", true)
        .order("name");
      return (data || []) as unknown as MatrixCleaner[];
    },
  });

  // Cleaner holidays overlapping the visible week
  const { data: holidays = [] } = useQuery({
    queryKey: ["matrix-holidays", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("cleaner_holidays" as any)
        .select("id, cleaner_id, start_date, end_date, reason")
        .lte("start_date", weekEndStr)
        .gte("end_date", weekStartStr);
      return (data || []) as unknown as CleanerHolidayRow[];
    },
  });


  // Tasks for the week
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["matrix-tasks", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("clean_tasks" as any)
        .select("*")
        .gte("scheduled_date", weekStartStr)
        .lte("scheduled_date", weekEndStr);
      return (data || []) as unknown as MatrixTask[];
    },
  });

  // Reservations covering the week (for guest names + times)
  const { data: reservations = [] } = useQuery({
    queryKey: ["matrix-reservations", weekStartStr, weekEndStr],
    queryFn: async () => {
      // Widen window so we can detect orphan gaps that span the week boundary.
      const lookStart = format(addDays(weekStart, -14), "yyyy-MM-dd");
      const lookEnd = format(addDays(weekEnd, 14), "yyyy-MM-dd");
      const { data } = await supabase
        .from("reservations")
        .select("id, listing_id, check_in, check_out, guest_name, check_in_time, check_out_time, status")
        .eq("status", "confirmed")
        .gte("check_out", lookStart)
        .lte("check_in", lookEnd);
      return (data || []) as MatrixReservation[];
    },
  });

  // Realtime subscription — scoped to the current week's tasks only.
  // Filter by scheduled_date range so we don't listen to the entire table.
  useEffect(() => {
    const channel = supabase
      .channel(`matrix-clean-tasks-${weekStartStr}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clean_tasks",
          filter: `scheduled_date=gte.${weekStartStr}`,
        },
        (payload: any) => {
          // Secondary client-side guard for the upper bound (Realtime filters
          // only support a single predicate per subscription).
          const row = payload.new ?? payload.old;
          const d = row?.scheduled_date as string | undefined;
          if (!d || d > weekEndStr) return;
          qc.invalidateQueries({ queryKey: ["matrix-tasks", weekStartStr, weekEndStr] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, weekStartStr, weekEndStr]);

  // Lazy auto-generate: if the user navigates to a current/future week that has
  // zero tasks but reservations exist, kick off generation automatically.
  // Visible to caller via `autoGenerating` so the UI can show a spinner.
  const [autoGenerating, setAutoGenerating] = useState(false);
  const inFlightRef = useRef<Set<string>>(new Set());
  const recentSuccessRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (tasksLoading) return;
    if (tasks.length > 0) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (weekEndStr < todayStr) return;
    const hasCheckoutsInWeek = reservations.some(
      (r) => r.check_out >= weekStartStr && r.check_out <= weekEndStr
    );
    if (!hasCheckoutsInWeek) return;

    // Skip if already in flight or successfully generated in the last 60s
    if (inFlightRef.current.has(weekStartStr)) return;
    const lastOk = recentSuccessRef.current.get(weekStartStr);
    if (lastOk && Date.now() - lastOk < 60_000) return;

    inFlightRef.current.add(weekStartStr);
    setAutoGenerating(true);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-daily-cleaning-schedule", {
          body: { date: weekStartStr, days_ahead: 7 },
        });
        if (error) throw error;
        recentSuccessRef.current.set(weekStartStr, Date.now());
        const created = (data as any)?.tasks_created ?? (data as any)?.tasksCreated ?? (data as any)?.created ?? null;
        if (created != null && created > 0) {
          toast({ title: "Week populated", description: `${created} clean${created === 1 ? "" : "s"} auto-scheduled` });
        }
        await qc.invalidateQueries({ queryKey: ["matrix-tasks", weekStartStr, weekEndStr] });
      } catch (e) {
        console.warn("Auto-generate cleaning schedule failed", e);
      } finally {
        inFlightRef.current.delete(weekStartStr);
        setAutoGenerating(false);
      }
    })();
  }, [tasksLoading, tasks.length, reservations, weekStartStr, weekEndStr, qc, toast]);

  // Mutations
  const reassignTask = useCallback(async (taskId: string, cleanerId: string | null, override?: { reason: string }) => {
    const newStatus = cleanerId ? "scheduled" : "unassigned";
    const patch: Record<string, unknown> = { assigned_cleaner_id: cleanerId, status: newStatus };
    if (cleanerId && override) {
      patch.override_assignment = true;
      patch.warning_reason = override.reason;
    } else if (!cleanerId) {
      patch.override_assignment = false;
      patch.warning_reason = null;
    }
    const { error } = await (supabase.from("clean_tasks" as any) as any)
      .update(patch)
      .eq("id", taskId);
    if (error) {
      toast({ title: "Reassignment failed", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["matrix-tasks", weekStartStr, weekEndStr] });
    return true;
  }, [qc, toast, weekStartStr, weekEndStr]);

  const completeTask = useCallback(async (taskId: string, listingId: string) => {
    const { error } = await (supabase.from("clean_tasks" as any) as any)
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return false;
    }
    await supabase.from("listings").update({ is_clean: true } as any).eq("id", listingId);
    qc.invalidateQueries({ queryKey: ["matrix-tasks", weekStartStr, weekEndStr] });
    toast({ title: "Marked complete" });
    return true;
  }, [qc, toast, weekStartStr, weekEndStr]);

  const undoComplete = useCallback(async (taskId: string, listingId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const newStatus = task?.assigned_cleaner_id ? "scheduled" : "unassigned";
    const { error } = await (supabase.from("clean_tasks" as any) as any)
      .update({ status: newStatus, completed_at: null })
      .eq("id", taskId);
    if (error) {
      toast({ title: "Undo failed", description: error.message, variant: "destructive" });
      return false;
    }
    await supabase.from("listings").update({ is_clean: false } as any).eq("id", listingId);
    qc.invalidateQueries({ queryKey: ["matrix-tasks", weekStartStr, weekEndStr] });
    toast({ title: "Undone", description: "Clean restored as scheduled." });
    return true;
  }, [qc, toast, tasks, weekStartStr, weekEndStr]);

  const removeTask = useCallback(async (taskId: string) => {
    // Capture metadata before delete so we can self-heal
    const task = tasks.find(t => t.id === taskId);
    const scheduledDate = task?.scheduled_date;
    const reservationId = task?.reservation_id;
    const source = task?.source;
    const listingId = task?.listing_id;

    const { error } = await (supabase.from("clean_tasks" as any) as any)
      .delete()
      .eq("id", taskId);
    if (error) {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
      return false;
    }
    // Reset is_clean so the property is no longer marked clean
    if (listingId) {
      await supabase.from("listings").update({ is_clean: false } as any).eq("id", listingId);
    }
    qc.invalidateQueries({ queryKey: ["matrix-tasks", weekStartStr, weekEndStr] });

    // Self-heal: regenerate from source reservation if applicable
    if (source === "manual") {
      toast({
        title: "Manual clean removed",
        description: "Add another from the + button if needed.",
      });
    } else if (reservationId && scheduledDate) {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "generate-daily-cleaning-schedule",
          { body: { date: scheduledDate } }
        );
        if (fnErr) throw fnErr;
        const created = data?.tasks_created ?? 0;
        if (created > 0) {
          toast({
            title: "Cleaning task removed",
            description: `Auto-regenerated ${created} task${created === 1 ? "" : "s"} for ${scheduledDate}.`,
          });
        } else {
          toast({
            title: "Cleaning task removed",
            description: `Could not auto-regenerate — the source reservation may have been cancelled.`,
          });
        }
        qc.invalidateQueries({ queryKey: ["matrix-tasks", weekStartStr, weekEndStr] });
      } catch (err: any) {
        toast({
          title: "Cleaning task removed",
          description: `Regenerate failed: ${err.message}`,
          variant: "destructive",
        });
      }
    } else {
      toast({ title: "Cleaning task removed" });
    }
    return true;
  }, [qc, toast, tasks, weekStartStr, weekEndStr]);

  const updateNotes = useCallback(async (taskId: string, notes: string) => {
    const { error } = await (supabase.from("clean_tasks" as any) as any)
      .update({ notes })
      .eq("id", taskId);
    if (error) {
      toast({ title: "Failed to save note", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["matrix-tasks", weekStartStr, weekEndStr] });
    return true;
  }, [qc, toast, weekStartStr, weekEndStr]);

  const addManualClean = useCallback(async (input: {
    listing_id: string;
    scheduled_date: string;
    task_type: "clean" | "interim" | "maintenance";
    assigned_cleaner_id: string | null;
    notes: string | null;
    override_assignment?: boolean;
    warning_reason?: string | null;
  }) => {
    const { error } = await (supabase.from("clean_tasks" as any) as any).insert({
      listing_id: input.listing_id,
      scheduled_date: input.scheduled_date,
      task_type: input.task_type,
      assigned_cleaner_id: input.assigned_cleaner_id,
      status: input.assigned_cleaner_id ? "scheduled" : "unassigned",
      notes: input.notes,
      source: "manual",
      priority: "standard",
      cleaning_duration_minutes: 90,
      override_assignment: input.override_assignment ?? false,
      warning_reason: input.warning_reason ?? null,
    });
    if (error) {
      toast({ title: "Failed to add", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["matrix-tasks", weekStartStr, weekEndStr] });
    toast({ title: "Manual clean added" });
    return true;
  }, [qc, toast, weekStartStr, weekEndStr]);

  // Group listings by location_group, sorted
  const groupedListings = useMemo(() => {
    const map = new Map<string, MatrixListing[]>();
    for (const l of listings) {
      const g = l.location_group || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(l);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [listings]);

  return {
    weekStart, weekEnd, days,
    listings, groupedListings,
    cleaners, tasks, reservations, holidays,
    isLoading: listingsLoading || tasksLoading,
    autoGenerating,
    reassignTask, completeTask, undoComplete, removeTask, updateNotes, addManualClean,
  };
}
