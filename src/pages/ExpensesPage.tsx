import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Receipt, ChevronDown, Plus, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TurnoverRatesTab } from "@/components/expenses/TurnoverRatesTab";
import { UtilitiesTab } from "@/components/expenses/UtilitiesTab";

const fmtGbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);

function uploadReceipt(file: File | null, userId: string): Promise<string | null> {
  if (!file || !userId) return Promise.resolve(null);
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  return supabase.storage.from("expense-receipts").upload(path, file).then(({ error }) => {
    if (error) { toast.error("Receipt upload failed: " + error.message); return null; }
    return path;
  });
}

// ============== CONSUMABLES ==============

function ConsumablesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);

  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplier, setSupplier] = useState("");
  const [value, setValue] = useState("");
  const [payer, setPayer] = useState<"company" | "cleaner">("company");
  const [allocType, setAllocType] = useState<"property" | "region">("property");
  const [selected, setSelected] = useState<string[]>([]);
  const [pcts, setPcts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: listings = [] } = useQuery({
    queryKey: ["expenses_listings"],
    queryFn: async () => {
      const { data } = await supabase.from("listings").select("id, name").eq("status", "active").order("name");
      return data ?? [];
    },
  });

  const { data: locationGroups = [] } = useQuery({
    queryKey: ["expenses_location_groups"],
    queryFn: async () => {
      const { data } = await supabase.from("location_groups").select("id, name").eq("archived", false).order("display_order");
      return data ?? [];
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["consumables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_consumables")
        .select("*, listings:listing_id (name)")
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const summary = useMemo(() => {
    const total = entries.reduce((s, e: any) => s + Number(e.receipt_value), 0);
    const pending = entries.filter((e: any) => e.payer === "cleaner" && !e.reimbursed)
      .reduce((s, e: any) => s + Number(e.receipt_value), 0);
    return { total, pending };
  }, [entries]);

  // Multi-select targets (properties or regions) with even-split-default attribution.
  const targets: { id: string; label: string }[] = allocType === "property"
    ? (listings as any[]).map((l) => ({ id: l.id, label: l.name }))
    : (locationGroups as any[]).map((g) => ({ id: g.name, label: g.name }));
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  const evenSplit = (ids: string[]) => {
    const n = ids.length; if (!n) return {} as Record<string, string>;
    const share = round3(100 / n); const out: Record<string, string> = {};
    ids.forEach((id, i) => { out[id] = String(i === n - 1 ? round3(100 - share * (n - 1)) : share); });
    return out;
  };
  const toggleTarget = (id: string) => setSelected((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    setPcts(evenSplit(next)); return next;
  });
  const allocTotal = round3(selected.reduce((s, id) => s + (parseFloat(pcts[id] ?? "") || 0), 0));
  const allocValid = selected.length > 0 && allocTotal === 100;
  const setAllocMode = (v: "property" | "region") => { setAllocType(v); setSelected([]); setPcts({}); };

  const submit = async () => {
    if (!supplier || !value) { toast.error("Enter supplier and value"); return; }
    if (selected.length === 0) { toast.error(`Select at least one ${allocType}`); return; }
    if (allocTotal !== 100) { toast.error(`Attribution must total 100% (currently ${allocTotal}%)`); return; }
    setSubmitting(true);
    const receipt_path = await uploadReceipt(file, user?.id ?? "");
    const totalVal = Number(value);
    // One expense_consumables row per target, value split by attribution.
    const rows = selected.map((id) => ({
      purchased_by_user_id: user?.id,
      purchased_by_name: user?.email,
      purchase_date: purchaseDate,
      supplier,
      receipt_value: Math.round(totalVal * (parseFloat(pcts[id]) || 0)) / 100,
      payer,
      allocation_type: allocType,
      listing_id: allocType === "property" ? id : null,
      region: allocType === "region" ? id : null,
      notes: notes || null,
      receipt_path,
    }));
    const { error } = await supabase.from("expense_consumables").insert(rows);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(rows.length > 1 ? `Split across ${rows.length} ${allocType === "property" ? "properties" : "regions"}` : "Entry added");
    setSupplier(""); setValue(""); setNotes(""); setFile(null); setSelected([]); setPcts({});
    qc.invalidateQueries({ queryKey: ["consumables"] });
    qc.invalidateQueries({ queryKey: ["owner_cost_categories"] });
  };

  const toggleReimbursed = async (id: string, val: boolean) => {
    const { error } = await supabase.from("expense_consumables").update({
      reimbursed: val,
      reimbursed_at: val ? new Date().toISOString() : null,
    } as any).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["consumables"] });
  };

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Delete consumable entry "${label}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("expense_consumables").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Entry deleted");
    qc.invalidateQueries({ queryKey: ["consumables"] });
    qc.invalidateQueries({ queryKey: ["owner_cost_categories"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Add Consumable Entry</h3>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-0">
              <div><Label>Purchase Date</Label><Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} /></div>
              <div><Label>Supplier / Where</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Tesco" /></div>
              <div><Label>Receipt Value (£)</Label><Input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} /></div>
              <div>
                <Label>Paid By</Label>
                <Select value={payer} onValueChange={(v: any) => setPayer(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="cleaner">Cleaner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Allocation</Label>
                <Select value={allocType} onValueChange={(v: any) => setAllocMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="property">Properties</SelectItem>
                    <SelectItem value="region">Regions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 grid md:grid-cols-2 gap-3">
                <div>
                  <Label>{allocType === "property" ? "Properties" : "Regions"} (multi-select)</Label>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-border/30 divide-y divide-border/20 mt-1">
                    {targets.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/30">
                        <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggleTarget(t.id)} className="accent-primary" />
                        <span className="truncate">{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Attribution ({selected.length})</Label>
                    {selected.length > 0 && <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setPcts(evenSplit(selected))}>Even split</button>}
                  </div>
                  {selected.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">None selected — defaults to an even split.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 mt-1">
                      {selected.map((id) => {
                        const label = targets.find((t) => t.id === id)?.label ?? id;
                        return (
                          <div key={id} className="flex items-center gap-2">
                            <span className="flex-1 text-sm truncate">{label}</span>
                            <Input type="number" min="0" max="100" step="0.001" value={pcts[id] ?? ""} onChange={(e) => setPcts((p) => ({ ...p, [id]: e.target.value }))} className="h-8 w-20 text-right text-xs" />
                            <span className="text-xs text-muted-foreground">%</span>
                            {value && pcts[id] && <span className="text-[10px] text-muted-foreground w-14 text-right">{fmtGbp((Number(value) || 0) * (parseFloat(pcts[id]) || 0) / 100)}</span>}
                          </div>
                        );
                      })}
                      <div className={`text-xs font-medium text-right pt-1 ${allocValid ? "text-emerald-400" : "text-destructive"}`}>Total: {allocTotal}% {!allocValid && "(must be 100%)"}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
              <div className="md:col-span-2">
                <Label>Receipt Photo</Label>
                <Input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={submit} disabled={submitting || !allocValid}>
                  <Upload className="h-4 w-4" /> {submitting ? "Saving…" : "Add Entry"}
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total Spend</div>
          <div className="text-2xl font-bold">{fmtGbp(summary.total)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Pending Reimbursement</div>
          <div className="text-2xl font-bold text-amber-400">{fmtGbp(summary.pending)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Paid By</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Reimbursed</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && entries.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No entries yet.</TableCell></TableRow>}
              {entries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{format(new Date(e.purchase_date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{e.supplier}</TableCell>
                  <TableCell>{fmtGbp(Number(e.receipt_value))}</TableCell>
                  <TableCell><Badge variant={e.payer === "company" ? "secondary" : "outline"}>{e.payer}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {e.allocation_type === "property" ? (e.listings?.name ?? "—") : `Region: ${e.region}`}
                  </TableCell>
                  <TableCell className="text-xs">{e.purchased_by_name ?? "—"}</TableCell>
                  <TableCell>
                    {e.payer === "cleaner" ? (
                      <Button size="sm" variant={e.reimbursed ? "secondary" : "outline"} onClick={() => toggleReimbursed(e.id, !e.reimbursed)}>
                        {e.reimbursed ? "Yes" : "Mark Paid"}
                      </Button>
                    ) : (
                      <Badge variant="secondary">N/A</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(e.id, `${e.supplier} ${fmtGbp(Number(e.receipt_value))}`)} title="Delete entry">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============== LAUNDRY ==============

function LaundryTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [supplier, setSupplier] = useState("Laundry Service");
  const [total, setTotal] = useState("");
  const [markupFixed, setMarkupFixed] = useState("");
  const [markupPct, setMarkupPct] = useState("");
  const [notes, setNotes] = useState("");

  // Fixed fee is added to the invoice first, then the percentage is applied on
  // top — e.g. £1,000 + £0 fixed + 2% = £1,020. The grossed-up figure is what
  // gets apportioned across properties.
  const baseTotal = Number(total) || 0;
  const fixedAdd = Number(markupFixed) || 0;
  const pctAdd = Number(markupPct) || 0;
  const adjustedTotal = Math.round((baseTotal + fixedAdd) * (1 + pctAdd / 100) * 100) / 100;
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Apportioning scope: across all properties (default), or restricted to a
  // hand-picked set of properties or whole regions. Restricting still weights
  // by rooms-let (bookings × bedrooms) within the chosen set.
  const [scope, setScope] = useState<"all" | "property" | "region">("all");
  const [pickListings, setPickListings] = useState<string[]>([]);
  const [pickRegions, setPickRegions] = useState<string[]>([]);

  const { data: scopeListings = [] } = useQuery({
    queryKey: ["laundry_scope_listings"],
    queryFn: async () => {
      const { data } = await supabase.from("listings").select("id, name, location_group").eq("status", "active").order("name");
      return data ?? [];
    },
  });
  const { data: scopeRegions = [] } = useQuery({
    queryKey: ["laundry_scope_regions"],
    queryFn: async () => {
      const { data } = await supabase.from("location_groups").select("name").eq("archived", false).order("display_order");
      return data ?? [];
    },
  });
  const toggleIn = (arr: string[], id: string) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["laundry_bills"],
    queryFn: async () => {
      const { data: b } = await supabase.from("expense_laundry_bills").select("*").order("bill_date", { ascending: false });
      const billIds = (b ?? []).map((x: any) => x.id);
      let allocs: any[] = [];
      if (billIds.length > 0) {
        const { data: a } = await supabase.from("expense_laundry_allocations").select("*").in("bill_id", billIds);
        allocs = a ?? [];
      }
      return (b ?? []).map((bill: any) => ({ ...bill, allocations: allocs.filter(a => a.bill_id === bill.id) }));
    },
  });

  const submit = async () => {
    if (!periodStart || !periodEnd || !total || !billDate) { toast.error("Please fill all required fields"); return; }
    if (periodStart > periodEnd) { toast.error("Start date must be before end date"); return; }
    if (scope === "property" && pickListings.length === 0) { toast.error("Select at least one property"); return; }
    if (scope === "region" && pickRegions.length === 0) { toast.error("Select at least one region"); return; }
    setSubmitting(true);

    // Resolve the set of listing ids the bill is allowed to apportion across.
    let allowedIds: Set<string> | null = null; // null = all properties
    if (scope === "property") {
      allowedIds = new Set(pickListings);
    } else if (scope === "region") {
      allowedIds = new Set((scopeListings as any[]).filter((l) => pickRegions.includes(l.location_group)).map((l) => l.id));
      if (allowedIds.size === 0) { setSubmitting(false); toast.error("No active properties in the selected region(s)"); return; }
    }

    const receipt_path = await uploadReceipt(file, user?.id ?? "");
    const totalNum = adjustedTotal;
    // Keep an audit trail of how the apportioned figure was derived.
    const markupNote = (fixedAdd !== 0 || pctAdd !== 0)
      ? `Invoice £${baseTotal.toFixed(2)}${fixedAdd ? ` + £${fixedAdd.toFixed(2)} fixed` : ""}${pctAdd ? ` + ${pctAdd}%` : ""} = £${totalNum.toFixed(2)} apportioned`
      : null;
    const finalNotes = [notes || null, markupNote].filter(Boolean).join(" · ") || null;

    const { data: bill, error: bErr } = await supabase.from("expense_laundry_bills").insert({
      bill_date: billDate, period_start: periodStart, period_end: periodEnd,
      supplier, total_amount: totalNum, notes: finalNotes, receipt_path,
      created_by: user?.id,
    }).select().single();

    if (bErr || !bill) { setSubmitting(false); toast.error(bErr?.message ?? "Failed to create bill"); return; }

    // Find bookings overlapping period
    const { data: resv } = await supabase
      .from("reservations")
      .select("listing_id, listings:listing_id (name, bedrooms)")
      .lt("check_in", periodEnd)
      .gt("check_out", periodStart)
      .not("status", "in", "(cancelled,canceled,declined,expired,inquiry)");

    const byListing = new Map<string, { name: string; bedrooms: number; bookings: number }>();
    (resv ?? []).forEach((r: any) => {
      if (!r.listing_id) return;
      if (allowedIds && !allowedIds.has(r.listing_id)) return;
      const cur = byListing.get(r.listing_id) ?? { name: r.listings?.name ?? "Unknown", bedrooms: r.listings?.bedrooms ?? 0, bookings: 0 };
      cur.bookings += 1;
      byListing.set(r.listing_id, cur);
    });

    const rows = Array.from(byListing, ([listing_id, v]) => ({
      listing_id, name: v.name, bedrooms: v.bedrooms, bookings: v.bookings,
      rooms_let: v.bookings * (v.bedrooms || 0),
    })).filter(r => r.rooms_let > 0);

    const totalRooms = rows.reduce((s, r) => s + r.rooms_let, 0);

    if (totalRooms === 0) {
      toast.warning("No qualifying bookings found in period — bill saved with no allocations");
    } else {
      const inserts = rows.map(r => {
        const pct = r.rooms_let / totalRooms;
        return {
          bill_id: bill.id, listing_id: r.listing_id, listing_name: r.name,
          bookings_in_period: r.bookings, bedrooms: r.bedrooms, rooms_let: r.rooms_let,
          allocation_pct: Number(pct.toFixed(4)),
          allocated_amount: Number((totalNum * pct).toFixed(2)),
        };
      });
      const { error: aErr } = await supabase.from("expense_laundry_allocations").insert(inserts);
      if (aErr) { toast.error(aErr.message); }
    }

    setSubmitting(false);
    toast.success("Laundry bill uploaded and apportioned");
    setTotal(""); setMarkupFixed(""); setMarkupPct(""); setNotes(""); setFile(null);
    qc.invalidateQueries({ queryKey: ["laundry_bills"] });
  };

  const removeBill = async (bill: any) => {
    if (!window.confirm(`Delete laundry bill "${bill.supplier}" (${fmtGbp(Number(bill.total_amount))})? This also removes its property allocations and cannot be undone.`)) return;
    await supabase.from("expense_laundry_allocations").delete().eq("bill_id", bill.id);
    const { error } = await supabase.from("expense_laundry_bills").delete().eq("id", bill.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Laundry bill deleted");
    qc.invalidateQueries({ queryKey: ["laundry_bills"] });
    qc.invalidateQueries({ queryKey: ["owner_cost_categories"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Upload Laundry Bill</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Bill Date</Label><Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} /></div>
            <div><Label>Supplier</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} /></div>
            <div><Label>Period Start</Label><Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
            <div><Label>Period End</Label><Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div>
            <div><Label>Total Invoice Amount (£)</Label><Input type="number" step="0.01" value={total} onChange={e => setTotal(e.target.value)} /></div>
            <div><Label>Receipt</Label><Input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
            <div><Label>Fixed Fee Addition (£)</Label><Input type="number" step="0.01" placeholder="0.00" value={markupFixed} onChange={e => setMarkupFixed(e.target.value)} /></div>
            <div><Label>Percentage Fee (%)</Label><Input type="number" step="0.01" placeholder="0" value={markupPct} onChange={e => setMarkupPct(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          </div>
          {(fixedAdd !== 0 || pctAdd !== 0) && baseTotal > 0 && (
            <div className="text-xs text-muted-foreground">
              Apportioning <span className="font-semibold text-foreground">{fmtGbp(adjustedTotal)}</span>
              {" "}(£{baseTotal.toFixed(2)}{fixedAdd ? ` + £${fixedAdd.toFixed(2)} fixed` : ""}{pctAdd ? ` + ${pctAdd}%` : ""}) across properties.
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-border/40 p-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Apportion Across</Label>
                <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All properties (with bookings)</SelectItem>
                    <SelectItem value="property">Selected properties</SelectItem>
                    <SelectItem value="region">Selected regions</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Weighted by rooms let (bookings × bedrooms) within the chosen set.
                </p>
              </div>
            </div>
            {scope === "property" && (
              <div>
                <Label>Properties ({pickListings.length})</Label>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border/30 divide-y divide-border/20 mt-1">
                  {(scopeListings as any[]).map((l) => (
                    <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/30">
                      <input type="checkbox" checked={pickListings.includes(l.id)} onChange={() => setPickListings((p) => toggleIn(p, l.id))} className="accent-primary" />
                      <span className="truncate">{l.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {scope === "region" && (
              <div>
                <Label>Regions ({pickRegions.length})</Label>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border/30 divide-y divide-border/20 mt-1">
                  {(scopeRegions as any[]).map((g) => (
                    <label key={g.name} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/30">
                      <input type="checkbox" checked={pickRegions.includes(g.name)} onChange={() => setPickRegions((p) => toggleIn(p, g.name))} className="accent-primary" />
                      <span className="truncate">{g.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button onClick={submit} disabled={submitting}>
            <Upload className="h-4 w-4" /> {submitting ? "Apportioning…" : "Upload & Apportion"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold">Past Bills</h3>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && bills.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No laundry bills uploaded yet.</CardContent></Card>
        )}
        {bills.map((bill: any) => <BillCard key={bill.id} bill={bill} onDelete={() => removeBill(bill)} />)}
      </div>
    </div>
  );
}

function BillCard({ bill, onDelete }: { bill: any; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const allocTotal = (bill.allocations ?? []).reduce((s: number, a: any) => s + Number(a.allocated_amount), 0);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center">
          <CollapsibleTrigger asChild>
            <button className="flex-1 flex items-center justify-between p-4 hover:bg-muted/30 text-left">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{bill.supplier}</span>
                  <Badge variant="secondary">{fmtGbp(Number(bill.total_amount))}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Billed {format(new Date(bill.bill_date), "dd MMM yyyy")} · Period {format(new Date(bill.period_start), "dd MMM")} – {format(new Date(bill.period_end), "dd MMM yyyy")} · {(bill.allocations ?? []).length} properties
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <Button size="icon" variant="ghost" className="h-8 w-8 mr-3 text-muted-foreground hover:text-destructive shrink-0"
            onClick={onDelete} title="Delete bill">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="text-xs text-muted-foreground italic mb-2">
              Rooms Let = Bookings in period × Bedrooms
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Bedrooms</TableHead>
                  <TableHead className="text-right">Rooms Let</TableHead>
                  <TableHead className="text-right">Share %</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Per booking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bill.allocations ?? []).sort((a: any, b: any) => Number(b.allocated_amount) - Number(a.allocated_amount)).map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.listing_name}</TableCell>
                    <TableCell className="text-right">{a.bookings_in_period}</TableCell>
                    <TableCell className="text-right">{a.bedrooms}</TableCell>
                    <TableCell className="text-right">{a.rooms_let}</TableCell>
                    <TableCell className="text-right">{(Number(a.allocation_pct) * 100).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-medium">{fmtGbp(Number(a.allocated_amount))}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {Number(a.bookings_in_period) > 0 ? fmtGbp(Number(a.allocated_amount) / Number(a.bookings_in_period)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="text-right">{fmtGbp(allocTotal)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function ExpensesPage() {
  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Receipt className="h-7 w-7 text-primary" />
            Expenses
          </h1>
          <p className="text-muted-foreground mt-1">Track consumables and apportion laundry bills across properties.</p>
        </div>
        <Tabs defaultValue="consumables">
          <TabsList>
            <TabsTrigger value="consumables">Consumables</TabsTrigger>
            <TabsTrigger value="laundry">Laundry</TabsTrigger>
            <TabsTrigger value="utilities">Utilities</TabsTrigger>
            <TabsTrigger value="rates">Set Rates</TabsTrigger>
          </TabsList>
          <TabsContent value="consumables" className="mt-4"><ConsumablesTab /></TabsContent>
          <TabsContent value="laundry" className="mt-4"><LaundryTab /></TabsContent>
          <TabsContent value="utilities" className="mt-4"><UtilitiesTab /></TabsContent>
          <TabsContent value="rates" className="mt-4"><TurnoverRatesTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
