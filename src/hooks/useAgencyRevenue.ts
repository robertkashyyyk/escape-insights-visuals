import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyData {
  month: string;
  revenue: number;
}

interface TopProperty {
  listingId: string;
  name: string;
  location: string;
  totalRevenue: number;
  agencyRevenue: number;
  managementPct: number;
}

export function useAgencyRevenue() {
  return useQuery({
    queryKey: ["agency-revenue"],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;

      const [{ data: reservations, error: rErr }, { data: owners, error: oErr }] = await Promise.all([
        supabase
          .from("reservations")
          .select("total_amount, check_in, listing_id, listings(name, city, location_group, owner_id)")
          .gte("check_in", startOfYear)
          .lte("check_in", endOfYear),
        supabase.from("property_owners").select("id, management_rate_pct"),
      ]);

      if (rErr) throw rErr;
      if (oErr) throw oErr;

      const ownerRateMap = new Map<string, number>();
      (owners || []).forEach((o) => {
        ownerRateMap.set(o.id, o.management_rate_pct ?? 0);
      });

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyBuckets = monthNames.map((m) => ({ month: m, revenue: 0 }));
      const propertyMap = new Map<string, TopProperty>();
      let totalYTD = 0;

      (reservations || []).forEach((r: any) => {
        const listing = r.listings;
        if (!listing) return;
        const rate = ownerRateMap.get(listing.owner_id) ?? 0;
        const total = r.total_amount ?? 0;
        const agencyRev = total * (rate / 100);

        totalYTD += agencyRev;

        const monthIdx = new Date(r.check_in).getMonth();
        monthlyBuckets[monthIdx].revenue += agencyRev;

        const existing = propertyMap.get(r.listing_id);
        if (existing) {
          existing.totalRevenue += total;
          existing.agencyRevenue += agencyRev;
        } else {
          propertyMap.set(r.listing_id, {
            listingId: r.listing_id,
            name: listing.name,
            location: listing.city || listing.location_group || "—",
            totalRevenue: total,
            agencyRevenue: agencyRev,
            managementPct: rate,
          });
        }
      });

      const topProperties = Array.from(propertyMap.values())
        .sort((a, b) => b.agencyRevenue - a.agencyRevenue)
        .slice(0, 10);

      return {
        totalYTD,
        monthlyData: monthlyBuckets as MonthlyData[],
        topProperties,
      };
    },
  });
}
