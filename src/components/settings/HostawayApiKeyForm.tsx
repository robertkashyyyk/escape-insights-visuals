import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Key } from "lucide-react";

export function HostawayApiKeyForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("value")
        .eq("key", "hostaway_api_key")
        .maybeSingle();
      if (data) setApiKey((data as any).value);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await (supabase.from("app_settings" as any) as any).upsert(
      { key: "hostaway_api_key", value: apiKey, updated_by: user?.id, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) {
      toast({ title: "Error saving API key", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Hostaway API key saved" });
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-4 w-4 text-primary" />
          Hostaway Integration
        </CardTitle>
        <CardDescription>Enter your Hostaway API key to enable automatic data sync instead of manual CSV uploads.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">API Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={loading ? "Loading..." : "Enter Hostaway API key"}
            disabled={loading}
          />
        </div>
        <Button onClick={handleSave} disabled={saving || loading} size="sm">
          {saving ? "Saving..." : "Save API Key"}
        </Button>
      </CardContent>
    </Card>
  );
}
