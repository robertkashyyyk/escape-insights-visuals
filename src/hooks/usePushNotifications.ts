import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Reusable web-push subscription logic (owner now; cleaners later). Ties a device
// subscription to the logged-in auth user. Public VAPID key is a build-time var.
const RAW_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
// Treat an unset key or the build-spec placeholder as "not configured".
const VAPID = RAW_VAPID && RAW_VAPID !== "REPLACE_WITH_VAPID_PUBLIC_KEY" && RAW_VAPID.length > 40 ? RAW_VAPID : undefined;

export type PushState =
  | "loading"
  | "unconfigured"       // no VAPID key baked in yet
  | "unsupported"        // browser has no Push API
  | "ios-needs-install"  // iOS Safari: Push only works once added to Home Screen
  | "denied"             // permission blocked — must change in OS settings
  | "default"            // can be enabled
  | "subscribed";        // active on this device

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!VAPID) return setState("unconfigured");
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (isIOS() && !isStandalone()) return setState("ios-needs-install");
    if (!supported) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    setState(sub && Notification.permission === "granted" ? "subscribed" : "default");
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // MUST be called from a user gesture (the toggle) — never on load.
  const enable = useCallback(async () => {
    if (!VAPID) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "default"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      const j = sub.toJSON() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("default"); return; }
      // One row per device; endpoint is unique so re-subscribing upserts.
      await (supabase.from as any)("push_subscriptions").upsert({
        owner_id: user.id,
        endpoint: sub.endpoint,
        p256dh: j.keys?.p256dh,
        auth: j.keys?.auth,
        user_agent: navigator.userAgent,
        last_used_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      setState("subscribed");
    } catch {
      await refresh();
    } finally { setBusy(false); }
  }, [refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await (supabase.from as any)("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setState("default");
    } finally { setBusy(false); }
  }, []);

  return { state, busy, enable, disable, isIOS: isIOS() };
}
