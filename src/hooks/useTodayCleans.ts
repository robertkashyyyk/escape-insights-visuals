import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay } from "date-fns";

export interface TodayCleanRow {
  id: string;
  status: string;
  assigned_cleaner_id: string | null;
  completed_at: string | null;
  priority_level: number | null;
  checkout_time: string | null;
  checkin_time: string | null;
  is_same_day_turnaround: boolean | null;
  listing_name: string;
  cleaner_name: string | null;
}

export function useTodayCleans() {
  const todayStr = format(startOfDay(new Date()), "yyyy-MM-dd");

  return useQuery<TodayCleanRow[]>({
    queryKey: ["today-cleans", todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("clean_tasks" as any)
        .select(
          "id, status, assigned_cleaner_id, completed_at, priority_level, checkout_time, checkin_time, is_same_day_turnaround, listings(name), cleaners(name)"
        )
        .eq("scheduled_date", todayStr)
        .not("status", "in", "(cancelled,canceled)")
        .order("priority_level", { ascending: true, nullsFirst: false })
        .order("checkout_time", { ascending: true, nullsFirst: false });
      return ((data || []) as any[]).map((r) => ({
        id: r.id,
        status: r.status,
        assigned_cleaner_id: r.assigned_cleaner_id,
        completed_at: r.completed_at,
        priority_level: r.priority_level,
        checkout_time: r.checkout_time,
        checkin_time: r.checkin_time,
        is_same_day_turnaround: r.is_same_day_turnaround,
        listing_name: r.listings?.name ?? "Unknown property",
        cleaner_name: r.cleaners?.name ?? null,
      }));
    },
  });
}
