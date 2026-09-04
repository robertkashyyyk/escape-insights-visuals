import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Share, Bell } from "lucide-react";

// Owner (and later cleaner) push toggle. Uses only theme tokens so it renders
// correctly in dark / brand / light. Permission is requested only on the toggle
// gesture, never on load.
export function PushNotificationToggle() {
  const { state, busy, enable, disable, isIOS } = usePushNotifications();

  const on = state === "subscribed";
  const canToggle = state === "default" || state === "subscribed";

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label className="text-sm flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Push notifications</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Get a push on this device the moment a new booking comes in.</p>
        </div>
        <Switch
          checked={on}
          disabled={busy || !canToggle}
          onCheckedChange={(v) => (v ? enable() : disable())}
        />
      </div>

      {/* State-specific guidance — never a dead toggle. */}
      {state === "loading" && <p className="text-[11px] text-muted-foreground">Checking…</p>}

      {state === "unconfigured" && (
        <p className="text-[11px] text-muted-foreground">Push isn't switched on for the app yet — check back shortly.</p>
      )}

      {state === "unsupported" && (
        <p className="text-[11px] text-muted-foreground">This browser doesn't support push notifications.</p>
      )}

      {state === "ios-needs-install" && (
        <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
          <span className="text-foreground font-medium">To get notifications on iPhone/iPad, add the app to your Home Screen first:</span>
          <span className="mt-1 flex items-center gap-1">tap <Share className="h-3 w-3 inline" /> Share → <span className="text-foreground">Add to Home Screen</span>, then open it from there and turn this on.</span>
        </div>
      )}

      {state === "denied" && (
        <p className="text-[11px] text-destructive/90">
          Notifications are blocked. Your browser won't ask again — turn them on for this app in your device Settings, then reopen the app.
        </p>
      )}

      {state === "subscribed" && (
        <p className="text-[11px] text-muted-foreground">On for this device. You'll get a push for each new booking.</p>
      )}

      {state === "default" && !busy && (
        <p className="text-[11px] text-muted-foreground">Off. Tap the switch to enable on this device.</p>
      )}
    </div>
  );
}
