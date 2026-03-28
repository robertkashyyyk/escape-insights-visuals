import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, getDaysInMonth, parseISO, startOfMonth, endOfMonth, max as dateMax, min as dateMin } from "date-fns";

interface ListingOccupancy {
  id: string;
  name: string;
  months: number[]; // 12 values, occupancy % per month
}

export function useOccupancyHeatmap(year: number) {
  return useQuery({
    queryKey: ["occupancy-heatmap", year],
    queryFn: async () => {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const [{ data: listings }, { data: reservations }] = await Promise.all([
        supabase.from("listings").select("id, name").eq("status", "active").order("name"),
        supabase
          .from("reservations")
          .select("listing_id, check_in, check_out")
          .gte("check_out", yearStart)
          .lte("check_in", yearEnd),
      ]);

      if (!listings) return { listings: [] as ListingOccupancy[] };

      const resMap = new Map<string, { check_in: string; check_out: string }[]>();
      (reservations || []).forEach((r) => {
        const arr = resMap.get(r.listing_id) || [];
        arr.push({ check_in: r.check_in, check_out: r.check_out });
        resMap.set(r.listing_id, arr);
      });

      const result: ListingOccupancy[] = listings.map((listing) => {
        const resos = resMap.get(listing.id) || [];
        const months: number[] = [];

        for (let m = 0; m < 12; m++) {
          const mStart = startOfMonth(new Date(year, m, 1));
          const mEnd = endOfMonth(mStart);
          const daysInMonth = getDaysInMonth(mStart);
          let nights = 0;

          resos.forEach((r) => {
            const ci = parseISO(r.check_in);
            const co = parseISO(r.check_out);
            const overlapStart = dateMax([ci, mStart]);
            const overlapEnd = dateMin([co, mEnd]);
            if (overlapStart < overlapEnd) {
              nights += differenceInDays(overlapEnd, overlapStart);
            }
          });

          months.push(Math.min(100, Math.round((nights / daysInMonth) * 100)));
        }

        return { id: listing.id, name: listing.name, months };
      });

      return { listings: result };
    },
  });
}
