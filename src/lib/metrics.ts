/**
 * Canonical metric definitions — the SINGLE source of truth for revenue, nights and
 * period attribution across every view (My Portfolio, My Graphs, My Statements, the
 * Reservations summary, the Dashboard and the Monthly/Owner report).
 *
 * Agreed definitions (2026-06-12):
 *   - Revenue   = GROSS (the guest price, `total_amount`), via getGrossRevenue.
 *   - Period    = STAY-OVERLAP, CLIPPED. A booking is attributed to a period by the
 *                 share of its nights that fall inside the period:
 *                     revenue_in_period = gross * (nights_in_period / total_nights)
 *                 so a May→June stay splits proportionally across the two months.
 *   - Nights    = nights of the stay that fall inside the period (clipped).
 *   - A booking "belongs" to a period if its stay overlaps it.
 *
 * Every screen MUST compute revenue/nights through THESE helpers so the numbers mirror
 * everywhere. Do not sum `total_amount` (unclipped) or `getNetRevenue` for period stats.
 */
import { getGrossRevenue, type RevenueRow } from "@/lib/revenue";

const DAY_MS = 86400000;
const toDate = (s: string) => new Date(s + "T00:00:00Z");

/** Total nights of a stay [check_in, check_out). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, Math.floor((toDate(checkOut).getTime() - toDate(checkIn).getTime()) / DAY_MS));
}

/** Nights of [check_in, check_out) that fall within [periodStart, periodEnd] (end-inclusive day). */
export function nightsInPeriod(checkIn: string, checkOut: string, periodStart: string, periodEnd: string): number {
  const startMs = Math.max(toDate(checkIn).getTime(), toDate(periodStart).getTime());
  const periodEndExclusive = toDate(periodEnd).getTime() + DAY_MS; // last day inclusive
  const endMs = Math.min(toDate(checkOut).getTime(), periodEndExclusive);
  return Math.max(0, Math.floor((endMs - startMs) / DAY_MS));
}

/** Does the stay overlap [periodStart, periodEnd]? */
export function overlapsPeriod(checkIn: string, checkOut: string, periodStart: string, periodEnd: string): boolean {
  return checkIn <= periodEnd && checkOut > periodStart;
}

/**
 * CANONICAL period revenue for one reservation: gross, apportioned by nights in the period.
 * A reservation fully inside the period returns its whole gross; a straddling one is clipped.
 */
export function periodRevenue(r: RevenueRow & { check_in: string; check_out: string }, periodStart: string, periodEnd: string): number {
  const gross = getGrossRevenue(r);
  const total = nightsBetween(r.check_in, r.check_out);
  if (total <= 0) {
    // 0-night booking (e.g. same-day): attribute fully if it falls in the period.
    return overlapsPeriod(r.check_in, r.check_out, periodStart, periodEnd) ? gross : 0;
  }
  const inP = nightsInPeriod(r.check_in, r.check_out, periodStart, periodEnd);
  return gross * (inP / total);
}
