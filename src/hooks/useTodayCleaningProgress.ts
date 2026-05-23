import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay } from "date-fns";

export interface TodayCleaningProgress {
  total: number;
  completed: number;
  unassigned: number;
  isLoading: boolean;
}

export function useTodayCleaningProgress() {
  const qc = useQueryClient();
  const todayStr = format(startOfDay(new Date()), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["today-cleaning-progress", todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("clean_tasks" as any)
        .select("id, status, assigned_cleaner_id")
        .eq("scheduled_date", todayStr);
      const rows = (data || []) as any[];
      const total = rows.length;
      const completed = rows.filter(r => r.status === "completed").length;
      const unassigned = rows.filter(r => !r.assigned_cleaner_id).length;
      return { total, completed, unassigned };
    },
  });

  useEffect(() => {
    const topic = `today-cleaning-progress-${todayStr}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(topic);
    channel
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "clean_tasks",
          filter: `scheduled_date=eq.${todayStr}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["today-cleaning-progress", todayStr] });
          qc.invalidateQueries({ queryKey: ["today-cleans", todayStr] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, todayStr]);

  return {
    total: data?.total ?? 0,
    completed: data?.completed ?? 0,
    unassigned: data?.unassigned ?? 0,
    isLoading,
  };
}
