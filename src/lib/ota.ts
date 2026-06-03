// Shared OTA-ingestion types + client-side helpers (candidate ranking for the
// Recon Queue mirrors the authoritative server scorer in supabase/functions/ota-ingest).

export type OtaPlatform = "airbnb" | "bookingcom";
export type OtaTxnType = "reservation" | "payout" | "resolution" | "adjustment";
export type OtaCollectionModel = "channel" | "host" | null;
export type OtaMatchMethod = "code" | "composite" | "manual" | "none";
export type OtaReconStatus = "auto_matched" | "needs_recon" | "matched" | "unmatched" | "excluded";

export interface OtaTransaction {
  id: string;
  batch_id: string;
  platform: OtaPlatform;
  txn_type: OtaTxnType;
  confirmation_code: string | null;
  reference_number: string | null;
  statement_descriptor: string | null;
  bookingcom_property_id: string | null;
  property_name_raw: string | null;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  currency: string;
  gross_amount: number | null;
  commission_amount: number | null;
  commission_pct: number | null;
  payment_fee_amount: number | null;
  vat: number | null;
  tax: number | null;
  net_amount: number | null;
  collection_model: OtaCollectionModel;
  is_revenue: boolean;
  resolved_listing_id: string | null;
  matched_reservation_id: string | null;
  match_confidence: number | null;
  match_method: OtaMatchMethod;
  recon_status: OtaReconStatus;
  raw_row: Record<string, string> | null;
  created_at: string;
}

export interface OtaBatch {
  id: string;
  platform: OtaPlatform;
  source_filename: string;
  inferred_period_start: string | null;
  inferred_period_end: string | null;
  row_count: number;
  status: string;
  uploaded_at: string;
}

export interface ResvCandidate {
  id: string;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  total_amount: number | null;
  host_payout: number | null;
  status: string;
}

const surname = (name: string | null): string | null => {
  if (!name) return null;
  const p = name.trim().split(/\s+/);
  return p.length ? p[p.length - 1].toLowerCase().replace(/[^a-z]/g, "") : null;
};
const days = (a: string | null, b: string | null): number | null =>
  a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) : null;

/** Composite match score (0..1) of an OTA txn against a reservation candidate. */
export function scoreCandidate(t: OtaTransaction, r: ResvCandidate): number {
  let s = 0;
  if (t.check_in && r.check_in === t.check_in) s += 0.4;
  if (t.check_out && r.check_out === t.check_out) s += 0.25;
  const sn = surname(t.guest_name);
  if (sn && surname(r.guest_name) === sn) s += 0.25;
  const rn = days(r.check_in, r.check_out);
  if (t.nights != null && rn != null && Math.abs(t.nights - rn) <= 1) s += 0.05;
  const amt = t.net_amount ?? t.gross_amount;
  const ramt = r.host_payout ?? r.total_amount;
  if (amt != null && ramt != null && ramt !== 0 && Math.abs(amt - ramt) / Math.abs(ramt) <= 0.02) s += 0.05;
  return Math.round(s * 1000) / 1000;
}

/** Significant-token containment fuzzy score (0..1), oriented to the listing name. */
const STOP = new Set(["the", "at", "a", "an", "of", "and", "&", "-", "no", "house", "cottage"]);
const sig = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
export function fuzzyListingScore(raw: string, listingName: string): number {
  const a = new Set(sig(raw));
  const b = sig(listingName);
  if (!b.length) return 0;
  return b.filter((t) => a.has(t)).length / b.length;
}

export const fmtGBP = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export const reconBadgeClass: Record<OtaReconStatus, string> = {
  auto_matched: "bg-green-500/15 text-green-400 border-green-500/30",
  matched: "bg-green-500/15 text-green-400 border-green-500/30",
  needs_recon: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  unmatched: "bg-red-500/15 text-red-400 border-red-500/30",
  excluded: "bg-muted text-muted-foreground border-border",
};
