import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format, parseISO } from "date-fns";

// Layers the gross-model settlement onto the owner report:
//  - Booking Fees + Card Processing as REAL cost lines (OTA settlement truth,
//    falling back to reservations.channel_commission).
//  - OTA reconciliation summary for the banner.
//  - Billing profile (opening balance, weekly RR, settlement method).
//  - Finalise: snapshot to report_periods + carry-forward opening balance (R7).
const db = supabase as any;

export interface OwnerSettlement {
  bookingFees: number;
  cardProcessing: number;
  openingBalance: number;
  weeklyRrAmount: number;
  weeklyRrTotal: number;
  settlementMethod: string;
  managementFeeMethod: string;
  flatPortfolioFee: number;
  weeksDrawn: number;
  recon: {
    total: number; matched: number; inQueue: number;
    matchedAmount: number; totalAmount: number; fullyReconciled: boolean;
  };
  manualByCode: Record<string, number>;   // manual cost / cost-line adjustments per code
  distributionByChannel: Record<string, number>;  // booking fee + card per channel
  revenueAdj: number;
  settlementAdj: number;
  reportPeriodId: string | null;
}

export function useOwnerSettlement(ownerId: string | null, periodStart: Date, periodEnd: Date) {
  return useQuery({
    queryKey: ["owner_settlement", ownerId, periodStart.toISOString(), periodEnd.toISOString()],
    enabled: !!ownerId,
    queryFn: async (): Promise<OwnerSettlement | null> => {
      const { data: owner } = await db.from("property_owners")
        .select("opening_balance, weekly_rr_amount, settlement_method, management_fee_method, flat_portfolio_fee, revenue_recognition")
        .eq("id", ownerId).single();
      if (!owner) return null;
      const prorate = (owner.revenue_recognition ?? "prorate_by_nights") !== "whole_in_attributed_month";

      const { data: listings } = await db.from("listings").select("id").eq("owner_id", ownerId);
      const listingIds = (listings ?? []).map((l: any) => l.id);
      const startStr = format(periodStart, "yyyy-MM-dd");
      const endStr = format(periodEnd, "yyyy-MM-dd");
      const daysInPeriod = Math.max(1, differenceInDays(periodEnd, periodStart) + 1);

      let bookingFees = 0, cardProcessing = 0;
      const distributionByChannel: Record<string, number> = {};
      const mapChannel = (p: string | null): string => {
        const s = (p ?? "").toLowerCase();
        if (s.includes("book") && s.includes("engine")) return "direct";
        if (s.includes("book")) return "bookingcom";
        if (s.includes("air")) return "airbnb";
        if (s.includes("homeaway") || s.includes("vrbo")) return "vrbo";
        return "direct";
      };
      let recon = { total: 0, matched: 0, inQueue: 0, matchedAmount: 0, totalAmount: 0, fullyReconciled: true };

      if (listingIds.length) {
        // reservations overlapping the period (match useMonthlyReport's window)
        const { data: resv } = await db.from("reservations")
          .select("id, channel_commission, check_in, check_out, platform")
          .in("listing_id", listingIds)
          .lte("check_in", endStr).gte("check_out", startStr).eq("status", "confirmed");
        const reservations = (resv ?? []) as any[];
        const resvIds = reservations.map((r) => r.id);

        // OTA settlement truth for those reservations
        const otaByResv = new Map<string, any>();
        if (resvIds.length) {
          const { data: ota } = await db.from("ota_transactions")
            .select("matched_reservation_id, commission_amount, payment_fee_amount")
            .in("matched_reservation_id", resvIds).in("recon_status", ["auto_matched", "matched"]);
          (ota ?? []).forEach((o: any) => { if (o.matched_reservation_id) otaByResv.set(o.matched_reservation_id, o); });
        }
        // Pro-rate fees by the same in-period night ratio as revenue (R1).
        const ratioFor = (r: any) => {
          if (!prorate) return 1;
          const bn = Math.max(1, differenceInDays(parseISO(r.check_out), parseISO(r.check_in)));
          const ci = parseISO(r.check_in), co = parseISO(r.check_out);
          const s = ci < periodStart ? periodStart : ci;
          const e = co > periodEnd ? periodEnd : co;
          return Math.max(0, differenceInDays(e, s)) / bn;
        };
        for (const r of reservations) {
          const o = otaByResv.get(r.id);
          const ratio = ratioFor(r);
          const comm = Number(o?.commission_amount ?? r.channel_commission ?? 0) * ratio;
          const card = Number(o?.payment_fee_amount ?? 0) * ratio;
          bookingFees += comm;
          cardProcessing += card;
          const ch = mapChannel(r.platform);
          distributionByChannel[ch] = (distributionByChannel[ch] ?? 0) + comm + card;
        }

        // Security-deposit card fees (non-revenue): the card processing fee is
        // charged when the deposit is taken and is NOT refunded with the deposit,
        // so it's a real cost. Attribute it to the property the deposit resolved
        // to, recognising it in the month of the stay (check_in within period).
        const { data: depRows } = await db.from("ota_transactions")
          .select("payment_fee_amount")
          .eq("platform", "stripe").eq("txn_type", "adjustment")
          .ilike("statement_descriptor", "%security deposit%")
          .gt("payment_fee_amount", 0)
          .in("resolved_listing_id", listingIds)
          .gte("check_in", startStr).lte("check_in", endStr);
        const depositCardFees = (depRows ?? []).reduce((s: number, d: any) => s + Number(d.payment_fee_amount ?? 0), 0);
        if (depositCardFees > 0) {
          cardProcessing += depositCardFees;
          distributionByChannel["deposit_fees"] = (distributionByChannel["deposit_fees"] ?? 0) + depositCardFees;
        }

        // reconciliation summary across the owner's revenue OTA rows
        const { data: rec } = await db.from("ota_transactions")
          .select("recon_status, gross_amount, net_amount")
          .in("resolved_listing_id", listingIds).eq("is_revenue", true);
        const rows = (rec ?? []) as any[];
        const matched = rows.filter((r) => ["auto_matched", "matched"].includes(r.recon_status));
        const queue = rows.filter((r) => ["needs_recon", "unmatched"].includes(r.recon_status));
        recon = {
          total: rows.length, matched: matched.length, inQueue: queue.length,
          matchedAmount: matched.reduce((s, r) => s + Number(r.gross_amount ?? r.net_amount ?? 0), 0),
          totalAmount: rows.reduce((s, r) => s + Number(r.gross_amount ?? r.net_amount ?? 0), 0),
          fullyReconciled: queue.length === 0,
        };
      }

      // Manual cost lines (property_costs) + logged adjustments (line_adjustments).
      // Both hang off a report_period; null if none exists yet for this owner/month.
      const manualByCode: Record<string, number> = {};
      let revenueAdj = 0, settlementAdj = 0, reportPeriodId: string | null = null;
      const { data: period } = await db.from("report_periods").select("id")
        .eq("owner_id", ownerId).eq("period_start", startStr).maybeSingle();
      reportPeriodId = period?.id ?? null;
      if (reportPeriodId) {
        const { data: pcs } = await db.from("property_costs")
          .select("actual_amount, cost_line_types(code)").eq("report_period_id", reportPeriodId);
        (pcs ?? []).forEach((c: any) => {
          const code = c.cost_line_types?.code;
          if (code) manualByCode[code] = (manualByCode[code] ?? 0) + Number(c.actual_amount ?? 0);
        });
        const { data: adj } = await db.from("line_adjustments")
          .select("target, amount, cost_line_types(code)").eq("report_period_id", reportPeriodId);
        (adj ?? []).forEach((a: any) => {
          if (a.target === "revenue") revenueAdj += Number(a.amount);
          else if (a.target === "settlement") settlementAdj += Number(a.amount);
          else if (a.target === "cost_line" && a.cost_line_types?.code)
            manualByCode[a.cost_line_types.code] = (manualByCode[a.cost_line_types.code] ?? 0) + Number(a.amount);
        });
      }

      const weeksDrawn = Math.round(daysInPeriod / 7);
      const weeklyRrAmount = Number(owner.weekly_rr_amount ?? 0);
      const weeklyRrTotal = owner.settlement_method === "weekly_draw" ? weeklyRrAmount * weeksDrawn : 0;

      return {
        bookingFees: round2(bookingFees), cardProcessing: round2(cardProcessing),
        openingBalance: Number(owner.opening_balance ?? 0),
        weeklyRrAmount, weeklyRrTotal: round2(weeklyRrTotal),
        settlementMethod: owner.settlement_method, managementFeeMethod: owner.management_fee_method,
        flatPortfolioFee: Number(owner.flat_portfolio_fee ?? 0), weeksDrawn, recon,
        manualByCode, revenueAdj: round2(revenueAdj), settlementAdj: round2(settlementAdj), reportPeriodId,
        distributionByChannel: Object.fromEntries(Object.entries(distributionByChannel).map(([k, v]) => [k, round2(v)])),
      };
    },
  });
}

export function useFinalizePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: {
      ownerId: string; periodStart: string; periodEnd: string;
      openingBalance: number; weeklyRrTotal: number; revenueTotal: number;
      costTotal: number; netTotal: number; settlementDue: number; netSettlementBalance: number;
    }) => {
      const now = new Date().toISOString();
      await db.from("report_periods").upsert({
        owner_id: s.ownerId, period_start: s.periodStart, period_end: s.periodEnd, status: "finalised",
        opening_balance: s.openingBalance, weekly_rr_total: s.weeklyRrTotal, revenue_total: s.revenueTotal,
        cost_total: s.costTotal, net_total: s.netTotal, settlement_due: s.settlementDue,
        net_settlement_balance: s.netSettlementBalance, generated_at: now, finalised_at: now,
      }, { onConflict: "owner_id,period_start" });
      // R7 carry-forward: next period opens at this period's closing balance
      await db.from("property_owners").update({ opening_balance: s.netSettlementBalance }).eq("id", s.ownerId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner_settlement"] });
      qc.invalidateQueries({ queryKey: ["monthly_report"] });
    },
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Manual cost lines + logged adjustments ──────────────────────────────────
export interface ManualCostRow { id: string; cost_code: string; display_name: string; listing_id: string | null; listing_name: string | null; amount: number }
export interface AdjustmentRow { id: string; target: string; cost_code: string | null; amount: number; reason: string }

async function ensureDraftPeriod(ownerId: string, periodStart: string, periodEnd: string): Promise<string> {
  const { data: existing } = await db.from("report_periods").select("id")
    .eq("owner_id", ownerId).eq("period_start", periodStart).maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await db.from("report_periods")
    .insert({ owner_id: ownerId, period_start: periodStart, period_end: periodEnd, status: "draft" })
    .select("id").single();
  if (error) throw error;
  return created.id;
}

export function useManualEntries(ownerId: string | null, periodStart: string, periodEnd: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["owner_settlement"] });
    qc.invalidateQueries({ queryKey: ["manual_entries"] });
  };

  const entries = useQuery({
    queryKey: ["manual_entries", ownerId, periodStart],
    enabled: !!ownerId,
    queryFn: async (): Promise<{ costs: ManualCostRow[]; adjustments: AdjustmentRow[] }> => {
      const { data: period } = await db.from("report_periods").select("id")
        .eq("owner_id", ownerId).eq("period_start", periodStart).maybeSingle();
      if (!period?.id) return { costs: [], adjustments: [] };
      const { data: pcs } = await db.from("property_costs")
        .select("id, actual_amount, listing_id, cost_line_types(code, display_name), listings(name)")
        .eq("report_period_id", period.id);
      const { data: adj } = await db.from("line_adjustments")
        .select("id, target, amount, reason, cost_line_types(code)").eq("report_period_id", period.id);
      return {
        costs: (pcs ?? []).map((c: any) => ({
          id: c.id, cost_code: c.cost_line_types?.code, display_name: c.cost_line_types?.display_name,
          listing_id: c.listing_id, listing_name: c.listings?.name ?? null, amount: Number(c.actual_amount),
        })),
        adjustments: (adj ?? []).map((a: any) => ({
          id: a.id, target: a.target, cost_code: a.cost_line_types?.code ?? null,
          amount: Number(a.amount), reason: a.reason,
        })),
      };
    },
  });

  const addCost = useMutation({
    mutationFn: async (v: { listingId: string; costCode: string; amount: number }) => {
      if (!ownerId) return;
      const periodId = await ensureDraftPeriod(ownerId, periodStart, periodEnd);
      const { data: clt } = await db.from("cost_line_types").select("id").eq("code", v.costCode).single();
      await db.from("property_costs").upsert({
        report_period_id: periodId, listing_id: v.listingId, cost_line_type_id: clt.id,
        actual_amount: v.amount, source: "manual",
      }, { onConflict: "report_period_id,listing_id,cost_line_type_id" });
    },
    onSuccess: invalidate,
  });

  const addAdjustment = useMutation({
    mutationFn: async (v: { target: "revenue" | "cost_line" | "settlement"; costCode?: string; amount: number; reason: string }) => {
      if (!ownerId) return;
      const periodId = await ensureDraftPeriod(ownerId, periodStart, periodEnd);
      let costLineTypeId: string | null = null;
      if (v.target === "cost_line" && v.costCode) {
        const { data: clt } = await db.from("cost_line_types").select("id").eq("code", v.costCode).single();
        costLineTypeId = clt?.id ?? null;
      }
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      await db.from("line_adjustments").insert({
        report_period_id: periodId, target: v.target, cost_line_type_id: costLineTypeId,
        amount: v.amount, reason: v.reason, adjusted_by: uid,
      });
    },
    onSuccess: invalidate,
  });

  const removeCost = useMutation({
    mutationFn: async (id: string) => { await db.from("property_costs").delete().eq("id", id); },
    onSuccess: invalidate,
  });
  const removeAdjustment = useMutation({
    mutationFn: async (id: string) => { await db.from("line_adjustments").delete().eq("id", id); },
    onSuccess: invalidate,
  });

  return { entries, addCost, addAdjustment, removeCost, removeAdjustment };
}
