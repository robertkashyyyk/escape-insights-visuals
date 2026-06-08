import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { getGrossRevenue, REVENUE_FIELDS } from "@/lib/revenue";

export interface ReportPropertyRow {
  listingId: string;
  name: string;
  nights: number;
  revenue: number;
  adr: number;
  occupancy: number;
  prevRevenue: number;
}

export interface ForwardBooking {
  label: string;
  revenue: number;
}

export interface MonthlyReportData {
  owner: {
    id: string;
    name: string;
    company: string | null;
    managementRatePct: number | null;
    vatInclusive: boolean;
  };
  periodLabel: string;
  prevPeriodLabel: string;
  propertyCount: number;
  totalRevenue: number;
  managementFee: number;
  totalNights: number;
  avgOccupancy: number;
  avgNightlyRate: number;
  // YoY comparison
  prevRevenue: number;
  prevAdr: number;
  prevOccupancy: number;
  currentAdr: number;
  currentOccupancy: number;
  // Property breakdown
  properties: ReportPropertyRow[];
  // Last 6 months trend
  monthlyTrend: { label: string; revenue: number }[];
  // Forward bookings
  forwardRevenue: number;
  forwardNights: number;
  nextCheckinDate: string | null;
  forwardMonths: ForwardBooking[];
  showForward: boolean;
}

function nightsInRange(checkIn: string, checkOut: string, rangeStart: Date, rangeEnd: Date): number {
  const ci = parseISO(checkIn);
  const co = parseISO(checkOut);
  const start = ci < rangeStart ? rangeStart : ci;
  const end = co > rangeEnd ? rangeEnd : co;
  const diff = differenceInDays(end, start);
  return Math.max(0, diff);
}

// Engine R1: recognise only the in-period portion of a booking's gross.
// prorate_by_nights (default) apportions month-boundary stays by nights — this is
// how the manual report splits e.g. a 30 Apr–2 May booking across the two months.
// whole_in_attributed_month counts the full gross in the overlapping month.
function recognisedRevenue(r: any, rangeStart: Date, rangeEnd: Date, prorate: boolean): number {
  const gross = getGrossRevenue(r);
  if (!prorate) return gross;
  const bookingNights = Math.max(1, differenceInDays(parseISO(r.check_out), parseISO(r.check_in)));
  const nip = nightsInRange(r.check_in, r.check_out, rangeStart, rangeEnd);
  return gross * (nip / bookingNights);
}

export function useMonthlyReport(ownerId: string | null, periodStart: Date, periodEnd: Date) {
  return useQuery({
    queryKey: ["monthly_report", ownerId, periodStart.toISOString(), periodEnd.toISOString()],
    enabled: !!ownerId,
    queryFn: async (): Promise<MonthlyReportData | null> => {
      const { data: owner } = await supabase
        .from("property_owners")
        .select("*")
        .eq("id", ownerId!)
        .single();
      if (!owner) return null;

      const { data: listings } = await supabase
        .from("listings")
        .select("id, name, status")
        .eq("owner_id", ownerId!);
      if (!listings?.length) return null;

      const listingIds = listings.map((l) => l.id);
      const activeCount = listings.filter((l) => l.status === "active").length;

      const startStr = format(periodStart, "yyyy-MM-dd");
      const endStr = format(periodEnd, "yyyy-MM-dd");

      // Previous year same period
      const prevStart = new Date(periodStart);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      const prevEnd = new Date(periodEnd);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);
      const prevStartStr = format(prevStart, "yyyy-MM-dd");
      const prevEndStr = format(prevEnd, "yyyy-MM-dd");

      // Period labels
      const isSingleMonth =
        periodStart.getDate() === 1 &&
        periodEnd.getTime() === endOfMonth(periodStart).getTime();
      const periodLabel = isSingleMonth
        ? format(periodStart, "MMMM yyyy") + " Performance Report"
        : `${format(periodStart, "d MMM yyyy")} – ${format(periodEnd, "d MMM yyyy")} Performance Report`;
      const prevPeriodLabel = isSingleMonth
        ? format(prevStart, "MMM yyyy")
        : `${format(prevStart, "d MMM yyyy")} – ${format(prevEnd, "d MMM yyyy")}`;

      // Last 6 months for trend
      const trendMonths: { start: Date; end: Date; label: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const ms = startOfMonth(subMonths(periodEnd, i));
        const me = endOfMonth(ms);
        trendMonths.push({ start: ms, end: me, label: format(ms, "MMM") });
      }
      const trendStartStr = format(trendMonths[0].start, "yyyy-MM-dd");

      // Forward bookings: next 3 months from today
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const forward3 = addMonths(today, 3);
      const forward3Str = format(forward3, "yyyy-MM-dd");

      // Should we show forward section? Only if period end is within 1 month of today
      const monthsAgo = differenceInDays(today, periodEnd);
      const showForward = monthsAgo <= 31;

      const resCols = `listing_id, check_in, check_out, status, ${REVENUE_FIELDS}`;
      const [currentRes, prevRes, trendRes, forwardRes] = await Promise.all([
        supabase
          .from("reservations")
          .select(resCols)
          .in("listing_id", listingIds)
          .lte("check_in", endStr)
          .gte("check_out", startStr)
          .eq("status", "confirmed"),
        supabase
          .from("reservations")
          .select(resCols)
          .in("listing_id", listingIds)
          .lte("check_in", prevEndStr)
          .gte("check_out", prevStartStr)
          .eq("status", "confirmed"),
        supabase
          .from("reservations")
          .select(resCols)
          .in("listing_id", listingIds)
          .gte("check_in", trendStartStr)
          .lte("check_in", endStr)
          .eq("status", "confirmed"),
        showForward
          ? supabase
              .from("reservations")
              .select(resCols)
              .in("listing_id", listingIds)
              .gte("check_in", todayStr)
              .lte("check_in", forward3Str)
              .eq("status", "confirmed")
          : Promise.resolve({ data: [] }),
      ]);

      const filter = (rows: any[]) => rows ?? [];

      const currentRows = filter(currentRes.data);
      const prevRows = filter(prevRes.data);
      const trendRows = filter(trendRes.data);
      const forwardRows = filter(forwardRes.data);

      // Revenue recognition (default prorate_by_nights) — apportion boundary stays.
      const prorate = ((owner as any).revenue_recognition ?? "prorate_by_nights") !== "whole_in_attributed_month";

      // Current period aggregation per property
      const byListing: Record<string, { revenue: number; nights: number }> = {};
      for (const r of currentRows) {
        const nights = nightsInRange(r.check_in, r.check_out, periodStart, periodEnd);
        const rev = recognisedRevenue(r, periodStart, periodEnd, prorate);
        if (!byListing[r.listing_id]) byListing[r.listing_id] = { revenue: 0, nights: 0 };
        byListing[r.listing_id].revenue += rev;
        byListing[r.listing_id].nights += nights;
      }

      const totalRevenue = Object.values(byListing).reduce((s, v) => s + v.revenue, 0);
      const totalNights = Object.values(byListing).reduce((s, v) => s + v.nights, 0);
      const avgNightlyRate = totalNights > 0 ? totalRevenue / totalNights : 0;
      const daysInPeriod = Math.max(1, differenceInDays(periodEnd, periodStart));
      const avgOccupancy = activeCount > 0 ? (totalNights / (activeCount * daysInPeriod)) * 100 : 0;

      const ratePct = owner.management_rate_pct ?? 0;
      const vatMultiplier = owner.vat_inclusive ? 1.2 : 1.0;
      const managementFee = totalRevenue * (ratePct / 100) * vatMultiplier;

      // Previous period aggregation
      let prevTotalRevenue = 0;
      let prevTotalNights = 0;
      const prevByListing: Record<string, { revenue: number }> = {};
      for (const r of prevRows) {
        const nights = nightsInRange(r.check_in, r.check_out, prevStart, prevEnd);
        const rev = recognisedRevenue(r, prevStart, prevEnd, prorate);
        prevTotalRevenue += rev;
        prevTotalNights += nights;
        if (!prevByListing[r.listing_id]) prevByListing[r.listing_id] = { revenue: 0 };
        prevByListing[r.listing_id].revenue += rev;
      }
      const prevAdr = prevTotalNights > 0 ? prevTotalRevenue / prevTotalNights : 0;
      const prevOccupancy = activeCount > 0 ? (prevTotalNights / (activeCount * daysInPeriod)) * 100 : 0;

      // Property breakdown
      const properties: ReportPropertyRow[] = listings
        .map((l) => {
          const agg = byListing[l.id] ?? { revenue: 0, nights: 0 };
          const occ = l.status === "active" ? (agg.nights / daysInPeriod) * 100 : 0;
          return {
            listingId: l.id,
            name: l.name,
            nights: agg.nights,
            revenue: agg.revenue,
            adr: agg.nights > 0 ? agg.revenue / agg.nights : 0,
            occupancy: occ,
            prevRevenue: prevByListing[l.id]?.revenue ?? 0,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      // Monthly trend
      const monthlyTrend = trendMonths.map((m) => {
        let rev = 0;
        for (const r of trendRows) {
          const ci = parseISO(r.check_in);
          if (ci >= m.start && ci <= m.end) {
            rev += getGrossRevenue(r);
          }
        }
        return { label: m.label, revenue: rev };
      });

      // Forward bookings
      let forwardRevenue = 0;
      let forwardNights = 0;
      let nextCheckinDate: string | null = null;
      const forwardMonthBuckets: ForwardBooking[] = [];

      if (showForward) {
        for (const r of forwardRows) {
          forwardRevenue += getGrossRevenue(r);
          forwardNights += differenceInDays(parseISO(r.check_out), parseISO(r.check_in));
          if (!nextCheckinDate || r.check_in < nextCheckinDate) nextCheckinDate = r.check_in;
        }

        for (let i = 0; i < 3; i++) {
          const ms = startOfMonth(addMonths(today, i));
          const me = endOfMonth(ms);
          let rev = 0;
          for (const r of forwardRows) {
            const ci = parseISO(r.check_in);
            if (ci >= ms && ci <= me) rev += getGrossRevenue(r);
          }
          forwardMonthBuckets.push({ label: format(ms, "MMM yyyy"), revenue: rev });
        }
      }

      return {
        owner: {
          id: owner.id,
          name: owner.name,
          company: owner.company,
          managementRatePct: owner.management_rate_pct,
          vatInclusive: owner.vat_inclusive,
        },
        periodLabel,
        prevPeriodLabel,
        propertyCount: listings.length,
        totalRevenue,
        managementFee,
        totalNights,
        avgOccupancy,
        avgNightlyRate,
        prevRevenue: prevTotalRevenue,
        prevAdr,
        prevOccupancy,
        currentAdr: avgNightlyRate,
        currentOccupancy: avgOccupancy,
        properties,
        monthlyTrend,
        forwardRevenue,
        forwardNights,
        nextCheckinDate,
        forwardMonths: forwardMonthBuckets,
        showForward,
      };
    },
  });
}
