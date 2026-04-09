import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyData {
  month: string;
  revenue: number;
}

interface OwnerRow {
  ownerId: string;
  ownerName: string;
  company: string | null;
  ratePct: number | null;
  vatInclusive: boolean;
  effectiveRate: number;
  rentalRevenue: number;
  mgmtRevenue: number;
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
        supabase.from("property_owners").select("id, name, company, management_rate_pct, vat_inclusive" as any),
      ]);

      if (rErr) throw rErr;
      if (oErr) throw oErr;

      // Build owner map with effective rate
      const ownerMap = new Map<string, { name: string; company: string | null; ratePct: number | null; vatInclusive: boolean; effectiveRate: number }>();
      (owners || []).forEach((o: any) => {
        const ratePct = o.management_rate_pct;
        const vatInclusive = o.vat_inclusive ?? false;
        const effectiveRate = ratePct != null ? (vatInclusive ? ratePct * 1.2 : ratePct) : 0;
        ownerMap.set(o.id, { name: o.name, company: o.company, ratePct, vatInclusive, effectiveRate });
      });

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyBuckets = monthNames.map((m) => ({ month: m, revenue: 0 }));
      const propertyMap = new Map<string, TopProperty>();
      const ownerAgg = new Map<string, { rentalRevenue: number; mgmtRevenue: number }>();
      let totalYTD = 0;

      (reservations || []).forEach((r: any) => {
        const listing = r.listings;
        if (!listing) return;
        const ownerInfo = ownerMap.get(listing.owner_id);
        const effectiveRate = ownerInfo?.effectiveRate ?? 0;
        const total = r.total_amount ?? 0;
        const agencyRev = total * (effectiveRate / 100);

        totalYTD += agencyRev;

        const monthIdx = new Date(r.check_in).getMonth();
        monthlyBuckets[monthIdx].revenue += agencyRev;

        // Per-owner aggregation
        const oa = ownerAgg.get(listing.owner_id) || { rentalRevenue: 0, mgmtRevenue: 0 };
        oa.rentalRevenue += total;
        oa.mgmtRevenue += agencyRev;
        ownerAgg.set(listing.owner_id, oa);

        // Per-property aggregation
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
            managementPct: effectiveRate,
          });
        }
      });

      // Build owner rows
      const ownerRows: OwnerRow[] = [];
      ownerMap.forEach((info, ownerId) => {
        const agg = ownerAgg.get(ownerId) || { rentalRevenue: 0, mgmtRevenue: 0 };
        ownerRows.push({
          ownerId,
          ownerName: info.name,
          company: info.company,
          ratePct: info.ratePct,
          vatInclusive: info.vatInclusive,
          effectiveRate: info.effectiveRate,
          rentalRevenue: agg.rentalRevenue,
          mgmtRevenue: agg.mgmtRevenue,
        });
      });
      ownerRows.sort((a, b) => b.mgmtRevenue - a.mgmtRevenue);

      const topProperties = Array.from(propertyMap.values())
        .sort((a, b) => b.agencyRevenue - a.agencyRevenue)
        .slice(0, 10);

      return {
        totalYTD,
        monthlyData: monthlyBuckets as MonthlyData[],
        topProperties,
        ownerRows,
      };
    },
  });
}
