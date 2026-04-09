import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, getDaysInMonth, parseISO, startOfMonth, endOfMonth, max as dateMax, min as dateMin } from "date-fns";

export interface MonthCell {
  occupancy: number;
  nightsBooked: number;
  nightsAvailable: number;
  revenue: number;
}

export interface ListingOccupancy {
  id: string;
  name: string;
  locationGroup: string;
  months: MonthCell[];
}

export function useOccupancyHeatmap(year: number) {
  return useQuery({
    queryKey: ["occupancy-heatmap", year],
    queryFn: async () => {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const [{ data: listings }, { data: reservations }] = await Promise.all([
        supabase.from("listings").select("id, name, location_group").eq("status", "active").order("name"),
        supabase
          .from("reservations")
          .select("listing_id, check_in, check_out, total_amount")
          .gte("check_out", yearStart)
          .lte("check_in", yearEnd),
      ]);

      if (!listings) return { listings: [] as ListingOccupancy[], locationGroups: [] as string[] };

      const resMap = new Map<string, { check_in: string; check_out: string; total_amount: number | null }[]>();
      (reservations || []).forEach((r) => {
        const arr = resMap.get(r.listing_id) || [];
        arr.push(r);
        resMap.set(r.listing_id, arr);
      });

      const result: ListingOccupancy[] = listings.map((listing) => {
        const resos = resMap.get(listing.id) || [];
        const months: MonthCell[] = [];

        for (let m = 0; m < 12; m++) {
          const mStart = startOfMonth(new Date(year, m, 1));
          const mEnd = endOfMonth(mStart);
          const daysInMonth = getDaysInMonth(mStart);
          let nights = 0;
          let revenue = 0;

          resos.forEach((r) => {
            const ci = parseISO(r.check_in);
            const co = parseISO(r.check_out);
            const totalNights = differenceInDays(co, ci) || 1;
            const overlapStart = dateMax([ci, mStart]);
            const overlapEnd = dateMin([co, mEnd]);
            if (overlapStart < overlapEnd) {
              const overlapNights = differenceInDays(overlapEnd, overlapStart);
              nights += overlapNights;
              if (r.total_amount && totalNights > 0) {
                revenue += (r.total_amount / totalNights) * overlapNights;
              }
            }
          });

          const occupancy = Math.min(100, Math.round((nights / daysInMonth) * 100));
          months.push({ occupancy, nightsBooked: nights, nightsAvailable: daysInMonth, revenue: Math.round(revenue) });
        }

        return { id: listing.id, name: listing.name, locationGroup: listing.location_group || "Ungrouped", months };
      });

      const locationGroups = [...new Set(result.map((l) => l.locationGroup))].sort();

      return { listings: result, locationGroups };
    },
  });
}
