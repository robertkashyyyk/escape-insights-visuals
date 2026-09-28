import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/listingName";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PoundSterling, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Cleaner = { id: string; name: string; rate_per_clean: number | null };
type Listing = { id: string; name: string; internal_name: string | null };

// Pay rates admin (super/senior). Override chain when a clean is paid:
// cleaner×property → property → cleaner default.
export default function CleanerPayRates() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [propRates, setPropRates] = useState<Record<string, string>>({});   // listing_id -> rate str
  const [overrides, setOverrides] = useState<any[]>([]);
  const [defaults, setDefaults] = useState<Record<string, string>>({});     // cleaner_id -> rate str
  const [saving, setSaving] = useState<string | null>(null);
  const [ovForm, setOvForm] = useState<{ cleaner_id: string; listing_id: string; rate: string }>({ cleaner_id: "", listing_id: "", rate: "" });

  const load = async () => {
    setLoading(true);
    const [cl, li, pr, ov] = await Promise.all([
      supabase.from("cleaners").select("id, name, rate_per_clean").eq("active", true).order("name"),
      supabase.from("listings").select("id, name, internal_name").eq("status", "active").eq("is_bundle", false).order("internal_name"),
      (supabase.from as any)("property_clean_rates").select("listing_id, rate"),
      (supabase.from as any)("cleaner_property_rates").select("cleaner_id, listing_id, rate"),
    ]);
    setCleaners((cl.data ?? []) as any);
    setListings((li.data ?? []) as any);
    const d: Record<string, string> = {};
    for (const c of (cl.data ?? []) as any[]) d[c.id] = c.rate_per_clean != null ? String(c.rate_per_clean) : "";
    setDefaults(d);
    const p: Record<string, string> = {};
    for (const r of (pr.data ?? []) as any[]) p[r.listing_id] = String(r.rate);
    setPropRates(p);
    setOverrides((ov.data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const nameOf = (id: string) => { const l = listings.find((x) => x.id === id); return l ? (displayName(l) || l.name) : id; };
  const cleanerName = (id: string) => cleaners.find((c) => c.id === id)?.name ?? id;

  const saveDefault = async (c: Cleaner) => {
    setSaving(`d:${c.id}`);
    const val = defaults[c.id] === "" ? null : Number(defaults[c.id]);
    const { error } = await (supabase.from("cleaners" as any) as any).update({ rate_per_clean: val }).eq("id", c.id);
    setSaving(null);
    toast({ title: error ? "Save failed" : `Saved ${c.name}`, description: error?.message, variant: error ? "destructive" : undefined });
  };

  const savePropRate = async (listingId: string) => {
    setSaving(`p:${listingId}`);
    const raw = propRates[listingId];
    let error: any = null;
    if (raw === "" || raw == null) {
      ({ error } = await (supabase.from as any)("property_clean_rates").delete().eq("listing_id", listingId));
    } else {
      ({ error } = await (supabase.from as any)("property_clean_rates").upsert({ listing_id: listingId, rate: Number(raw), updated_at: new Date().toISOString() }));
    }
    setSaving(null);
    toast({ title: error ? "Save failed" : "Property rate saved", description: error?.message, variant: error ? "destructive" : undefined });
  };

  const addOverride = async () => {
    if (!ovForm.cleaner_id || !ovForm.listing_id || ovForm.rate === "") return;
    setSaving("ov");
    const { error } = await (supabase.from as any)("cleaner_property_rates")
      .upsert({ cleaner_id: ovForm.cleaner_id, listing_id: ovForm.listing_id, rate: Number(ovForm.rate), updated_at: new Date().toISOString() });
    setSaving(null);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setOvForm({ cleaner_id: "", listing_id: "", rate: "" });
    load();
  };

  const removeOverride = async (o: any) => {
    await (supabase.from as any)("cleaner_property_rates").delete().eq("cleaner_id", o.cleaner_id).eq("listing_id", o.listing_id);
    setOverrides((prev) => prev.filter((x) => !(x.cleaner_id === o.cleaner_id && x.listing_id === o.listing_id)));
  };

  const sortedListings = useMemo(() => [...listings].sort((a, b) => (displayName(a) || a.name).localeCompare(displayName(b) || b.name)), [listings]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><PoundSterling className="h-5 w-5 text-primary" /> Cleaner Pay Rates</h1>
          <p className="text-sm text-muted-foreground">Flat rate per completed clean. Resolution order: cleaner + property override → property rate → cleaner default.</p>
        </div>

        {loading ? <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div> : (
          <>
            {/* Cleaner default rates */}
            <section className="glass-card rounded-xl border border-border/30 p-4">
              <h2 className="text-sm font-semibold mb-3">Cleaner default rate</h2>
              <div className="space-y-2">
                {cleaners.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{c.name}</span>
                    <span className="text-muted-foreground text-sm">£</span>
                    <Input type="number" min="0" step="0.5" className="w-24 h-8" value={defaults[c.id] ?? ""}
                      onChange={(e) => setDefaults((p) => ({ ...p, [c.id]: e.target.value }))} />
                    <Button size="sm" variant="outline" className="h-8" disabled={saving === `d:${c.id}`} onClick={() => saveDefault(c)}>
                      {saving === `d:${c.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            {/* Per-property rate */}
            <section className="glass-card rounded-xl border border-border/30 p-4">
              <h2 className="text-sm font-semibold mb-3">Per-property rate <span className="text-xs font-normal text-muted-foreground">(applies to any cleaner unless overridden)</span></h2>
              <div className="space-y-2 max-h-80 overflow-auto">
                {sortedListings.map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <span className="text-sm flex-1 truncate">{displayName(l) || l.name}</span>
                    <span className="text-muted-foreground text-sm">£</span>
                    <Input type="number" min="0" step="0.5" className="w-24 h-8" value={propRates[l.id] ?? ""}
                      placeholder="—"
                      onChange={(e) => setPropRates((p) => ({ ...p, [l.id]: e.target.value }))} />
                    <Button size="sm" variant="outline" className="h-8" disabled={saving === `p:${l.id}`} onClick={() => savePropRate(l.id)}>
                      {saving === `p:${l.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            {/* Overrides */}
            <section className="glass-card rounded-xl border border-border/30 p-4">
              <h2 className="text-sm font-semibold mb-3">Cleaner + property overrides <span className="text-xs font-normal text-muted-foreground">(most specific)</span></h2>
              <div className="flex items-end gap-2 flex-wrap mb-3">
                <select className="h-8 rounded-md border border-border/40 bg-background text-sm px-2" value={ovForm.cleaner_id} onChange={(e) => setOvForm((f) => ({ ...f, cleaner_id: e.target.value }))}>
                  <option value="">Cleaner…</option>
                  {cleaners.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="h-8 rounded-md border border-border/40 bg-background text-sm px-2 max-w-[180px]" value={ovForm.listing_id} onChange={(e) => setOvForm((f) => ({ ...f, listing_id: e.target.value }))}>
                  <option value="">Property…</option>
                  {sortedListings.map((l) => <option key={l.id} value={l.id}>{displayName(l) || l.name}</option>)}
                </select>
                <div className="inline-flex items-center gap-1"><span className="text-muted-foreground text-sm">£</span>
                  <Input type="number" min="0" step="0.5" className="w-20 h-8" value={ovForm.rate} onChange={(e) => setOvForm((f) => ({ ...f, rate: e.target.value }))} /></div>
                <Button size="sm" className="h-8 gap-1" disabled={saving === "ov" || !ovForm.cleaner_id || !ovForm.listing_id || ovForm.rate === ""} onClick={addOverride}>
                  {saving === "ov" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
                </Button>
              </div>
              <div className="space-y-1.5">
                {overrides.length === 0 ? <p className="text-xs text-muted-foreground/60">No overrides.</p> : overrides.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{cleanerName(o.cleaner_id)} · {nameOf(o.listing_id)}</span>
                    <span className="tabular-nums">£{Number(o.rate).toFixed(0)}</span>
                    <button onClick={() => removeOverride(o)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
