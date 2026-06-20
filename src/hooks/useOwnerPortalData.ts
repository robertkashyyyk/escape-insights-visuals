import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  subYears, addWeeks, addMonths, addQuarters, addYears,
  format,
} from "date-fns";
import { REVENUE_FIELDS } from "@/lib/revenue";
import { periodRevenue, overlapsPeriod } from "@/lib/metrics";

export type OwnerPeriodType = "Week" | "Month" | "Quarter" | "Year";
export type OwnerDateMode = "check_in" | "created";

export interface OwnerReservationDetail {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  nights_total: number;
  nights_in_period: number;
  revenue: number;            // already × factor for bundle splits
  revenue_factor: number;     // 1.0 for normal, 0.55/0.45 for bundle components
  platform: string | null;
  is_bundle_expansion: boolean;
  duplicate_of?: string;      // guest_name of the row we kept
}

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
  reservations: OwnerReservationDetail[];
  duplicatesDropped: OwnerReservationDetail[];
}

export interface OwnerKpis {
  // Headline values = FULL selected period ("what's on the cards").
  totalRevenue: number;
  occupancy: number;
  adr: number;
  totalBookings: number;
  totalNights: number;
  // To-date pairs, used ONLY for the "vs last year" badges so the comparison stays
  // like-for-like (period-to-date this year vs same-as-of-date last year).
  revenueToDate: number;
  prevRevenueToDate: number;
  occupancyToDate: number;
  prevOccupancyToDate: number;
  adrToDate: number;
  prevAdrToDate: number;
}

export function getPeriodRange(periodType: OwnerPeriodType, ref: Date) {
  switch (periodType) {
    case "Week":    return { from: startOfWeek(ref, { weekStartsOn: 1 }), to: endOfWeek(ref, { weekStartsOn: 1 }) };
    case "Month":   return { from: startOfMonth(ref), to: endOfMonth(ref) };
    case "Quarter": return { from: startOfQuarter(ref), to: endOfQuarter(ref) };
    case "Year":
    default:        return { from: startOfYear(ref), to: endOfYear(ref) };
  }
}

export function shiftPeriod(ref: Date, periodType: OwnerPeriodType, direction: 1 | -1): Date {
  switch (periodType) {
    case "Week":    return addWeeks(ref, direction);
    case "Month":   return addMonths(ref, direction);
    case "Quarter": return addQuarters(ref, direction);
    case "Year":    return addYears(ref, direction);
  }
}

export function getPeriodLabel(periodType: OwnerPeriodType, ref: Date, now: Date): string {
  const { from, to } = getPeriodRange(periodType, ref);
  const isCurrentPeriod = from <= now && to >= now;
  switch (periodType) {
    case "Week":    return `${`W/C ${format(from, "d MMM yyyy")}`}${isCurrentPeriod ? " (This week)" : ""}`;
    case "Month":   return `${format(from, "MMMM yyyy")}${isCurrentPeriod ? " (This month)" : ""}`;
    case "Quarter": {
      const q = Math.ceil((from.getMonth() + 1) / 3);
      return `Q${q} ${format(from, "yyyy")}${isCurrentPeriod ? " (This quarter)" : ""}`;
    }
    case "Year":    return `${format(from, "yyyy")}${isCurrentPeriod ? " (This year)" : ""}`;
  }
}

/* ───────────────────────── helpers ───────────────────────── */

const DAY_MS = 86400000;
const toDate = (s: string) => new Date(s + "T00:00:00Z");
const nightsBetween = (ci: string, co: string) =>
  Math.max(0, Math.floor((toDate(co).getTime() - toDate(ci).getTime()) / DAY_MS));

/** Nights of [ci, co) that fall inside [periodStart, periodEnd] (inclusive end day). */
const nightsInPeriod = (ci: string, co: string, periodStart: string, periodEnd: string) => {
  const startMs = Math.max(toDate(ci).getTime(), toDate(periodStart).getTime());
  // periodEnd is inclusive (last day of period). Reservation occupies nights up to check_out exclusive.
  // Add 1 day to periodEnd to compare against check_out.
  const periodEndExclusive = toDate(periodEnd).getTime() + DAY_MS;
  const endMs = Math.min(toDate(co).getTime(), periodEndExclusive);
  return Math.max(0, Math.floor((endMs - startMs) / DAY_MS));
};

/**
 * Per-listing dedupe: two reservations on the same listing with overlapping
 * dates and the same length within ±1 day are treated as duplicates.
 * Keep the one with the higher total_amount (real booking).
 */
function dedupePerListing<T extends { listing_id: string; check_in: string; check_out: string; total_amount?: number | null; id: string }>(
  rows: T[]
): { kept: T[]; dropped: Array<T & { _dup_of: T }> } {
  const byListing = new Map<string, T[]>();
  rows.forEach((r) => {
    const arr = byListing.get(r.listing_id) ?? [];
    arr.push(r);
    byListing.set(r.listing_id, arr);
  });

  const kept: T[] = [];
  const dropped: Array<T & { _dup_of: T }> = [];

  byListing.forEach((arr) => {
    // Sort by check_in then descending total_amount so the "winner" comes first when overlapping
    arr.sort((a, b) => {
      if (a.check_in !== b.check_in) return a.check_in < b.check_in ? -1 : 1;
      return (Number(b.total_amount ?? 0)) - (Number(a.total_amount ?? 0));
    });

    const used: T[] = [];
    arr.forEach((r) => {
      const dup = used.find((u) => {
        // Overlap test
        if (r.check_in >= u.check_out || r.check_out <= u.check_in) return false;
        // Similar length (within 1 night)
        const lenA = nightsBetween(u.check_in, u.check_out);
        const lenB = nightsBetween(r.check_in, r.check_out);
        return Math.abs(lenA - lenB) <= 1;
      });
      if (dup) {
        dropped.push({ ...(r as any), _dup_of: dup });
      } else {
        used.push(r);
        kept.push(r);
      }
    });
  });

  return { kept, dropped };
}

/* ───────────────────────── hook ───────────────────────── */

export function useOwnerPortalData(
  periodType: OwnerPeriodType = "Year",
  periodRef: Date = new Date(),
  dateMode: OwnerDateMode = "check_in"
) {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId } = useOwnerPreview();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { from: periodStart, to: rawPeriodEnd } = getPeriodRange(periodType, periodRef);

  // Headline cards + property cards show the FULL selected period — "what's on the cards"
  // regardless of whether check-ins fall before or after today. (The earned-to-date vs
  // pipeline split lives in My Graphs.) The "vs last year" badge, however, is computed over
  // a SEPARATE to-date window below, so an in-progress (half-booked) period isn't pitted
  // against a complete prior period.
  const _todayMid = new Date(); _todayMid.setHours(0, 0, 0, 0);
  const inProgress = periodStart.getTime() <= _todayMid.getTime() && rawPeriodEnd.getTime() > _todayMid.getTime();

  // Display window = full period.
  const periodEnd = rawPeriodEnd;
  const periodDays = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / DAY_MS) + 1);
  const prevPeriodStart = subYears(periodStart, 1);
  const prevPeriodEnd = subYears(periodEnd, 1);
  const prevPeriodDays = Math.max(1, Math.floor((prevPeriodEnd.getTime() - prevPeriodStart.getTime()) / DAY_MS) + 1);

  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr   = periodEnd.toISOString().slice(0, 10);
  const prevStartStr   = prevPeriodStart.toISOString().slice(0, 10);
  const prevEndStr     = prevPeriodEnd.toISOString().slice(0, 10);

  // Comparison window = to-date (clamped to today for an in-progress period) + the same
  // as-of date a year earlier. Used only for the YoY badges.
  const cmpEnd = inProgress ? _todayMid : rawPeriodEnd;
  const cmpDays = Math.max(1, Math.floor((cmpEnd.getTime() - periodStart.getTime()) / DAY_MS) + 1);
  const prevCmpStart = subYears(periodStart, 1);
  const prevCmpEnd   = subYears(cmpEnd, 1);
  const prevCmpDays  = Math.max(1, Math.floor((prevCmpEnd.getTime() - prevCmpStart.getTime()) / DAY_MS) + 1);
  const cmpStartStr     = periodStartStr;
  const cmpEndStr       = cmpEnd.toISOString().slice(0, 10);
  const prevCmpStartStr = prevCmpStart.toISOString().slice(0, 10);
  const prevCmpEndStr   = prevCmpEnd.toISOString().slice(0, 10);
  const useCreatedDate = dateMode === "created";

  return useQuery({
    queryKey: ["owner_portal_v2", isPreviewMode ? selectedOwnerId : user?.id, periodType, periodStartStr, dateMode],
    enabled: !!(isPreviewMode ? selectedOwnerId : user),
    queryFn: async () => {
      /* ── 1. Listings + owner ── */
      let listingsQuery = supabase.from("listings").select("id, name, location_group, bedrooms, owner_id, is_bundle, bundle_components");
      let ownerQuery    = supabase.from("property_owners").select("id, name");
      if (isPreviewMode && selectedOwnerId) {
        listingsQuery = listingsQuery.eq("owner_id", selectedOwnerId);
        ownerQuery    = ownerQuery.eq("id", selectedOwnerId);
      }

      const [listingsRes, ownerRes, syncRes] = await Promise.all([
        listingsQuery,
        ownerQuery,
        supabase.from("sync_logs").select("completed_at").eq("status", "completed").order("completed_at", { ascending: false }).limit(1),
      ]);

      const listings    = listingsRes.data || [];
      const owner       = ownerRes.data?.[0];
      const lastSyncAt  = syncRes.data?.[0]?.completed_at ?? null;
      const listingIds  = listings.map((l) => l.id);
      const listingName = new Map<string, string>(listings.map((l: any) => [l.id, l.name]));

      // Bundle map
      const bundlesById = new Map<string, Array<{ listing_id: string; split_pct: number }>>();
      listings.forEach((l: any) => {
        if (l.is_bundle && Array.isArray(l.bundle_components)) bundlesById.set(l.id, l.bundle_components);
      });

      const componentListings = listings.filter((l: any) => !l.is_bundle);
      const nonBundleCount = Math.max(1, componentListings.length);

      /* ── 2. Reservations (raw confirmed) ── */
      let rawReservations: any[] = [];
      if (listingIds.length > 0) {
        const { data } = await supabase
          .from("reservations")
          .select(`id, listing_id, check_in, check_out, year, month, status, reservation_date, guest_name, platform, ${REVENUE_FIELDS}`)
          .in("listing_id", listingIds)
          .eq("status", "confirmed");
        rawReservations = data || [];
      }

      /* ── 3. Dedupe per listing (catches Hostaway/channel duplicates) ── */
      const { kept, dropped } = dedupePerListing(rawReservations);
      const droppedByListing = new Map<string, any[]>();
      dropped.forEach((d) => {
        const arr = droppedByListing.get(d.listing_id) ?? [];
        arr.push(d);
        droppedByListing.set(d.listing_id, arr);
      });

      /* ── 4. Expand bundle reservations into virtual per-component rows ── */
      type Exp = any & { _listing_id: string; _revenue_factor: number; _is_bundle_expansion: boolean };
      const expanded: Exp[] = [];
      kept.forEach((r) => {
        const comps = bundlesById.get(r.listing_id);
        if (comps && comps.length > 0) {
          comps.forEach((c) => {
            expanded.push({
              ...r,
              _listing_id: c.listing_id,
              _revenue_factor: (c.split_pct ?? (100 / comps.length)) / 100,
              _is_bundle_expansion: true,
            });
          });
        } else {
          expanded.push({ ...r, _listing_id: r.listing_id, _revenue_factor: 1, _is_bundle_expansion: false });
        }
      });

      /* ── 5. Period filter helpers ── */
      const inPeriod = (r: any, rangeStart: string, rangeEnd: string) => {
        if (useCreatedDate) {
          const rd = r.reservation_date;
          return rd && rd >= rangeStart && rd <= rangeEnd;
        }
        return r.check_in <= rangeEnd && r.check_out > rangeStart;
      };

      const currentYear = now.getFullYear();

      /* ── 6. Build per-property aggregates (single source of truth) ── */
      const properties: OwnerProperty[] = componentListings.map((l: any) => {
        const propRes = expanded.filter((r) => r._listing_id === l.id);

        const thisPeriodRes = propRes.filter((r) => inPeriod(r, periodStartStr, periodEndStr));
        const prevPeriodRes = propRes.filter((r) => inPeriod(r, prevStartStr, prevEndStr));

        const revenueThisYear = thisPeriodRes.reduce((s, r) => s + periodRevenue(r, periodStartStr, periodEndStr) * r._revenue_factor, 0);
        const revenuePrevYear = prevPeriodRes.reduce((s, r) => s + periodRevenue(r, prevStartStr, prevEndStr) * r._revenue_factor, 0);

        const monthlyRevenue = Array.from({ length: 12 }, (_, m) => {
          const ms = `${currentYear}-${String(m + 1).padStart(2, "0")}-01`;
          const me = new Date(Date.UTC(currentYear, m + 1, 0)).toISOString().slice(0, 10);
          return propRes
            .filter((r) => overlapsPeriod(r.check_in, r.check_out, ms, me))
            .reduce((s, r) => s + periodRevenue(r, ms, me) * r._revenue_factor, 0);
        });

        // Clip nights to period — prevents cross-month bleed and overlap > calendar
        const totalNights = thisPeriodRes.reduce(
          (s, r) => s + nightsInPeriod(r.check_in, r.check_out, periodStartStr, periodEndStr),
          0
        );

        const occupancyPct = Math.min(100, (totalNights / periodDays) * 100);
        const adr = totalNights > 0 ? revenueThisYear / totalNights : 0;
        const totalBookings = thisPeriodRes.length;
        const upcomingCount = propRes.filter((r) => r.check_in >= today).length;

        const reservations: OwnerReservationDetail[] = thisPeriodRes
          .map((r) => ({
            id: r.id,
            guest_name: r.guest_name,
            check_in: r.check_in,
            check_out: r.check_out,
            nights_total: nightsBetween(r.check_in, r.check_out),
            nights_in_period: nightsInPeriod(r.check_in, r.check_out, periodStartStr, periodEndStr),
            revenue: periodRevenue(r, periodStartStr, periodEndStr) * r._revenue_factor,
            revenue_factor: r._revenue_factor,
            platform: r.platform ?? null,
            is_bundle_expansion: r._is_bundle_expansion,
          }))
          .sort((a, b) => (a.check_in < b.check_in ? -1 : 1));

        const duplicatesDropped: OwnerReservationDetail[] = (droppedByListing.get(l.id) ?? [])
          .filter((d) => inPeriod(d, periodStartStr, periodEndStr))
          .map((d) => ({
            id: d.id,
            guest_name: d.guest_name,
            check_in: d.check_in,
            check_out: d.check_out,
            nights_total: nightsBetween(d.check_in, d.check_out),
            nights_in_period: nightsInPeriod(d.check_in, d.check_out, periodStartStr, periodEndStr),
            revenue: 0,
            revenue_factor: 1,
            platform: d.platform ?? null,
            is_bundle_expansion: false,
            duplicate_of: d._dup_of?.guest_name,
          }));

        return {
          id: l.id, name: l.name, location_group: l.location_group, bedrooms: l.bedrooms,
          isBundle: false,
          revenueThisYear, revenuePrevYear, occupancyPct, adr, totalNights, totalBookings,
          monthlyRevenue, upcomingCount, reservations, duplicatesDropped,
        };
      });

      /* ── 7. Aggregate KPIs — derive from properties so totals ALWAYS tie ── */
      const totalRevenue   = properties.reduce((s, p) => s + p.revenueThisYear,  0);
      const totalNightsAll = properties.reduce((s, p) => s + p.totalNights,      0);
      const totalBookings  = properties.reduce((s, p) => s + p.totalBookings,    0);

      const occupancy = nonBundleCount > 0
        ? Math.min(100, (totalNightsAll / (periodDays * nonBundleCount)) * 100)
        : 0;
      const adr = totalNightsAll > 0 ? totalRevenue / totalNightsAll : 0;

      // To-date comparison aggregates — drive the "vs last year" badges only. Current
      // to-date (period start → today) vs the same as-of window a year earlier, so the %
      // is like-for-like even though the headline above shows the full period.
      let curCmpNights = 0,  curCmpRevenue = 0;
      let prevCmpNights = 0, prevCmpRevenue = 0;
      componentListings.forEach((l: any) => {
        expanded.filter((r) => r._listing_id === l.id && inPeriod(r, cmpStartStr, cmpEndStr)).forEach((r) => {
          curCmpNights  += nightsInPeriod(r.check_in, r.check_out, cmpStartStr, cmpEndStr);
          curCmpRevenue += periodRevenue(r, cmpStartStr, cmpEndStr) * r._revenue_factor;
        });
        expanded.filter((r) => r._listing_id === l.id && inPeriod(r, prevCmpStartStr, prevCmpEndStr)).forEach((r) => {
          prevCmpNights  += nightsInPeriod(r.check_in, r.check_out, prevCmpStartStr, prevCmpEndStr);
          prevCmpRevenue += periodRevenue(r, prevCmpStartStr, prevCmpEndStr) * r._revenue_factor;
        });
      });
      const occupancyToDate = nonBundleCount > 0
        ? Math.min(100, (curCmpNights / (cmpDays * nonBundleCount)) * 100) : 0;
      const prevOccupancyToDate = nonBundleCount > 0
        ? Math.min(100, (prevCmpNights / (prevCmpDays * nonBundleCount)) * 100) : 0;
      const adrToDate     = curCmpNights  > 0 ? curCmpRevenue  / curCmpNights  : 0;
      const prevAdrToDate = prevCmpNights > 0 ? prevCmpRevenue / prevCmpNights : 0;

      const kpis: OwnerKpis = {
        totalRevenue,
        occupancy,
        adr,
        totalBookings,
        totalNights: totalNightsAll,
        revenueToDate: curCmpRevenue,
        prevRevenueToDate: prevCmpRevenue,
        occupancyToDate,
        prevOccupancyToDate,
        adrToDate,
        prevAdrToDate,
      };

      const duplicatesDroppedCount = properties.reduce((s, p) => s + p.duplicatesDropped.length, 0);

      return { owner, properties, kpis, currentYear, periodType, lastSyncAt, duplicatesDroppedCount };
    },
  });
}
