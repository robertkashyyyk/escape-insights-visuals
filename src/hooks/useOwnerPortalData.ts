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
import { getNetRevenue, REVENUE_FIELDS } from "@/lib/revenue";

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
  const periodDays = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);

  const prevPeriodStart = subYears(periodStart, 1);
  const prevPeriodEnd = subYears(periodEnd, 1);
  const prevPeriodDays = Math.max(1, Math.floor((prevPeriodEnd.getTime() - prevPeriodStart.getTime()) / 86400000) + 1);

  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);
  const prevStartStr = prevPeriodStart.toISOString().slice(0, 10);
  const prevEndStr = prevPeriodEnd.toISOString().slice(0, 10);

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

      // Build bundle → components map (listing_id → { components: [{listing_id, split_pct}] })
      const bundlesById = new Map<string, Array<{ listing_id: string; split_pct: number }>>();
      listings.forEach((l: any) => {
        if (l.is_bundle && Array.isArray(l.bundle_components)) {
          bundlesById.set(l.id, l.bundle_components);
        }
      });

      // Non-bundle listings only (we hide bundle cards entirely)
      const componentListings = listings.filter((l: any) => !l.is_bundle);
      const nonBundleCount = Math.max(1, componentListings.length);

      let reservations: any[] = [];
      if (listingIds.length > 0) {
        const { data } = await supabase
          .from("reservations")
          .select(`listing_id, check_in, check_out, year, month, status, reservation_date, ${REVENUE_FIELDS}`)
          .in("listing_id", listingIds)
          .eq("status", "confirmed");
        reservations = data || [];
      }

      // Expand bundle reservations into virtual per-component reservations.
      // Each component gets full nights/bookings but revenue is split by split_pct.
      type ExpandedRes = any & { _listing_id: string; _revenue_factor: number };
      const expanded: ExpandedRes[] = [];
      reservations.forEach((r) => {
        const bundleComps = bundlesById.get(r.listing_id);
        if (bundleComps && bundleComps.length > 0) {
          bundleComps.forEach((c) => {
            expanded.push({ ...r, _listing_id: c.listing_id, _revenue_factor: (c.split_pct ?? (100 / bundleComps.length)) / 100 });
          });
        } else {
          expanded.push({ ...r, _listing_id: r.listing_id, _revenue_factor: 1 });
        }
      });

      const inPeriod = (r: any, rangeStart: string, rangeEnd: string) => {
        if (useCreatedDate) {
          const rd = r.reservation_date;
          return rd && rd >= rangeStart && rd <= rangeEnd;
        }
        return r.check_in <= rangeEnd && r.check_out > rangeStart;
      };

      const currentYear = now.getFullYear();

      const properties: OwnerProperty[] = componentListings.map((l) => {
        const propRes = expanded.filter((r) => r._listing_id === l.id && r.status !== "cancelled");

        const thisPeriodRes = propRes.filter((r) => inPeriod(r, periodStartStr, periodEndStr));
        const prevPeriodRes = propRes.filter((r) => inPeriod(r, prevStartStr, prevEndStr));

        const revenueThisYear = thisPeriodRes.reduce((s, r) => s + getNetRevenue(r) * r._revenue_factor, 0);
        const revenuePrevYear = prevPeriodRes.reduce((s, r) => s + getNetRevenue(r) * r._revenue_factor, 0);

        const monthlyRevenue = Array.from({ length: 12 }, (_, m) =>
          propRes.filter((r) => r.year === currentYear && r.month === m + 1).reduce((s, r) => s + getNetRevenue(r) * r._revenue_factor, 0)
        );

        let totalNights = 0;
        thisPeriodRes.forEach((r) => {
          const ci = new Date(r.check_in);
          const co = new Date(r.check_out);
          totalNights += Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
        });

        const occupancyPct = Math.min(100, (totalNights / periodDays) * 100);
        const adr = totalNights > 0 ? revenueThisYear / totalNights : 0;
        const totalBookings = thisPeriodRes.length;
        const upcomingCount = propRes.filter((r) => r.check_in >= today).length;

        return {
          id: l.id, name: l.name, location_group: l.location_group, bedrooms: l.bedrooms,
          isBundle: false,
          revenueThisYear, revenuePrevYear, occupancyPct, adr, totalNights, totalBookings, monthlyRevenue, upcomingCount
        };
      });

      // Aggregate KPIs (use original reservations, not expanded — bundle stays counted once)
      const allThisPeriod = reservations.filter((r) => r.status !== "cancelled" && inPeriod(r, periodStartStr, periodEndStr));
      const allPrevPeriod = reservations.filter((r) => r.status !== "cancelled" && inPeriod(r, prevStartStr, prevEndStr));

      const totalRevenue = allThisPeriod.reduce((s, r) => s + getNetRevenue(r), 0);
      const prevYearRevenue = allPrevPeriod.reduce((s, r) => s + getNetRevenue(r), 0);

      let totalNightsAll = 0;
      allThisPeriod.forEach((r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        totalNightsAll += Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
      });

      // Bundle stays block all components — count each bundle night × component count for occupancy
      let bookedRoomNights = 0;
      allThisPeriod.forEach((r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        const nights = Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
        const comps = bundlesById.get(r.listing_id);
        bookedRoomNights += nights * (comps && comps.length > 0 ? comps.length : 1);
      });

      const occupancy = Math.min(100, (bookedRoomNights / (periodDays * nonBundleCount)) * 100);
      const adr = totalNightsAll > 0 ? totalRevenue / totalNightsAll : 0;

      const prevTotalNights = allPrevPeriod.reduce((s, r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        return s + Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
      }, 0);
      const prevYearAdr = prevTotalNights > 0 ? prevYearRevenue / prevTotalNights : 0;

      let prevBookedRoomNights = 0;
      allPrevPeriod.forEach((r) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        const nights = Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
        const comps = bundlesById.get(r.listing_id);
        prevBookedRoomNights += nights * (comps && comps.length > 0 ? comps.length : 1);
      });
      const prevYearOccupancy = nonBundleCount > 0 ? Math.min(100, (prevBookedRoomNights / (prevPeriodDays * nonBundleCount)) * 100) : 0;


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
