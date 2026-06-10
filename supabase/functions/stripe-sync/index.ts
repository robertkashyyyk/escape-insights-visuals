// ============================================================================
// Escape Grids — Stripe sync (live API → ota_transactions)
//
// Pulls Stripe balance transactions (charges / refunds / payouts), maps them the
// same way as the Stripe CSV import, matches direct bookings to Hostaway by
// reservation id, classifies security deposits (round £ <=400) + refunds, and
// upserts into ota_transactions deduped on the Stripe txn id (external_txn_id),
// so it never duplicates rows already brought in via CSV.
//
// Read-only Stripe key (STRIPE_API_KEY). Internal — verify_jwt = false (cron).
// POST { days?: number }  (lookback window; default 120)
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isDeposit = (a: number | null) => a != null && a > 0 && a <= 400 && a % 100 === 0;
const dateOf = (unix: number | null) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : null);

// Pull the Hostaway reservation id from a charge's metadata / description.
function extractResvId(bt: any): string | null {
  const src = bt.source && typeof bt.source === "object" ? bt.source : null;
  const md = src?.metadata ?? {};
  const direct = md["Reservation Id"] ?? md.reservation_id ?? md.reservationId ?? md.hostaway_reservation_id ?? md.hostawayReservationId;
  if (direct && /^\d+$/.test(String(direct))) return String(direct);
  const text = [bt.description, src?.description, md["Charge Id"], JSON.stringify(md)].filter(Boolean).join(" ");
  const m = String(text).match(/Reservation Id:?\s*(\d+)/i);
  return m ? m[1] : null;
}
function chargeIdOf(bt: any): string | null {
  const src = bt.source;
  if (src && typeof src === "object") {
    if (src.object === "refund") return src.charge ?? src.id;
    return src.id;
  }
  return typeof src === "string" ? src : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("STRIPE_API_KEY");
    if (!KEY) return json({ error: "STRIPE_API_KEY not set" }, 500);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(400, Number(body?.days ?? 120)));
    const sinceTs = Math.floor(Date.now() / 1000) - days * 86400;

    // ---- fetch balance transactions (paginated, source expanded) ----
    const bts: any[] = [];
    let startingAfter: string | null = null;
    for (let page = 0; page < 60; page++) {
      const u = new URL("https://api.stripe.com/v1/balance_transactions");
      u.searchParams.set("limit", "100");
      u.searchParams.set("created[gte]", String(sinceTs));
      u.searchParams.append("expand[]", "data.source");
      if (startingAfter) u.searchParams.set("starting_after", startingAfter);
      const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${KEY}` } });
      if (!r.ok) return json({ error: "Stripe API error", status: r.status, detail: (await r.text()).slice(0, 400) }, 502);
      const d = await r.json();
      bts.push(...(d.data ?? []));
      if (!d.has_more || !d.data?.length) break;
      startingAfter = d.data[d.data.length - 1].id;
    }

    // ---- find-or-create the persistent "Stripe API (live)" batch ----
    let { data: batch } = await admin.from("ota_import_batches").select("id")
      .eq("platform", "stripe").eq("source_filename", "Stripe API (live)").maybeSingle();
    if (!batch) {
      const ins = await admin.from("ota_import_batches")
        .insert({ platform: "stripe", source_filename: "Stripe API (live)", status: "reconciled", row_count: 0 })
        .select("id").single();
      batch = ins.data;
    }
    const batchId = batch.id;

    // ---- map + classify ----
    const staged = bts.map((bt) => {
      const amount = bt.amount != null ? bt.amount / 100 : null;
      const fee = bt.fee != null ? bt.fee / 100 : 0;
      const net = bt.net != null ? bt.net / 100 : amount;
      const created = dateOf(bt.created);
      const ch = chargeIdOf(bt);
      const resvId = extractResvId(bt);
      const src = bt.source && typeof bt.source === "object" ? bt.source : null;
      const billName = src?.billing_details?.name ?? (typeof src?.customer === "object" ? src.customer?.name : null) ?? null;
      const billEmail = src?.billing_details?.email ?? src?.receipt_email ?? null;
      const t = (bt.type ?? "").toLowerCase();
      const base: any = {
        batch_id: batchId, platform: "stripe", external_txn_id: bt.id, guest_name: billName,
        reference_number: ch, check_in: created, currency: (bt.currency ?? "gbp").toUpperCase(),
        raw_row: { id: bt.id, Source: ch, Type: bt.type, Amount: String(amount ?? ""), Fee: String(fee), Net: String(net), Reservation_Id: resvId ?? "", Customer: billName ?? "", Email: billEmail ?? "" },
        match_method: "none", match_confidence: null, resolved_listing_id: null, matched_reservation_id: null,
        commission_amount: null, commission_pct: null, vat: null, tax: null,
      };
      if (t === "charge" || t === "payment") {
        if (resvId) return { ...base, txn_type: "reservation", is_revenue: true, collection_model: "channel",
          gross_amount: amount, commission_amount: 0, payment_fee_amount: fee, net_amount: net, stripe_resv_id: resvId, statement_descriptor: bt.description ?? null };
        if (isDeposit(amount)) return { ...base, txn_type: "adjustment", is_revenue: false,
          statement_descriptor: "Security deposit / hold", payment_fee_amount: fee, net_amount: amount, recon_status: "excluded" };
        return { ...base, txn_type: "adjustment", is_revenue: false,
          statement_descriptor: "Stripe charge — review", payment_fee_amount: fee, net_amount: amount, recon_status: "needs_recon" };
      }
      if (t === "refund" || t === "payment_refund") {
        const dep = isDeposit(amount != null ? Math.abs(amount) : null);
        return { ...base, txn_type: "adjustment", is_revenue: false,
          statement_descriptor: dep ? "Deposit refund" : "Stripe refund — review", payment_fee_amount: fee,
          net_amount: amount, recon_status: dep ? "excluded" : "needs_recon" };
      }
      return { ...base, txn_type: "payout", is_revenue: false, net_amount: amount, recon_status: "excluded", statement_descriptor: bt.description ?? null };
    });

    // ---- match direct bookings by Hostaway reservation id ----
    const resvIds = Array.from(new Set(staged.filter((s) => s.stripe_resv_id).map((s) => Number(s.stripe_resv_id)))).filter((n) => Number.isFinite(n)) as number[];
    const hostawayMap = new Map<string, any>();
    for (let i = 0; i < resvIds.length; i += 300) {
      const { data } = await admin.from("reservations").select("id, listing_id, hostaway_reservation_id, status").in("hostaway_reservation_id", resvIds.slice(i, i + 300));
      (data ?? []).forEach((r: any) => { if (r.hostaway_reservation_id != null) hostawayMap.set(String(r.hostaway_reservation_id), r); });
    }
    for (const s of staged) {
      if (s.txn_type === "reservation" && s.stripe_resv_id) {
        const hit = hostawayMap.get(String(s.stripe_resv_id));
        if (hit) {
          s.matched_reservation_id = hit.id; s.resolved_listing_id = hit.listing_id;
          s.match_method = "code"; s.match_confidence = 1.0;
          if (hit.status === "confirmed") s.recon_status = "auto_matched";
          else { s.is_revenue = false; s.recon_status = "excluded"; }
        } else s.recon_status = "needs_recon";
      }
      delete s.stripe_resv_id;
    }

    // ---- auto-attribute unlinked charges by guest name + amount ----
    // The API gives us the customer name (the CSV didn't). An exact full-name +
    // amount match to a single confirmed reservation auto-attributes it; a sole
    // surname+amount candidate is suggested in the Recon queue; else it stays for
    // manual attribution.
    const norm = (x: string | null) => (x ?? "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
    for (const s of staged) {
      if (s.statement_descriptor !== "Stripe charge — review" || !s.guest_name || s.net_amount == null) continue;
      const amt = Number(s.net_amount);
      const surname = norm(s.guest_name).split(" ").pop();
      if (!surname || surname.length < 2) continue;
      const { data: cands } = await admin.from("reservations")
        .select("id, listing_id, guest_name, total_amount, status")
        .eq("status", "confirmed").gte("total_amount", amt - 2).lte("total_amount", amt + 2)
        .ilike("guest_name", `%${surname}%`);
      const rows = cands ?? [];
      const exact = rows.filter((r: any) => norm(r.guest_name) === norm(s.guest_name));
      const pick = exact.length === 1 ? exact[0] : (rows.length === 1 ? rows[0] : null);
      if (pick) {
        const confident = exact.length === 1;
        Object.assign(s, {
          txn_type: "reservation", is_revenue: true, collection_model: "channel",
          gross_amount: amt, commission_amount: 0, net_amount: amt,
          matched_reservation_id: pick.id, resolved_listing_id: pick.listing_id,
          match_method: "composite", match_confidence: confident ? 0.95 : 0.7,
          recon_status: confident ? "auto_matched" : "needs_recon",
          statement_descriptor: confident ? "Stripe (matched by name + amount)" : "Stripe charge — review",
        });
      }
    }

    // ---- upsert (dedup on external_txn_id) ----
    for (let i = 0; i < staged.length; i += 500) {
      const { error } = await admin.from("ota_transactions").upsert(staged.slice(i, i + 500), { onConflict: "external_txn_id", ignoreDuplicates: false });
      if (error) throw error;
    }
    await admin.from("ota_import_batches").update({ row_count: staged.length, status: "reconciled" }).eq("id", batchId);

    return json({ ok: true, fetched: bts.length, upserted: staged.length, days,
      reservations: staged.filter((s) => s.txn_type === "reservation").length,
      auto_matched: staged.filter((s) => s.recon_status === "auto_matched").length,
      deposits: staged.filter((s) => s.statement_descriptor === "Security deposit / hold").length });
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
