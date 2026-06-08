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
      let recon = { total: 0, matched: 0, inQueue: 0, matchedAmount: 0, totalAmount: 0, fullyReconciled: true };

      if (listingIds.length) {
        // reservations overlapping the period (match useMonthlyReport's window)
        const { data: resv } = await db.from("reservations")
          .select("id, channel_commission, check_in, check_out")
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
          bookingFees += Number(o?.commission_amount ?? r.channel_commission ?? 0) * ratio;
          cardProcessing += Number(o?.payment_fee_amount ?? 0) * ratio;
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

      const weeksDrawn = Math.round(daysInPeriod / 7);
      const weeklyRrAmount = Number(owner.weekly_rr_amount ?? 0);
      const weeklyRrTotal = owner.settlement_method === "weekly_draw" ? weeklyRrAmount * weeksDrawn : 0;

      return {
        bookingFees: round2(bookingFees), cardProcessing: round2(cardProcessing),
        openingBalance: Number(owner.opening_balance ?? 0),
        weeklyRrAmount, weeklyRrTotal: round2(weeklyRrTotal),
        settlementMethod: owner.settlement_method, managementFeeMethod: owner.management_fee_method,
        flatPortfolioFee: Number(owner.flat_portfolio_fee ?? 0), weeksDrawn, recon,
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
