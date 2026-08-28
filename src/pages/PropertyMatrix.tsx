import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocationGroups } from "@/hooks/useLocationGroups";
import { PropertyBedsEditor } from "@/components/properties/PropertyBedsEditor";
import { displayName } from "@/lib/listingName";
import { PROPERTY_TYPES } from "@/lib/propertyTypes";
import { Search, Save, BedDouble, Loader2 } from "lucide-react";

// ── Column config — add a variable here and it appears in the grid. ────────────
type ColType = "text" | "number" | "select" | "bool";
interface Col { key: string; label: string; type: ColType; group: string; width: number; options?: { value: string; label: string }[] }

const NUM = (key: string, label: string, group: string, width = 84): Col => ({ key, label, type: "number", group, width });
const BOOL = (key: string, label: string, group: string): Col => ({ key, label, type: "bool", group, width: 64 });

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function PropertyMatrix() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: locationGroups = [] } = useLocationGroups();
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, Record<string, any>>>({});
  const [saving, setSaving] = useState(false);
  const [bedsFor, setBedsFor] = useState<{ id: string; name: string } | null>(null);

  const { data: owners = [] } = useQuery({
    queryKey: ["matrix_owners"],
    queryFn: async () => (await supabase.from("property_owners").select("id, name").order("name")).data ?? [],
  });

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["matrix_listings"],
    queryFn: async () => {
      const cols = "id, name, internal_name, owner_id, location_group, property_type, status, is_bundle, bedrooms, bathrooms, kitchens, max_guests, cleaning_fee, cleaning_duration_minutes, nightly_rate, min_rate, base_rate, has_hot_tub, has_ev_charger, pet_friendly, self_check_in, tags";
      const { data } = await supabase.from("listings").select(cols).order("name");
      return (data ?? []) as any[];
    },
  });

  // Beds summary per listing (reuses property_beds + bed_types) for the Beds cell.
  const { data: bedsSummary = {} } = useQuery({
    queryKey: ["matrix_beds_summary"],
    queryFn: async () => {
      const [{ data: beds }, { data: types }] = await Promise.all([
        (supabase.from as any)("property_beds").select("listing_id, quantity, bed_type_id"),
        (supabase.from as any)("bed_types").select("id, name"),
      ]);
      const typeName = new Map<string, string>((types ?? []).map((t: any) => [t.id as string, t.name as string]));
      const byListing: Record<string, Record<string, number>> = {};
      for (const b of beds ?? []) {
        const n = String(typeName.get(b.bed_type_id) ?? "Bed");
        (byListing[b.listing_id] ||= {})[n] = (byListing[b.listing_id]?.[n] ?? 0) + Number(b.quantity ?? 0);
      }
      const out: Record<string, string> = {};
      for (const [lid, m] of Object.entries(byListing)) {
        out[lid] = Object.entries(m).map(([n, q]) => `${q}×${n}`).join(", ");
      }
      return out;
    },
  });

  const ownerOptions = useMemo(() => (owners as any[]).map((o) => ({ value: o.id, label: o.name })), [owners]);
  const regionOptions = useMemo(() => (locationGroups as any[]).map((g) => ({ value: g.name, label: g.name })), [locationGroups]);

  // Editable data columns (pasteable). Name + Beds are rendered specially.
  const dataCols: Col[] = useMemo(() => [
    { key: "owner_id", label: "Owner", type: "select", group: "Basics", width: 150, options: ownerOptions },
    { key: "location_group", label: "Region", type: "select", group: "Basics", width: 130, options: regionOptions },
    { key: "property_type", label: "Type", type: "select", group: "Basics", width: 120, options: PROPERTY_TYPES.map((t) => ({ value: t, label: t })) },
    { key: "status", label: "Status", type: "select", group: "Basics", width: 100, options: [{ value: "active", label: "active" }, { value: "inactive", label: "inactive" }] },
    NUM("bedrooms", "Beds#", "Layout"), NUM("bathrooms", "Baths", "Layout"), NUM("kitchens", "Kitchens", "Layout"), NUM("max_guests", "Guests", "Layout"),
    NUM("cleaning_fee", "Clean £", "Cleaning"), NUM("cleaning_duration_minutes", "Clean min", "Cleaning", 90),
    NUM("nightly_rate", "Nightly", "Rates"), NUM("min_rate", "Min", "Rates"), NUM("base_rate", "Base", "Rates"),
    BOOL("has_hot_tub", "Hot tub", "Amenities"), BOOL("has_ev_charger", "EV", "Amenities"), BOOL("pet_friendly", "Pets", "Amenities"), BOOL("self_check_in", "Self CI", "Amenities"),
    { key: "tags", label: "Tags", type: "text", group: "Other", width: 140 },
  ], [ownerOptions, regionOptions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listings as any[]).filter((l) =>
      (region === "all" || l.location_group === region) &&
      (!q || displayName(l).toLowerCase().includes(q))
    );
  }, [listings, region, search]);

  const getVal = (l: any, key: string) => (edits[l.id]?.[key] !== undefined ? edits[l.id][key] : l[key]);
  const setVal = (id: string, key: string, val: any) =>
    setEdits((p) => ({ ...p, [id]: { ...p[id], [key]: val } }));

  const dirtyCount = useMemo(() => Object.values(edits).reduce((s, m) => s + Object.keys(m).length, 0), [edits]);

  // Coerce a pasted string into the column's typed value (undefined = skip cell).
  const coerce = (col: Col, raw: string): any => {
    const v = raw.trim();
    if (col.type === "number") return v === "" ? null : (isNaN(parseFloat(v)) ? undefined : round2(parseFloat(v)));
    if (col.type === "bool") return /^(y|yes|true|1)$/i.test(v) ? true : /^(n|no|false|0)$/i.test(v) || v === "" ? false : undefined;
    if (col.type === "select") {
      if (v === "") return null;
      const hit = col.options?.find((o) => o.label.toLowerCase() === v.toLowerCase() || o.value.toLowerCase() === v.toLowerCase());
      return hit ? hit.value : undefined; // don't set an unknown owner/region
    }
    return v === "" ? null : v;
  };

  // Paste a TSV block anchored at (rowIdx, colIdx into dataCols).
  const onPaste = (rowIdx: number, colIdx: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return; // single value → normal paste
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    setEdits((prev) => {
      const next = { ...prev };
      lines.forEach((line, r) => {
        line.split("\t").forEach((raw, c) => {
          const l = filtered[rowIdx + r];
          const col = dataCols[colIdx + c];
          if (!l || !col) return;
          const val = coerce(col, raw);
          if (val !== undefined) next[l.id] = { ...next[l.id], [col.key]: val };
        });
      });
      return next;
    });
  };

  // Ctrl/Cmd+D → fill this column down across every filtered row with this cell's value.
  const onKeyDown = (l: any, col: Col, e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const val = getVal(l, col.key);
      setEdits((prev) => {
        const next = { ...prev };
        filtered.forEach((row) => { next[row.id] = { ...next[row.id], [col.key]: val }; });
        return next;
      });
      toast({ title: `Filled ${col.label} down`, description: `${filtered.length} properties` });
    }
  };

  const saveAll = async () => {
    setSaving(true);
    let ok = 0, fail = 0;
    for (const [id, patch] of Object.entries(edits)) {
      if (!Object.keys(patch).length) continue;
      const { error } = await (supabase.from("listings") as any).update(patch).eq("id", id);
      if (error) fail++; else ok++;
    }
    setSaving(false);
    if (fail) toast({ title: "Some rows failed", description: `${ok} saved · ${fail} failed`, variant: "destructive" });
    else toast({ title: "Saved", description: `${ok} propert${ok === 1 ? "y" : "ies"} updated` });
    setEdits({});
    qc.invalidateQueries({ queryKey: ["matrix_listings"] });
  };

  // Merge a current value into a select's options so it always displays.
  const optsFor = (col: Col, current: any) => {
    const opts = col.options ?? [];
    if (current != null && current !== "" && !opts.some((o) => o.value === current))
      return [...opts, { value: String(current), label: String(current) }];
    return opts;
  };

  const isDirty = (id: string, key: string) => edits[id]?.[key] !== undefined;
  const groups = Array.from(new Set(dataCols.map((c) => c.group)));

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Property Matrix</h1>
            <p className="text-sm text-muted-foreground mt-1">Bulk-edit every property. Paste from a spreadsheet, or ⌘/Ctrl+D to fill a column down.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search properties…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {(locationGroups as any[]).map((g) => <SelectItem key={g.name} value={g.name}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} shown</span>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Loading…</div>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-auto max-h-[calc(100vh-230px)]">
            <table className="text-xs border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-card">
                  <th className="sticky left-0 z-30 bg-card border-b border-r border-border/60 px-2 py-1.5 text-left font-semibold min-w-[220px]">Property</th>
                  {groups.map((g) => (
                    <th key={g} colSpan={dataCols.filter((c) => c.group === g).length}
                      className="border-b border-l border-border/60 px-2 py-1 text-left text-[10px] uppercase tracking-wider text-muted-foreground">{g}</th>
                  ))}
                  <th className="border-b border-l border-border/60 px-2 py-1 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Beds</th>
                </tr>
                <tr className="bg-card">
                  <th className="sticky left-0 z-30 bg-card border-b border-r border-border/60 px-2 py-1 text-left text-[10px] text-muted-foreground">name</th>
                  {dataCols.map((c) => (
                    <th key={c.key} style={{ minWidth: c.width }} className="border-b border-border/40 px-2 py-1 text-left text-[10px] text-muted-foreground font-medium">{c.label}</th>
                  ))}
                  <th className="border-b border-border/40 px-2 py-1 text-left text-[10px] text-muted-foreground">setup</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, rowIdx) => (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background border-b border-r border-border/60 px-2 py-1 font-medium truncate max-w-[240px]" title={displayName(l)}>
                      {displayName(l)}{l.is_bundle && <span className="ml-1 text-[9px] text-primary">(bundle)</span>}
                    </td>
                    {dataCols.map((c, colIdx) => {
                      const val = getVal(l, c.key);
                      const dirty = isDirty(l.id, c.key);
                      const cell = "border-b border-border/30 px-1 py-0.5" + (dirty ? " bg-amber-400/10" : "");
                      if (c.type === "bool") return (
                        <td key={c.key} className={cell + " text-center"} onKeyDown={(e) => onKeyDown(l, c, e)} tabIndex={0}>
                          <Switch checked={!!val} onCheckedChange={(v) => setVal(l.id, c.key, v)} />
                        </td>
                      );
                      if (c.type === "select") return (
                        <td key={c.key} className={cell} onKeyDown={(e) => onKeyDown(l, c, e)}>
                          <Select value={val ?? ""} onValueChange={(v) => setVal(l.id, c.key, v)}>
                            <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-1"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {optsFor(c, val).map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                      return (
                        <td key={c.key} className={cell}>
                          <input
                            type={c.type === "number" ? "number" : "text"}
                            value={val ?? ""}
                            onChange={(e) => setVal(l.id, c.key, c.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                            onPaste={(e) => onPaste(rowIdx, colIdx, e)}
                            onKeyDown={(e) => onKeyDown(l, c, e)}
                            style={{ width: c.width }}
                            className="h-7 bg-transparent px-1 rounded outline-none focus:ring-1 focus:ring-primary/50 tabular-nums"
                          />
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-border/30 px-1 py-0.5">
                      <button onClick={() => setBedsFor({ id: l.id, name: displayName(l) })}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground max-w-[200px] truncate" title={bedsSummary[l.id] || "Set beds"}>
                        <BedDouble className="h-3 w-3 shrink-0" />
                        <span className="truncate">{bedsSummary[l.id] || "set beds"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sticky save bar */}
        {dirtyCount > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
            <span className="text-sm">{dirtyCount} change{dirtyCount === 1 ? "" : "s"}</span>
            <Button size="sm" variant="ghost" onClick={() => setEdits({})}>Discard</Button>
            <Button size="sm" onClick={saveAll} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save all
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!bedsFor} onOpenChange={(o) => !o && setBedsFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Beds — {bedsFor?.name}</DialogTitle></DialogHeader>
          {bedsFor && <PropertyBedsEditor listingId={bedsFor.id} />}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
