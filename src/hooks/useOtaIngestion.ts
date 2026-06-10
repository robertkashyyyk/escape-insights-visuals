import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OtaBatch, OtaTransaction, ResvCandidate, OtaPlatform } from "@/lib/ota";

// New tables aren't in the generated Database types yet — cast like the rest of
// the codebase does (e.g. useMaintenanceQueue casts clean_issues writes).
const db = supabase as any;

async function getUid() {
  return (await supabase.auth.getUser()).data.user?.id ?? null;
}

export interface ListingLite { id: string; name: string }

export function useListings() {
  return useQuery({
    queryKey: ["listings_lite"],
    queryFn: async (): Promise<ListingLite[]> => {
      const { data } = await db.from("listings").select("id, name").order("name");
      return data ?? [];
    },
  });
}

export function useOtaBatches() {
  return useQuery({
    queryKey: ["ota_batches"],
    queryFn: async (): Promise<OtaBatch[]> => {
      const { data, error } = await db
        .from("ota_import_batches")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Transactions, optionally filtered by batch and/or a set of recon statuses. */
export function useOtaTransactions(opts: { batchId?: string; statuses?: string[]; revenueOnly?: boolean; nonRevenueOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ["ota_transactions", opts],
    queryFn: async (): Promise<OtaTransaction[]> => {
      let q = db.from("ota_transactions").select("*").order("check_in", { ascending: true });
      if (opts.batchId) q = q.eq("batch_id", opts.batchId);
      if (opts.statuses?.length) q = q.in("recon_status", opts.statuses);
      if (opts.revenueOnly) q = q.eq("is_revenue", true);
      if (opts.nonRevenueOnly) q = q.eq("is_revenue", false);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function fetchReservationCandidates(listingId: string): Promise<ResvCandidate[]> {
  const { data } = await db
    .from("reservations")
    .select("id, guest_name, check_in, check_out, total_amount, host_payout, status")
    .eq("listing_id", listingId)
    .eq("status", "confirmed")
    .order("check_in", { ascending: true });
  return data ?? [];
}

export interface AttributionDecisionRow {
  id: string;
  ota_transaction_id: string;
  outcome: "management_report" | "company_retention";
  allocated_listing_id: string | null;
  allocated_listing_name: string | null;
  reason: string | null;
  txn: any;
}

/** Already-decided attribution items (so they can be reviewed / re-opened). */
export function useAttributionDecisions() {
  return useQuery({
    queryKey: ["attribution_decisions"],
    queryFn: async (): Promise<AttributionDecisionRow[]> => {
      const { data } = await db.from("ota_attribution_decisions")
        .select("id, ota_transaction_id, outcome, allocated_listing_id, reason, listings(name), ota_transactions(platform, txn_type, statement_descriptor, property_name_raw, guest_name, check_in, net_amount, gross_amount)")
        .order("decided_at", { ascending: false });
      return (data ?? []).map((d: any) => ({
        id: d.id, ota_transaction_id: d.ota_transaction_id, outcome: d.outcome,
        allocated_listing_id: d.allocated_listing_id, allocated_listing_name: d.listings?.name ?? null,
        reason: d.reason, txn: d.ota_transactions ?? {},
      }));
    },
  });
}

// ── Security deposits (Stripe) — one-in/one-out audit, paired by charge id ──
export interface SecurityDeposit {
  ref: string; charge: number; refund: number; net: number; fee: number;
  date: string | null; status: "held" | "returned" | "refund_only";
}
export function useSecurityDeposits() {
  return useQuery({
    queryKey: ["security_deposits"],
    queryFn: async (): Promise<{ held: SecurityDeposit[]; returned: SecurityDeposit[]; refundOnly: SecurityDeposit[]; totalHeld: number; totalFees: number }> => {
      // All Stripe deposit charges + deposit refunds, across every batch (so a
      // May charge pairs with a June refund). Grouped by Stripe charge id.
      const { data } = await db.from("ota_transactions")
        .select("reference_number, net_amount, payment_fee_amount, check_in, statement_descriptor")
        .eq("platform", "stripe").eq("txn_type", "adjustment").eq("is_revenue", false)
        .in("statement_descriptor", ["Security deposit / hold", "Deposit refund"]);
      const groups = new Map<string, SecurityDeposit>();
      (data ?? []).forEach((r: any) => {
        const ref = r.reference_number ?? "(none)";
        const g = groups.get(ref) ?? { ref, charge: 0, refund: 0, net: 0, fee: 0, date: null, status: "held" };
        const amt = Number(r.net_amount ?? 0);
        if (amt >= 0) g.charge += amt; else g.refund += -amt;
        g.fee += Number(r.payment_fee_amount ?? 0);
        if (r.check_in && (!g.date || r.check_in < g.date)) g.date = r.check_in;
        groups.set(ref, g);
      });
      const held: SecurityDeposit[] = [], returned: SecurityDeposit[] = [], refundOnly: SecurityDeposit[] = [];
      for (const g of groups.values()) {
        g.net = Math.round((g.charge - g.refund) * 100) / 100;
        if (Math.abs(g.net) < 1) { g.status = "returned"; returned.push(g); }
        else if (g.charge > 0) { g.status = "held"; held.push(g); }
        else { g.status = "refund_only"; refundOnly.push(g); }
      }
      held.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
      return {
        held, returned, refundOnly,
        totalHeld: Math.round(held.reduce((s, g) => s + g.net, 0) * 100) / 100,
        totalFees: Math.round([...held, ...returned].reduce((s, g) => s + g.fee, 0) * 100) / 100,
      };
    },
  });
}

export function useOtaMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ota_transactions"] });
    qc.invalidateQueries({ queryKey: ["ota_batches"] });
    qc.invalidateQueries({ queryKey: ["attribution_decisions"] });
    qc.invalidateQueries({ queryKey: ["security_deposits"] });
  };

  const uploadCsv = useMutation({
    mutationFn: async (vars: { platform: OtaPlatform; file: File }) => {
      const csv = await vars.file.text();
      const { data, error } = await supabase.functions.invoke("ota-ingest", {
        body: { platform: vars.platform, filename: vars.file.name, csv },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any)?.summary;
    },
    onSuccess: invalidate,
  });

  // Confirm a listing for an OTA row; learn the alias so it's never asked again,
  // and apply it to any other pending rows with the same raw name + platform.
  const confirmListing = useMutation({
    mutationFn: async (vars: { txn: OtaTransaction; listingId: string }) => {
      const { txn, listingId } = vars;
      const uid = await getUid();
      if (txn.property_name_raw) {
        await db.from("listing_aliases").upsert(
          { platform: txn.platform, raw_name: txn.property_name_raw, listing_id: listingId, created_by: uid },
          { onConflict: "platform,raw_name" }
        );
        // back-apply to siblings still awaiting listing resolution
        await db.from("ota_transactions")
          .update({ resolved_listing_id: listingId })
          .eq("platform", txn.platform)
          .eq("property_name_raw", txn.property_name_raw)
          .is("resolved_listing_id", null);
      }
      // also learn the Booking.com property-id alias
      if (txn.bookingcom_property_id) {
        await db.from("listing_aliases").upsert(
          { platform: txn.platform, raw_name: `pid:${txn.bookingcom_property_id}`, listing_id: listingId, created_by: uid },
          { onConflict: "platform,raw_name" }
        );
      }
      await db.from("ota_transactions").update({ resolved_listing_id: listingId }).eq("id", txn.id);
    },
    onSuccess: invalidate,
  });

  const confirmMatch = useMutation({
    mutationFn: async (vars: { txnId: string; reservationId: string; method?: "manual" | "composite" | "code"; confidence?: number }) => {
      await db.from("ota_transactions").update({
        matched_reservation_id: vars.reservationId,
        match_method: vars.method ?? "manual",
        match_confidence: vars.confidence ?? 1.0,
        recon_status: "matched",
      }).eq("id", vars.txnId);
    },
    onSuccess: invalidate,
  });

  const markNoReservation = useMutation({
    mutationFn: async (vars: { txnId: string }) => {
      await db.from("ota_transactions").update({
        matched_reservation_id: null, match_method: "manual", recon_status: "unmatched",
      }).eq("id", vars.txnId);
    },
    onSuccess: invalidate,
  });

  const attributionDecision = useMutation({
    mutationFn: async (vars: { txnId: string; outcome: "management_report" | "company_retention"; allocatedListingId?: string | null; reason?: string }) => {
      const uid = await getUid();
      // replace any prior decision so re-deciding an item just works
      await db.from("ota_attribution_decisions").delete().eq("ota_transaction_id", vars.txnId);
      await db.from("ota_attribution_decisions").insert({
        ota_transaction_id: vars.txnId,
        outcome: vars.outcome,
        allocated_listing_id: vars.outcome === "management_report" ? vars.allocatedListingId : null,
        reason: vars.reason ?? null,
        decided_by: uid,
      });
      await db.from("ota_transactions").update({
        recon_status: vars.outcome === "management_report" ? "matched" : "excluded",
        resolved_listing_id: vars.outcome === "management_report" ? vars.allocatedListingId : null,
      }).eq("id", vars.txnId);
    },
    onSuccess: invalidate,
  });

  // Re-open a decided attribution item -> back to the pending queue to re-decide.
  const reopenAttribution = useMutation({
    mutationFn: async (txnId: string) => {
      await db.from("ota_attribution_decisions").delete().eq("ota_transaction_id", txnId);
      await db.from("ota_transactions").update({ recon_status: "needs_recon", resolved_listing_id: null }).eq("id", txnId);
    },
    onSuccess: invalidate,
  });

  // Delete a batch and (via FK cascade) its staged transactions + attribution
  // decisions. Learned listing aliases persist.
  const deleteBatch = useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await db.from("ota_import_batches").delete().eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { uploadCsv, confirmListing, confirmMatch, markNoReservation, attributionDecision, reopenAttribution, deleteBatch, invalidate };
}
