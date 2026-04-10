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

export function useOwnerPortalData(periodType: OwnerPeriodType = "Year", periodRef: Date = new Date()) {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId } = useOwnerPreview();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { from: periodStart, to: periodEnd } = getPeriodRange(periodType, periodRef);
  // Cap at today if the period extends into the future
  const effectiveEnd = dateMin([periodEnd, now]);
  const periodDays = Math.max(1, Math.floor((effectiveEnd.getTime() - periodStart.getTime()) / 86400000));

  // Same period last year, also capped at the same relative day
  const prevPeriodStart = subYears(periodStart, 1);
  const prevPeriodEnd = subYears(periodEnd, 1);
  const prevEffectiveEnd = dateMin([prevPeriodEnd, subYears(effectiveEnd, 1)]);
  const prevPeriodDays = Math.max(1, Math.floor((prevEffectiveEnd.getTime() - prevPeriodStart.getTime()) / 86400000));

  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const effectiveEndStr = effectiveEnd.toISOString().slice(0, 10);
  const prevStartStr = prevPeriodStart.toISOString().slice(0, 10);
  const prevEffectiveEndStr = prevEffectiveEnd.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["owner_portal", isPreviewMode ? selectedOwnerId : user?.id, periodType, periodStartStr],
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

      // Overlap check capped at effective end dates
      const overlaps = (ci: string, co: string, rangeStart: string, rangeEnd: string) =>
        ci <= rangeEnd && co > rangeStart;

      const currentYear = now.getFullYear();

      const properties: OwnerProperty[] = listings.map((l) => {
        const propRes = reservations.filter((r) => r.listing_id === l.id && r.status !== "cancelled");

        const thisPeriodRes = propRes.filter((r) => overlaps(r.check_in, r.check_out, periodStartStr, effectiveEndStr));
        const prevPeriodRes = propRes.filter((r) => overlaps(r.check_in, r.check_out, prevStartStr, prevEffectiveEndStr));

        const revenueThisYear = thisPeriodRes.reduce((s, r) => s + (r.total_amount || 0), 0);
        const revenuePrevYear = prevPeriodRes.reduce((s, r) => s + (r.total_amount || 0), 0);

        const monthlyRevenue = Array.from({ length: 12 }, (_, m) =>
          propRes.filter((r) => r.year === currentYear && r.month === m + 1).reduce((s, r) => s + (r.total_amount || 0), 0)
        );

        // Occupancy for period (capped at effective end)
        let nightsBooked = 0;
        thisPeriodRes.forEach((r) => {
          const ci = new Date(r.check_in);
          const co = new Date(r.check_out);
          const start = ci < periodStart ? periodStart : ci;
          const end = co > effectiveEnd ? effectiveEnd : co;
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
      const allThisPeriod = reservations.filter((r) => r.status !== "cancelled" && overlaps(r.check_in, r.check_out, periodStartStr, effectiveEndStr));
      const allPrevPeriod = reservations.filter((r) => r.status !== "cancelled" && overlaps(r.check_in, r.check_out, prevStartStr, prevEffectiveEndStr));

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
      let prevNightsBooked = 0;
      allPrevPeriod.forEach((r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        const start = ci < prevPeriodStart ? prevPeriodStart : ci;
        const end = co > prevEffectiveEnd ? prevEffectiveEnd : co;
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
