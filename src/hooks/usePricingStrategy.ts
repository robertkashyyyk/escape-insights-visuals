import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";
import { getNetRevenue, REVENUE_FIELDS } from "@/lib/revenue";

type SeasonBucket = "Jan–Mar" | "Shoulder (Apr/May/Sep)" | "Summer (Jun–Aug)" | "Autumn (Oct/Nov)" | "December";

export interface BucketData {
  season: SeasonBucket;
  actualADR: number;
  avgMinRate: number;
  avgBaseRate: number;
}

const SEASON_ORDER: SeasonBucket[] = [
  "Jan–Mar",
  "Shoulder (Apr/May/Sep)",
  "Summer (Jun–Aug)",
  "Autumn (Oct/Nov)",
  "December",
];

function getSeason(month: number): SeasonBucket {
  if (month >= 1 && month <= 3) return "Jan–Mar";
  if (month === 4 || month === 5 || month === 9) return "Shoulder (Apr/May/Sep)";
  if (month >= 6 && month <= 8) return "Summer (Jun–Aug)";
  if (month === 10 || month === 11) return "Autumn (Oct/Nov)";
  return "December";
}

export function usePricingStrategy(locationGroup: string | null) {
  const locationGroupsQuery = useQuery({
    queryKey: ["pricing-location-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("location_group")
        .not("location_group", "is", null)
        .eq("status", "active");
      if (error) throw error;
      const groups = [...new Set(data.map((l) => l.location_group!).filter(Boolean))].sort();
      return groups;
    },
  });

  const dataQuery = useQuery({
    queryKey: ["pricing-strategy", locationGroup],
    queryFn: async () => {
      // Fetch listings
      let listingsQ = supabase.from("listings").select("id, min_rate, base_rate, location_group").eq("status", "active");
      if (locationGroup) listingsQ = listingsQ.eq("location_group", locationGroup);
      const { data: listings, error: le } = await listingsQ;
      if (le) throw le;
      if (!listings?.length) return SEASON_ORDER.map((s) => ({ season: s, actualADR: 0, avgMinRate: 0, avgBaseRate: 0 }));

      const listingIds = listings.map((l) => l.id);

      // Fetch reservations in batches (supabase 1000 row limit)
      let allReservations: any[] = [];
      for (let i = 0; i < listingIds.length; i += 50) {
        const batch = listingIds.slice(i, i + 50);
        const { data: res, error: re } = await supabase
          .from("reservations")
          .select(`check_in, check_out, listing_id, ${REVENUE_FIELDS}`)
          .in("listing_id", batch)
          .eq("status", "confirmed");
        if (re) throw re;
        if (res) allReservations = allReservations.concat(res);
      }

      // Aggregate per season
      const buckets: Record<SeasonBucket, { revenue: number; nights: number }> = {} as any;
      SEASON_ORDER.forEach((s) => (buckets[s] = { revenue: 0, nights: 0 }));

      for (const r of allReservations) {
        const month = new Date(r.check_in).getMonth() + 1;
        const season = getSeason(month);
        const nights = Math.max(1, differenceInDays(new Date(r.check_out), new Date(r.check_in)));
        buckets[season].revenue += getNetRevenue(r);
        buckets[season].nights += nights;
      }

      // Avg rates from listings
      const avgMin = listings.reduce((s, l) => s + (l.min_rate || 0), 0) / listings.length;
      const avgBase = listings.reduce((s, l) => s + (l.base_rate || 0), 0) / listings.length;

      return SEASON_ORDER.map((season) => ({
        season,
        actualADR: buckets[season].nights > 0 ? Math.round(buckets[season].revenue / buckets[season].nights) : 0,
        avgMinRate: Math.round(avgMin),
        avgBaseRate: Math.round(avgBase),
      }));
    },
  });

  return {
    data: dataQuery.data || [],
    locationGroups: locationGroupsQuery.data || [],
    isLoading: dataQuery.isLoading || locationGroupsQuery.isLoading,
  };
}
