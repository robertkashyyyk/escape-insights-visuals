import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CleanerProfileFields, type CleanerProfileValue } from "@/components/settings/CleanerProfileFields";
import { Loader2, Mail, KeyRound, Trash2, Copy, SprayCan, Save } from "lucide-react";

type AppRole = "super" | "senior" | "admin" | "client" | "cleaner";

export interface ManageUser {
  id: string;
  email: string;
  last_sign_in_at: string | null;
  role: AppRole | null;
  display_name: string | null;
  owner_link: { id: string; name: string } | null;
  cleaner_link: { id: string; name: string } | null;
}

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "super", label: "Super" },
  { value: "senior", label: "Senior" },
  { value: "admin", label: "Admin" },
  { value: "client", label: "Client / Owner" },
  { value: "cleaner", label: "Cleaner" },
];

const londonToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const addDaysStr = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
const daySpan = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000) + 1;
const genPassword = () => crypto.randomUUID().slice(0, 10).replace(/-/g, "") + "A1!";

interface Props {
  user: ManageUser | null;
  isSelf: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function ManagePersonSheet({ user, isSelf, onClose, onChanged }: Props) {
  const { toast } = useToast();
  const [role, setRole] = useState<AppRole | "">("");
  const [busy, setBusy] = useState<string | null>(null); // which action is running

  // credentials
  const [tempPw, setTempPw] = useState("");

  // linked cleaner
  const [cleaner, setCleaner] = useState<any | null>(null);
  const [regen, setRegen] = useState<{ ids: string[]; startStr: string; days: number } | null>(null);

  // linked owner
  const [owner, setOwner] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setRole(user?.role ?? "");
    setTempPw(""); setRegen(null); setCleaner(null); setOwner(null); setConfirmDelete(false);
    if (!user) return;
    (async () => {
      if (user.cleaner_link) {
        const { data } = await (supabase.from("cleaners" as any) as any).select("*").eq("id", user.cleaner_link.id).single();
        setCleaner(data);
      }
      if (user.owner_link) {
        const { data } = await (supabase.from("property_owners" as any) as any).select("*").eq("id", user.owner_link.id).single();
        setOwner(data);
      }
    })();
  }, [user]);

  if (!user) return null;

  const call = async (body: any, label: string) => {
    setBusy(label);
    const { data, error } = await supabase.functions.invoke("manage-users", { body });
    setBusy(null);
    if (error || data?.error) {
      toast({ title: "Action failed", description: error?.message || data?.error, variant: "destructive" });
      return null;
    }
    return data ?? {};
  };

  const changeRole = async (next: AppRole) => {
    setRole(next);
    const res = await call({ action: "update_role", user_id: user.id, role: next }, "role");
    if (res) { toast({ title: "Role updated", description: `${user.email} is now ${next}` }); onChanged(); }
  };

  const resendInvite = async () => {
    const res = await call({ action: "resend_invite", user_id: user.id }, "invite");
    if (res) toast({ title: "Invite sent", description: `Emailed ${user.email} a set-password link.` });
  };

  const setPassword = async () => {
    const pw = tempPw || genPassword();
    if (pw.length < 8) { toast({ title: "Too short", description: "Min 8 characters", variant: "destructive" }); return; }
    const res = await call({ action: "reset_password", user_id: user.id, password: pw }, "password");
    if (res) { setTempPw(pw); toast({ title: "Temporary password set", description: "Share it securely — they can sign in now." }); }
  };

  const deleteUser = async () => {
    const res = await call({ action: "delete", user_id: user.id }, "delete");
    if (res) { toast({ title: "User deleted", description: `${user.email}'s login removed. Linked record kept.` }); onChanged(); onClose(); }
  };

  const cleanerValue: CleanerProfileValue | null = cleaner ? {
    location_groups: cleaner.location_groups ?? [],
    workload_share: cleaner.workload_share ?? {},
    non_working_days: cleaner.non_working_days ?? [],
    daily_working_hours: cleaner.daily_working_hours ?? 8,
    rate_per_clean: cleaner.rate_per_clean ?? 0,
    home_postcode: cleaner.home_postcode ?? null,
    home_latitude: cleaner.home_latitude ?? null,
    home_longitude: cleaner.home_longitude ?? null,
  } : null;

  const saveCleaner = async () => {
    if (!cleaner) return;
    setBusy("cleaner");
    const { error } = await (supabase.from("cleaners" as any) as any).update({
      location_groups: cleaner.location_groups ?? [],
      workload_share: cleaner.workload_share ?? {},
      non_working_days: cleaner.non_working_days ?? [],
      daily_working_hours: cleaner.daily_working_hours ?? 8,
      rate_per_clean: cleaner.rate_per_clean ?? 0,
      home_postcode: cleaner.home_postcode ?? null,
      home_latitude: cleaner.home_latitude ?? null,
      home_longitude: cleaner.home_longitude ?? null,
      region: (cleaner.location_groups ?? [])[0] || "Other",
      name: cleaner.name, email: cleaner.email, phone: cleaner.phone ?? null,
    }).eq("id", cleaner.id);
    setBusy(null);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cleaner updated" });
    onChanged();
    // Offer to regenerate their future cleans under the new settings.
    const startStr = addDaysStr(londonToday(), 1);
    const { data } = await (supabase.from("clean_tasks" as any) as any)
      .select("id, scheduled_date, override_assignment")
      .eq("assigned_cleaner_id", cleaner.id)
      .gte("scheduled_date", startStr)
      .not("status", "in", "(completed,cancelled,canceled)");
    const rows = (data || []).filter((r: any) => !r.override_assignment);
    if (rows.length > 0) {
      const maxDate = rows.reduce((m: string, r: any) => (r.scheduled_date > m ? r.scheduled_date : m), startStr);
      setRegen({ ids: rows.map((r: any) => r.id), startStr, days: daySpan(startStr, maxDate) });
    }
  };

  const runRegen = async () => {
    if (!regen) return;
    setBusy("regen");
    const { error } = await (supabase.from("clean_tasks" as any) as any)
      .update({ assigned_cleaner_id: null, status: "unassigned" }).in("id", regen.ids);
    if (!error) {
      await supabase.functions.invoke("generate-daily-cleaning-schedule", { body: { date: regen.startStr, days_ahead: regen.days } });
    }
    setBusy(null); setRegen(null);
    toast({ title: error ? "Regenerate failed" : "Cleans regenerated", description: error?.message || `${regen.ids.length} clean(s) reallocated.`, variant: error ? "destructive" : undefined });
  };

  const saveOwner = async () => {
    if (!owner) return;
    setBusy("owner");
    const { error } = await (supabase.from("property_owners" as any) as any).update({
      name: owner.name, email: owner.email, phone: owner.phone ?? null,
      company: owner.company ?? null, management_rate_pct: owner.management_rate_pct,
      vat_inclusive: owner.vat_inclusive ?? false, notes: owner.notes ?? null,
    }).eq("id", owner.id);
    setBusy(null);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Owner updated" }); onChanged();
  };

  const neverSignedIn = !user.last_sign_in_at;

  return (
    <Sheet open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{user.display_name || user.cleaner_link?.name || user.owner_link?.name || user.email}</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select value={role} onValueChange={(v) => changeRole(v as AppRole)} disabled={busy === "role" || (isSelf && role === "super")}>
              <SelectTrigger className="bg-secondary/50 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            {isSelf && role === "super" && <p className="text-[11px] text-muted-foreground">You can't change your own super role.</p>}
          </div>

          {/* Access / credentials */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Access</Label>
            {neverSignedIn && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Never signed in</Badge>
                <Button variant="outline" size="sm" className="gap-2" onClick={resendInvite} disabled={busy === "invite"}>
                  {busy === "invite" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Resend invite
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Input value={tempPw} onChange={(e) => setTempPw(e.target.value)} placeholder="Set a temporary password" className="bg-secondary/50 border-border/40 font-mono text-sm" />
              <Button variant="outline" size="icon" title="Generate" onClick={() => setTempPw(genPassword())}>↻</Button>
              {tempPw && <Button variant="outline" size="icon" title="Copy" onClick={() => navigator.clipboard?.writeText(tempPw)}><Copy className="h-4 w-4" /></Button>}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={setPassword} disabled={busy === "password"}>
                {busy === "password" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} Set
              </Button>
            </div>
          </div>

          {/* Cleaner editing */}
          {user.cleaner_link && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-1.5"><SprayCan className="h-4 w-4 text-primary" /> Cleaner details</Label>
                {!cleaner ? <p className="text-xs text-muted-foreground">Loading…</p> : cleanerValue && (
                  <>
                    <CleanerProfileFields value={cleanerValue} onChange={(patch) => setCleaner({ ...cleaner, ...patch })} />
                    <Button className="gap-2" onClick={saveCleaner} disabled={busy === "cleaner"}>
                      {busy === "cleaner" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save cleaner details
                    </Button>
                    {regen && (
                      <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-2">
                        <p className="text-xs">Reassign {regen.ids.length} upcoming clean{regen.ids.length === 1 ? "" : "s"} under the new settings?</p>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={runRegen} disabled={busy === "regen"}>
                            {busy === "regen" ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Regenerating…</> : "Regenerate cleans"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRegen(null)} disabled={busy === "regen"}>Keep as-is</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Owner editing */}
          {user.owner_link && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium">Owner details</Label>
                {!owner ? <p className="text-xs text-muted-foreground">Loading…</p> : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Name</Label>
                        <Input value={owner.name ?? ""} onChange={(e) => setOwner({ ...owner, name: e.target.value })} className="bg-secondary/50 border-border/40" /></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Phone</Label>
                        <Input value={owner.phone ?? ""} onChange={(e) => setOwner({ ...owner, phone: e.target.value })} className="bg-secondary/50 border-border/40" /></div>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Company</Label>
                      <Input value={owner.company ?? ""} onChange={(e) => setOwner({ ...owner, company: e.target.value })} className="bg-secondary/50 border-border/40" /></div>
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Management rate (%)</Label>
                        <Input type="number" value={owner.management_rate_pct ?? ""} onChange={(e) => setOwner({ ...owner, management_rate_pct: e.target.value === "" ? null : Number(e.target.value) })} className="bg-secondary/50 border-border/40" /></div>
                      <div className="flex items-center gap-2 pb-2">
                        <Switch checked={!!owner.vat_inclusive} onCheckedChange={(v) => setOwner({ ...owner, vat_inclusive: v })} />
                        <Label className="text-xs text-muted-foreground">VAT inclusive</Label>
                      </div>
                    </div>
                    <Button className="gap-2" onClick={saveOwner} disabled={busy === "owner"}>
                      {busy === "owner" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save owner details
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          <Separator />
          {!confirmDelete ? (
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={isSelf}>
              <Trash2 className="h-4 w-4" /> Delete this user
            </Button>
          ) : (
            <div className="rounded border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs">Delete <span className="font-medium">{user.email}</span>'s login? Their linked record is kept and unlinked.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={deleteUser} disabled={busy === "delete"}>
                  {busy === "delete" ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Deleting…</> : "Delete user"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy === "delete"}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
