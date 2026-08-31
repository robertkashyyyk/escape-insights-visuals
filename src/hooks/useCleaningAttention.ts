import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { format, addDays, startOfDay } from "date-fns";

export type DayState = "green" | "amber" | "red" | "empty";

/** Cleaning-capacity signals for the command centre: per-day traffic-light state
 *  (all regions) over the next `days`, plus roll-ups for the attention strip. */
export function useCleaningAttention(days = 14) {
  const start = startOfDay(new Date());
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(addDays(start, days - 1), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["cleaning-attention", startStr, endStr],
    queryFn: async () => {
      const rows = await fetchAllRows<any>(() =>
        supabase.from("clean_tasks")
          .select("scheduled_date, status, assigned_cleaner_id, overloaded")
          .gte("scheduled_date", startStr).lte("scheduled_date", endStr)
          .not("status", "in", "(cancelled,canceled)"));

      const byDay = new Map<string, { total: number; unassigned: number; over: number }>();
      for (const t of rows) {
        const c = byDay.get(t.scheduled_date) ?? { total: 0, unassigned: 0, over: 0 };
        c.total++;
        const done = t.status === "completed" || t.status === "done";
        if (!t.assigned_cleaner_id && !done) c.unassigned++;
        if (t.overloaded) c.over++;
        byDay.set(t.scheduled_date, c);
      }

      const list = Array.from({ length: days }, (_, i) => {
        const d = addDays(start, i);
        const c = byDay.get(format(d, "yyyy-MM-dd")) ?? { total: 0, unassigned: 0, over: 0 };
        const state: DayState = c.total === 0 ? "empty" : c.unassigned > 0 ? "red" : c.over > 0 ? "amber" : "green";
        return { date: d, ...c, state };
      });

      return {
        days: list,
        unassignedToday: list[0].unassigned,
        unassignedTotal: list.reduce((s, d) => s + d.unassigned, 0),
        redDays: list.filter((d) => d.state === "red").length,
        amberDays: list.filter((d) => d.state === "amber").length,
      };
    },
  });
}
