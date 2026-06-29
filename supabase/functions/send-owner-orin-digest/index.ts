import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Orin digest email for an owner. Canonical metrics (gross, clipped) but presented
// RELATIVELY — % changes, occupancy %, trends — NEVER absolute £ figures.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { owner_id, period = "monthly" } = await req.json();
    if (!owner_id) return json({ skipped: "no owner_id" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: owner }, { data: prefs }, { data: listings }] = await Promise.all([
      supabase.from("property_owners").select("name, email").eq("id", owner_id).maybeSingle(),
      supabase.from("owner_notification_prefs").select("notify_orin").eq("owner_id", owner_id).maybeSingle(),
      supabase.from("listings").select("id, name, is_bundle").eq("owner_id", owner_id),
    ]);
    if (!prefs?.notify_orin) return json({ skipped: "owner not opted in" });
    const recipient = owner?.email;
    if (!recipient) return json({ skipped: "no recipient" });

    const props = (listings ?? []).filter((l: any) => !l.is_bundle);
    const ids = props.map((l: any) => l.id);
    if (ids.length === 0) return json({ skipped: "no properties" });

    // Current period + same period last year (YoY) + the immediately-preceding period (prior).
    const now = new Date();
    const { curStart, curEnd, prevStart, prevEnd, ppStart, ppEnd, label } = ranges(period, now);

    const fetchRes = async (s: string, e: string) => {
      const { data } = await supabase.from("reservations")
        .select("listing_id, check_in, check_out, total_amount, host_payout, channel_commission, cleaning_fee, tax_amount, status")
        .in("listing_id", ids).eq("status", "confirmed").lte("check_in", e).gte("check_out", s);
      return data ?? [];
    };
    const [curRes, prevRes, ppRes] = await Promise.all([
      fetchRes(curStart, curEnd), fetchRes(prevStart, prevEnd), fetchRes(ppStart, ppEnd),
    ]);

    const cur = aggregate(curRes, curStart, curEnd, props);
    const prevYear = aggregate(prevRes, prevStart, prevEnd, props);
    const prior = aggregate(ppRes, ppStart, ppEnd, props);
    const days = daysInclusive(curStart, curEnd);
    const occ = (a: { nights: number }) => (props.length ? Math.round((a.nights / (props.length * days)) * 100) : 0);
    const pct = (c: number, p: number) => (p > 0 ? Math.round(((c - p) / p) * 100) : (c > 0 ? 100 : 0));
    const adr = (a: { revenue: number; nights: number }) => (a.nights ? a.revenue / a.nights : 0);

    const html = orinEmail(label, period, owner?.name ?? "there", {
      revPctYoY: pct(cur.revenue, prevYear.revenue),
      revPctPrior: pct(cur.revenue, prior.revenue),
      occCur: occ(cur), occYoY: occ(prevYear), occPrior: occ(prior),
      nights: cur.nights, prevNights: prevYear.nights,
      bookings: cur.bookings, prevBookings: prevYear.bookings,
      adrPctYoY: pct(adr(cur), adr(prevYear)),
      topRevenueName: cur.topRevenueName, byProperty: cur.byProperty,
    });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ skipped: "no resend key" }, 500);
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Orin at Escape Grids <updates@escapegrids.com>", to: recipient, subject: `Orin: your ${label} portfolio update`, html }),
    });
    const body = await resp.json();
    if (!resp.ok) return json({ error: body }, 500);
    return json({ sent: true, to: recipient, label });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

const DAY = 86400000;
const toD = (s: string) => new Date(s + "T00:00:00Z");
function nightsBetween(ci: string, co: string) { return Math.max(0, Math.floor((toD(co).getTime() - toD(ci).getTime()) / DAY)); }
function nightsInPeriod(ci: string, co: string, s: string, e: string) {
  const a = Math.max(toD(ci).getTime(), toD(s).getTime());
  const b = Math.min(toD(co).getTime(), toD(e).getTime() + DAY);
  return Math.max(0, Math.floor((b - a) / DAY));
}
function gross(r: any) { return Number(r.total_amount ?? 0); }
function daysInclusive(s: string, e: string) { return Math.floor((toD(e).getTime() - toD(s).getTime()) / DAY) + 1; }

function aggregate(rows: any[], s: string, e: string, props: any[]) {
  let revenue = 0, nights = 0, bookings = 0;
  const nightsByProp: Record<string, number> = {};
  const revByProp: Record<string, number> = {};
  for (const r of rows) {
    const inp = nightsInPeriod(r.check_in, r.check_out, s, e);
    if (inp <= 0) continue;
    const tn = nightsBetween(r.check_in, r.check_out);
    const rev = gross(r) * (tn > 0 ? inp / tn : 1);
    revenue += rev; nights += inp; bookings += 1;
    nightsByProp[r.listing_id] = (nightsByProp[r.listing_id] ?? 0) + inp;
    revByProp[r.listing_id] = (revByProp[r.listing_id] ?? 0) + rev;
  }
  // Per-property breakdown (nights + revenue), sorted by nights desc.
  const byProperty = props
    .map((p: any) => ({ name: p.name, nights: nightsByProp[p.id] ?? 0, revenue: revByProp[p.id] ?? 0 }))
    .sort((a, b) => b.nights - a.nights);
  let topRevenueName = "—", maxRev = -1;
  for (const p of byProperty) { if (p.revenue > maxRev) { maxRev = p.revenue; topRevenueName = p.name; } }
  return { revenue, nights, bookings, topRevenueName, byProperty };
}

// Trim a listing's marketing name to its short identifier, e.g.
// "Lily's Pad ~ Luxury ~ Lough Shore" / "Ernie's Den - Lakefront…" → "Lily's Pad" / "Ernie's Den".
function shortName(n: string) { return n.split(/ ~ | - | by /)[0].trim(); }

function ranges(period: string, now: Date) {
  if (period === "weekly") {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0
    const thisMon = new Date(d.getTime() - dow * DAY);
    const curEndD = new Date(thisMon.getTime() - DAY);       // last Sun
    const curStartD = new Date(curEndD.getTime() - 6 * DAY); // last Mon
    const ps = new Date(curStartD.getTime() - 364 * DAY), pe = new Date(curEndD.getTime() - 364 * DAY);
    const pps = new Date(curStartD.getTime() - 7 * DAY), ppe = new Date(curEndD.getTime() - 7 * DAY); // previous week
    const f = (x: Date) => x.toISOString().slice(0, 10);
    return { curStart: f(curStartD), curEnd: f(curEndD), prevStart: f(ps), prevEnd: f(pe), ppStart: f(pps), ppEnd: f(ppe), label: `week of ${curStartD.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}` };
  }
  // monthly: previous full month
  const y = now.getUTCFullYear(), m = now.getUTCMonth(); // 0-based, current month
  const cs = new Date(Date.UTC(y, m - 1, 1)), ce = new Date(Date.UTC(y, m, 0));
  const ps = new Date(Date.UTC(y - 1, m - 1, 1)), pe = new Date(Date.UTC(y - 1, m, 0));
  const pcs = new Date(Date.UTC(y, m - 2, 1)), pce = new Date(Date.UTC(y, m - 1, 0)); // previous month
  const f = (x: Date) => x.toISOString().slice(0, 10);
  return { curStart: f(cs), curEnd: f(ce), prevStart: f(ps), prevEnd: f(pe), ppStart: f(pcs), ppEnd: f(pce), label: cs.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) };
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function arrow(p: number) { return p > 0 ? `up ${p}%` : p < 0 ? `down ${Math.abs(p)}%` : "flat"; }

function orinEmail(
  label: string,
  period: string,
  name: string,
  d: {
    revPctYoY: number; revPctPrior: number;
    occCur: number; occYoY: number; occPrior: number;
    nights: number; prevNights: number; bookings: number; prevBookings: number;
    adrPctYoY: number;
    topRevenueName: string; byProperty: { name: string; nights: number; revenue: number }[];
  },
) {
  const pw = period === "weekly" ? "week" : "month";       // "this week" / "this month"
  const prior = period === "weekly" ? "the week before" : "the month before";
  const headline = d.revPctYoY >= 0
    ? `Solid ${label} — revenue ${arrow(d.revPctYoY)} on last year and ${arrow(d.revPctPrior)} on ${prior}.`
    : `${label} came in softer — revenue ${arrow(d.revPctYoY)} on last year (${arrow(d.revPctPrior)} on ${prior}).`;

  const insights: string[] = [];
  const yoyDelta = d.prevNights
    ? ` (${d.nights - d.prevNights >= 0 ? "+" : ""}${d.nights - d.prevNights} nights, ${d.bookings - d.prevBookings >= 0 ? "+" : ""}${d.bookings - d.prevBookings} bookings vs last year)`
    : "";
  insights.push(`Occupancy ran at <b>${d.occCur}%</b> — versus ${d.occYoY}% a year ago and ${d.occPrior}% ${prior}. ${d.nights} nights sold across ${d.bookings} bookings${yoyDelta}.`);
  if (d.adrPctYoY < 0 && d.revPctYoY > 0) insights.push(`Average nightly rate softened (${arrow(d.adrPctYoY)} on last year) but volume more than made up for it — net revenue still ${arrow(d.revPctYoY)}. A healthy trade.`);
  else if (d.adrPctYoY > 0) insights.push(`Average nightly rate firmed (${arrow(d.adrPctYoY)} on last year) — you held price and still sold the nights.`);

  // Top performers — call out the REVENUE leader (the real driver; most-nights ≠
  // most-valuable for cheaper units), then a per-property nights breakdown.
  const withNights = d.byProperty.filter((p) => p.nights > 0);
  if (withNights.length === 1) {
    insights.push(`<b>${shortName(withNights[0].name)}</b> took all ${withNights[0].nights} nights this ${pw}.`);
  } else if (withNights.length > 1) {
    insights.push(`<b>${shortName(d.topRevenueName)}</b> drove the most revenue this ${pw}.`);
    const breakdown = withNights.map((p) => `<b>${shortName(p.name)}</b> ${p.nights}`).join(", ");
    insights.push(`Nights by property — ${breakdown}.`);
  }

  const lis = insights.map((t) => `<li style="margin:0 0 10px;color:#334155;font-size:14px;line-height:1.5">${t}</li>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0f172a;padding:20px 28px;display:flex;align-items:center"><span style="color:#fff;font-size:18px;font-weight:700">Escape&nbsp;Grids</span><span style="color:#f59e0b;font-size:12px;margin-left:10px;letter-spacing:.05em">ORIN UPDATE</span></div>
    <div style="height:4px;background:#f59e0b"></div>
    <div style="padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#94a3b8">${label} · portfolio update</p>
      <h1 style="margin:0 0 16px;font-size:21px;color:#0f172a;line-height:1.3">${headline}</h1>
      <p style="margin:0 0 14px;font-size:14px;color:#475569">Hi ${name.split(/\s+/)[0]}, here's how your properties performed last ${label.includes("week") ? "week" : "month"}.</p>
      <ul style="margin:0;padding-left:18px">${lis}</ul>
      <p style="margin:22px 0 0;font-size:12px;color:#94a3b8">— Orin · Escape Grids' revenue analyst. Figures are relative to keep things simple; full numbers are always in your portal. Manage these updates under Settings.</p>
    </div>
  </div></body></html>`;
}
