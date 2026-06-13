import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Owner-facing booking emails. Branded, and deliberately WITHOUT any £ figures.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { reservation_id, event } = await req.json(); // event: "new" | "cancelled"
    if (!reservation_id) return json({ skipped: "no reservation_id" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: r } = await supabase
      .from("reservations")
      .select("id, guest_name, check_in, check_out, platform, listing_id")
      .eq("id", reservation_id).maybeSingle();
    if (!r) return json({ skipped: "reservation not found" });

    const { data: listing } = await supabase
      .from("listings").select("id, name, owner_id").eq("id", r.listing_id).maybeSingle();
    if (!listing?.owner_id) return json({ skipped: "no owner" });

    const [{ data: owner }, { data: prefs }] = await Promise.all([
      supabase.from("property_owners").select("name, email").eq("id", listing.owner_id).maybeSingle(),
      supabase.from("owner_notification_prefs").select("notify_bookings").eq("owner_id", listing.owner_id).maybeSingle(),
    ]);
    if (!prefs?.notify_bookings) return json({ skipped: "owner not opted in" });
    if (!owner?.email) return json({ skipped: "owner has no email" });

    const firstName = (r.guest_name || "Guest").trim().split(/\s+/)[0];
    const nights = Math.max(1, Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000));
    const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const cancelled = event === "cancelled";

    const subject = cancelled ? `Booking cancelled — ${listing.name}` : `New booking — ${listing.name}`;
    const heading = cancelled ? "A booking has been cancelled" : "You've got a new booking";
    const intro = cancelled
      ? "One of your upcoming bookings has been cancelled."
      : "Good news — a new confirmed booking has just come in for one of your properties.";

    const html = brandedEmail(heading, intro, [
      ["Guest", firstName],
      ["Property", listing.name],
      ["Dates", `${fmt(r.check_in)} → ${fmt(r.check_out)}`],
      ["Nights", String(nights)],
      ["Channel", r.platform || "—"],
    ], cancelled);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ skipped: "no resend key" }, 500);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Escape Grids <updates@escapegrids.com>", to: owner.email, subject, html }),
    });
    const body = await resp.json();
    if (!resp.ok) return json({ error: body }, 500);
    return json({ sent: true, to: owner.email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function brandedEmail(heading: string, intro: string, rows: [string, string][], cancelled: boolean): string {
  const accent = cancelled ? "#ef4444" : "#f59e0b";
  const cells = rows.map(([k, v]) =>
    `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;width:120px">${k}</td><td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600">${v}</td></tr>`
  ).join("");
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0f172a;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700">Escape&nbsp;Grids</span></div>
    <div style="height:4px;background:${accent}"></div>
    <div style="padding:28px">
      <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">${heading}</h1>
      <p style="margin:0 0 18px;font-size:14px;color:#475569">${intro}</p>
      <table style="width:100%;border-collapse:collapse">${cells}</table>
      <p style="margin:22px 0 0;font-size:12px;color:#94a3b8">You're receiving this because booking notifications are on. Manage them in your portal under Settings.</p>
    </div>
  </div></body></html>`;
}
