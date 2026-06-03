import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift, Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Season {
  id?: string;
  name: string;
  start_month: number; start_day: number;
  end_month: number; end_day: number;
  spend_threshold: number;
  display_order: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]; // non-leap, days before month
const ord = (m: number, d: number) => MONTH_START[m - 1] + d; // 1..365
const ordLabel = (o: number) => {
  let m = 11;
  for (let i = 0; i < 12; i++) if (o <= MONTH_START[i] + (i === 11 ? 31 : MONTH_START[i + 1] - MONTH_START[i])) { m = i; break; }
  return `${o - MONTH_START[m]} ${MONTHS[m]}`;
};

/** Validates that the seasons tile the 365-day year with no gaps / no overlaps (wrap-around OK). */
function validate(seasons: Season[]) {
  const cover = new Array(366).fill(0);
  for (const s of seasons) {
    const a = ord(s.start_month, s.start_day), b = ord(s.end_month, s.end_day);
    const mark = (from: number, to: number) => { for (let d = from; d <= to; d++) cover[d]++; };
    if (a <= b) mark(a, b); else { mark(a, 365); mark(1, b); }
  }
  const uncovered: number[] = [], doubled: number[] = [];
  for (let d = 1; d <= 365; d++) { if (cover[d] === 0) uncovered.push(d); else if (cover[d] > 1) doubled.push(d); }
  return { ok: !uncovered.length && !doubled.length, uncovered, doubled };
}

export function WelcomeBasketsSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Season[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["seasons_admin"],
    queryFn: async () => ((await (supabase.from as any)("seasons")
      .select("id, name, start_month, start_day, end_month, end_day, spend_threshold, display_order")
      .order("display_order")).data ?? []) as Season[],
  });
  useEffect(() => { if (data) setRows(data.map((d) => ({ ...d, spend_threshold: Number(d.spend_threshold) }))); }, [data]);

  const set = (i: number, patch: Partial<Season>) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setRows((p) => [...p, { name: "New Season", start_month: 1, start_day: 1, end_month: 1, end_day: 1, spend_threshold: 0, display_order: p.length }]);
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));

  const v = validate(rows);

  const saveAll = async () => {
    if (rows.some((r) => !r.name.trim())) { toast({ title: "Every season needs a name", variant: "destructive" }); return; }
    if (!v.ok) { toast({ title: "Seasons must tile the year", description: "Fix the gaps / overlaps highlighted below before saving.", variant: "destructive" }); return; }
    setSaving(true);
    // Replace-all: delete removed, upsert current.
    const existingIds = (data ?? []).map((d) => d.id);
    const keepIds = rows.filter((r) => r.id).map((r) => r.id);
    const toDelete = existingIds.filter((id) => !keepIds.includes(id));
    if (toDelete.length) await (supabase.from as any)("seasons").delete().in("id", toDelete);
    const payload = rows.map((r, i) => ({
      ...(r.id ? { id: r.id } : {}),
      name: r.name.trim(), start_month: r.start_month, start_day: r.start_day,
      end_month: r.end_month, end_day: r.end_day, spend_threshold: r.spend_threshold || 0, display_order: i,
    }));
    const { error } = await (supabase.from as any)("seasons").upsert(payload);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Seasons saved" });
    qc.invalidateQueries({ queryKey: ["seasons_admin"] });
  };

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <Gift className="h-4 w-4 text-primary" /> Welcome Baskets
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Seasons recur every year (month/day). A new booking whose check-in falls in a season and whose
          revenue exceeds that season's threshold auto-creates a welcome-basket setup task. Seasons must tile
          the year with no gaps or overlaps.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Validation banner */}
        {v.ok ? (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
            <CheckCircle2 className="h-4 w-4" /> Seasons tile the year — no gaps or overlaps.
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              {v.uncovered.length > 0 && <div>Uncovered: {v.uncovered.length} day{v.uncovered.length === 1 ? "" : "s"} (e.g. {ordLabel(v.uncovered[0])}{v.uncovered.length > 1 ? `–${ordLabel(v.uncovered[v.uncovered.length - 1])}` : ""}).</div>}
              {v.doubled.length > 0 && <div>Double-covered: {v.doubled.length} day{v.doubled.length === 1 ? "" : "s"} (e.g. {ordLabel(v.doubled[0])}).</div>}
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.id ?? `new-${i}`} className="flex flex-wrap items-end gap-2 rounded-md border border-border/30 bg-secondary/20 p-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Season</Label>
                  <Input value={r.name} onChange={(e) => set(i, { name: e.target.value })} className="h-8 w-32 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">From</Label>
                  <div className="flex gap-1">
                    <Select value={String(r.start_month)} onValueChange={(val) => set(i, { start_month: Number(val) })}>
                      <SelectTrigger className="h-8 w-16 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{MONTHS.map((m, idx) => <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min={1} max={31} value={r.start_day} onChange={(e) => set(i, { start_day: Number(e.target.value) || 1 })} className="h-8 w-14 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">To</Label>
                  <div className="flex gap-1">
                    <Select value={String(r.end_month)} onValueChange={(val) => set(i, { end_month: Number(val) })}>
                      <SelectTrigger className="h-8 w-16 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{MONTHS.map((m, idx) => <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min={1} max={31} value={r.end_day} onChange={(e) => set(i, { end_day: Number(e.target.value) || 1 })} className="h-8 w-14 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Threshold £</Label>
                  <Input type="number" min={0} step="0.01" value={r.spend_threshold} onChange={(e) => set(i, { spend_threshold: Number(e.target.value) || 0 })} className="h-8 w-24 text-xs" />
                </div>
                <button type="button" onClick={() => removeRow(i)} className="h-8 w-8 rounded-md border border-border/30 flex items-center justify-center text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add season</Button>
          <Button size="sm" onClick={saveAll} disabled={saving || !v.ok}>{saving ? "Saving…" : "Save seasons"}</Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Threshold £0 means every new booking in that season creates a welcome basket — set real thresholds to limit it.</p>
      </CardContent>
    </Card>
  );
}
