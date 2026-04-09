import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { User, LogOut } from "lucide-react";

export function AccountSettings() {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated" });
      setNewPassword("");
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <User className="h-4 w-4 text-primary" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={user?.email || ""} disabled className="bg-secondary/50 border-border/40 opacity-70" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className="bg-secondary/50 border-border/40" />
          </div>
          <Button onClick={handlePasswordChange} disabled={saving || !newPassword} size="sm">
            {saving ? "Updating..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/30 bg-card/50 backdrop-blur-sm border-destructive/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Sign Out</p>
            <p className="text-xs text-muted-foreground">End your current session</p>
          </div>
          <Button variant="destructive" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
