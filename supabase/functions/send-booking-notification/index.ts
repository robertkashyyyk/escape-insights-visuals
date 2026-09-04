// Escape Grids — owner booking push notification.
// Called by an AFTER INSERT / AFTER UPDATE trigger on public.reservations
// (see migration). Resolves the owning auth user via listings -> property_owners,
// sends a minimal push to each of that owner's devices, prunes dead endpoints,
// and stamps reservations.notified_at so it never double-fires.
//
// Minimal payload only (property name + dates + booking id). NO guest names or
// contact details — push routes through Google/Apple, keeping this out of
// avoidable GDPR scope.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "?");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Shared-secret gate — the trigger sends x-notify-secret. Once the secret is
    // set the endpoint rejects anything else; before it's set (rollout window) it
    // stays open so nothing breaks between deploying and configuring.
    const SHARED = Deno.env.get("NOTIFY_SHARED_SECRET");
    if (SHARED && req.headers.get("x-notify-secret") !== SHARED) {
      return json({ error: "unauthorized" }, 401);
    }

    const PUB = Deno.env.get("VAPID_PUBLIC_KEY");
    const PRIV = Deno.env.get("VAPID_PRIVATE_KEY");
    const SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@escapeordinarygroup.com";
    if (!PUB || !PRIV) return json({ error: "VAPID keys not set" }, 500);
    webpush.setVapidDetails(SUBJECT, PUB, PRIV);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { reservation_id } = await req.json().catch(() => ({}));
    if (!reservation_id) return json({ skipped: "no reservation_id" });

    // Reservation + its listing (name + owner). Function-level idempotency guard too.
    const { data: r } = await admin.from("reservations")
      .select("id, listing_id, check_in, check_out, status, notified_at, listings:listing_id (name, internal_name, owner_id)")
      .eq("id", reservation_id).maybeSingle();
    if (!r) return json({ skipped: "reservation not found" });
    if (r.status !== "confirmed") return json({ skipped: "not confirmed" });
    if (r.notified_at) return json({ skipped: "already notified" });

    const ownerRecordId = (r as any).listings?.owner_id;
    if (!ownerRecordId) return json({ skipped: "no owner on listing" });
    const { data: owner } = await admin.from("property_owners").select("user_id").eq("id", ownerRecordId).maybeSingle();
    const ownerUserId = owner?.user_id;
    if (!ownerUserId) return json({ skipped: "owner has no linked login" });

    const { data: subs } = await admin.from("push_subscriptions")
      .select("id, endpoint, p256dh, auth").eq("owner_id", ownerUserId);
    if (!subs || subs.length === 0) {
      await admin.from("reservations").update({ notified_at: new Date().toISOString() }).eq("id", r.id);
      return json({ sent: 0, note: "no devices; marked notified" });
    }

    const propName = ((r as any).listings?.internal_name || (r as any).listings?.name || "your property");
    const payload = JSON.stringify({
      title: "New booking",
      body: `${propName} · ${fmt(r.check_in)} – ${fmt(r.check_out)}`,
      url: `/owner/reservations?booking=${r.id}`,
      tag: `booking-${r.id}`,
    });

    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
        await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          // Dead endpoint — drop it.
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }

    // Stamp notified_at so repeated triggers / re-syncs never double-send.
    await admin.from("reservations").update({ notified_at: new Date().toISOString() }).eq("id", r.id);
    return json({ sent, devices: subs.length });
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
