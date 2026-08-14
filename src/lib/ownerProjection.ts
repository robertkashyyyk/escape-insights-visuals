/**
 * Owner revenue projection engine.
 *
 * Projected revenue = booked revenue + (nights we can still realistically sell)
 *                     × blended ADR, per property, per month.
 *
 * Per property, per month M:
 *  - Month ceiling / target occupancy = last-year-same-month occupancy × this
 *    year's average YoY lift. The lift is measured over COMPLETED months this
 *    year EXCLUDING the two summer peak months (Jul/Aug) — they were already
 *    near-full so they'd understate the real growth of room-to-grow months.
 *    The target is month-specific (Nov anchors to Nov, Jul to Jul) and learns
 *    from actuals each period, so it drifts up as the business grows.
 *  - Sellable nights = target nights − booked; for the CURRENT month only nights
 *    from today onward count (elapsed empty nights can't be filled).
 *  - Pickup valued at the blend of this-year and last-year ADR for that month.
 *  - Floored at what's booked; can't exceed the month's realistic ceiling.
 *
 * Stay (check-in) basis only. Booking-date mode returns the booked figure.
 */

const SUMMER = new Set([6, 7]); // 0-indexed: Jul, Aug
const HARD_CEILING = 0.98;      // physical backstop so nothing implies >100%

const pad = (n: number) => String(n).padStart(2, "0");
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function monthWindow(y: number, m: number) {
  const ws = `${y}-${pad(m + 1)}-01`;
  const weExcl = m === 11 ? `${y + 1}-01-01` : `${y}-${pad(m + 2)}-01`;
  return { ws, weExcl };
}

const clipNights = (ci: string, co: string, ws: string, weExcl: string) => {
  const s = ci > ws ? ci : ws;
  const e = co < weExcl ? co : weExcl;
  return Math.max(0, daysBetween(s, e));
};

export interface ProjResv {
  _listing_id: string;
  check_in: string;
  check_out: string;
  total_amount: number | null;
  _revenue_factor?: number;
}

interface MonthStats { nights: number; revenue: number; }

function propMonthStats(rp: ProjResv[], y: number, m: number): MonthStats {
  const { ws, weExcl } = monthWindow(y, m);
  let nights = 0, revenue = 0;
  for (const r of rp) {
    if (r.check_in >= weExcl || r.check_out <= ws) continue;
    const n = clipNights(r.check_in, r.check_out, ws, weExcl);
    if (n <= 0) continue;
    const totalN = Math.max(1, daysBetween(r.check_in, r.check_out));
    nights += n;
    revenue += (Number(r.total_amount) || 0) * (r._revenue_factor ?? 1) * (n / totalN);
  }
  return { nights, revenue };
}

/** Nights booked from `fromStr` (inclusive) to month end, for the current-month split. */
function bookedNightsFrom(rp: ProjResv[], y: number, m: number, fromStr: string): number {
  const { weExcl } = monthWindow(y, m);
  const start = fromStr > monthWindow(y, m).ws ? fromStr : monthWindow(y, m).ws;
  let nights = 0;
  for (const r of rp) {
    if (r.check_in >= weExcl || r.check_out <= start) continue;
    nights += clipNights(r.check_in, r.check_out, start, weExcl);
  }
  return nights;
}

export interface ProjectParams {
  reservations: ProjResv[];
  listingIds: string[];
  periodType: "Week" | "Month" | "Quarter" | "Year" | string;
  periodStart: Date;
  now: Date;
  useCreatedDate: boolean;
  bookedRevenue: number; // full-period booked revenue (fallback)
}

export function projectRevenue(params: ProjectParams): number {
  const { reservations, listingIds, periodType, periodStart, now, useCreatedDate, bookedRevenue } = params;
  // Projection is a stay-basis concept; booking-date mode & week are too granular.
  if (useCreatedDate || periodType === "Week") return bookedRevenue;

  const curYear = now.getFullYear();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const byProp = new Map<string, ProjResv[]>();
  listingIds.forEach((id) => byProp.set(id, []));
  reservations.forEach((r) => { if (byProp.has(r._listing_id)) byProp.get(r._listing_id)!.push(r); });

  // ── Per-property YoY lift over completed, non-summer months this year ──
  const liftOf = new Map<string, number>();
  let portTn = 0, portLn = 0;
  for (const id of listingIds) {
    const rp = byProp.get(id) || [];
    let tn = 0, ln = 0;
    for (let m = 0; m < 12; m++) {
      const { weExcl } = monthWindow(curYear, m);
      if (weExcl > todayStr) continue;   // month not fully complete
      if (SUMMER.has(m)) continue;        // exclude summer peaks
      tn += propMonthStats(rp, curYear, m).nights;
      ln += propMonthStats(rp, curYear - 1, m).nights;
    }
    portTn += tn; portLn += ln;
    liftOf.set(id, ln >= 10 ? clamp(tn / ln, 0.5, 2.5) : NaN);
  }
  const portfolioLift = portLn >= 10 ? clamp(portTn / portLn, 0.5, 2.5) : 1;
  listingIds.forEach((id) => { if (Number.isNaN(liftOf.get(id))) liftOf.set(id, portfolioLift); });

  // ── Per-property proven ceiling: the best monthly occupancy actually achieved
  // over the last 18 completed months. Caps the lifted target so a peak month
  // (already near its real max) can't be projected to an impossible occupancy,
  // while low-season months stay well under it. Learns/edges up over time. ──
  const bestOf = new Map<string, number>();
  let portBest = 0;
  for (const id of listingIds) {
    const rp = byProp.get(id) || [];
    let best = 0;
    for (let k = 1; k <= 18; k++) {
      const d = new Date(curYear, now.getMonth() - k, 1);
      const occ = propMonthStats(rp, d.getFullYear(), d.getMonth()).nights / daysInMonth(d.getFullYear(), d.getMonth());
      if (occ > best) best = occ;
    }
    bestOf.set(id, best);
    if (best > portBest) portBest = best;
  }
  const fallbackBest = portBest > 0 ? portBest : 0.85;
  listingIds.forEach((id) => { if (!(bestOf.get(id)! > 0)) bestOf.set(id, fallbackBest); });

  // Months making up the selected period.
  const months: Array<{ y: number; m: number }> = [];
  if (periodType === "Month") {
    months.push({ y: periodStart.getFullYear(), m: periodStart.getMonth() });
  } else if (periodType === "Quarter") {
    const qStart = Math.floor(periodStart.getMonth() / 3) * 3;
    for (let i = 0; i < 3; i++) months.push({ y: periodStart.getFullYear(), m: qStart + i });
  } else { // Year
    for (let m = 0; m < 12; m++) months.push({ y: periodStart.getFullYear(), m });
  }

  let projected = 0;
  for (const { y, m } of months) projected += projectMonth(y, m);
  return Math.round(projected);

  function projectMonth(y: number, m: number): number {
    const { ws, weExcl } = monthWindow(y, m);
    const capacity = daysInMonth(y, m);
    const isPast = weExcl <= todayStr;
    const isCurrent = ws <= todayStr && weExcl > todayStr;

    let monthTotal = 0;
    for (const id of listingIds) {
      const rp = byProp.get(id) || [];
      const cur = propMonthStats(rp, y, m);          // this-year, target month
      if (isPast) { monthTotal += cur.revenue; continue; }

      const last = propMonthStats(rp, y - 1, m);
      const lastCap = daysInMonth(y - 1, m);
      const lastOcc = lastCap > 0 ? last.nights / lastCap : 0;
      const lift = liftOf.get(id) ?? portfolioLift;
      // Month-specific target, capped at this property's proven realistic ceiling.
      const targetOcc = Math.min(HARD_CEILING, bestOf.get(id) ?? fallbackBest, lastOcc * lift);

      let projectedNights: number;
      if (isCurrent) {
        // Only nights from today onward are still sellable; elapsed empties are lost.
        const remainingDays = Math.max(0, daysBetween(todayStr, weExcl));
        const bookedRemaining = bookedNightsFrom(rp, y, m, todayStr);
        const bookedElapsed = cur.nights - bookedRemaining;
        const targetRemaining = Math.min(remainingDays, Math.max(bookedRemaining, Math.round(targetOcc * remainingDays)));
        projectedNights = bookedElapsed + targetRemaining;
      } else {
        // Future month: a full month of lead to reach its target.
        projectedNights = Math.min(capacity, Math.max(cur.nights, Math.round(targetOcc * capacity)));
      }

      const thisADR = cur.nights > 0 ? cur.revenue / cur.nights : 0;
      const lastADR = last.nights > 0 ? last.revenue / last.nights : 0;
      const blendedADR = thisADR && lastADR ? (thisADR + lastADR) / 2 : (thisADR || lastADR);

      const pickupNights = Math.max(0, projectedNights - cur.nights);
      monthTotal += cur.revenue + pickupNights * blendedADR;
    }
    return monthTotal;
  }
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
