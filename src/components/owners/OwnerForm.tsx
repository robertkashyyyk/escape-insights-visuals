import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface OwnerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner?: Tables<"property_owners">;
  onSuccess: () => void;
}

const emptyForm = {
  name: "", company: "", email: "", phone: "", management_rate_pct: "", vat_inclusive: false, notes: "",
  // billing profile
  management_fee_method: "percent_per_property",
  flat_portfolio_fee: "",
  settlement_method: "pay_on_generation",
  weekly_rr_amount: "",
  opening_balance: "",
};

export function OwnerForm({ open, onOpenChange, owner, onSuccess }: OwnerFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEdit = !!owner;

  useEffect(() => {
    if (!owner) { setForm(emptyForm); return; }
    // Fetch the authoritative row — the owners list (useOwnerPerformance) doesn't
    // carry the billing-profile columns, so reading them off `owner` would load
    // defaults and silently overwrite the saved profile on update.
    let active = true;
    (async () => {
      const { data } = await supabase.from("property_owners").select("*").eq("id", owner.id).single();
      if (!active) return;
      const o = (data ?? owner) as any;
      setForm({
        name: o.name ?? "",
        company: o.company ?? "",
        email: o.email ?? "",
        phone: o.phone ?? "",
        management_rate_pct: o.management_rate_pct?.toString() ?? "",
        vat_inclusive: o.vat_inclusive ?? false,
        notes: o.notes ?? "",
        management_fee_method: o.management_fee_method ?? "percent_per_property",
        flat_portfolio_fee: o.flat_portfolio_fee?.toString() ?? "",
        settlement_method: o.settlement_method ?? "pay_on_generation",
        weekly_rr_amount: o.weekly_rr_amount?.toString() ?? "",
        opening_balance: o.opening_balance?.toString() ?? "",
      });
    })();
    return () => { active = false; };
  }, [owner, open]);

  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }));

  const effectiveRate = form.management_rate_pct
    ? form.vat_inclusive
      ? (parseFloat(form.management_rate_pct) * 1.2).toFixed(1)
      : parseFloat(form.management_rate_pct).toFixed(1)
    : null;

  const num = (s: string) => (s !== "" && !Number.isNaN(parseFloat(s)) ? parseFloat(s) : null);

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
      management_rate_pct: num(form.management_rate_pct),
      vat_inclusive: form.vat_inclusive,
      notes: form.notes || null,
      // billing profile — keep the selected method's fields, null the others
      management_fee_method: form.management_fee_method,
      flat_portfolio_fee: form.management_fee_method === "flat_per_portfolio" ? num(form.flat_portfolio_fee) : null,
      settlement_method: form.settlement_method,
      weekly_rr_amount: form.settlement_method === "weekly_draw" ? num(form.weekly_rr_amount) : null,
      opening_balance: num(form.opening_balance) ?? 0,
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
      <SheetContent className="sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2 shrink-0">
          <SheetTitle>{isEdit ? "Edit Owner" : "Add Owner"}</SheetTitle>
        </SheetHeader>

        {/* Scrollable body (fixes the no-scroll drawer bug) */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 grid gap-4">
          {field("Name *", "name")}
          {field("Company", "company")}
          {field("Email", "email", "email")}
          {field("Phone", "phone", "tel")}

          {/* ── Billing profile ───────────────────────────── */}
          <div className="pt-2 border-t border-border/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Billing profile</p>

            {/* Management fee method */}
            <div className="space-y-1.5">
              <Label className="text-xs">Management fee method</Label>
              <Select value={form.management_fee_method} onValueChange={(v) => set("management_fee_method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent_per_property">Percent of revenue (per property)</SelectItem>
                  <SelectItem value="flat_per_property">Flat fee per property</SelectItem>
                  <SelectItem value="flat_per_portfolio">Flat fee for whole portfolio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.management_fee_method === "percent_per_property" && (
              <div className="space-y-3 mt-3">
                {field("Management Rate %", "management_rate_pct", "number")}
                <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 p-3">
                  <div>
                    <Label className="text-xs font-medium">+ VAT (20%)</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Add 20% VAT on top of the entered rate</p>
                  </div>
                  <Switch checked={form.vat_inclusive} onCheckedChange={(v) => set("vat_inclusive", v)} />
                </div>
                {effectiveRate && (
                  <p className="text-xs text-muted-foreground -mt-1">
                    Effective rate: <span className="text-foreground font-medium">{effectiveRate}%</span>
                    {form.vat_inclusive && <span className="text-primary ml-1">(incl. VAT)</span>}
                  </p>
                )}
              </div>
            )}

            {form.management_fee_method === "flat_per_property" && (
              <p className="text-[11px] text-muted-foreground mt-3 rounded-lg border border-border/40 bg-secondary/20 p-3">
                Set each property's fixed fee on its own record (Properties → edit → Management flat fee).
              </p>
            )}

            {form.management_fee_method === "flat_per_portfolio" && (
              <div className="mt-3">{field("Portfolio fee (£ / period)", "flat_portfolio_fee", "number")}</div>
            )}

            {/* Settlement method */}
            <div className="space-y-1.5 mt-4">
              <Label className="text-xs">Settlement method</Label>
              <Select value={form.settlement_method} onValueChange={(v) => set("settlement_method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pay_on_generation">Pay on generation (balance when report runs)</SelectItem>
                  <SelectItem value="weekly_draw">Weekly draw (fixed £ / week)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.settlement_method === "weekly_draw" && (
              <div className="mt-3">{field("Weekly draw amount (£ / week)", "weekly_rr_amount", "number")}</div>
            )}

            <div className="mt-3">
              {field("Opening balance (£)", "opening_balance", "number")}
              <p className="text-[10px] text-muted-foreground mt-1">Carried forward automatically after each finalised period.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-border/40 px-6 py-4">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : isEdit ? "Update Owner" : "Add Owner"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
