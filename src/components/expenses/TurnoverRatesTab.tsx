import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shirt, Package, Plus, Trash2, WashingMachine } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const fmtGbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);

export function TurnoverRatesTab() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Set-rate accruals — a flat £ charge is generated automatically on each turnover (when a clean is
        completed) for covered properties, and rolls onto the owner report. This is separate from the
        actual-cost Consumables / Laundry tabs.
      </p>
      <LaundryRates />
      <ConsumableRates />
      <Accruals />
    </div>
  );
}

// ---------------- Laundry Rates ----------------
function LaundryRates() {
  const qc = useQueryClient();
  const [name, setName] = useState("Laundry");
  const [amount, setAmount] = useState("");
  const [regions, setRegions] = useState<string[]>([]);

  const { data: locationGroups = [] } = useQuery({
    queryKey: ["lc_location_groups"],
    queryFn: async () => {
      const { data } = await supabase.from("location_groups").select("name").eq("archived", false).order("display_order");
      return (data ?? []).map((g: any) => g.name as string);
    },
  });

  const { data: rates = [], refetch } = useQuery({
    queryKey: ["laundry_rates_admin"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("laundry_rates")
        .select("id, name, amount, active, laundry_rate_regions(region)")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // Regions already covered by an active rate (for overlap prevention).
  const coveredRegions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rates) if (r.active) for (const rr of r.laundry_rate_regions ?? []) s.add(rr.region);
    return s;
  }, [rates]);

  const toggleRegion = (region: string) =>
    setRegions((prev) => (prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]));

  const addRate = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (regions.length === 0) { toast.error("Select at least one region"); return; }
    const clash = regions.filter((r) => coveredRegions.has(r));
    if (clash.length) { toast.error(`Already covered by an active rate: ${clash.join(", ")}`); return; }
    const { data, error } = await (supabase.from as any)("laundry_rates")
      .insert({ name: name.trim() || "Laundry", amount: amt }).select("id").single();
    if (error) { toast.error("Could not add rate", { description: error.message }); return; }
    const rows = regions.map((region) => ({ rate_id: data.id, region }));
    const { error: e2 } = await (supabase.from as any)("laundry_rate_regions").insert(rows);
    if (e2) { toast.error("Could not assign regions", { description: e2.message }); return; }
    setName("Laundry"); setAmount(""); setRegions([]);
    refetch(); qc.invalidateQueries({ queryKey: ["laundry_rates_admin"] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await (supabase.from as any)("laundry_rates").update({ active: !active }).eq("id", id);
    refetch();
  };
  const remove = async (id: string) => {
    if (!window.confirm("Delete this laundry rate? Existing accrued charges are kept.")) return;
    await (supabase.from as any)("laundry_rates").delete().eq("id", id);
    refetch();
  };

  return (
    <Card className="border-border/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><WashingMachine className="h-4 w-4 text-primary" /> Laundry Rates (per turnover)</CardTitle>
        <p className="text-xs text-muted-foreground">A flat £/turnover charge for every property in the assigned region(s). One active rate per region.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input className="w-36" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">£ / turnover</Label><Input className="w-28" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
          <Button size="sm" onClick={addRate}><Plus className="h-3.5 w-3.5 mr-1" /> Add rate</Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Assign regions</Label>
          <div className="flex flex-wrap gap-1.5">
            {locationGroups.map((rg) => {
              const sel = regions.includes(rg);
              const covered = coveredRegions.has(rg);
              return (
                <button key={rg} type="button" onClick={() => toggleRegion(rg)} disabled={covered && !sel}
                  className={`px-2 py-1 rounded-md text-xs border transition-colors ${sel ? "bg-primary/15 text-primary border-primary/40" : covered ? "opacity-40 cursor-not-allowed border-border/30" : "bg-secondary/40 border-border/40 hover:bg-secondary"}`}
                  title={covered && !sel ? "Already covered by an active rate" : ""}>
                  {rg}{covered && !sel ? " ✓" : ""}
                </button>
              );
            })}
          </div>
        </div>
        {rates.length > 0 && (
          <div className="divide-y divide-border/20 rounded-md border border-border/30 overflow-hidden">
            {rates.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-secondary/20">
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-sm text-muted-foreground">{fmtGbp(Number(r.amount))}/turnover</span>
                <span className="flex-1 text-xs text-muted-foreground truncate">{(r.laundry_rate_regions ?? []).map((x: any) => x.region).join(", ") || "no regions"}</span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActive(r.id, r.active)}>{r.active ? "Active" : "Inactive"}</Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- Consumable Rates ----------------
function ConsumableRates() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"direct_to_property" | "region" | "communal">("direct_to_property");
  const [listingId, setListingId] = useState("");
  const [region, setRegion] = useState("");
  const [groupId, setGroupId] = useState("");

  const { data: listings = [] } = useQuery({
    queryKey: ["lc_listings"],
    queryFn: async () => (await supabase.from("listings").select("id, name").eq("status", "active").order("name")).data ?? [],
  });
  const { data: regions = [] } = useQuery({
    queryKey: ["lc_location_groups"],
    queryFn: async () => ((await supabase.from("location_groups").select("name").eq("archived", false).order("display_order")).data ?? []).map((g: any) => g.name),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["lc_communal_groups"],
    queryFn: async () => (await (supabase.from as any)("communal_groups").select("id, name").order("name")).data ?? [],
  });
  const { data: rates = [], refetch } = useQuery({
    queryKey: ["consumable_rates_admin"],
    queryFn: async () => (await (supabase.from as any)("consumable_rates")
      .select("id, name, amount, type, active, listing_id, region, communal_group_id, listings(name), communal_groups(name)")
      .order("created_at", { ascending: false })).data ?? [],
  });

  const addRate = async () => {
    const amt = parseFloat(amount);
    if (!name.trim()) { toast.error("Enter a name"); return; }
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    const payload: any = { name: name.trim(), amount: amt, type };
    if (type === "direct_to_property") { if (!listingId) { toast.error("Select a property"); return; } payload.listing_id = listingId; }
    if (type === "region") { if (!region) { toast.error("Select a region"); return; } payload.region = region; }
    if (type === "communal") { if (!groupId) { toast.error("Select a communal group"); return; } payload.communal_group_id = groupId; }
    const { error } = await (supabase.from as any)("consumable_rates").insert(payload);
    if (error) { toast.error("Could not add rate", { description: error.message }); return; }
    setName(""); setAmount(""); setListingId(""); setRegion(""); setGroupId("");
    refetch(); qc.invalidateQueries({ queryKey: ["consumable_rates_admin"] });
  };
  const toggleActive = async (id: string, active: boolean) => { await (supabase.from as any)("consumable_rates").update({ active: !active }).eq("id", id); refetch(); };
  const remove = async (id: string) => { if (!window.confirm("Delete this consumable rate? Existing accrued charges are kept.")) return; await (supabase.from as any)("consumable_rates").delete().eq("id", id); refetch(); };

  const targetLabel = (r: any) =>
    r.type === "direct_to_property" ? (r.listings?.name ?? "property")
    : r.type === "region" ? r.region
    : (r.communal_groups?.name ?? "communal group");

  return (
    <Card className="border-border/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Consumable Rates (per turnover)</CardTitle>
        <p className="text-xs text-muted-foreground">Direct (one property), Region (all in a region), or Communal (split across the group by Communal Share %).</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input className="w-40" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome pack" /></div>
          <div className="space-y-1.5"><Label className="text-xs">£ / turnover</Label><Input className="w-28" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="direct_to_property">Direct to property</SelectItem>
                <SelectItem value="region">Region</SelectItem>
                <SelectItem value="communal">Communal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "direct_to_property" && (
            <div className="space-y-1.5"><Label className="text-xs">Property</Label>
              <Select value={listingId} onValueChange={setListingId}><SelectTrigger className="w-48"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{listings.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
          )}
          {type === "region" && (
            <div className="space-y-1.5"><Label className="text-xs">Region</Label>
              <Select value={region} onValueChange={setRegion}><SelectTrigger className="w-44"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{regions.map((rg: string) => <SelectItem key={rg} value={rg}>{rg}</SelectItem>)}</SelectContent></Select></div>
          )}
          {type === "communal" && (
            <div className="space-y-1.5"><Label className="text-xs">Communal group</Label>
              <Select value={groupId} onValueChange={setGroupId}><SelectTrigger className="w-48"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select></div>
          )}
          <Button size="sm" onClick={addRate}><Plus className="h-3.5 w-3.5 mr-1" /> Add rate</Button>
        </div>
        {rates.length > 0 && (
          <div className="divide-y divide-border/20 rounded-md border border-border/30 overflow-hidden">
            {rates.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-secondary/20">
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-sm text-muted-foreground">{fmtGbp(Number(r.amount))}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border/40 capitalize">{r.type.replace(/_/g, " ")}</span>
                <span className="flex-1 text-xs text-muted-foreground truncate">{targetLabel(r)}</span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActive(r.id, r.active)}>{r.active ? "Active" : "Inactive"}</Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- Accruals (per property) ----------------
function Accruals() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const periodStart = `${month}-01`;
  // first day of next month
  const periodEnd = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    return d;
  }, [month]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["turnover_accruals", month],
    queryFn: async () => {
      const [laundry, consum, listings] = await Promise.all([
        (supabase.from as any)("laundry_charges").select("listing_id, amount").gte("charge_date", periodStart).lt("charge_date", periodEnd),
        (supabase.from as any)("consumable_charges").select("listing_id, amount").gte("charge_date", periodStart).lt("charge_date", periodEnd),
        supabase.from("listings").select("id, name"),
      ]);
      const names = new Map<string, string>((listings.data ?? []).map((l: any) => [l.id, l.name]));
      const map = new Map<string, { name: string; laundry: number; consumables: number }>();
      const ensure = (id: string) => map.get(id) ?? map.set(id, { name: names.get(id) ?? "Unknown", laundry: 0, consumables: 0 }).get(id)!;
      for (const c of (laundry.data ?? []) as any[]) ensure(c.listing_id).laundry += Number(c.amount);
      for (const c of (consum.data ?? []) as any[]) ensure(c.listing_id).consumables += Number(c.amount);
      return Array.from(map.values()).sort((a, b) => (b.laundry + b.consumables) - (a.laundry + a.consumables));
    },
  });

  const totals = rows.reduce((acc, r) => ({ laundry: acc.laundry + r.laundry, consumables: acc.consumables + r.consumables }), { laundry: 0, consumables: 0 });

  return (
    <Card className="border-border/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Shirt className="h-4 w-4 text-primary" /> Accrued charges (per property)</CardTitle>
        <div className="flex items-center gap-2 pt-1">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 h-8" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accrued charges for this period. Charges generate automatically as cleans are completed.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Laundry</TableHead>
                <TableHead className="text-right">Consumables</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{fmtGbp(r.laundry)}</TableCell>
                  <TableCell className="text-right">{fmtGbp(r.consumables)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtGbp(r.laundry + r.consumables)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-border/40">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold">{fmtGbp(totals.laundry)}</TableCell>
                <TableCell className="text-right font-semibold">{fmtGbp(totals.consumables)}</TableCell>
                <TableCell className="text-right font-semibold">{fmtGbp(totals.laundry + totals.consumables)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
