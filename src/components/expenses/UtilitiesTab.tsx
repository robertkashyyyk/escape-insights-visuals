import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plug, Plus, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const fmtGbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const TYPES = ["Electricity", "Gas", "Water", "Internet", "Council Tax", "Oil", "TV Licence", "Other"];

export function UtilitiesTab() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [type, setType] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  // selected listing ids (ordered) + editable pct per id
  const [selected, setSelected] = useState<string[]>([]);
  const [pcts, setPcts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: listings = [] } = useQuery({
    queryKey: ["util_listings"],
    queryFn: async () => (await supabase.from("listings").select("id, name").eq("status", "active").order("name")).data ?? [],
  });
  const nameOf = useMemo(() => new Map<string, string>((listings as any[]).map((l) => [l.id, l.name])), [listings]);

  const { data: entries = [], refetch } = useQuery({
    queryKey: ["utility_expenses"],
    queryFn: async () => (await (supabase.from as any)("utility_expenses")
      .select("id, type, expense_date, value, utility_expense_allocations(id)")
      .order("expense_date", { ascending: false }).limit(50)).data ?? [],
  });

  const evenSplit = (ids: string[]): Record<string, string> => {
    const n = ids.length;
    if (n === 0) return {};
    const share = round3(100 / n);
    const out: Record<string, string> = {};
    ids.forEach((id, i) => { out[id] = String(i === n - 1 ? round3(100 - share * (n - 1)) : share); });
    return out;
  };

  // Toggling a property re-applies the even split (spec: recalculated as properties change).
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setPcts(evenSplit(next));
      return next;
    });
  };

  const total = round3(selected.reduce((s, id) => s + (parseFloat(pcts[id] ?? "") || 0), 0));
  const valid = selected.length > 0 && total === 100;

  const filtered = (listings as any[]).filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  const save = async () => {
    const v = parseFloat(value);
    if (!type.trim()) { toast.error("Enter a type"); return; }
    if (!v || v <= 0) { toast.error("Enter a valid value"); return; }
    if (selected.length === 0) { toast.error("Select at least one property"); return; }
    if (total !== 100) { toast.error(`Attribution must total 100% (currently ${total}%)`); return; }
    setSaving(true);
    const { data: exp, error } = await (supabase.from as any)("utility_expenses")
      .insert({ type: type.trim(), expense_date: date, value: v, notes: notes.trim() || null, created_by: user?.id ?? null })
      .select("id").single();
    if (error) { setSaving(false); toast.error("Could not save", { description: error.message }); return; }
    const rows = selected.map((id) => {
      const pct = parseFloat(pcts[id] ?? "0") || 0;
      return { utility_expense_id: exp.id, listing_id: id, attribution_pct: pct, amount: Math.round(v * pct) / 100, expense_date: date };
    });
    const { error: e2 } = await (supabase.from as any)("utility_expense_allocations").insert(rows);
    setSaving(false);
    if (e2) { toast.error("Could not save allocations", { description: e2.message }); return; }
    toast.success("Utility expense added");
    setType(""); setValue(""); setNotes(""); setSelected([]); setPcts({});
    refetch();
    qc.invalidateQueries({ queryKey: ["owner_cost_categories"] });
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this utility expense and its allocations?")) return;
    await (supabase.from as any)("utility_expenses").delete().eq("id", id);
    refetch();
    qc.invalidateQueries({ queryKey: ["owner_cost_categories"] });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plug className="h-4 w-4 text-primary" /> Add utility expense</CardTitle>
          <p className="text-xs text-muted-foreground">Split across selected properties. Defaults to an even split; edit the % per property (must total 100%).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Input list="util-types" className="w-40" value={type} onChange={(e) => setType(e.target.value)} placeholder="Electricity" />
              <datalist id="util-types">{TYPES.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Date</Label><Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Value (£)</Label><Input type="number" min="0" step="0.01" className="w-28" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5 flex-1 min-w-40"><Label className="text-xs">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" /></div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Property picker */}
            <div className="space-y-1.5">
              <Label className="text-xs">Properties</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-7 h-8 text-xs" />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border/30 divide-y divide-border/20">
                {filtered.map((l: any) => (
                  <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-secondary/30">
                    <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} className="accent-primary" />
                    <span className="truncate">{l.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Allocation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Attribution ({selected.length})</Label>
                {selected.length > 0 && (
                  <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setPcts(evenSplit(selected))}>Even split</button>
                )}
              </div>
              {selected.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No properties selected.</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {selected.map((id) => (
                    <div key={id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{nameOf.get(id)}</span>
                      <Input type="number" min="0" max="100" step="0.001" value={pcts[id] ?? ""} onChange={(e) => setPcts((p) => ({ ...p, [id]: e.target.value }))} className="h-8 w-20 text-right text-xs" />
                      <span className="text-xs text-muted-foreground">%</span>
                      {value && pcts[id] && <span className="text-[10px] text-muted-foreground w-16 text-right">{fmtGbp((parseFloat(value) || 0) * (parseFloat(pcts[id]) || 0) / 100)}</span>}
                    </div>
                  ))}
                  <div className={`text-xs font-medium text-right pt-1 ${valid ? "text-emerald-400" : "text-destructive"}`}>
                    Total: {total}% {!valid && "(must be 100%)"}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving || !valid}><Plus className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Add expense"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/30">
        <CardHeader><CardTitle className="text-base">Recent utility expenses</CardTitle></CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No utility expenses yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">Properties</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {(entries as any[]).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.type}</TableCell>
                    <TableCell>{format(new Date(e.expense_date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right">{fmtGbp(Number(e.value))}</TableCell>
                    <TableCell className="text-right">{e.utility_expense_allocations?.length ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
