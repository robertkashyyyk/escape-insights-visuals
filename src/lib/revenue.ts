/**
 * Net (management) revenue helpers.
 *
 * Hostaway gives us:
 *   - totalPrice (gross — what the guest paid in total)
 *   - hostPayout (net — what is actually paid to the host after channel
 *     commission, channel-collected tax, etc.)
 *
 * For dashboards and management reporting we ALWAYS want the net figure,
 * because that's the money that actually reaches Escape Ordinary / the owner.
 *
 * Resolution order (most accurate first):
 *   1. host_payout (preferred — direct from Hostaway)
 *   2. total_amount - cleaning_fee - channel_commission - tax_amount
 *   3. total_amount (last-resort fallback for very old rows)
 */

export interface RevenueRow {
  total_amount?: number | null;
  host_payout?: number | null;
  cleaning_fee?: number | null;
  channel_commission?: number | null;
  tax_amount?: number | null;
}

export function getNetRevenue(r: RevenueRow | null | undefined): number {
  if (!r) return 0;

  if (r.host_payout != null && Number(r.host_payout) > 0) {
    return Number(r.host_payout);
  }

  const total = Number(r.total_amount ?? 0);
  const cleaning = Number(r.cleaning_fee ?? 0);
  const commission = Number(r.channel_commission ?? 0);
  const tax = Number(r.tax_amount ?? 0);

  if (cleaning > 0 || commission > 0 || tax > 0) {
    return Math.max(0, total - cleaning - commission - tax);
  }

  return total;
}

/** Standard select() field list for any query that needs net revenue. */
export const REVENUE_FIELDS =
  "total_amount, host_payout, cleaning_fee, channel_commission, tax_amount";
