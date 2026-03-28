import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subYears, differenceInDays, format } from "date-fns";

export function useRevenuePacing(targetMonth: Date) {
  return useQuery({
    queryKey: ["revenue-pacing", format(targetMonth, "yyyy-MM")],
    queryFn: async () => {
      const monthStart = startOfMonth(targetMonth);
      const monthEnd = endOfMonth(targetMonth);
      const today = new Date();
      const daysUntilStart = Math.max(0, differenceInDays(monthStart, today));

      // Current year: all reservations with check_in in targetMonth
      const { data: currentData } = await supabase
        .from("reservations")
        .select("total_amount, reservation_date")
        .gte("check_in", format(monthStart, "yyyy-MM-dd"))
        .lte("check_in", format(monthEnd, "yyyy-MM-dd"));

      const currentRevenue = (currentData || []).reduce(
        (sum, r) => sum + (r.total_amount || 0),
        0
      );

      // Previous year same month
      const lastYearStart = startOfMonth(subYears(monthStart, 1));
      const lastYearEnd = endOfMonth(subYears(monthStart, 1));

      // Historical: bookings that were on the books at the same lead time
      // reservation_date <= (lastYearStart - daysUntilStart) equivalent point
      const cutoffDate = new Date(lastYearStart);
      cutoffDate.setDate(cutoffDate.getDate() - daysUntilStart);

      const { data: historicalAtPoint } = await supabase
        .from("reservations")
        .select("total_amount, reservation_date")
        .gte("check_in", format(lastYearStart, "yyyy-MM-dd"))
        .lte("check_in", format(lastYearEnd, "yyyy-MM-dd"))
        .lte("reservation_date", format(cutoffDate, "yyyy-MM-dd"));

      const historicalRevenue = (historicalAtPoint || []).reduce(
        (sum, r) => sum + (r.total_amount || 0),
        0
      );

      // Final historical total (all reservations for that month last year)
      const { data: historicalAll } = await supabase
        .from("reservations")
        .select("total_amount")
        .gte("check_in", format(lastYearStart, "yyyy-MM-dd"))
        .lte("check_in", format(lastYearEnd, "yyyy-MM-dd"));

      const historicalFinalRevenue = (historicalAll || []).reduce(
        (sum, r) => sum + (r.total_amount || 0),
        0
      );

      const pacingPct =
        historicalRevenue > 0
          ? (currentRevenue / historicalRevenue) * 100
          : currentRevenue > 0
          ? 100
          : 0;

      return {
        currentRevenue,
        historicalRevenue,
        historicalFinalRevenue,
        pacingPct,
        daysUntilStart,
      };
    },
  });
}
