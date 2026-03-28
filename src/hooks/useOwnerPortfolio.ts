import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, startOfYear, endOfYear, format } from "date-fns";

interface PropertyBreakdown {
  listingId: string;
  name: string;
  revenue: number;
  nights: number;
  adr: number;
  pctOfTotal: number;
}

interface MonthBucket {
  label: string;
  revenue: number;
}

interface OwnerPortfolioData {
  totalRevenue: number;
  avgOccupancy: number;
  blendedAdr: number;
  monthlyRevenue: MonthBucket[];
  properties: PropertyBreakdown[];
}

export function useOwnerPortfolio(ownerId: string | null, year: number) {
  return useQuery({
    queryKey: ["owner_portfolio", ownerId, year],
    enabled: !!ownerId,
    queryFn: async (): Promise<OwnerPortfolioData> => {
      const yearStart = startOfYear(new Date(year, 0, 1)).toISOString().split("T")[0];
      const yearEnd = endOfYear(new Date(year, 0, 1)).toISOString().split("T")[0];

      // Get listings for this owner
      const { data: listings } = await supabase
        .from("listings")
        .select("id, name, status")
        .eq("owner_id", ownerId!);

      if (!listings?.length) {
        return { totalRevenue: 0, avgOccupancy: 0, blendedAdr: 0, monthlyRevenue: [], properties: [] };
      }

      const listingIds = listings.map((l) => l.id);
      const activeCount = listings.filter((l) => l.status === "active").length;

      // Fetch all reservations for these listings in the year
      const { data: reservations } = await supabase
        .from("reservations")
        .select("listing_id, check_in, check_out, total_amount")
        .in("listing_id", listingIds)
        .gte("check_in", yearStart)
        .lte("check_in", yearEnd);

      const rows = reservations ?? [];

      // Per-property aggregation
      const byListing: Record<string, { revenue: number; nights: number }> = {};
      const monthlyMap: Record<string, number> = {};

      for (const r of rows) {
        const nights = Math.max(1, differenceInDays(parseISO(r.check_out), parseISO(r.check_in)));
        const rev = r.total_amount ?? 0;

        if (!byListing[r.listing_id]) byListing[r.listing_id] = { revenue: 0, nights: 0 };
        byListing[r.listing_id].revenue += rev;
        byListing[r.listing_id].nights += nights;

        const monthKey = format(parseISO(r.check_in), "MMM");
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + rev;
      }

      const totalRevenue = Object.values(byListing).reduce((s, v) => s + v.revenue, 0);
      const totalNights = Object.values(byListing).reduce((s, v) => s + v.nights, 0);
      const blendedAdr = totalNights > 0 ? totalRevenue / totalNights : 0;

      // Occupancy: total nights / (active listings × 365) × 100
      const daysInYear = 365;
      const avgOccupancy = activeCount > 0 ? (totalNights / (activeCount * daysInYear)) * 100 : 0;

      // Monthly buckets
      const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyRevenue = monthOrder.map((m) => ({ label: m, revenue: monthlyMap[m] || 0 }));

      // Property breakdown
      const listingMap = Object.fromEntries(listings.map((l) => [l.id, l.name]));
      const properties: PropertyBreakdown[] = Object.entries(byListing)
        .map(([id, v]) => ({
          listingId: id,
          name: listingMap[id] || "Unknown",
          revenue: v.revenue,
          nights: v.nights,
          adr: v.nights > 0 ? v.revenue / v.nights : 0,
          pctOfTotal: totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return { totalRevenue, avgOccupancy, blendedAdr, monthlyRevenue, properties };
    },
  });
}
