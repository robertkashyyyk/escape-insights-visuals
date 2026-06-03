import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, format, endOfMonth } from "date-fns";

// Client Statement engine (R1–R7). Revenue = GROSS (decided 2026-06-03):
//   Booking.com = OTA "Gross amount"; Airbnb = "Amount + Service fee".
//   In reservations, total_amount is the gross Hostaway price; matched OTA rows
//   (gross_amount/commission/payment_fee) override it when present.
// Booking fees + card processing are REAL settlement deductions under gross.
const db = supabase as any;

export type ChannelKey = "bookingcom" | "airbnb" | "direct";

export interface CostLine {
  code: string;
  display_name: string;
  actual: number;          // after adjustments
  computed: number;        // before adjustments
  pct: number | null;      // of revenue
  benchmark_pct: number | null;
  is_settlement_cost: boolean;
  source: string;
}

export interface StatementProperty {
  listingId: string;
  name: string;
  revenue: number;
  nights: number;
  daysAvailable: number;
  occupancy: number;
  adr: number;
  numBookings: number;
  avgLengthOfStay: number;
}

export interface ReconSummary {
  totalReservations: number;
  matched: number;
  inQueue: number;
  matchedAmount: number;
  totalAmount: number;
  fullyReconciled: boolean;
}

export interface ClientStatement {
  owner: {
    id: string; name: string; company: string | null;
    managementRatePct: number | null; vatInclusive: boolean;
    managementFeeMethod: string; settlementMethod: string;
    weeklyRrAmount: number | null; flatPortfolioFee: number | null;
    openingBalance: number; revenueRecognition: string;
  };
  periodLabel: string;
  periodStart: string; periodEnd: string;
  properties: StatementProperty[];
  channels: { channel: ChannelKey; amount: number; pct: number }[];
  costLines: CostLine[];
  // settlement waterfall (R5)
  revenueTotal: number;
  costTotal: number;
  netTotal: number;
  openingBalance: number;
  settlementDue: number;
  weeklyRrTotal: number;
  netSettlementBalance: number;
  recon: ReconSummary;
  daysInPeriod: number;
}

const mapChannel = (platform: string | null): ChannelKey => {
  const p = (platform ?? "").toLowerCase();
  if (p.includes("book")) return "bookingcom";
  if (p.includes("air")) return "airbnb";
  return "direct";
};
const overlapNights = (ci: string, co: string, start: Date, end: Date) => {
  const a = parseISO(ci), b = parseISO(co);
  const s = a < start ? start : a;
  const e = b > end ? end : b;
  return Math.max(0, differenceInDays(e, s));
};

export function useClientStatement(ownerId: string | null, periodStart: Date, periodEnd: Date) {
  return useQuery({
    queryKey: ["client_statement", ownerId, periodStart.toISOString(), periodEnd.toISOString()],
    enabled: !!ownerId,
    queryFn: async (): Promise<ClientStatement | null> => {
      const { data: owner } = await db.from("property_owners").select("*").eq("id", ownerId).single();
      if (!owner) return null;

      const { data: listings } = await db
        .from("listings")
        .select("id, name, status, management_rate_override, management_flat_fee")
        .eq("owner_id", ownerId);
      if (!listings?.length) return null;
      const listingIds = listings.map((l: any) => l.id);
      const activeCount = listings.filter((l: any) => l.status === "active").length || listings.length;

      const startStr = format(periodStart, "yyyy-MM-dd");
      const endStr = format(periodEnd, "yyyy-MM-dd");
      const daysInPeriod = Math.max(1, differenceInDays(periodEnd, periodStart) + 1);

      // confirmed reservations overlapping the period
      const { data: resv } = await db
        .from("reservations")
        .select("id, listing_id, check_in, check_out, status, platform, total_amount, channel_commission, host_payout")
        .in("listing_id", listingIds)
        .lte("check_in", endStr)
        .gte("check_out", startStr)
        .eq("status", "confirmed");
      const reservations = (resv ?? []) as any[];
      const resvIds = reservations.map((r) => r.id);

      // OTA settlement truth for those reservations (matched only)
      let otaByResv = new Map<string, any>();
      if (resvIds.length) {
        const { data: ota } = await db
          .from("ota_transactions")
          .select("matched_reservation_id, gross_amount, commission_amount, payment_fee_amount, collection_model, recon_status")
          .in("matched_reservation_id", resvIds)
          .in("recon_status", ["auto_matched", "matched"]);
        (ota ?? []).forEach((o: any) => { if (o.matched_reservation_id) otaByResv.set(o.matched_reservation_id, o); });
      }

      // recon summary across all OTA rows touching these listings in the period
      const { data: reconRows } = await db
        .from("ota_transactions")
        .select("recon_status, net_amount, gross_amount, is_revenue, resolved_listing_id")
        .in("resolved_listing_id", listingIds)
        .eq("is_revenue", true);
      const recRows = (reconRows ?? []) as any[];
      const matchedRows = recRows.filter((r) => ["auto_matched", "matched"].includes(r.recon_status));
      const queueRows = recRows.filter((r) => ["needs_recon", "unmatched"].includes(r.recon_status));
      const recon: ReconSummary = {
        totalReservations: recRows.length,
        matched: matchedRows.length,
        inQueue: queueRows.length,
        matchedAmount: matchedRows.reduce((s, r) => s + Number(r.gross_amount ?? r.net_amount ?? 0), 0),
        totalAmount: recRows.reduce((s, r) => s + Number(r.gross_amount ?? r.net_amount ?? 0), 0),
        fullyReconciled: queueRows.length === 0,
      };

      const recognition: string = owner.revenue_recognition ?? "prorate_by_nights";

      // R1 / R2 / R3 + per-reservation booking fees & card fees (R4 integration lines)
      const byListing: Record<string, StatementProperty & { _booking_nights: number }> = {};
      const channelAmt: Record<ChannelKey, number> = { bookingcom: 0, airbnb: 0, direct: 0 };
      let bookingFees = 0, cardProcessing = 0;

      for (const r of reservations) {
        const ota = otaByResv.get(r.id);
        const gross = Number(ota?.gross_amount ?? r.total_amount ?? 0);
        const commission = Number(ota?.commission_amount ?? r.channel_commission ?? 0);
        const cardFee = Number(ota?.payment_fee_amount ?? 0);
        const bookingNights = Math.max(1, differenceInDays(parseISO(r.check_out), parseISO(r.check_in)));
        const nip = overlapNights(r.check_in, r.check_out, periodStart, periodEnd);
        const ratio = recognition === "whole_in_attributed_month" ? 1 : nip / bookingNights;
        const recognised = gross * ratio;

        if (!byListing[r.listing_id]) {
          const l = listings.find((x: any) => x.id === r.listing_id);
          byListing[r.listing_id] = {
            listingId: r.listing_id, name: l?.name ?? "—", revenue: 0, nights: 0,
            daysAvailable: daysInPeriod, occupancy: 0, adr: 0, numBookings: 0,
            avgLengthOfStay: 0, _booking_nights: 0,
          };
        }
        const agg = byListing[r.listing_id];
        agg.revenue += recognised;
        agg.nights += nip;
        agg.numBookings += 1;
        agg._booking_nights += bookingNights;
        channelAmt[mapChannel(r.platform)] += recognised;
        bookingFees += commission * ratio;
        cardProcessing += cardFee * ratio;
      }

      const properties: StatementProperty[] = Object.values(byListing).map((p) => ({
        listingId: p.listingId, name: p.name, revenue: round2(p.revenue), nights: p.nights,
        daysAvailable: p.daysAvailable,
        occupancy: p.daysAvailable > 0 ? p.nights / p.daysAvailable : 0,
        adr: p.nights > 0 ? round2(p.revenue / p.nights) : 0,
        numBookings: p.numBookings,
        avgLengthOfStay: p.numBookings > 0 ? round2(p._booking_nights / p.numBookings) : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      const revenueFromResv = Object.values(byListing).reduce((s, p) => s + p.revenue, 0);

      // R4 management fee (override-first, gross base, VAT on the fee)
      const vatFactor = owner.vat_inclusive ? 1.2 : 1.0;
      let management = 0;
      if (owner.management_fee_method === "flat_per_property") {
        management = listings.reduce((s: number, l: any) => s + Number(l.management_flat_fee ?? 0), 0);
      } else if (owner.management_fee_method === "flat_per_portfolio") {
        management = 0; // applied once at portfolio level below
      } else {
        for (const p of Object.values(byListing)) {
          const l = listings.find((x: any) => x.id === p.listingId);
          const ratePct = Number(l?.management_rate_override ?? owner.management_rate_pct ?? 0);
          management += p.revenue * (ratePct / 100) * vatFactor;
        }
      }

      // platform-engine + manual costs
      const cleaning = await cleaningCost(listingIds, startStr, endStr);
      const maintenance = await maintenanceCost(listingIds, startStr, endStr);

      // manual cost lines + adjustments from an existing report_period (if any)
      const { data: period } = await db.from("report_periods").select("id, opening_balance")
        .eq("owner_id", ownerId).eq("period_start", startStr).maybeSingle();
      let manualCosts: Record<string, number> = {};
      let adjustments: any[] = [];
      if (period?.id) {
        const { data: pcs } = await db.from("property_costs")
          .select("actual_amount, cost_line_types(code)").eq("report_period_id", period.id);
        (pcs ?? []).forEach((c: any) => {
          const code = c.cost_line_types?.code; if (code) manualCosts[code] = (manualCosts[code] ?? 0) + Number(c.actual_amount ?? 0);
        });
        const { data: adj } = await db.from("line_adjustments").select("*").eq("report_period_id", period.id);
        adjustments = adj ?? [];
      }

      const { data: clt } = await db.from("cost_line_types").select("*").order("sort_order");
      const costLineTypes = (clt ?? []) as any[];

      const computedByCode: Record<string, number> = {
        booking_fees: round2(bookingFees),
        card_processing: round2(cardProcessing),
        cleaning: round2(cleaning),
        maintenance: round2(maintenance),
        management: round2(management),
        consumables: 0, laundry: 0, welcome_baskets: 0, refunds: 0,
        utilities: round2(manualCosts["utilities"] ?? 0),
        setup: round2(manualCosts["setup"] ?? 0),
      };

      // line_adjustments stores cost_line_type_id; resolve code via costLineTypes
      const codeById = new Map(costLineTypes.map((t) => [t.id, t.code]));
      const adjByCode: Record<string, number> = {};
      for (const a of adjustments) {
        if (a.target === "cost_line" && a.cost_line_type_id) {
          const c = codeById.get(a.cost_line_type_id);
          if (c) adjByCode[c] = (adjByCode[c] ?? 0) + Number(a.amount);
        }
      }
      const revenueAdj = adjustments.filter((a) => a.target === "revenue").reduce((s, a) => s + Number(a.amount), 0);
      const settlementAdj = adjustments.filter((a) => a.target === "settlement").reduce((s, a) => s + Number(a.amount), 0);

      const revenueTotal = round2(revenueFromResv + revenueAdj);

      const costLines: CostLine[] = costLineTypes.map((t) => {
        const computed = computedByCode[t.code] ?? 0;
        const adj = adjByCode[t.code] ?? 0;
        const actual = round2(computed + adj);
        return {
          code: t.code, display_name: t.display_name,
          computed, actual,
          pct: revenueTotal > 0 ? round4(actual / revenueTotal) : null,
          benchmark_pct: t.default_target_pct != null ? Number(t.default_target_pct) : null,
          is_settlement_cost: t.is_settlement_cost,
          source: t.source_category,
        };
      });

      let costTotal = costLines.filter((c) => c.is_settlement_cost).reduce((s, c) => s + c.actual, 0);
      if (owner.management_fee_method === "flat_per_portfolio") costTotal += Number(owner.flat_portfolio_fee ?? 0);
      costTotal = round2(costTotal);

      const netTotal = round2(revenueTotal - costTotal);
      const openingBalance = Number(period?.opening_balance ?? owner.opening_balance ?? 0);
      const settlementDue = round2(netTotal + openingBalance + settlementAdj);
      const weeksDrawn = Math.round(daysInPeriod / 7);
      const weeklyRrTotal = owner.settlement_method === "weekly_draw"
        ? round2(Number(owner.weekly_rr_amount ?? 0) * weeksDrawn) : 0;
      const netSettlementBalance = round2(settlementDue - weeklyRrTotal);

      const channels = (["bookingcom", "airbnb", "direct"] as ChannelKey[]).map((c) => ({
        channel: c, amount: round2(channelAmt[c]),
        pct: revenueFromResv > 0 ? round4(channelAmt[c] / revenueFromResv) : 0,
      }));

      const isSingleMonth = periodStart.getDate() === 1 && periodEnd.getTime() === endOfMonth(periodStart).getTime();

      return {
        owner: {
          id: owner.id, name: owner.name, company: owner.company,
          managementRatePct: owner.management_rate_pct, vatInclusive: !!owner.vat_inclusive,
          managementFeeMethod: owner.management_fee_method, settlementMethod: owner.settlement_method,
          weeklyRrAmount: owner.weekly_rr_amount, flatPortfolioFee: owner.flat_portfolio_fee,
          openingBalance, revenueRecognition: recognition,
        },
        periodLabel: isSingleMonth ? format(periodStart, "MMMM yyyy")
          : `${format(periodStart, "d MMM yyyy")} – ${format(periodEnd, "d MMM yyyy")}`,
        periodStart: startStr, periodEnd: endStr,
        properties, channels, costLines,
        revenueTotal, costTotal, netTotal, openingBalance,
        settlementDue, weeklyRrTotal, netSettlementBalance,
        recon, daysInPeriod,
      };
    },
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

async function cleaningCost(listingIds: string[], startStr: string, endStr: string): Promise<number> {
  try {
    const { data } = await db
      .from("clean_tasks")
      .select("assigned_cleaner_id, cleaners(rate_per_clean)")
      .in("listing_id", listingIds)
      .eq("status", "completed")
      .gte("completed_at", `${startStr}T00:00:00`)
      .lte("completed_at", `${endStr}T23:59:59`);
    return (data ?? []).reduce((s: number, t: any) => s + Number(t.cleaners?.rate_per_clean ?? 0), 0);
  } catch { return 0; }
}

async function maintenanceCost(listingIds: string[], startStr: string, endStr: string): Promise<number> {
  try {
    const { data } = await db
      .from("property_maintenance_log")
      .select("cost, date")
      .in("listing_id", listingIds)
      .gte("date", startStr)
      .lte("date", endStr);
    return (data ?? []).reduce((s: number, m: any) => s + Number(m.cost ?? 0), 0);
  } catch { return 0; }
}
