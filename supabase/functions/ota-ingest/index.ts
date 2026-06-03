// ============================================================================
// Escape Grids — OTA Report Ingestion edge function (P1–P3 auto pass)
//
// POST { platform: 'airbnb'|'bookingcom', filename: string, csv: string }
//   1. Parse the CSV (RFC-4180 aware) and classify each row.
//   2. Build ota_transactions (txn_type, money, collection_model, is_revenue).
//   3. Resolve each reservation row's listing (alias -> bookingcom id -> fuzzy).
//   4. Composite-match to a Hostaway reservation (code path is dormant until
//      reservations.channel_reservation_code is populated by the sync).
//
// Staff-only (super/senior/admin). Uses the service role for DB writes after
// verifying the caller's JWT + role.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields, escaped quotes (""), commas + newlines
// inside quotes. Returns array of string[] rows.
// ---------------------------------------------------------------------------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((x) => x.trim() !== "")) rows.push(row); }
  return rows;
}

const num = (v: string | undefined): number | null => {
  if (v == null) return null;
  const cleaned = v.replace(/[£$,\s]/g, "").replace(/[()]/g, (m) => (m === "(" ? "-" : ""));
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};
const toDate = (v: string | undefined): string | null => {
  if (!v) return null;
  const t = v.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);          // 2026-04-02
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);    // 02/04/2026 (d/m/Y)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const surname = (name: string | null): string | null => {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, "") : null;
};
const daysBetween = (a: string | null, b: string | null): number | null => {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
};

// ---------------------------------------------------------------------------
// Fuzzy listing match: containment of significant tokens against listing name.
// ---------------------------------------------------------------------------
const STOP = new Set(["the", "at", "a", "an", "of", "and", "&", "-", "no", "house", "cottage"]);
const sigTokens = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
function fuzzyScore(raw: string, listingName: string): number {
  const a = new Set(sigTokens(raw));
  const b = sigTokens(listingName);
  if (!b.length) return 0;
  const inter = b.filter((t) => a.has(t)).length;
  return inter / b.length; // oriented to the canonical listing name
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- auth: caller must be staff ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await authed.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "Not authenticated" }, 401);
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.some((r: string) => ["super", "senior", "admin"].includes(r)))
      return json({ error: "Staff only" }, 403);

    const { platform, filename, csv } = await req.json();
    if (!["airbnb", "bookingcom"].includes(platform)) return json({ error: "Unknown platform" }, 400);
    if (!csv || typeof csv !== "string") return json({ error: "Missing csv" }, 400);

    const grid = parseCsv(csv);
    if (grid.length < 2) return json({ error: "CSV has no data rows" }, 400);
    const header = grid[0];
    const nIdx = (name: string) => {
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      const t = norm(name);
      const cols = header.map(norm);
      let i = cols.indexOf(t);
      if (i === -1) i = cols.findIndex((h) => h.startsWith(t) || t.startsWith(h));
      return i;
    };
    const cell = (r: string[], name: string): string | undefined => {
      const i = nIdx(name);
      return i === -1 ? undefined : r[i];
    };

    // ---- build staged transactions ----
    type Stg = Record<string, any>;
    const staged: Stg[] = [];
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    const trackPeriod = (d: string | null) => {
      if (!d) return;
      if (!periodStart || d < periodStart) periodStart = d;
      if (!periodEnd || d > periodEnd) periodEnd = d;
    };

    for (let i = 1; i < grid.length; i++) {
      const r = grid[i];
      const rawObj: Record<string, string> = {};
      header.forEach((h, j) => (rawObj[h] = r[j] ?? ""));

      if (platform === "airbnb") {
        const type = (cell(r, "Type") ?? "").trim();
        const ci = toDate(cell(r, "Start date"));
        const co = (() => {
          const nights = num(cell(r, "Nights"));
          if (ci && nights) { const d = new Date(ci); d.setDate(d.getDate() + nights); return d.toISOString().slice(0, 10); }
          return null;
        })();
        const amount = num(cell(r, "Amount"));
        const serviceFee = num(cell(r, "Service fee"));
        const cleaning = num(cell(r, "Cleaning fee"));
        const base: Stg = {
          platform, raw_row: rawObj, currency: (cell(r, "Currency") ?? "GBP").trim() || "GBP",
          confirmation_code: (cell(r, "Confirmation Code") ?? "").trim() || null,
          property_name_raw: (cell(r, "Listing") ?? "").trim() || null,
          guest_name: (cell(r, "Guest") ?? "").trim() || null,
          check_in: ci, check_out: co, nights: num(cell(r, "Nights")),
          statement_descriptor: (cell(r, "Details") ?? "").trim() || null,
        };
        if (/^reservation$/i.test(type)) {
          staged.push({ ...base, txn_type: "reservation", is_revenue: true, collection_model: "channel",
            net_amount: amount, commission_amount: serviceFee,
            gross_amount: amount != null && serviceFee != null ? amount + serviceFee : amount,
            // cleaning fee captured in raw_row; not a settlement input here
          });
          trackPeriod(ci);
        } else if (/payout/i.test(type) && !/resolution/i.test(type)) {
          staged.push({ ...base, txn_type: "payout", is_revenue: false, net_amount: amount, recon_status: "excluded" });
        } else if (/resolution/i.test(type)) {
          staged.push({ ...base, txn_type: "resolution", is_revenue: false, net_amount: amount, recon_status: "needs_recon" });
        } else {
          staged.push({ ...base, txn_type: "adjustment", is_revenue: false, net_amount: amount, recon_status: "needs_recon" });
        }
      } else {
        // booking.com
        const type = (cell(r, "Type") ?? cell(r, "Transaction type") ?? "").trim();
        const status = (cell(r, "Reservation status") ?? "").trim();
        const payoutType = (cell(r, "Payout type") ?? "").trim();
        const ci = toDate(cell(r, "Check-in date") ?? cell(r, "Check-in"));
        const co = toDate(cell(r, "Check-out date") ?? cell(r, "Check-out"));
        const gross = num(cell(r, "Gross amount"));
        const commission = num(cell(r, "Commission"));
        const commissionPct = num(cell(r, "Commission %"));
        const payFee = num(cell(r, "Payments Service Fee"));
        const txnAmt = num(cell(r, "Transaction amount"));
        const base: Stg = {
          platform, raw_row: rawObj, currency: "GBP",
          reference_number: (cell(r, "Reference number") ?? "").trim() || null,
          bookingcom_property_id: (cell(r, "Property ID") ?? "").trim() || null,
          property_name_raw: (cell(r, "Property name") ?? "").trim() || null,
          statement_descriptor: (cell(r, "Statement Descriptor") ?? "").trim() || null,
          guest_name: (cell(r, "Guest name") ?? "").trim() || null,
          check_in: ci, check_out: co, nights: daysBetween(ci, co),
          vat: num(cell(r, "VAT")), tax: num(cell(r, "Tax")),
        };
        const isPayout = /payout/i.test(type) && !/reservation/i.test(type);
        if (isPayout) {
          staged.push({ ...base, txn_type: "payout", is_revenue: false, net_amount: num(cell(r, "Payout amount")), recon_status: "excluded" });
          continue;
        }
        // reservation rows: include only status "Okay"
        if (status && !/okay|ok/i.test(status)) continue;
        if (payoutType.toLowerCase() === "net") {
          staged.push({ ...base, txn_type: "reservation", is_revenue: true, collection_model: "channel",
            gross_amount: gross, commission_amount: commission, commission_pct: commissionPct != null ? commissionPct / 100 : null,
            payment_fee_amount: payFee, net_amount: txnAmt ?? gross });
        } else {
          // Gross / host-collected: commission "To be invoiced" -> a payable computed from %
          const pct = commissionPct != null ? commissionPct / 100 : 0.15;
          staged.push({ ...base, txn_type: "reservation", is_revenue: true, collection_model: "host",
            gross_amount: gross, commission_pct: pct,
            commission_amount: gross != null ? Math.round(gross * pct * 100) / 100 : null,
            net_amount: gross });
        }
        trackPeriod(ci);
      }
    }

    // ---- create batch ----
    const { data: batch, error: bErr } = await admin.from("ota_import_batches").insert({
      platform, source_filename: filename ?? "upload.csv",
      inferred_period_start: periodStart, inferred_period_end: periodEnd,
      row_count: staged.length, status: "parsed", uploaded_by: uid,
    }).select("id").single();
    if (bErr) throw bErr;
    const batchId = batch.id;

    // ---- listing resolution + reservation matching (auto pass) ----
    const { data: listings } = await admin.from("listings").select("id, name");
    const { data: aliases } = await admin.from("listing_aliases").select("raw_name, listing_id").eq("platform", platform);
    const aliasMap = new Map<string, string>((aliases ?? []).map((a: any) => [a.raw_name.toLowerCase(), a.listing_id]));

    const resolveListing = (t: Stg): { id: string | null; suggest: string | null } => {
      // 1. alias on raw name
      if (t.property_name_raw) {
        const hit = aliasMap.get(t.property_name_raw.toLowerCase());
        if (hit) return { id: hit, suggest: null };
      }
      // 2. booking.com property id stored as an alias
      if (t.bookingcom_property_id) {
        const hit = aliasMap.get(`pid:${t.bookingcom_property_id}`.toLowerCase());
        if (hit) return { id: hit, suggest: null };
      }
      // 3. fuzzy suggestion
      if (t.property_name_raw && listings?.length) {
        let best: { id: string; score: number } | null = null;
        for (const l of listings) {
          const sc = fuzzyScore(t.property_name_raw, l.name);
          if (!best || sc > best.score) best = { id: l.id, score: sc };
        }
        if (best && best.score >= 0.6) return { id: null, suggest: best.id };
      }
      return { id: null, suggest: null };
    };

    // cache reservations per listing
    const resvCache = new Map<string, any[]>();
    const getResv = async (listingId: string) => {
      if (resvCache.has(listingId)) return resvCache.get(listingId)!;
      const { data } = await admin.from("reservations")
        .select("id, guest_name, check_in, check_out, total_amount, host_payout, channel_reservation_code, status")
        .eq("listing_id", listingId);
      const rows = (data ?? []).filter((r: any) => r.status === "confirmed");
      resvCache.set(listingId, rows);
      return rows;
    };

    const scoreCandidate = (t: Stg, r: any): number => {
      let s = 0;
      if (t.check_in && r.check_in === t.check_in) s += 0.40;
      if (t.check_out && r.check_out === t.check_out) s += 0.25;
      const sn = surname(t.guest_name);
      if (sn && surname(r.guest_name) === sn) s += 0.25;
      const tn = t.nights, rn = daysBetween(r.check_in, r.check_out);
      if (tn != null && rn != null && Math.abs(tn - rn) <= 1) s += 0.05;
      const amt = t.net_amount ?? t.gross_amount;
      const ramt = r.host_payout ?? r.total_amount;
      if (amt != null && ramt != null && ramt !== 0 && Math.abs(amt - ramt) / Math.abs(ramt) <= 0.02) s += 0.05;
      return s;
    };

    const rowsToInsert: Stg[] = [];
    for (const t of staged) {
      const out: Stg = {
        batch_id: batchId, platform: t.platform, txn_type: t.txn_type,
        confirmation_code: t.confirmation_code ?? null, reference_number: t.reference_number ?? null,
        statement_descriptor: t.statement_descriptor ?? null, bookingcom_property_id: t.bookingcom_property_id ?? null,
        property_name_raw: t.property_name_raw ?? null, guest_name: t.guest_name ?? null,
        check_in: t.check_in ?? null, check_out: t.check_out ?? null, nights: t.nights ?? null,
        currency: t.currency ?? "GBP", gross_amount: t.gross_amount ?? null,
        commission_amount: t.commission_amount ?? null, commission_pct: t.commission_pct ?? null,
        payment_fee_amount: t.payment_fee_amount ?? null, vat: t.vat ?? null, tax: t.tax ?? null,
        net_amount: t.net_amount ?? null, collection_model: t.collection_model ?? null,
        is_revenue: !!t.is_revenue, raw_row: t.raw_row,
        match_method: "none", recon_status: t.recon_status ?? "needs_recon",
        match_confidence: null, resolved_listing_id: null, matched_reservation_id: null,
      };

      if (t.txn_type === "reservation") {
        const { id: listingId, suggest } = resolveListing(t);
        out.resolved_listing_id = listingId ?? suggest ?? null;

        if (listingId) {
          // PRIMARY (dormant): code match against channel_reservation_code
          const code = t.confirmation_code || t.reference_number;
          const resv = await getResv(listingId);
          let matched: any = null, method = "composite", confidence = 0;
          if (code) {
            const codeHit = resv.find((r: any) => r.channel_reservation_code && r.channel_reservation_code === code);
            if (codeHit) { matched = codeHit; method = "code"; confidence = 1.0; }
          }
          if (!matched) {
            let best: { r: any; s: number } | null = null;
            let exactDatePairs = 0;
            for (const r of resv) {
              const s = scoreCandidate(t, r);
              if (t.check_in && t.check_out && r.check_in === t.check_in && r.check_out === t.check_out) exactDatePairs++;
              if (!best || s > best.s) best = { r, s };
            }
            if (best) {
              // uniqueness bonus: sole reservation with the exact stay dates
              let s = best.s;
              if (exactDatePairs === 1 && t.check_in && t.check_out &&
                  best.r.check_in === t.check_in && best.r.check_out === t.check_out) s = Math.min(1, s + 0.15);
              matched = best.r; confidence = Math.round(s * 1000) / 1000; method = "composite";
            }
          }
          if (method === "code") {
            out.matched_reservation_id = matched.id; out.match_method = "code";
            out.match_confidence = 1.0; out.recon_status = "auto_matched";
          } else if (matched && confidence >= 0.85) {
            out.matched_reservation_id = matched.id; out.match_method = "composite";
            out.match_confidence = confidence; out.recon_status = "auto_matched";
          } else if (matched && confidence >= 0.55) {
            out.matched_reservation_id = matched.id; out.match_method = "composite";
            out.match_confidence = confidence; out.recon_status = "needs_recon"; // best candidate suggested
          } else {
            out.match_confidence = matched ? confidence : 0;
            out.recon_status = "unmatched";
          }
        } else {
          // listing unresolved (suggestion only or none) -> human resolves listing first
          out.recon_status = "needs_recon";
        }
      } else if (t.txn_type === "payout") {
        out.recon_status = "excluded"; // informational, never matched
      } else {
        // resolution / adjustment -> attribution queue (P4)
        out.recon_status = "needs_recon";
      }
      rowsToInsert.push(out);
    }

    // chunked insert
    for (let i = 0; i < rowsToInsert.length; i += 500) {
      const { error } = await admin.from("ota_transactions").insert(rowsToInsert.slice(i, i + 500));
      if (error) throw error;
    }

    // summary
    const summary = {
      batch_id: batchId, platform, total: rowsToInsert.length,
      reservations: rowsToInsert.filter((r) => r.txn_type === "reservation").length,
      payouts: rowsToInsert.filter((r) => r.txn_type === "payout").length,
      resolutions: rowsToInsert.filter((r) => r.txn_type === "resolution").length,
      adjustments: rowsToInsert.filter((r) => r.txn_type === "adjustment").length,
      auto_matched: rowsToInsert.filter((r) => r.recon_status === "auto_matched").length,
      needs_recon: rowsToInsert.filter((r) => r.recon_status === "needs_recon").length,
      unmatched: rowsToInsert.filter((r) => r.recon_status === "unmatched").length,
      channel: rowsToInsert.filter((r) => r.collection_model === "channel").length,
      host: rowsToInsert.filter((r) => r.collection_model === "host").length,
    };
    return json({ ok: true, summary });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
