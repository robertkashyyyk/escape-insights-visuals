import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";

export function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !role) return;

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();

    const response = await supabase.functions.invoke("invite-user", {
      body: { email, role },
    });

    setLoading(false);

    if (response.error) {
      toast({
        title: "Invite failed",
        description: response.error.message || "Could not send invite",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Invite sent",
        description: `Invitation sent to ${email} as ${role}`,
      });
      setEmail("");
      setRole("");
    }
  };

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2" style={{ fontFamily: "Outfit, sans-serif" }}>
          <UserPlus className="h-5 w-5 text-primary" />
          Invite User
        </CardTitle>
        <CardDescription>
          Send an email invitation with a pre-assigned role
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-secondary/50 border-border/40"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger className="bg-secondary/50 border-border/40">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super">Super — Full access</SelectItem>
                <SelectItem value="senior">Senior — Most functions</SelectItem>
                <SelectItem value="admin">Admin — Limited access</SelectItem>
                <SelectItem value="client">Client — View own data only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={loading || !email || !role} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Send Invitation
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
