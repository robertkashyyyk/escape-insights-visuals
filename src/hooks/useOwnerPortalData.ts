import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["owner_portal", user?.id, currentYear],
    enabled: !!user,
    queryFn: async () => {
      // RLS automatically scopes these to the owner's data
      const [listingsRes, reservationsRes, ownerRes] = await Promise.all([
        supabase.from("listings").select("id, name, location_group, bedrooms"),
        supabase.from("reservations").select("listing_id, check_in, check_out, total_amount, owner_payout, year, month, status"),
        supabase.from("property_owners").select("id, name"),
      ]);

      const listings = listingsRes.data || [];
      const reservations = reservationsRes.data || [];
      const owner = ownerRes.data?.[0];

      const prevYear = currentYear - 1;
      const now = new Date();
      const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1;

      // Build property data
      const properties: OwnerProperty[] = listings.map((l) => {
        const propRes = reservations.filter((r) => r.listing_id === l.id);
        const thisYearRes = propRes.filter((r) => r.year === currentYear && r.status !== "cancelled");
        const prevYearRes = propRes.filter((r) => r.year === prevYear && r.status !== "cancelled");

        const revenueThisYear = thisYearRes.reduce((s, r) => s + (r.total_amount || 0), 0);
        const revenuePrevYear = prevYearRes.reduce((s, r) => s + (r.total_amount || 0), 0);

        // Monthly revenue for sparkline (current year)
        const monthlyRevenue = Array.from({ length: 12 }, (_, m) =>
          thisYearRes.filter((r) => r.month === m + 1).reduce((s, r) => s + (r.total_amount || 0), 0)
        );

        // Occupancy: nights booked / days elapsed in year
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

      // Aggregate KPIs
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
        prevYearOccupancy: 0, // simplified
        adr,
        prevYearAdr,
        ownerPayout,
        prevYearPayout,
      };

      return { owner, properties, kpis, currentYear };
    },
  });
}
