import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface OwnerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner?: Tables<"property_owners">;
  onSuccess: () => void;
}

const emptyForm = { name: "", company: "", email: "", phone: "", management_rate_pct: "", vat_inclusive: false, notes: "" };

export function OwnerForm({ open, onOpenChange, owner, onSuccess }: OwnerFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEdit = !!owner;

  useEffect(() => {
    if (owner) {
      setForm({
        name: owner.name,
        company: owner.company ?? "",
        email: owner.email ?? "",
        phone: owner.phone ?? "",
        management_rate_pct: owner.management_rate_pct?.toString() ?? "",
        vat_inclusive: (owner as any).vat_inclusive ?? false,
        notes: owner.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [owner, open]);

  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }));

  const effectiveRate = form.management_rate_pct
    ? form.vat_inclusive
      ? (parseFloat(form.management_rate_pct) * 1.2).toFixed(1)
      : parseFloat(form.management_rate_pct).toFixed(1)
    : null;

  const handleSave = async () => {
    if (!form.name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      name: form.name,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      management_rate_pct: form.management_rate_pct ? parseFloat(form.management_rate_pct) : null,
      vat_inclusive: form.vat_inclusive,
      notes: form.notes || null,
    };

    const { error } = isEdit
      ? await supabase.from("property_owners").update(payload).eq("id", owner!.id)
      : await supabase.from("property_owners").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "Error saving owner", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isEdit ? "Owner updated" : "Owner added" });
      onOpenChange(false);
      onSuccess();
    }
  };

  const field = (label: string, key: string, type = "text") => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Owner" : "Add Owner"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          {field("Name *", "name")}
          {field("Company", "company")}
          {field("Email", "email", "email")}
          {field("Phone", "phone", "tel")}
          {field("Management Rate %", "management_rate_pct", "number")}
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 p-3">
            <div>
              <Label className="text-xs font-medium">+ VAT (20%)</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Add 20% VAT on top of the entered rate</p>
            </div>
            <Switch checked={form.vat_inclusive} onCheckedChange={(v) => set("vat_inclusive", v)} />
          </div>
          {effectiveRate && (
            <p className="text-xs text-muted-foreground -mt-2">
              Effective rate: <span className="text-foreground font-medium">{effectiveRate}%</span>
              {form.vat_inclusive && <span className="text-primary ml-1">(incl. VAT)</span>}
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="mt-2">
            {saving ? "Saving..." : isEdit ? "Update Owner" : "Add Owner"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
