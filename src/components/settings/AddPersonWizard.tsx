import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CleanerProfileFields } from "@/components/settings/CleanerProfileFields";
import { UserPlus, Loader2, Copy, KeyRound, Mail, ArrowRight, ArrowLeft } from "lucide-react";

type Role = "super" | "senior" | "admin" | "client" | "cleaner";

const ROLE_OPTIONS: { value: Role; label: string; needsSetup?: "cleaner" | "owner" }[] = [
  { value: "super", label: "Super — full access" },
  { value: "senior", label: "Senior — most functions" },
  { value: "admin", label: "Admin — read-only operational" },
  { value: "client", label: "Client / Owner — Owner Portal", needsSetup: "owner" },
  { value: "cleaner", label: "Cleaner — Cleaner Portal", needsSetup: "cleaner" },
];

function genPassword(): string {
  return crypto.randomUUID().slice(0, 10).replace(/-/g, "") + "A1!";
}

interface Props {
  onDone?: () => void;
}

export function AddPersonWizard({ onDone }: Props) {
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — identity + role
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | "">("");

  // Step 2 — cleaner
  const [locationGroups, setLocationGroups] = useState<string[]>([]);
  const [workloadShare, setWorkloadShare] = useState<Record<string, number>>({});
  const [nonWorkingDays, setNonWorkingDays] = useState<string[]>([]);
  const [dailyHours, setDailyHours] = useState(8);
  const [homePostcode, setHomePostcode] = useState("");
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);

  // Step 2 — owner
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [mgmtRate, setMgmtRate] = useState<number | null>(null);
  const [vatInclusive, setVatInclusive] = useState(false);
  const [ownerNotes, setOwnerNotes] = useState("");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [assignedListingIds, setAssignedListingIds] = useState<string[]>([]);

  // Step 3 — credentials
  const [credentialMode, setCredentialMode] = useState<"invite" | "temp_password">("invite");
  const [tempPassword, setTempPassword] = useState(genPassword());

  const roleMeta = ROLE_OPTIONS.find((r) => r.value === role);
  const needsSetup = roleMeta?.needsSetup;

  // Load properties lazily when the owner branch is reached.
  useEffect(() => {
    if (needsSetup === "owner" && properties.length === 0) {
      (async () => {
        const { data } = await supabase.from("listings").select("id, name").order("name");
        setProperties((data as any) ?? []);
      })();
    }
  }, [needsSetup, properties.length]);

  const reset = () => {
    setStep(1); setName(""); setEmail(""); setRole("");
    setLocationGroups([]); setWorkloadShare({}); setNonWorkingDays([]); setDailyHours(8);
    setHomePostcode(""); setHomeLat(null); setHomeLng(null);
    setCompany(""); setPhone(""); setMgmtRate(null); setVatInclusive(false); setOwnerNotes("");
    setAssignedListingIds([]);
    setCredentialMode("invite"); setTempPassword(genPassword());
  };

  const closeAll = () => { setOpen(false); reset(); };

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const step1Valid = name.trim() && email.trim() && role;
  const goFromStep1 = () => setStep(needsSetup ? 2 : 3);

  const handleCreate = async () => {
    if (!role) return;
    setSubmitting(true);
    try {
      let linkTable: "cleaners" | "property_owners" | undefined;
      let linkId: string | undefined;

      if (needsSetup === "cleaner") {
        const payload = {
          name, email, phone: null,
          location_groups: locationGroups,
          workload_share: workloadShare,
          non_working_days: nonWorkingDays,
          daily_working_hours: dailyHours,
          active: true,
          notify_email: false, notify_whatsapp: false,
          region: locationGroups[0] || "Other",
          home_postcode: homePostcode || null,
          home_latitude: homeLat, home_longitude: homeLng,
          color: null,
        };
        const { data, error } = await (supabase.from("cleaners" as any) as any)
          .insert(payload).select("id").single();
        if (error) throw new Error(`Creating cleaner record failed: ${error.message}`);
        linkTable = "cleaners"; linkId = data.id;
      } else if (needsSetup === "owner") {
        const payload = {
          name, email, phone: phone || null, company: company || null,
          management_rate_pct: mgmtRate, vat_inclusive: vatInclusive, notes: ownerNotes || null,
        };
        const { data, error } = await (supabase.from("property_owners" as any) as any)
          .insert(payload).select("id").single();
        if (error) throw new Error(`Creating owner record failed: ${error.message}`);
        linkTable = "property_owners"; linkId = data.id;
        if (assignedListingIds.length > 0) {
          await (supabase.from("listings" as any) as any)
            .update({ owner_id: data.id }).in("id", assignedListingIds);
        }
      }

      const { data: res, error: fnErr } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create",
          email, name, role,
          linkTable, linkId,
          credential_mode: credentialMode,
          ...(credentialMode === "temp_password" ? { password: tempPassword } : {}),
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (res?.error) throw new Error(res.error);

      const adopted = res?.adopted;
      if (credentialMode === "temp_password") {
        toast({
          title: adopted ? "Existing account linked" : "Person created",
          description: `${name} can sign in with the temporary password (copy it before closing).`,
        });
      } else {
        toast({
          title: adopted ? "Existing account linked" : "Invite sent",
          description: `${email} ${adopted ? "was linked" : "has been emailed an invite"} as ${role}.`,
        });
      }
      onDone?.();
      closeAll();
    } catch (e: any) {
      toast({ title: "Couldn't complete", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Add Person
          </CardTitle>
          <CardDescription>Create a user, set their role and any role-specific setup, then invite them.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Add a person
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) closeAll(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a person</DialogTitle>
            <DialogDescription>
              Step {step} of 3 — {step === 1 ? "who they are" : step === 2 ? `${needsSetup} setup` : "access"}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="bg-secondary/50 border-border/40" />
              </div>
              <div className="space-y-1.5">
                <Label>Email address</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className="bg-secondary/50 border-border/40" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="bg-secondary/50 border-border/40"><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {needsSetup && <p className="text-[11px] text-muted-foreground">Next you'll set up their {needsSetup} details before inviting.</p>}
              </div>
            </div>
          )}

          {step === 2 && needsSetup === "cleaner" && (
            <CleanerProfileFields
              value={{
                location_groups: locationGroups,
                workload_share: workloadShare,
                non_working_days: nonWorkingDays,
                daily_working_hours: dailyHours,
                home_postcode: homePostcode,
                home_latitude: homeLat,
                home_longitude: homeLng,
              }}
              onChange={(patch) => {
                if (patch.location_groups !== undefined) setLocationGroups(patch.location_groups);
                if (patch.workload_share !== undefined) setWorkloadShare(patch.workload_share);
                if (patch.non_working_days !== undefined) setNonWorkingDays(patch.non_working_days);
                if (patch.daily_working_hours !== undefined) setDailyHours(patch.daily_working_hours);
                if (patch.home_postcode !== undefined) setHomePostcode(patch.home_postcode ?? "");
                if (patch.home_latitude !== undefined) setHomeLat(patch.home_latitude);
                if (patch.home_longitude !== undefined) setHomeLng(patch.home_longitude);
              }}
            />
          )}

          {step === 2 && needsSetup === "owner" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Company (optional)</Label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} className="bg-secondary/50 border-border/40" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Phone (optional)</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-secondary/50 border-border/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Management rate (%)</Label>
                  <Input type="number" min={0} max={100} value={mgmtRate ?? ""} onChange={(e) => setMgmtRate(e.target.value === "" ? null : Number(e.target.value))} className="bg-secondary/50 border-border/40" />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch checked={vatInclusive} onCheckedChange={setVatInclusive} />
                  <Label className="text-xs text-muted-foreground">VAT inclusive</Label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assign properties (optional)</Label>
                <div className="max-h-40 overflow-y-auto rounded border border-border/40 p-2 space-y-1">
                  {properties.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No properties loaded.</p>
                  ) : properties.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={assignedListingIds.includes(p.id)}
                        onChange={() => toggle(assignedListingIds, p.id, setAssignedListingIds)} />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Label className="text-xs text-muted-foreground">How should {name || "they"} get access?</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={credentialMode === "invite" ? "default" : "outline"}
                  className="gap-2" onClick={() => setCredentialMode("invite")}>
                  <Mail className="h-4 w-4" /> Email invite
                </Button>
                <Button type="button" variant={credentialMode === "temp_password" ? "default" : "outline"}
                  className="gap-2" onClick={() => setCredentialMode("temp_password")}>
                  <KeyRound className="h-4 w-4" /> Temp password
                </Button>
              </div>
              {credentialMode === "invite" ? (
                <p className="text-xs text-muted-foreground">
                  {email || "They"} will be emailed a link to set their own password. You can resend it later from their row.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Temporary password (share securely)</Label>
                  <div className="flex gap-2">
                    <Input value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className="bg-secondary/50 border-border/40 font-mono" />
                    <Button type="button" variant="outline" onClick={() => navigator.clipboard?.writeText(tempPassword)} title="Copy">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setTempPassword(genPassword())} title="Regenerate">↻</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">They can sign in immediately and change it later.</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(needsSetup ? step - 1 : 1)} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step === 1 && (
              <Button onClick={goFromStep1} disabled={!step1Valid} className="ml-auto">
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)} className="ml-auto">
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleCreate} disabled={submitting} className="ml-auto">
                {submitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating…</> : <>Create {credentialMode === "invite" ? "& invite" : "person"}</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
