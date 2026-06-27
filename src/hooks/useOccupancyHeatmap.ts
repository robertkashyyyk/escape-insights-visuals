import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import {
  differenceInDays,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  endOfMonth,
  max as dateMax,
  min as dateMin,
  addDays,
  format,
} from "date-fns";
import { computeOrphanGapDates } from "@/lib/orphanGaps";

export interface MonthCell {
  occupancy: number;
  nightsBooked: number;
  nightsAvailable: number;
  revenue: number;
  bookings: number;
  orphanNights: number;
}

export interface ListingOccupancy {
  id: string;
  name: string;
  locationGroup: string;
  minStayNights: number;
  months: MonthCell[];
}

export function useOccupancyHeatmap(year: number) {
  return useQuery({
    queryKey: ["occupancy-heatmap", year],
    queryFn: async () => {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const [{ data: listings }, reservations] = await Promise.all([
        supabase.from("listings").select("id, name, location_group, min_stay_nights").eq("status", "active").order("name"),
        fetchAllRows<any>(() => supabase
          .from("reservations")
          .select("listing_id, check_in, check_out, total_amount, status")
          .gte("check_out", yearStart)
          .lte("check_in", yearEnd)
          .eq("status", "confirmed")),
      ]);

      if (!listings) return { listings: [] as ListingOccupancy[], locationGroups: [] as string[] };

      const resMap = new Map<string, { check_in: string; check_out: string; total_amount: number | null; status?: string | null }[]>();
      (reservations || []).forEach((r) => {
        const arr = resMap.get(r.listing_id) || [];
        arr.push(r);
        resMap.set(r.listing_id, arr);
      });

      const result: ListingOccupancy[] = (listings as any[]).map((listing) => {
        const resos = resMap.get(listing.id) || [];
        const minStay = listing.min_stay_nights ?? 2;
        const orphanSet = computeOrphanGapDates(resos, minStay);
        const months: MonthCell[] = [];

        for (let m = 0; m < 12; m++) {
          const mStart = startOfMonth(new Date(year, m, 1));
          const mEnd = endOfMonth(mStart);
          const daysInMonth = getDaysInMonth(mStart);
          let nights = 0;
          let revenue = 0;
          let bookings = 0;

          resos.forEach((r) => {
            const ci = parseISO(r.check_in);
            const co = parseISO(r.check_out);
            const totalNights = differenceInDays(co, ci) || 1;
            const overlapStart = dateMax([ci, mStart]);
            const overlapEnd = dateMin([co, mEnd]);
            if (overlapStart < overlapEnd) {
              const overlapNights = differenceInDays(overlapEnd, overlapStart);
              nights += overlapNights;
              bookings += 1;
              if (r.total_amount && totalNights > 0) {
                revenue += (r.total_amount / totalNights) * overlapNights;
              }
            }
          });

          // Count orphan-gap nights falling inside this month
          let orphanNights = 0;
          for (let d = mStart; d <= mEnd; d = addDays(d, 1)) {
            if (orphanSet.has(format(d, "yyyy-MM-dd"))) orphanNights++;
          }

          const occupancy = Math.min(100, Math.round((nights / daysInMonth) * 100));
          months.push({
            occupancy,
            nightsBooked: nights,
            nightsAvailable: daysInMonth,
            revenue: Math.round(revenue),
            bookings,
            orphanNights,
          });
        }

        return {
          id: listing.id,
          name: listing.name,
          locationGroup: listing.location_group || "Ungrouped",
          minStayNights: minStay,
          months,
        };
      });

      const locationGroups = [...new Set(result.map((l) => l.locationGroup))].sort();

      return { listings: result, locationGroups };
    },
  });
}
