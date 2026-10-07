// Single source of truth for mapping a raw Hostaway reservation status to our
// internal status. Used by hostaway-sync (write path) and the reconcile tooling.
//
// IMPORTANT: unknown statuses map to "unknown" — NEVER silently to "confirmed".
// The caller must log unknowns and treat them as not-live (no clean, no revenue).

export type MappedStatus = "confirmed" | "ownerStay" | "cancelled" | "inquiry" | "unknown";

// Keys are lower-cased Hostaway status values; look-up lower-cases the input too.
const HOSTAWAY_STATUS_MAP: Record<string, MappedStatus> = {
  // Live, revenue-bearing
  new: "confirmed",
  modified: "confirmed",
  confirmed: "confirmed",
  // Live for cleaning, but NOT revenue (kept as its own status)
  ownerstay: "ownerStay",
  // Not live — dead bookings
  cancelled: "cancelled",
  canceled: "cancelled",
  declined: "cancelled",
  expired: "cancelled",
  inquirydenied: "cancelled",
  inquirytimedout: "cancelled",
  inquirynotpossible: "cancelled",
  // Not live — not yet a booking (no clean, no revenue)
  inquiry: "inquiry",
  inquirypreapproved: "inquiry",
  pending: "inquiry",
  awaitingpayment: "inquiry",
};

export function mapHostawayStatus(raw: string | null | undefined): { status: MappedStatus; known: boolean } {
  const key = (raw ?? "").trim().toLowerCase();
  const mapped = key ? HOSTAWAY_STATUS_MAP[key] : undefined;
  return mapped ? { status: mapped, known: true } : { status: "unknown", known: false };
}

// "Live" = gets a cleaning job. ownerStay is live (owner still needs the property
// cleaned) but is excluded from revenue. "unknown"/"inquiry"/"cancelled" are not live.
export function isLive(s: MappedStatus): boolean {
  return s === "confirmed" || s === "ownerStay";
}

// Only genuine guest bookings count as revenue in owner reports.
export function countsAsRevenue(s: MappedStatus): boolean {
  return s === "confirmed";
}
