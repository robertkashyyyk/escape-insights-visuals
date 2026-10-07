// TEMPORARY, READ-ONLY diagnostic. Full-status reconciliation against Hostaway for
// reservations with check_out >= today - 60 days. Applies the corrected status map and
// lists every reservation whose stored status differs from Hostaway's truth. Writes
// NOTHING to the database. Delete after use.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { rejectAnon } from "../_shared/auth.ts";
import { mapHostawayStatus, isLive, countsAsRevenue } from "../_shared/hostawayStatus.ts";

const HOSTAWAY_API = "https://api.hostaway.com/v1";
const LIMIT = 100;
const TIME_BUDGET_MS = 120_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authFail = rejectAnon(req, corsHeaders);
  if (authFail) return authFail;
  const START = Date.now();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const lookbackDays = 60;
  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);

  try {
    // 1. Hostaway OAuth
    const { data: settings } = await supabase.from("app_settings").select("key, value")
      .in("key", ["hostaway_account_id", "hostaway_client_secret"]);
    const sm = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
    const tokenRes = await fetch(`${HOSTAWAY_API}/accessTokens`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: sm.hostaway_account_id, client_secret: sm.hostaway_client_secret, scope: "general" }),
    });
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok || !tokenBody.access_token) throw new Error(`Hostaway auth failed: ${JSON.stringify(tokenBody)}`);
    const authHeaders = { Authorization: `Bearer ${tokenBody.access_token}`, "Cache-Control": "no-cache" };

    // 2. Pull Hostaway reservations departing on/after the cutoff. Build id -> raw status.
    const hostawayById = new Map<number, { raw: string; departure: string | null; arrival: string | null }>();
    let offset = 0, truncated = false, pages = 0;
    while (true) {
      if (Date.now() - START > TIME_BUDGET_MS) { truncated = true; break; }
      const url = `${HOSTAWAY_API}/reservations?limit=${LIMIT}&offset=${offset}&departureStartDate=${cutoff}`;
      const res = await fetch(url, { headers: authHeaders });
      const body = await res.json();
      if (!res.ok) throw new Error(`Hostaway fetch failed (offset=${offset}): ${JSON.stringify(body)}`);
      const rows = body.result || [];
      if (rows.length === 0) break;
      for (const r of rows) {
        // backstop client-side filter in case the API ignores departureStartDate
        if (!r.departureDate || r.departureDate >= cutoff) {
          hostawayById.set(r.id, { raw: r.status ?? "", departure: r.departureDate ?? null, arrival: r.arrivalDate ?? null });
        }
      }
      pages++;
      offset += LIMIT;
      if (rows.length < LIMIT) break;
    }

    // 3. Our reservations in the same window, with listing + owner.
    // PostgREST caps a single response at 1000 rows, so paginate with .range().
    const ours: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabase
        .from("reservations")
        .select("id, hostaway_reservation_id, guest_name, status, check_in, check_out, total_amount, owner_payout, platform, listing_id, listings:listing_id (internal_name, name, owner_id, property_owners:owner_id (name))")
        .gte("check_out", cutoff)
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      if (!page || page.length === 0) break;
      ours.push(...page);
      if (page.length < 1000) break;
    }

    // 4. Compare.
    type Disc = Record<string, unknown>;
    const discrepancies: Disc[] = [];
    const unmatched: Disc[] = [];
    for (const r of ours || []) {
      const hid = (r as any).hostaway_reservation_id as number | null;
      const base = {
        reservation_id: (r as any).id, hostaway_id: hid,
        guest: (r as any).guest_name,
        property: (r as any).listings?.internal_name || (r as any).listings?.name,
        owner: (r as any).listings?.property_owners?.name ?? null,
        check_in: (r as any).check_in, check_out: (r as any).check_out,
        our_status: (r as any).status, total_amount: (r as any).total_amount,
      };
      if (!hid) { unmatched.push({ ...base, reason: "no hostaway_reservation_id" }); continue; }
      const ha = hostawayById.get(hid);
      if (!ha) { unmatched.push({ ...base, reason: "not in Hostaway departure>=cutoff set" }); continue; }
      const { status: correct, known } = mapHostawayStatus(ha.raw);
      if (correct !== (r as any).status) {
        discrepancies.push({
          reservation_id: (r as any).id,
          hostaway_id: hid,
          guest: (r as any).guest_name,
          property: (r as any).listings?.internal_name || (r as any).listings?.name,
          owner: (r as any).listings?.property_owners?.name ?? null,
          check_in: (r as any).check_in,
          check_out: (r as any).check_out,
          platform: (r as any).platform,
          total_amount: (r as any).total_amount,
          owner_payout: (r as any).owner_payout,
          our_status: (r as any).status,
          hostaway_raw: ha.raw,
          correct_status: correct,
          known_status: known,
          correct_is_live: isLive(correct),
          correct_is_revenue: countsAsRevenue(correct),
        });
      }
    }

    // 5. Attach clean info for the discrepant + unmatched reservations.
    const withCleans = [...discrepancies, ...unmatched];
    const ids = withCleans.map((d) => d.reservation_id as string);
    if (ids.length > 0) {
      const { data: cleans } = await supabase
        .from("clean_tasks")
        .select("id, reservation_id, scheduled_date, status, not_required, assigned_cleaner_id, completion_source, cleaners:assigned_cleaner_id (name)")
        .in("reservation_id", ids);
      const byRes = new Map<string, any[]>();
      for (const c of cleans || []) {
        const k = String((c as any).reservation_id);
        if (!byRes.has(k)) byRes.set(k, []);
        byRes.get(k)!.push(c);
      }
      for (const d of withCleans) {
        const cs = byRes.get(String(d.reservation_id)) || [];
        d.cleans = cs.map((c) => ({
          scheduled_date: c.scheduled_date, status: c.status, not_required: c.not_required,
          completed: c.status === "completed" || c.status === "done",
          cleaner: c.cleaners?.name ?? null,
        }));
        d.has_live_clean = cs.some((c) => !["cancelled", "canceled"].includes(c.status));
        d.has_completed_clean = cs.some((c) => c.status === "completed" || c.status === "done");
      }
    }

    discrepancies.sort((a, b) => String(a.check_out).localeCompare(String(b.check_out)));
    return new Response(JSON.stringify({
      cutoff, hostaway_in_window: hostawayById.size, pages, truncated,
      our_reservations_in_window: (ours || []).length,
      unmatched_count: unmatched.length,
      unmatched,
      unknown_mapped_count: discrepancies.filter((d) => d.correct_status === "unknown").length,
      discrepancy_count: discrepancies.length,
      discrepancies,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
