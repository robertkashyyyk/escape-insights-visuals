import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Key, Link2, RefreshCw, Clock, Trash2 } from "lucide-react";

function IntegrationPlaceholder({ name, description }: { name: string; description: string }) {
  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur-sm opacity-60">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <Link2 className="h-4 w-4 text-muted-foreground" />
          {name}
          <Badge variant="outline" className="ml-auto text-xs text-muted-foreground border-border/40">Coming Soon</Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button disabled size="sm" variant="outline">Connect {name}</Button>
      </CardContent>
    </Card>
  );
}

const CRON_OPTIONS = [
  { value: "off", label: "Off — Manual only" },
  { value: "1", label: "Every 1 hour" },
  { value: "3", label: "Every 3 hours" },
  { value: "6", label: "Every 6 hours" },
  { value: "12", label: "Every 12 hours" },
  { value: "24", label: "Every 24 hours" },
];

export function IntegrationsSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [cronInterval, setCronInterval] = useState("off");
  const [savingCron, setSavingCron] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["hostaway_account_id", "hostaway_client_secret", "hostaway_sync_interval"]);
      if (data) {
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
        if (map.hostaway_account_id) setAccountId(map.hostaway_account_id);
        if (map.hostaway_client_secret) setClientSecret(map.hostaway_client_secret);
        if (map.hostaway_sync_interval) setCronInterval(map.hostaway_sync_interval);
        if (map.hostaway_account_id && map.hostaway_client_secret) setConnected(true);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await (supabase.from("app_settings") as any).upsert([
      { key: "hostaway_account_id", value: accountId, updated_by: user?.id, updated_at: now },
      { key: "hostaway_client_secret", value: clientSecret, updated_by: user?.id, updated_at: now },
    ], { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      setConnected(true);
      toast({ title: "Hostaway credentials saved" });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    toast({ title: "Sync started", description: "Pulling all reservations and listings from Hostaway. This may take a minute..." });
    try {
      const { data, error } = await supabase.functions.invoke("hostaway-sync", { method: "POST" });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: "Sync complete",
          description: `${data.listings} listings and ${data.reservations} reservations synced.${data.skipped ? ` ${data.skipped} skipped.` : ""}`,
        });
      } else {
        throw new Error(data?.error || "Unknown sync error");
      }
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleCronChange = async (value: string) => {
    setCronInterval(value);
    setSavingCron(true);
    const now = new Date().toISOString();
    const { error } = await (supabase.from("app_settings") as any).upsert([
      { key: "hostaway_sync_interval", value, updated_by: user?.id, updated_at: now },
    ], { onConflict: "key" });
    setSavingCron(false);
    if (error) {
      toast({ title: "Error saving schedule", description: error.message, variant: "destructive" });
    } else {
      toast({ title: value === "off" ? "Auto-sync disabled" : `Auto-sync set to every ${value} hour${value === "1" ? "" : "s"}` });
    }
  };

  const handleResetCredentials = async () => {
    setAccountId("");
    setClientSecret("");
    setConnected(false);
    const now = new Date().toISOString();
    await (supabase.from("app_settings") as any).upsert([
      { key: "hostaway_account_id", value: "", updated_by: user?.id, updated_at: now },
      { key: "hostaway_client_secret", value: "", updated_by: user?.id, updated_at: now },
    ], { onConflict: "key" });
    toast({ title: "Credentials cleared", description: "Enter new credentials and save." });
  };

  return (
    <div className="space-y-4 max-w-xl">
      <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <Key className="h-4 w-4 text-primary" />
            Hostaway API
            {connected && <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Connected</Badge>}
          </CardTitle>
          <CardDescription>Connect your Hostaway account for automatic data sync.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Account ID</Label>
            <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder={loading ? "Loading..." : "Enter Account ID"} disabled={loading} className="bg-secondary/50 border-border/40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Client Secret</Label>
            <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={loading ? "Loading..." : "Enter Client Secret"} disabled={loading} className="bg-secondary/50 border-border/40" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} disabled={saving || loading} size="sm">
              {saving ? "Saving..." : "Save Credentials"}
            </Button>
            {connected && (
              <>
                <Button onClick={handleSync} disabled={syncing} size="sm" variant="outline" className="gap-2">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button onClick={handleResetCredentials} size="sm" variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto-sync schedule */}
      {connected && (
        <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <Clock className="h-4 w-4 text-primary" />
              Auto-Sync Schedule
            </CardTitle>
            <CardDescription>Set how often Hostaway data should automatically sync.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={cronInterval} onValueChange={handleCronChange} disabled={savingCron}>
              <SelectTrigger className="w-64 bg-secondary/50 border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {cronInterval === "off"
                ? "Auto-sync is disabled. Use the Sync Now button for manual syncs."
                : `Hostaway will auto-sync every ${cronInterval} hour${cronInterval === "1" ? "" : "s"}.`}
            </p>
          </CardContent>
        </Card>
      )}

      <IntegrationPlaceholder name="Xero" description="Sync invoices and financial data with Xero." />
      <IntegrationPlaceholder name="Mailchimp" description="Send guest marketing campaigns via Mailchimp." />
      <IntegrationPlaceholder name="PriceLabs" description="Dynamic pricing integration with PriceLabs." />
    </div>
  );
}
