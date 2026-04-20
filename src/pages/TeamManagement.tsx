import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { InviteUserForm } from "@/components/settings/InviteUserForm";
import { Loader2, Trash2, Users, Search, RefreshCw, ShieldCheck, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";

type AppRole = "super" | "senior" | "admin" | "client" | "cleaner";

interface ManagedUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: AppRole | null;
  display_name: string | null;
  avatar_url: string | null;
  owner_link: { id: string; name: string } | null;
  cleaner_link: { id: string; name: string } | null;
}

const ROLE_BADGE: Record<AppRole, { label: string; className: string }> = {
  super: { label: "Super", className: "bg-primary/15 text-primary border-primary/30" },
  senior: { label: "Senior", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  admin: { label: "Admin", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  client: { label: "Owner", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cleaner: { label: "Cleaner", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

export default function TeamManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setResetting(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "reset_password", user_id: resetTarget.id, password: newPassword },
    });
    setResetting(false);
    if (error || data?.error) {
      toast({ title: "Reset failed", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Password reset", description: `${resetTarget.email} can now sign in with the new password` });
    setResetTarget(null);
    setNewPassword("");
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "list" },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({
        title: "Failed to load users",
        description: error?.message || data?.error,
        variant: "destructive",
      });
      return;
    }
    setUsers(data.users ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleRoleChange = async (target: ManagedUser, newRole: AppRole) => {
    if (target.role === newRole) return;
    setUpdatingId(target.id);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "update_role", user_id: target.id, role: newRole },
    });
    setUpdatingId(null);
    if (error || data?.error) {
      toast({
        title: "Update failed",
        description: error?.message || data?.error,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Role updated", description: `${target.email} is now ${newRole}` });
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, role: newRole } : u))
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setUpdatingId(target.id);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "delete", user_id: target.id },
    });
    setUpdatingId(null);
    if (error || data?.error) {
      toast({
        title: "Delete failed",
        description: error?.message || data?.error,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "User deleted", description: target.email });
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (q && !`${u.email} ${u.display_name ?? ""}`.toLowerCase().includes(q)) return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2
              className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              <Users className="h-6 w-6 text-primary" />
              Team & Users
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage who has access and what they can see
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  All users ({filtered.length})
                </CardTitle>
                <CardDescription>
                  Change a role to instantly update what that user can access.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search email or name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 bg-secondary/50 border-border/40"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[160px] bg-secondary/50 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="super">Super</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="client">Owner</SelectItem>
                      <SelectItem value="cleaner">Cleaner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="rounded-md border border-border/30 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Linked record</TableHead>
                          <TableHead>Last sign-in</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No users found
                            </TableCell>
                          </TableRow>
                        )}
                        {filtered.map((u) => {
                          const isSelf = u.id === user?.id;
                          const linked = u.owner_link
                            ? { type: "Owner", name: u.owner_link.name }
                            : u.cleaner_link
                            ? { type: "Cleaner", name: u.cleaner_link.name }
                            : null;
                          return (
                            <TableRow key={u.id}>
                              <TableCell>
                                <div className="font-medium text-foreground text-sm">
                                  {u.display_name || u.email}
                                  {isSelf && (
                                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {u.role && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] uppercase tracking-wide ${ROLE_BADGE[u.role].className}`}
                                    >
                                      {ROLE_BADGE[u.role].label}
                                    </Badge>
                                  )}
                                  <Select
                                    value={u.role ?? ""}
                                    onValueChange={(v) => handleRoleChange(u, v as AppRole)}
                                    disabled={updatingId === u.id || (isSelf && u.role === "super")}
                                  >
                                    <SelectTrigger className="h-7 w-[110px] text-xs bg-secondary/50 border-border/40">
                                      <SelectValue placeholder="Set role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="super">Super</SelectItem>
                                      <SelectItem value="senior">Senior</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="client">Owner</SelectItem>
                                      <SelectItem value="cleaner">Cleaner</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {linked ? (
                                  <div>
                                    <div className="text-xs text-muted-foreground">{linked.type}</div>
                                    <div className="text-foreground">{linked.name}</div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {u.last_sign_in_at
                                  ? formatDistanceToNow(new Date(u.last_sign_in_at), {
                                      addSuffix: true,
                                    })
                                  : "Never"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    disabled={updatingId === u.id}
                                    onClick={() => { setResetTarget(u); setNewPassword(""); }}
                                    title="Reset password"
                                  >
                                    <KeyRound className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    disabled={isSelf || updatingId === u.id}
                                    onClick={() => setDeleteTarget(u)}
                                    title="Delete user"
                                  >
                                    {updatingId === u.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/30 bg-card/30 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Role permissions</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1.5">
                <p><span className="text-foreground font-medium">Super</span> — full access including this team page and all settings</p>
                <p><span className="text-foreground font-medium">Senior</span> — operations, revenue, owners, properties (no team management)</p>
                <p><span className="text-foreground font-medium">Admin</span> — read-only operational data</p>
                <p><span className="text-foreground font-medium">Owner (client)</span> — Owner Portal only — sees own portfolio, reservations, statements</p>
                <p><span className="text-foreground font-medium">Cleaner</span> — Cleaner Portal only — sees own assigned tasks</p>
              </CardContent>
            </Card>
          </div>

          <div>
            <InviteUserForm onInvited={load} />
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="text-foreground font-medium">{deleteTarget?.email}</span>'s
              login. They will lose all access immediately. Linked owner/cleaner records will be unlinked but kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Reset password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <span className="text-foreground font-medium">{resetTarget?.email}</span>.
              They'll be able to sign in immediately with this password. Share it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs text-muted-foreground">New password (min 8 characters)</Label>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              autoFocus
              className="bg-secondary/50 border-border/40 font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setNewPassword(""); }}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 8}>
              {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Set password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
