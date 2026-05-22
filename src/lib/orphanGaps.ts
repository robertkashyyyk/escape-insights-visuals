/**
 * Orphan Gap detection.
 *
 * An "Orphan Gap" is a stretch of empty nights between a checkout and the next
 * check-in whose length is *shorter* than the property's minimum-stay rule —
 * i.e. commercially stranded inventory that cannot be booked.
 *
 * Returns the set of orphan-gap night dates (YYYY-MM-DD) for a given list of
 * reservations on a single listing.
 *
 * A "night" of date D means the night that *starts* on date D (i.e. the night
 * D→D+1). Convention matches the cleaning matrix where each cell represents a
 * single day/night column.
 */
import { addDays, differenceInDays, format, parseISO } from "date-fns";

export interface ReservationLite {
  check_in: string;  // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD (exclusive — guest leaves this morning)
  status?: string | null;
}

export function computeOrphanGapDates(
  reservations: ReservationLite[],
  minStayNights: number,
): Set<string> {
  const out = new Set<string>();
  if (!reservations.length || minStayNights <= 1) return out;

  // Only confirmed bookings define real gaps. Cancelled etc. shouldn't fill a gap.
  const confirmed = reservations
    .filter((r) => !r.status || r.status === "confirmed")
    .map((r) => ({ ci: parseISO(r.check_in), co: parseISO(r.check_out) }))
    .sort((a, b) => a.ci.getTime() - b.ci.getTime());

  for (let i = 0; i < confirmed.length - 1; i++) {
    const prevOut = confirmed[i].co;
    const nextIn = confirmed[i + 1].ci;
    const gapNights = differenceInDays(nextIn, prevOut);
    if (gapNights <= 0) continue;          // back-to-back / overlap
    if (gapNights >= minStayNights) continue; // big enough to sell — not orphan

    // Mark each empty night in the gap as orphan.
    for (let n = 0; n < gapNights; n++) {
      out.add(format(addDays(prevOut, n), "yyyy-MM-dd"));
    }
  }

  return out;
}

/** Tooltip helper. */
export function orphanGapTooltip(minStayNights: number): string {
  return `Orphan Gap — unavailable due to ${minStayNights}-night minimum stay`;
}
