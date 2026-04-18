import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, addMonths, format, subYears, differenceInDays } from "date-fns";
import { getNetRevenue, REVENUE_FIELDS } from "@/lib/revenue";

interface ForecastMonth {
  month: string;
  otbRevenue: number;
  projectedPickup: number;
  projectedFinal: number;
  hasHistoricalData: boolean;
}

export function useRevenueForecaster() {
  return useQuery({
    queryKey: ["revenue-forecaster"],
    queryFn: async () => {
      const today = new Date();
      const months = [1, 2, 3].map((i) => startOfMonth(addMonths(today, i)));

      // Fetch listings for location_group mapping
      const { data: listings } = await supabase
        .from("listings")
        .select("id, location_group");
      const listingMap = new Map(
        (listings ?? []).map((l) => [l.id, l.location_group ?? "Unknown"])
      );

      // Date ranges
      const currentStart = format(months[0], "yyyy-MM-dd");
      const currentEnd = format(addMonths(months[2], 1), "yyyy-MM-dd");
      const lastYearStart = format(subYears(months[0], 1), "yyyy-MM-dd");
      const lastYearEnd = format(subYears(addMonths(months[2], 1), 1), "yyyy-MM-dd");

      // Fetch current reservations for next 3 months
      const { data: currentRes } = await supabase
        .from("reservations")
        .select(`listing_id, check_in, ${REVENUE_FIELDS}`)
        .gte("check_in", currentStart)
        .lt("check_in", currentEnd)
        .eq("status", "confirmed");

      // Fetch last year's reservations for same 3 months
      const { data: lastYearRes } = await supabase
        .from("reservations")
        .select(`listing_id, check_in, reservation_date, ${REVENUE_FIELDS}`)
        .gte("check_in", lastYearStart)
        .lt("check_in", lastYearEnd)
        .eq("status", "confirmed");

      const result: ForecastMonth[] = months.map((monthStart) => {
        const monthEnd = addMonths(monthStart, 1);
        const daysUntil = Math.max(0, differenceInDays(monthStart, today));
        const lyMonthStart = subYears(monthStart, 1);
        const lyMonthEnd = subYears(monthEnd, 1);
        const lyCutoff = format(
          new Date(lyMonthStart.getTime() - daysUntil * 86400000),
          "yyyy-MM-dd"
        );

        // Group current OTB by location_group
        const otbByGroup = new Map<string, number>();
        (currentRes ?? []).forEach((r) => {
          const ci = new Date(r.check_in);
          if (ci >= monthStart && ci < monthEnd) {
            const grp = listingMap.get(r.listing_id) ?? "Unknown";
            otbByGroup.set(grp, (otbByGroup.get(grp) ?? 0) + getNetRevenue(r as any));
          }
        });

        // Group last year by location_group: final total & OTB at same lead time
        const lyFinalByGroup = new Map<string, number>();
        const lyOtbByGroup = new Map<string, number>();
        let hasHistorical = false;

        (lastYearRes ?? []).forEach((r) => {
          const ci = new Date(r.check_in);
          if (ci >= lyMonthStart && ci < lyMonthEnd) {
            const grp = listingMap.get(r.listing_id) ?? "Unknown";
            const amt = getNetRevenue(r as any);
            lyFinalByGroup.set(grp, (lyFinalByGroup.get(grp) ?? 0) + amt);
            if (r.reservation_date && r.reservation_date <= lyCutoff) {
              lyOtbByGroup.set(grp, (lyOtbByGroup.get(grp) ?? 0) + amt);
              hasHistorical = true;
            }
          }
        });

        // Calculate projected pickup per group
        let totalOtb = 0;
        let totalPickup = 0;

        otbByGroup.forEach((otb, grp) => {
          totalOtb += otb;
          const lyFinal = lyFinalByGroup.get(grp) ?? 0;
          const lyOtb = lyOtbByGroup.get(grp) ?? 0;

          if (lyOtb > 0 && lyFinal > 0) {
            const ratio = Math.min(5, Math.max(1, lyFinal / lyOtb));
            totalPickup += otb * ratio - otb;
          }
        });

        return {
          month: format(monthStart, "MMM yyyy"),
          otbRevenue: Math.round(totalOtb),
          projectedPickup: Math.round(totalPickup),
          projectedFinal: Math.round(totalOtb + totalPickup),
          hasHistoricalData: hasHistorical,
        };
      });

      return result;
    },
  });
}
