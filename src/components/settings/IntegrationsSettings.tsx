import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Key, Link2 } from "lucide-react";

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

export function IntegrationsSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["hostaway_account_id", "hostaway_client_secret"]);
      if (data) {
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
        if (map.hostaway_account_id) setAccountId(map.hostaway_account_id);
        if (map.hostaway_client_secret) setClientSecret(map.hostaway_client_secret);
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
          <Button onClick={handleSave} disabled={saving || loading} size="sm">
            {saving ? "Saving..." : "Save Credentials"}
          </Button>
        </CardContent>
      </Card>

      <IntegrationPlaceholder name="Xero" description="Sync invoices and financial data with Xero." />
      <IntegrationPlaceholder name="Mailchimp" description="Send guest marketing campaigns via Mailchimp." />
      <IntegrationPlaceholder name="PriceLabs" description="Dynamic pricing integration with PriceLabs." />
    </div>
  );
}
