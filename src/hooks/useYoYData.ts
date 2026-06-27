import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  setWeek,
  setMonth,
  setYear,
  differenceInCalendarDays,
  format,
} from "date-fns";
import { getGrossRevenue, REVENUE_FIELDS } from "@/lib/revenue";

export type PeriodType = "week" | "month" | "quarter";

interface PropertyYoY {
  listingId: string;
  name: string;
  city: string | null;
  currentRevenue: number;
  previousRevenue: number;
  currentAdr: number;
  previousAdr: number;
  currentOccupancy: number;
  previousOccupancy: number;
  revenueChange: number | null;
  adrChange: number | null;
  occupancyChange: number | null;
  isNew: boolean;
}

function getDateRange(periodType: PeriodType, periodValue: number, year: number) {
  let base = new Date(year, 0, 1);

  if (periodType === "week") {
    base = setWeek(setYear(new Date(), year), periodValue, { weekStartsOn: 1 });
    return { start: startOfWeek(base, { weekStartsOn: 1 }), end: endOfWeek(base, { weekStartsOn: 1 }) };
  }
  if (periodType === "month") {
    base = setMonth(setYear(new Date(), year), periodValue - 1);
    return { start: startOfMonth(base), end: endOfMonth(base) };
  }
  // quarter
  const quarterMonth = (periodValue - 1) * 3;
  base = setMonth(setYear(new Date(), year), quarterMonth);
  return { start: startOfQuarter(base), end: endOfQuarter(base) };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : null;
  return ((current - previous) / previous) * 100;
}

export function useYoYData(periodType: PeriodType, periodValue: number, year: number) {
  return useQuery({
    queryKey: ["yoy", periodType, periodValue, year],
    queryFn: async (): Promise<PropertyYoY[]> => {
      const current = getDateRange(periodType, periodValue, year);
      const previous = getDateRange(periodType, periodValue, year - 1);

      const daysInPeriod = differenceInCalendarDays(current.end, current.start) + 1;

      const fmt = (d: Date) => format(d, "yyyy-MM-dd");

      // Fetch both periods + listings in parallel
      const [curRes, prevRes, listingsRes] = await Promise.all([
        fetchAllRows<any>(() => supabase
          .from("reservations")
          .select(`listing_id, check_in, check_out, ${REVENUE_FIELDS}`)
          .gte("check_in", fmt(current.start))
          .lte("check_in", fmt(current.end))
          .eq("status", "confirmed")),
        fetchAllRows<any>(() => supabase
          .from("reservations")
          .select(`listing_id, check_in, check_out, ${REVENUE_FIELDS}`)
          .gte("check_in", fmt(previous.start))
          .lte("check_in", fmt(previous.end))
          .eq("status", "confirmed")),
        supabase.from("listings").select("id, name, city"),
      ]);

      if (listingsRes.error) throw listingsRes.error;
      const listings = listingsRes.data;

      const listingMap = new Map((listings || []).map((l) => [l.id, l]));

      type Agg = { revenue: number; nights: number };
      const aggregate = (rows: typeof curRes) => {
        const map = new Map<string, Agg>();
        for (const r of rows || []) {
          const nights = differenceInCalendarDays(new Date(r.check_out), new Date(r.check_in));
          const prev = map.get(r.listing_id) || { revenue: 0, nights: 0 };
          prev.revenue += getGrossRevenue(r as any);
          prev.nights += nights > 0 ? nights : 1;
          map.set(r.listing_id, prev);
        }
        return map;
      };

      const curAgg = aggregate(curRes);
      const prevAgg = aggregate(prevRes);

      const allIds = new Set([...curAgg.keys(), ...prevAgg.keys()]);

      const results: PropertyYoY[] = [];
      for (const id of allIds) {
        const listing = listingMap.get(id);
        if (!listing) continue;

        const cur = curAgg.get(id) || { revenue: 0, nights: 0 };
        const prev = prevAgg.get(id) || { revenue: 0, nights: 0 };
        const hadPriorData = prevAgg.has(id);

        const curAdr = cur.nights > 0 ? cur.revenue / cur.nights : 0;
        const prevAdr = prev.nights > 0 ? prev.revenue / prev.nights : 0;
        const curOcc = (cur.nights / daysInPeriod) * 100;
        const prevOcc = (prev.nights / daysInPeriod) * 100;

        results.push({
          listingId: id,
          name: listing.name,
          city: listing.city,
          currentRevenue: cur.revenue,
          previousRevenue: prev.revenue,
          currentAdr: curAdr,
          previousAdr: prevAdr,
          currentOccupancy: Math.min(curOcc, 100),
          previousOccupancy: Math.min(prevOcc, 100),
          revenueChange: hadPriorData ? pctChange(cur.revenue, prev.revenue) : null,
          adrChange: hadPriorData ? pctChange(curAdr, prevAdr) : null,
          occupancyChange: hadPriorData ? pctChange(curOcc, prevOcc) : null,
          isNew: !hadPriorData,
        });
      }

      results.sort((a, b) => (b.revenueChange ?? -Infinity) - (a.revenueChange ?? -Infinity));
      return results;
    },
  });
}
