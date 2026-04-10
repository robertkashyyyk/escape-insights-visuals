import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";

export interface OwnerProperty {
  id: string;
  name: string;
  location_group: string | null;
  bedrooms: number | null;
  revenueThisYear: number;
  revenuePrevYear: number;
  occupancyPct: number;
  adr: number;
  monthlyRevenue: number[];
  upcomingCount: number;
}

export interface OwnerKpis {
  totalRevenue: number;
  prevYearRevenue: number;
  occupancy: number;
  prevYearOccupancy: number;
  adr: number;
  prevYearAdr: number;
  ownerPayout: number;
  prevYearPayout: number;
}

export function useOwnerPortalData() {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId } = useOwnerPreview();
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["owner_portal", isPreviewMode ? selectedOwnerId : user?.id, currentYear],
    enabled: !!(isPreviewMode ? selectedOwnerId : user),
    queryFn: async () => {
      // In preview mode, query by owner ID; in real mode, RLS scopes automatically
      let listingsQuery = supabase.from("listings").select("id, name, location_group, bedrooms, owner_id");
      let ownerQuery = supabase.from("property_owners").select("id, name");

      if (isPreviewMode && selectedOwnerId) {
        listingsQuery = listingsQuery.eq("owner_id", selectedOwnerId);
        ownerQuery = ownerQuery.eq("id", selectedOwnerId);
      }

      const [listingsRes, ownerRes] = await Promise.all([
        listingsQuery,
        ownerQuery,
      ]);

      const listings = listingsRes.data || [];
      const owner = ownerRes.data?.[0];
      const listingIds = listings.map((l) => l.id);

      // Fetch reservations for these listings
      let reservations: any[] = [];
      if (listingIds.length > 0) {
        const { data } = await supabase
          .from("reservations")
          .select("listing_id, check_in, check_out, total_amount, owner_payout, year, month, status")
          .in("listing_id", listingIds);
        reservations = data || [];
      }

      const prevYear = currentYear - 1;
      const now = new Date();
      const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1;

      const properties: OwnerProperty[] = listings.map((l) => {
        const propRes = reservations.filter((r) => r.listing_id === l.id);
        const thisYearRes = propRes.filter((r) => r.year === currentYear && r.status !== "cancelled");
        const prevYearRes = propRes.filter((r) => r.year === prevYear && r.status !== "cancelled");

        const revenueThisYear = thisYearRes.reduce((s, r) => s + (r.total_amount || 0), 0);
        const revenuePrevYear = prevYearRes.reduce((s, r) => s + (r.total_amount || 0), 0);

        const monthlyRevenue = Array.from({ length: 12 }, (_, m) =>
          thisYearRes.filter((r) => r.month === m + 1).reduce((s, r) => s + (r.total_amount || 0), 0)
        );

        const daysInScope = dayOfYear;
        let nightsBooked = 0;
        thisYearRes.forEach((r) => {
          const ci = new Date(r.check_in);
          const co = new Date(r.check_out);
          const start = ci < new Date(currentYear, 0, 1) ? new Date(currentYear, 0, 1) : ci;
          const end = co > now ? now : co;
          const nights = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
          nightsBooked += nights;
        });
        const occupancyPct = daysInScope > 0 ? Math.min(100, (nightsBooked / daysInScope) * 100) : 0;

        const totalNights = thisYearRes.reduce((s, r) => {
          const ci = new Date(r.check_in);
          const co = new Date(r.check_out);
          return s + Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
        }, 0);
        const adr = totalNights > 0 ? revenueThisYear / totalNights : 0;

        const upcomingCount = propRes.filter((r) => r.check_in >= today && r.status !== "cancelled").length;

        return {
          id: l.id,
          name: l.name,
          location_group: l.location_group,
          bedrooms: l.bedrooms,
          revenueThisYear,
          revenuePrevYear,
          occupancyPct,
          adr,
          monthlyRevenue,
          upcomingCount,
        };
      });

      const allThisYear = reservations.filter((r) => r.year === currentYear && r.status !== "cancelled");
      const allPrevYear = reservations.filter((r) => r.year === prevYear && r.status !== "cancelled");

      const totalRevenue = allThisYear.reduce((s, r) => s + (r.total_amount || 0), 0);
      const prevYearRevenue = allPrevYear.reduce((s, r) => s + (r.total_amount || 0), 0);
      const ownerPayout = allThisYear.reduce((s, r) => s + (r.owner_payout || 0), 0);
      const prevYearPayout = allPrevYear.reduce((s, r) => s + (r.owner_payout || 0), 0);

      const avgOccupancy = properties.length > 0
        ? properties.reduce((s, p) => s + p.occupancyPct, 0) / properties.length
        : 0;

      const totalNightsAll = allThisYear.reduce((s, r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        return s + Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
      }, 0);
      const adr = totalNightsAll > 0 ? totalRevenue / totalNightsAll : 0;

      const prevTotalNights = allPrevYear.reduce((s, r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        return s + Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
      }, 0);
      const prevYearAdr = prevTotalNights > 0 ? prevYearRevenue / prevTotalNights : 0;

      const kpis: OwnerKpis = {
        totalRevenue,
        prevYearRevenue,
        occupancy: avgOccupancy,
        prevYearOccupancy: 0,
        adr,
        prevYearAdr,
        ownerPayout,
        prevYearPayout,
      };

      return { owner, properties, kpis, currentYear };
    },
  });
}
