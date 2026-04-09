import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subYears, differenceInDays, format, addDays, subDays } from "date-fns";

interface PacingData {
  currentOTB: number;
  currentBookingCount: number;
  samePointLastYear: number;
  lastYearFinal: number;
  pacingPct: number;
  daysOut: number;
  isStarted: boolean;
  propertyBreakdown: PropertyPacing[];
  velocityCurrent: VelocityPoint[];
  velocityLastYear: VelocityPoint[];
}

export interface PropertyPacing {
  listingId: string;
  propertyName: string;
  locationGroup: string | null;
  currentOTB: number;
  samePointLY: number;
  pacingPct: number;
}

export interface VelocityPoint {
  daysOut: number;
  cumulative: number;
}

async function fetchAllReservations(
  checkInStart: string,
  checkInEnd: string,
  reservationDateCutoff?: string
) {
  let allData: any[] = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    let q = supabase
      .from("reservations")
      .select("total_amount, reservation_date, listing_id")
      .gte("check_in", checkInStart)
      .lte("check_in", checkInEnd)
      .eq("status", "confirmed")
      .range(from, from + batchSize - 1);

    if (reservationDateCutoff) {
      q = q.lte("reservation_date", reservationDateCutoff);
    }

    const { data } = await q;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allData;
}

async function fetchListings() {
  const { data } = await supabase
    .from("listings")
    .select("id, name, location_group")
    .eq("status", "active");
  return data || [];
}

function buildVelocityData(
  reservations: any[],
  monthStart: Date,
  maxDaysBack: number
): VelocityPoint[] {
  if (!reservations.length) return [];

  // For each reservation, compute how many days before monthStart it was booked
  // daysOut is positive = days before month start
  const points = reservations
    .filter((r) => r.reservation_date)
    .map((r) => ({
      daysOut: differenceInDays(monthStart, new Date(r.reservation_date)),
      amount: r.total_amount || 0,
    }))
    .filter((p) => p.daysOut >= 0 && p.daysOut <= maxDaysBack);

  if (!points.length) return [];

  // Group amounts by daysOut
  const grouped: Record<number, number> = {};
  for (const p of points) {
    grouped[p.daysOut] = (grouped[p.daysOut] || 0) + p.amount;
  }

  // Sort descending (furthest first: 120, 119, ... 1, 0)
  // Build cumulative: start from furthest out, accumulate toward day 0
  const sortedDays = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  let cumulative = 0;
  const result: VelocityPoint[] = [];
  for (const d of sortedDays) {
    cumulative += grouped[d];
    // Use negative daysOut for x-axis: -120 (left) to 0 (right)
    result.push({ daysOut: -d, cumulative });
  }

  // Sort ascending by daysOut for chart (-120, -119, ... 0)
  result.sort((a, b) => a.daysOut - b.daysOut);

  return result;
}

export function useRevenuePacing(targetMonth: Date) {
  return useQuery<PacingData>({
    queryKey: ["revenue-pacing-v2", format(targetMonth, "yyyy-MM")],
    queryFn: async () => {
      const monthStart = startOfMonth(targetMonth);
      const monthEnd = endOfMonth(targetMonth);
      const today = new Date();

      const isStarted = today >= monthStart;
      const daysOut = isStarted
        ? differenceInDays(today, monthStart)
        : differenceInDays(monthStart, today);

      const todayStr = format(today, "yyyy-MM-dd");
      const lastYearEquivDate = format(subDays(today, 365), "yyyy-MM-dd");

      const lastYearMonthStart = startOfMonth(subYears(monthStart, 1));
      const lastYearMonthEnd = endOfMonth(subYears(monthStart, 1));

      const monthStartStr = format(monthStart, "yyyy-MM-dd");
      const monthEndStr = format(monthEnd, "yyyy-MM-dd");
      const lyStartStr = format(lastYearMonthStart, "yyyy-MM-dd");
      const lyEndStr = format(lastYearMonthEnd, "yyyy-MM-dd");

      // Fetch all data in parallel
      const [currentRes, lyAtPointRes, lyFinalRes, listings] = await Promise.all([
        fetchAllReservations(monthStartStr, monthEndStr, todayStr),
        fetchAllReservations(lyStartStr, lyEndStr, lastYearEquivDate),
        fetchAllReservations(lyStartStr, lyEndStr),
        fetchListings(),
      ]);

      const currentOTB = currentRes.reduce((s, r) => s + (r.total_amount || 0), 0);
      const currentBookingCount = currentRes.length;
      const samePointLastYear = lyAtPointRes.reduce((s, r) => s + (r.total_amount || 0), 0);
      const lastYearFinal = lyFinalRes.reduce((s, r) => s + (r.total_amount || 0), 0);

      const pacingPct =
        samePointLastYear > 0
          ? (currentOTB / samePointLastYear) * 100
          : currentOTB > 0
          ? 999
          : 0;

      // Property-level breakdown
      const listingMap = new Map(listings.map((l) => [l.id, l]));

      const currentByListing: Record<string, number> = {};
      for (const r of currentRes) {
        currentByListing[r.listing_id] = (currentByListing[r.listing_id] || 0) + (r.total_amount || 0);
      }

      const lyByListing: Record<string, number> = {};
      for (const r of lyAtPointRes) {
        lyByListing[r.listing_id] = (lyByListing[r.listing_id] || 0) + (r.total_amount || 0);
      }

      const allListingIds = new Set([...Object.keys(currentByListing), ...Object.keys(lyByListing)]);
      const propertyBreakdown: PropertyPacing[] = Array.from(allListingIds)
        .map((lid) => {
          const listing = listingMap.get(lid);
          const cur = currentByListing[lid] || 0;
          const ly = lyByListing[lid] || 0;
          return {
            listingId: lid,
            propertyName: listing?.name || "Unknown Property",
            locationGroup: listing?.location_group || null,
            currentOTB: cur,
            samePointLY: ly,
            pacingPct: ly > 0 ? (cur / ly) * 100 : cur > 0 ? 999 : 0,
          };
        })
        .sort((a, b) => a.pacingPct - b.pacingPct);

      // Velocity chart data
      const velocityCurrent = buildVelocityData(currentRes, monthStart, 120);
      const velocityLastYear = buildVelocityData(lyFinalRes, lastYearMonthStart, 120);

      return {
        currentOTB,
        currentBookingCount,
        samePointLastYear,
        lastYearFinal,
        pacingPct,
        daysOut,
        isStarted,
        propertyBreakdown,
        velocityCurrent,
        velocityLastYear,
      };
    },
  });
}

// Hook to find the default month (earliest future month with bookings)
export function useDefaultPacingMonth(months: Date[]) {
  return useQuery({
    queryKey: ["pacing-default-month", months.map((m) => format(m, "yyyy-MM")).join(",")],
    queryFn: async () => {
      for (let i = 0; i < months.length; i++) {
        const start = format(startOfMonth(months[i]), "yyyy-MM-dd");
        const end = format(endOfMonth(months[i]), "yyyy-MM-dd");
        const { count } = await supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .gte("check_in", start)
          .lte("check_in", end)
          .eq("status", "confirmed");
        if (count && count > 0) return i;
      }
      return 0;
    },
    staleTime: 60_000,
  });
}

/* ── Portfolio Pacing (All Months) ── */
export interface PortfolioMonthPacing {
  month: Date;
  label: string;
  currentOTB: number;
  samePointLY: number;
  lastYearFinal: number;
  pacingPct: number;
}

export interface PortfolioPacingData {
  totalOTB: number;
  totalSamePointLY: number;
  totalLYFinal: number;
  portfolioPacingPct: number;
  monthsAhead: number;
  months: PortfolioMonthPacing[];
}

export function usePortfolioPacing(months: Date[]) {
  return useQuery<PortfolioPacingData>({
    queryKey: ["portfolio-pacing", months.map(m => format(m, "yyyy-MM")).join(",")],
    queryFn: async () => {
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const lastYearEquivDate = format(subDays(today, 365), "yyyy-MM-dd");

      const results: PortfolioMonthPacing[] = [];

      // Fetch all months in parallel
      const fetches = months.map(async (m) => {
        const ms = startOfMonth(m);
        const me = endOfMonth(m);
        const lyMs = startOfMonth(subYears(ms, 1));
        const lyMe = endOfMonth(subYears(ms, 1));

        const [cur, lyPoint, lyFinal] = await Promise.all([
          fetchAllReservations(format(ms, "yyyy-MM-dd"), format(me, "yyyy-MM-dd"), todayStr),
          fetchAllReservations(format(lyMs, "yyyy-MM-dd"), format(lyMe, "yyyy-MM-dd"), lastYearEquivDate),
          fetchAllReservations(format(lyMs, "yyyy-MM-dd"), format(lyMe, "yyyy-MM-dd")),
        ]);

        const currentOTB = cur.reduce((s, r) => s + (r.total_amount || 0), 0);
        const samePointLY = lyPoint.reduce((s, r) => s + (r.total_amount || 0), 0);
        const lastYearFinal = lyFinal.reduce((s, r) => s + (r.total_amount || 0), 0);
        const pacingPct = samePointLY > 0 ? (currentOTB / samePointLY) * 100 : currentOTB > 0 ? 999 : 0;

        return {
          month: ms,
          label: format(ms, "MMM yyyy"),
          currentOTB,
          samePointLY,
          lastYearFinal,
          pacingPct,
        };
      });

      const all = await Promise.all(fetches);
      results.push(...all);

      const totalOTB = results.reduce((s, m) => s + m.currentOTB, 0);
      const totalSamePointLY = results.reduce((s, m) => s + m.samePointLY, 0);
      const totalLYFinal = results.reduce((s, m) => s + m.lastYearFinal, 0);
      const portfolioPacingPct = totalSamePointLY > 0 ? (totalOTB / totalSamePointLY) * 100 : 0;
      const monthsAhead = results.filter(m => m.pacingPct >= 100 && m.pacingPct < 900).length;

      return { totalOTB, totalSamePointLY, totalLYFinal, portfolioPacingPct, monthsAhead, months: results };
    },
    staleTime: 60_000,
  });
}
