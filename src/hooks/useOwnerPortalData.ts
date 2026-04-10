import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subYears } from "date-fns";

export type OwnerPeriodType = "Week" | "Month" | "Quarter" | "Year";

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
}

function getPeriodRange(periodType: OwnerPeriodType, now: Date) {
  switch (periodType) {
    case "Week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "Month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "Quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "Year":
    default:
      return { from: startOfYear(now), to: endOfYear(now) };
  }
}

export function useOwnerPortalData(periodType: OwnerPeriodType = "Year") {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId } = useOwnerPreview();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { from: periodStart, to: periodEnd } = getPeriodRange(periodType, now);
  const prevPeriodStart = subYears(periodStart, 1);
  const prevPeriodEnd = subYears(periodEnd, 1);

  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);
  const prevStartStr = prevPeriodStart.toISOString().slice(0, 10);
  const prevEndStr = prevPeriodEnd.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["owner_portal", isPreviewMode ? selectedOwnerId : user?.id, periodType],
    enabled: !!(isPreviewMode ? selectedOwnerId : user),
    queryFn: async () => {
      let listingsQuery = supabase.from("listings").select("id, name, location_group, bedrooms, owner_id");
      let ownerQuery = supabase.from("property_owners").select("id, name");

      if (isPreviewMode && selectedOwnerId) {
        listingsQuery = listingsQuery.eq("owner_id", selectedOwnerId);
        ownerQuery = ownerQuery.eq("id", selectedOwnerId);
      }

      const [listingsRes, ownerRes] = await Promise.all([listingsQuery, ownerQuery]);
      const listings = listingsRes.data || [];
      const owner = ownerRes.data?.[0];
      const listingIds = listings.map((l) => l.id);

      let reservations: any[] = [];
      if (listingIds.length > 0) {
        const { data } = await supabase
          .from("reservations")
          .select("listing_id, check_in, check_out, total_amount, year, month, status")
          .in("listing_id", listingIds);
        reservations = data || [];
      }

      // Filter reservations that overlap with current period and previous period
      const overlaps = (ci: string, co: string, rangeStart: string, rangeEnd: string) =>
        ci <= rangeEnd && co > rangeStart;

      const currentYear = now.getFullYear();

      const properties: OwnerProperty[] = listings.map((l) => {
        const propRes = reservations.filter((r) => r.listing_id === l.id && r.status !== "cancelled");

        const thisPeriodRes = propRes.filter((r) => overlaps(r.check_in, r.check_out, periodStartStr, periodEndStr));
        const prevPeriodRes = propRes.filter((r) => overlaps(r.check_in, r.check_out, prevStartStr, prevEndStr));

        const revenueThisYear = thisPeriodRes.reduce((s, r) => s + (r.total_amount || 0), 0);
        const revenuePrevYear = prevPeriodRes.reduce((s, r) => s + (r.total_amount || 0), 0);

        const monthlyRevenue = Array.from({ length: 12 }, (_, m) =>
          propRes.filter((r) => r.year === currentYear && r.month === m + 1).reduce((s, r) => s + (r.total_amount || 0), 0)
        );

        // Occupancy for period
        const periodDays = Math.max(1, Math.floor((Math.min(periodEnd.getTime(), now.getTime()) - periodStart.getTime()) / 86400000));
        let nightsBooked = 0;
        thisPeriodRes.forEach((r) => {
          const ci = new Date(r.check_in);
          const co = new Date(r.check_out);
          const start = ci < periodStart ? periodStart : ci;
          const end = co > (periodEnd < now ? periodEnd : now) ? (periodEnd < now ? periodEnd : now) : co;
          nightsBooked += Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
        });
        const occupancyPct = Math.min(100, (nightsBooked / periodDays) * 100);

        const totalNights = thisPeriodRes.reduce((s, r) => {
          const ci = new Date(r.check_in);
          const co = new Date(r.check_out);
          return s + Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
        }, 0);
        const adr = totalNights > 0 ? revenueThisYear / totalNights : 0;

        const upcomingCount = propRes.filter((r) => r.check_in >= today).length;

        return { id: l.id, name: l.name, location_group: l.location_group, bedrooms: l.bedrooms, revenueThisYear, revenuePrevYear, occupancyPct, adr, monthlyRevenue, upcomingCount };
      });

      // Aggregate KPIs
      const allThisPeriod = reservations.filter((r) => r.status !== "cancelled" && overlaps(r.check_in, r.check_out, periodStartStr, periodEndStr));
      const allPrevPeriod = reservations.filter((r) => r.status !== "cancelled" && overlaps(r.check_in, r.check_out, prevStartStr, prevEndStr));

      const totalRevenue = allThisPeriod.reduce((s, r) => s + (r.total_amount || 0), 0);
      const prevYearRevenue = allPrevPeriod.reduce((s, r) => s + (r.total_amount || 0), 0);

      const avgOccupancy = properties.length > 0 ? properties.reduce((s, p) => s + p.occupancyPct, 0) / properties.length : 0;

      const totalNightsAll = allThisPeriod.reduce((s, r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        return s + Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
      }, 0);
      const adr = totalNightsAll > 0 ? totalRevenue / totalNightsAll : 0;

      const prevTotalNights = allPrevPeriod.reduce((s, r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        return s + Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
      }, 0);
      const prevYearAdr = prevTotalNights > 0 ? prevYearRevenue / prevTotalNights : 0;

      // Prev year occupancy
      const prevPeriodDays = Math.max(1, Math.floor((prevPeriodEnd.getTime() - prevPeriodStart.getTime()) / 86400000));
      let prevNightsBooked = 0;
      allPrevPeriod.forEach((r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        const start = ci < prevPeriodStart ? prevPeriodStart : ci;
        const end = co > prevPeriodEnd ? prevPeriodEnd : co;
        prevNightsBooked += Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
      });
      const prevYearOccupancy = listings.length > 0 ? Math.min(100, (prevNightsBooked / (prevPeriodDays * listings.length)) * 100) : 0;

      const kpis: OwnerKpis = {
        totalRevenue,
        prevYearRevenue,
        occupancy: avgOccupancy,
        prevYearOccupancy,
        adr,
        prevYearAdr,
      };

      return { owner, properties, kpis, currentYear, periodType };
    },
  });
}
