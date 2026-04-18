import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  subYears, addWeeks, addMonths, addQuarters, addYears,
  format, isFuture, min as dateMin
} from "date-fns";

export type OwnerPeriodType = "Week" | "Month" | "Quarter" | "Year";
export type OwnerDateMode = "check_in" | "created";

export interface OwnerProperty {
  id: string;
  name: string;
  location_group: string | null;
  bedrooms: number | null;
  isBundle: boolean;
  revenueThisYear: number;
  revenuePrevYear: number;
  occupancyPct: number;
  adr: number;
  totalNights: number;
  totalBookings: number;
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
  totalBookings: number;
  totalNights: number;
}

/** Returns the start/end of a period given a reference date */
export function getPeriodRange(periodType: OwnerPeriodType, ref: Date) {
  switch (periodType) {
    case "Week":
      return { from: startOfWeek(ref, { weekStartsOn: 1 }), to: endOfWeek(ref, { weekStartsOn: 1 }) };
    case "Month":
      return { from: startOfMonth(ref), to: endOfMonth(ref) };
    case "Quarter":
      return { from: startOfQuarter(ref), to: endOfQuarter(ref) };
    case "Year":
    default:
      return { from: startOfYear(ref), to: endOfYear(ref) };
  }
}

/** Shift a reference date by +/- 1 period */
export function shiftPeriod(ref: Date, periodType: OwnerPeriodType, direction: 1 | -1): Date {
  switch (periodType) {
    case "Week": return addWeeks(ref, direction);
    case "Month": return addMonths(ref, direction);
    case "Quarter": return addQuarters(ref, direction);
    case "Year": return addYears(ref, direction);
  }
}

/** Human-readable label for the selected period */
export function getPeriodLabel(periodType: OwnerPeriodType, ref: Date, now: Date): string {
  const { from, to } = getPeriodRange(periodType, ref);
  const isCurrentPeriod = from <= now && to >= now;
  switch (periodType) {
    case "Week": {
      const label = `W/C ${format(from, "d MMM yyyy")}`;
      return isCurrentPeriod ? `${label} (This week)` : label;
    }
    case "Month": {
      const label = format(from, "MMMM yyyy");
      return isCurrentPeriod ? `${label} (This month)` : label;
    }
    case "Quarter": {
      const q = Math.ceil((from.getMonth() + 1) / 3);
      const label = `Q${q} ${format(from, "yyyy")}`;
      return isCurrentPeriod ? `${label} (This quarter)` : label;
    }
    case "Year": {
      const label = format(from, "yyyy");
      return isCurrentPeriod ? `${label} YTD` : label;
    }
  }
}

export function useOwnerPortalData(periodType: OwnerPeriodType = "Year", periodRef: Date = new Date(), dateMode: OwnerDateMode = "check_in") {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId } = useOwnerPreview();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { from: periodStart, to: periodEnd } = getPeriodRange(periodType, periodRef);
  const effectiveEnd = dateMin([periodEnd, now]);
  const periodDays = Math.max(1, Math.floor((effectiveEnd.getTime() - periodStart.getTime()) / 86400000) + 1);

  const prevPeriodStart = subYears(periodStart, 1);
  const prevPeriodEnd = subYears(periodEnd, 1);
  const prevEffectiveEnd = dateMin([prevPeriodEnd, subYears(effectiveEnd, 1)]);
  const prevPeriodDays = Math.max(1, Math.floor((prevEffectiveEnd.getTime() - prevPeriodStart.getTime()) / 86400000) + 1);

  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const effectiveEndStr = effectiveEnd.toISOString().slice(0, 10);
  const prevStartStr = prevPeriodStart.toISOString().slice(0, 10);
  const prevEffectiveEndStr = prevEffectiveEnd.toISOString().slice(0, 10);

  const useCreatedDate = dateMode === "created";

  return useQuery({
    queryKey: ["owner_portal", isPreviewMode ? selectedOwnerId : user?.id, periodType, periodStartStr, dateMode],
    enabled: !!(isPreviewMode ? selectedOwnerId : user),
    queryFn: async () => {
      let listingsQuery = supabase.from("listings").select("id, name, location_group, bedrooms, owner_id, is_bundle, bundle_components");
      let ownerQuery = supabase.from("property_owners").select("id, name");

      if (isPreviewMode && selectedOwnerId) {
        listingsQuery = listingsQuery.eq("owner_id", selectedOwnerId);
        ownerQuery = ownerQuery.eq("id", selectedOwnerId);
      }

      const [listingsRes, ownerRes] = await Promise.all([listingsQuery, ownerQuery]);
      const listings = listingsRes.data || [];
      const owner = ownerRes.data?.[0];
      const listingIds = listings.map((l) => l.id);

      // Count non-bundle listings for occupancy denominator
      const nonBundleListings = listings.filter(l => !(l as any).is_bundle);
      const nonBundleCount = Math.max(1, nonBundleListings.length);

      let reservations: any[] = [];
      if (listingIds.length > 0) {
        const { data } = await supabase
          .from("reservations")
          .select("listing_id, check_in, check_out, total_amount, year, month, status, reservation_date")
          .in("listing_id", listingIds)
          .eq("status", "confirmed");
        reservations = data || [];
      }

      const inPeriod = (r: any, rangeStart: string, rangeEnd: string) => {
        if (useCreatedDate) {
          const rd = r.reservation_date;
          return rd && rd >= rangeStart && rd <= rangeEnd;
        }
        return r.check_in <= rangeEnd && r.check_out > rangeStart;
      };

      const currentYear = now.getFullYear();

      const properties: OwnerProperty[] = listings.map((l) => {
        const isBundle = !!(l as any).is_bundle;
        const propRes = reservations.filter((r) => r.listing_id === l.id && r.status !== "cancelled");

        const thisPeriodRes = propRes.filter((r) => inPeriod(r, periodStartStr, effectiveEndStr));
        const prevPeriodRes = propRes.filter((r) => inPeriod(r, prevStartStr, prevEffectiveEndStr));

        const revenueThisYear = thisPeriodRes.reduce((s, r) => s + (r.total_amount || 0), 0);
        const revenuePrevYear = prevPeriodRes.reduce((s, r) => s + (r.total_amount || 0), 0);

        const monthlyRevenue = Array.from({ length: 12 }, (_, m) =>
          propRes.filter((r) => r.year === currentYear && r.month === m + 1).reduce((s, r) => s + (r.total_amount || 0), 0)
        );

        // Nights calculation
        let totalNights = 0;
        let nightsBooked = 0;
        thisPeriodRes.forEach((r) => {
          const ci = new Date(r.check_in);
          const co = new Date(r.check_out);
          const fullNights = Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));

          if (useCreatedDate) {
            // In booking date mode, count full stay nights
            totalNights += fullNights;
            nightsBooked += fullNights;
          } else {
            // In check-in mode, clip to period
            const start = ci < periodStart ? periodStart : ci;
            const end = co > effectiveEnd ? effectiveEnd : co;
            const clipped = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
            nightsBooked += clipped;
            totalNights += fullNights;
          }
        });

        // Occupancy: for booking date mode, use full nights / (periodDays * 1 property)
        // Allow > 100% in booking date mode
        const occupancyPct = useCreatedDate
          ? (nightsBooked / periodDays) * 100
          : Math.min(100, (nightsBooked / periodDays) * 100);

        const adr = totalNights > 0 ? revenueThisYear / totalNights : 0;
        const totalBookings = thisPeriodRes.length;
        const upcomingCount = propRes.filter((r) => r.check_in >= today).length;

        return {
          id: l.id, name: l.name, location_group: l.location_group, bedrooms: l.bedrooms,
          isBundle,
          revenueThisYear, revenuePrevYear, occupancyPct, adr, totalNights, totalBookings, monthlyRevenue, upcomingCount
        };
      });

      // Aggregate KPIs
      const allThisPeriod = reservations.filter((r) => r.status !== "cancelled" && inPeriod(r, periodStartStr, effectiveEndStr));
      const allPrevPeriod = reservations.filter((r) => r.status !== "cancelled" && inPeriod(r, prevStartStr, prevEffectiveEndStr));

      const totalRevenue = allThisPeriod.reduce((s, r) => s + (r.total_amount || 0), 0);
      const prevYearRevenue = allPrevPeriod.reduce((s, r) => s + (r.total_amount || 0), 0);

      // Aggregate occupancy using non-bundle count
      let totalNightsBooked = 0;
      let totalNightsAll = 0;
      allThisPeriod.forEach((r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        const fullNights = Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
        totalNightsAll += fullNights;
        if (useCreatedDate) {
          totalNightsBooked += fullNights;
        } else {
          const start = ci < periodStart ? periodStart : ci;
          const end = co > effectiveEnd ? effectiveEnd : co;
          totalNightsBooked += Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
        }
      });

      const occupancy = useCreatedDate
        ? (totalNightsBooked / (periodDays * nonBundleCount)) * 100
        : Math.min(100, (totalNightsBooked / (periodDays * nonBundleCount)) * 100);

      const adr = totalNightsAll > 0 ? totalRevenue / totalNightsAll : 0;

      const prevTotalNights = allPrevPeriod.reduce((s, r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        return s + Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
      }, 0);
      const prevYearAdr = prevTotalNights > 0 ? prevYearRevenue / prevTotalNights : 0;

      // Prev year occupancy
      let prevNightsBooked = 0;
      allPrevPeriod.forEach((r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        const start = ci < prevPeriodStart ? prevPeriodStart : ci;
        const end = co > prevEffectiveEnd ? prevEffectiveEnd : co;
        prevNightsBooked += Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
      });
      const prevYearOccupancy = nonBundleCount > 0 ? Math.min(100, (prevNightsBooked / (prevPeriodDays * nonBundleCount)) * 100) : 0;

      const kpis: OwnerKpis = {
        totalRevenue,
        prevYearRevenue,
        occupancy,
        prevYearOccupancy,
        adr,
        prevYearAdr,
        totalBookings: allThisPeriod.length,
        totalNights: totalNightsAll,
      };

      return { owner, properties, kpis, currentYear, periodType };
    },
  });
}
