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
// order = the expected slash-date order for AMBIGUOUS values (both parts <= 12).
// Airbnb exports US "mdy" (05/29/2026); most others "dmy". Unambiguous values
// (a part > 12) are auto-detected regardless of `order`.
const toDate = (v: string | undefined, order: "mdy" | "dmy" = "dmy"): string | null => {
  if (!v) return null;
  const t = v.trim();
  if (t === "" || t === "-") return null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);          // 2026-04-02 (ISO)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);    // slash date
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    let mm: number, dd: number;
    if (a > 12) { dd = a; mm = b; }                      // unambiguous day-first
    else if (b > 12) { mm = a; dd = b; }                 // unambiguous month-first
    else if (order === "mdy") { mm = a; dd = b; }
    else { dd = a; mm = b; }
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${m[3]}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
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
    if (!["airbnb", "bookingcom", "stripe"].includes(platform)) return json({ error: "Unknown platform" }, 400);
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
        const ci = toDate(cell(r, "Start date"), "mdy");
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
      } else if (platform === "bookingcom") {
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
        // non-reservation, non-payout rows (e.g. "Commission adjustment") -> attribution queue
        if (!/reservation/i.test(type)) {
          staged.push({ ...base, txn_type: "adjustment", is_revenue: false,
            commission_amount: commission != null ? Math.abs(commission) : null,
            net_amount: gross ?? num(cell(r, "Transaction amount")), recon_status: "needs_recon" });
          continue;
        }
        // reservation rows: include only status "Okay"
        if (status && !/okay|ok/i.test(status)) continue;
        if (payoutType.toLowerCase() === "net") {
          // Booking.com reports commission + payments fee as NEGATIVE deductions;
          // store them as positive cost magnitudes.
          staged.push({ ...base, txn_type: "reservation", is_revenue: true, collection_model: "channel",
            gross_amount: gross, commission_amount: commission != null ? Math.abs(commission) : null,
            commission_pct: commissionPct != null ? commissionPct / 100 : null,
            payment_fee_amount: payFee != null ? Math.abs(payFee) : null, net_amount: txnAmt ?? gross });
        } else {
          // Gross / host-collected: commission "To be invoiced" -> a payable computed from %
          const pct = commissionPct != null ? commissionPct / 100 : 0.15;
          staged.push({ ...base, txn_type: "reservation", is_revenue: true, collection_model: "host",
            gross_amount: gross, commission_pct: pct,
            commission_amount: gross != null ? Math.round(gross * pct * 100) / 100 : null,
            net_amount: gross });
        }
        trackPeriod(ci);
      } else {
        // stripe (balance history)
        const type = (cell(r, "Type") ?? "").trim().toLowerCase();
        const amount = num(cell(r, "Amount"));
        const fee = num(cell(r, "Fee"));
        const netAmt = num(cell(r, "Net"));
        const created = toDate((cell(r, "Created (UTC)") ?? "").slice(0, 10));
        const desc = cell(r, "Description") ?? "";
        const chargeRef = (cell(r, "Source") ?? cell(r, "id") ?? "").trim() || null;
        // Hostaway reservation id linked in the description / metadata
        const ridMatch = desc.match(/Reservation Id:\s*(\d+)/i);
        const stripeResvId = ridMatch ? ridMatch[1] : null;
        const base: Stg = {
          platform, raw_row: rawObj, currency: (cell(r, "Currency") ?? "GBP").trim() || "GBP",
          reference_number: chargeRef, statement_descriptor: desc || null,
          check_in: created, stripe_resv_id: stripeResvId, external_txn_id: rawObj["id"] || null,
        };
        // A security deposit is a round £ hold, up to £400 (100/200/300/400).
        // Anything else without a reservation link goes to the queues for review.
        const isDeposit = (a: number | null) => a != null && a > 0 && a <= 400 && a % 100 === 0;
        if (type === "charge" || type === "payment") {
          if (stripeResvId) {
            // direct/website/google booking paid via Stripe -> match by Hostaway id
            staged.push({ ...base, txn_type: "reservation", is_revenue: true, collection_model: "channel",
              gross_amount: amount, commission_amount: 0, payment_fee_amount: fee, net_amount: netAmt ?? amount });
            trackPeriod(created);
          } else if (isDeposit(amount)) {
            // security deposit / hold: excluded from revenue; card fee still captured.
            staged.push({ ...base, txn_type: "adjustment", is_revenue: false,
              statement_descriptor: "Security deposit / hold", payment_fee_amount: fee,
              net_amount: amount, recon_status: "excluded" });
          } else {
            // unlinked, non-deposit charge -> human review (attribution).
            staged.push({ ...base, txn_type: "adjustment", is_revenue: false,
              statement_descriptor: "Stripe charge — review", payment_fee_amount: fee,
              net_amount: amount, recon_status: "needs_recon" });
          }
        } else if (type === "refund" || type === "payment_refund") {
          if (isDeposit(amount != null ? Math.abs(amount) : null)) {
            // deposit return -> Security audit (paired by Source)
            staged.push({ ...base, txn_type: "adjustment", is_revenue: false,
              statement_descriptor: "Deposit refund", payment_fee_amount: fee,
              net_amount: amount, recon_status: "excluded" });
          } else {
            // non-deposit refund (e.g. a booking refund) -> human review
            staged.push({ ...base, txn_type: "adjustment", is_revenue: false,
              statement_descriptor: "Stripe refund — review", payment_fee_amount: fee,
              net_amount: amount, recon_status: "needs_recon" });
          }
        } else {
          // payout / refund_failure / other -> informational
          staged.push({ ...base, txn_type: "payout", is_revenue: false, net_amount: amount, recon_status: "excluded" });
        }
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

    // GLOBAL code map — the OTA confirmation/reference uniquely identifies a
    // reservation regardless of listing, so match on it FIRST and derive the
    // listing from the matched reservation (no name-resolution needed).
    const allCodes = Array.from(new Set(
      staged.filter((s) => s.txn_type === "reservation")
        .map((s) => s.confirmation_code || s.reference_number).filter(Boolean),
    )) as string[];
    const codeToResv = new Map<string, any>();
    for (let i = 0; i < allCodes.length; i += 300) {
      const { data } = await admin.from("reservations")
        .select("id, listing_id, guest_name, check_in, check_out, total_amount, host_payout, channel_reservation_code, status")
        .in("channel_reservation_code", allCodes.slice(i, i + 300));
      (data ?? []).forEach((r: any) => { if (r.channel_reservation_code) codeToResv.set(r.channel_reservation_code, r); });
    }

    // Stripe direct bookings link by Hostaway reservation id (not a channel code).
    const hostawayIds = Array.from(new Set(
      staged.filter((s) => s.txn_type === "reservation" && s.stripe_resv_id).map((s) => Number(s.stripe_resv_id)),
    )).filter((n) => Number.isFinite(n)) as number[];
    const hostawayIdToResv = new Map<string, any>();
    for (let i = 0; i < hostawayIds.length; i += 300) {
      const { data } = await admin.from("reservations")
        .select("id, listing_id, hostaway_reservation_id, status")
        .in("hostaway_reservation_id", hostawayIds.slice(i, i + 300));
      (data ?? []).forEach((r: any) => { if (r.hostaway_reservation_id != null) hostawayIdToResv.set(String(r.hostaway_reservation_id), r); });
    }
    const learnedAliases: { platform: string; raw_name: string; listing_id: string }[] = [];
    const learnAlias = (t: Stg, listingId: string) => {
      if (t.property_name_raw) {
        learnedAliases.push({ platform, raw_name: t.property_name_raw, listing_id: listingId });
        aliasMap.set(t.property_name_raw.toLowerCase(), listingId); // benefit later rows in this batch
      }
      if (t.bookingcom_property_id) {
        learnedAliases.push({ platform, raw_name: `pid:${t.bookingcom_property_id}`, listing_id: listingId });
        aliasMap.set(`pid:${t.bookingcom_property_id}`.toLowerCase(), listingId);
      }
    };

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

    // Cancelled & refunded bookings: a confirmation code whose rows (reservation
    // + adjustments) net to ~£0 was booked then fully refunded -> exclude all its
    // rows (no net revenue, no fee). A non-zero residual (e.g. a kept cancellation
    // fee, or a resolution deduction on a real stay) is NOT excluded.
    const codeNet = new Map<string, { sum: number; n: number }>();
    for (const s of staged) {
      const c = s.confirmation_code || s.reference_number;
      if (!c) continue;
      const e = codeNet.get(c) ?? { sum: 0, n: 0 };
      e.sum += Number(s.net_amount ?? s.gross_amount ?? 0); e.n += 1;
      codeNet.set(c, e);
    }
    const cancelledCodes = new Set<string>();
    for (const [c, e] of codeNet) if (e.n >= 2 && Math.abs(e.sum) < 1) cancelledCodes.add(c);

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
        is_revenue: !!t.is_revenue, raw_row: t.raw_row, external_txn_id: t.external_txn_id ?? null,
        match_method: "none", recon_status: t.recon_status ?? "needs_recon",
        match_confidence: null, resolved_listing_id: null, matched_reservation_id: null,
      };

      // Cancelled & refunded (net ~£0 across the code's rows) -> exclude, no revenue.
      const rowCode = t.confirmation_code || t.reference_number;
      if (rowCode && cancelledCodes.has(rowCode)) {
        out.is_revenue = false; out.recon_status = "excluded";
        rowsToInsert.push(out);
        continue;
      }

      if (t.txn_type === "reservation" && t.stripe_resv_id) {
        // Stripe direct booking — match by Hostaway reservation id.
        const hit = hostawayIdToResv.get(String(t.stripe_resv_id));
        if (hit) {
          out.matched_reservation_id = hit.id;
          out.resolved_listing_id = hit.listing_id;
          out.match_method = "code"; out.match_confidence = 1.0;
          if (hit.status === "confirmed") out.recon_status = "auto_matched";
          else { out.is_revenue = false; out.recon_status = "excluded"; } // cancelled
        } else {
          out.recon_status = "needs_recon";
        }
        rowsToInsert.push(out);
        continue;
      }

      if (t.txn_type === "reservation") {
        // 1) PRIMARY — global code match (listing comes from the reservation)
        const code = t.confirmation_code || t.reference_number;
        const codeHit = code ? codeToResv.get(code) : null;
        if (codeHit) {
          out.matched_reservation_id = codeHit.id;
          out.resolved_listing_id = codeHit.listing_id;
          out.match_method = "code"; out.match_confidence = 1.0; out.recon_status = "auto_matched";
          learnAlias(t, codeHit.listing_id); // bootstrap the name/id alias for future name-only rows
        } else {
          // 2) resolve listing (alias / property id / fuzzy) then composite-score within it
          const { id: listingId, suggest } = resolveListing(t);
          const useListing = listingId ?? suggest;
          out.resolved_listing_id = useListing ?? null;
          if (useListing) {
            const resv = await getResv(useListing);
            let best: { r: any; s: number } | null = null;
            let exactDatePairs = 0;
            for (const r of resv) {
              const s = scoreCandidate(t, r);
              if (t.check_in && t.check_out && r.check_in === t.check_in && r.check_out === t.check_out) exactDatePairs++;
              if (!best || s > best.s) best = { r, s };
            }
            let confidence = 0, matched: any = null;
            if (best) {
              let s = best.s;
              if (exactDatePairs === 1 && t.check_in && t.check_out &&
                  best.r.check_in === t.check_in && best.r.check_out === t.check_out) s = Math.min(1, s + 0.15);
              matched = best.r; confidence = Math.round(s * 1000) / 1000;
            }
            if (matched && confidence >= 0.85) {
              out.matched_reservation_id = matched.id; out.match_method = "composite";
              out.match_confidence = confidence; out.recon_status = "auto_matched";
              if (listingId == null) learnAlias(t, useListing); // confident match on a fuzzy listing -> learn it
            } else if (matched && confidence >= 0.55) {
              out.matched_reservation_id = matched.id; out.match_method = "composite";
              out.match_confidence = confidence; out.recon_status = "needs_recon";
            } else {
              out.match_confidence = matched ? confidence : 0; out.recon_status = "needs_recon";
            }
          } else {
            out.recon_status = "needs_recon";
          }
        }
      } else if (t.txn_type === "payout") {
        out.recon_status = "excluded"; // informational, never matched
      } else {
        // resolution / adjustment -> attribution queue, UNLESS already resolved
        // upstream (e.g. an excluded Stripe security deposit / refund).
        if (out.recon_status !== "excluded") out.recon_status = "needs_recon";
      }
      rowsToInsert.push(out);
    }

    // chunked insert (Stripe upserts on the txn id so re-uploads / API syncs dedup)
    for (let i = 0; i < rowsToInsert.length; i += 500) {
      const chunk = rowsToInsert.slice(i, i + 500);
      const op = platform === "stripe"
        ? admin.from("ota_transactions").upsert(chunk, { onConflict: "external_txn_id", ignoreDuplicates: false })
        : admin.from("ota_transactions").insert(chunk);
      const { error } = await op;
      if (error) throw error;
    }

    // persist aliases learned from confident matches (bootstraps name-only matching)
    if (learnedAliases.length) {
      const seen = new Set<string>();
      const uniq = learnedAliases.filter((a) => { const k = a.raw_name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      await admin.from("listing_aliases").upsert(uniq, { onConflict: "platform,raw_name", ignoreDuplicates: true });
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
