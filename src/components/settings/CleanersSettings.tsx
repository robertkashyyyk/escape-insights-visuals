import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, SprayCan, AlertTriangle, Loader2 } from "lucide-react";

const LOCATION_GROUPS = ["Castle Hume", "Belfast", "Enniskillen", "North Coast", "Portstewart Coast", "Larne", "Kesh", "Other"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Cleaner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  region: string;
  location_groups: string[];
  workload_share: Record<string, number>;
  non_working_days: string[];
  daily_working_hours: number | null;
  rate_per_clean: number | null;
  active: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;
  home_postcode: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
}

type CleanerForm = Omit<Cleaner, "id" | "region">;

const empty: CleanerForm = {
  name: "", phone: "", email: "",
  location_groups: [], workload_share: {},
  non_working_days: [], daily_working_hours: 8, rate_per_clean: 0, active: true,
  notify_email: false, notify_whatsapp: false,
  home_postcode: "", home_latitude: null, home_longitude: null,
};

/** Get sum of workload_share for a group across all cleaners, excluding one cleaner by id */
function getOthersTotal(cleaners: Cleaner[], group: string, excludeId: string | null): number {
  return cleaners.reduce((sum, c) => {
    if (c.id === excludeId) return sum;
    if (!c.location_groups?.includes(group)) return sum;
    return sum + (c.workload_share?.[group] ?? 0);
  }, 0);
}

/** Get breakdown of allocations for a group across all cleaners */
function getGroupBreakdown(cleaners: Cleaner[], group: string, excludeId: string | null): { name: string; pct: number }[] {
  return cleaners
    .filter(c => c.id !== excludeId && c.location_groups?.includes(group) && (c.workload_share?.[group] ?? 0) > 0)
    .map(c => ({ name: c.name, pct: c.workload_share?.[group] ?? 0 }));
}

export function CleanersSettings() {
  const { toast } = useToast();
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cleaner | null>(null);
  const [form, setForm] = useState<CleanerForm>(empty);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null);

  const fetchCleaners = async () => {
    const { data } = await supabase.from("cleaners" as any).select("*").order("name");
    if (data) setCleaners((data as any[]).map(c => ({
      ...c,
      location_groups: c.location_groups || [],
      workload_share: c.workload_share || {},
    })));
    setLoading(false);
  };

  useEffect(() => { fetchCleaners(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setGeocodeResult(null); setOpen(true); };
  const openEdit = (c: Cleaner) => {
    setEditing(c);
    setForm({
      name: c.name, phone: c.phone, email: c.email,
      location_groups: c.location_groups || [],
      workload_share: c.workload_share || {},
      non_working_days: c.non_working_days || [],
      daily_working_hours: c.daily_working_hours,
      rate_per_clean: c.rate_per_clean, active: c.active,
      notify_email: c.notify_email ?? false,
      notify_whatsapp: c.notify_whatsapp ?? false,
      home_postcode: c.home_postcode || "",
      home_latitude: c.home_latitude,
      home_longitude: c.home_longitude,
    });
    setGeocodeResult(c.home_latitude ? "📍 Coordinates loaded" : null);
    setOpen(true);
  };

  const geocodePostcode = async (postcode: string) => {
    if (!postcode.trim()) return;
    setGeocoding(true);
    setGeocodeResult(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postcode.trim())}&country=GB&format=json&addressdetails=1&limit=1`, {
        headers: { "User-Agent": "EscapeGrids/1.0" },
      });
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon, address } = data[0];
        const parts = [address?.town || address?.city || address?.village, address?.county || address?.state].filter(Boolean);
        setForm(f => ({ ...f, home_latitude: parseFloat(lat), home_longitude: parseFloat(lon) }));
        setGeocodeResult(`📍 ${parts.join(", ") || "Location found"}`);
      } else {
        setGeocodeResult("❌ Postcode not found");
      }
    } catch {
      setGeocodeResult("❌ Geocoding failed");
    } finally {
      setGeocoding(false);
    }
  };

  // Compute save-time warnings for under-allocated groups
  const saveWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const g of form.location_groups) {
      const othersTotal = getOthersTotal(cleaners, g, editing?.id ?? null);
      const thisValue = form.workload_share[g] ?? 0;
      const total = othersTotal + thisValue;
      if (total < 100) {
        warnings.push(`${g} is only allocated to ${total}%. Add another cleaner or adjust allocations to reach 100%.`);
      }
    }
    return warnings;
  }, [form.location_groups, form.workload_share, cleaners, editing]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name, phone: form.phone, email: form.email,
      location_groups: form.location_groups,
      workload_share: form.workload_share,
      non_working_days: form.non_working_days,
      daily_working_hours: form.daily_working_hours,
      rate_per_clean: form.rate_per_clean, active: form.active,
      notify_email: form.notify_email,
      notify_whatsapp: form.notify_whatsapp,
      region: form.location_groups[0] || "Other",
      home_postcode: form.home_postcode || null,
      home_latitude: form.home_latitude,
      home_longitude: form.home_longitude,
    };
    if (editing) {
      await (supabase.from("cleaners" as any) as any).update(payload).eq("id", editing.id);
      toast({ title: "Cleaner updated" });
    } else {
      await (supabase.from("cleaners" as any) as any).insert(payload);
      toast({ title: "Cleaner added" });
    }
    setOpen(false);
    fetchCleaners();
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("cleaners" as any) as any).delete().eq("id", id);
    toast({ title: "Cleaner removed" });
    fetchCleaners();
  };

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      non_working_days: f.non_working_days.includes(day)
        ? f.non_working_days.filter(d => d !== day)
        : [...f.non_working_days, day],
    }));
  };

  const toggleLocationGroup = (group: string) => {
    setForm(f => {
      const has = f.location_groups.includes(group);
      const newGroups = has ? f.location_groups.filter(g => g !== group) : [...f.location_groups, group];
      const newShare = { ...f.workload_share };
      if (has) {
        delete newShare[group];
      } else {
        const othersTotal = getOthersTotal(cleaners, group, editing?.id ?? null);
        const remaining = Math.max(0, 100 - othersTotal);
        newShare[group] = remaining;
      }
      return { ...f, location_groups: newGroups, workload_share: newShare };
    });
  };

  const setWorkloadShare = (group: string, value: number) => {
    const othersTotal = getOthersTotal(cleaners, group, editing?.id ?? null);
    const maxAvailable = Math.max(0, 100 - othersTotal);
    const clamped = Math.min(Math.max(0, value), maxAvailable);
    if (value > maxAvailable) {
      toast({
        title: `Maximum available for ${group} is ${maxAvailable}%`,
        description: `Other cleaners account for ${othersTotal}%.`,
        variant: "destructive",
      });
    }
    setForm(f => ({ ...f, workload_share: { ...f.workload_share, [group]: clamped } }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cleaners.length} cleaner{cleaners.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Cleaner</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : cleaners.length === 0 ? (
        <Card className="border-border/30 bg-card/50 p-8 text-center">
          <SprayCan className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No cleaners yet. Add your first cleaner above.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cleaners.map(c => (
            <Card key={c.id} className="border-border/30 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{c.name}</h4>
                  <div className="flex items-center gap-1">
                    <Badge variant={c.active ? "default" : "outline"} className={c.active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs" : "text-xs"}>
                      {c.active ? "Active" : "Inactive"}
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {c.phone && <p>📞 {c.phone}</p>}
                  {c.email && <p>✉️ {c.email}</p>}
                  <p>{c.daily_working_hours ?? 8}h/day · £{c.rate_per_clean}/clean</p>
                  {c.location_groups?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.location_groups.map(g => (
                        <Badge key={g} variant="outline" className="text-[10px] border-primary/30 text-primary px-1.5 py-0">
                          {g}{c.workload_share?.[g] != null ? ` ${c.workload_share[g]}%` : ""}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {c.non_working_days?.length > 0 && <p>🚫 Off: {c.non_working_days.join(", ")}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border/30 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{editing ? "Edit Cleaner" : "Add Cleaner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-secondary/50 border-border/40" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-secondary/50 border-border/40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-secondary/50 border-border/40" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Home Postcode</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.home_postcode || ""}
                  onChange={e => setForm({ ...form, home_postcode: e.target.value })}
                  placeholder="e.g. BT93 1UJ"
                  className="bg-secondary/50 border-border/40 flex-1"
                />
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => geocodePostcode(form.home_postcode || "")}
                  disabled={geocoding || !form.home_postcode?.trim()}
                  className="h-9 text-xs"
                >
                  {geocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Locate"}
                </Button>
              </div>
              {geocodeResult && (
                <p className={`text-[11px] ${geocodeResult.startsWith("📍") ? "text-emerald-400" : "text-red-400"}`}>
                  {geocodeResult}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Daily Working Hours</Label>
                <Input type="number" min={1} max={16} step={0.5} value={form.daily_working_hours ?? 8} onChange={e => setForm({ ...form, daily_working_hours: parseFloat(e.target.value) || 8 })} className="bg-secondary/50 border-border/40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rate per Clean (£)</Label>
                <Input type="number" min={0} value={form.rate_per_clean ?? 0} onChange={e => setForm({ ...form, rate_per_clean: parseFloat(e.target.value) || 0 })} className="bg-secondary/50 border-border/40" />
              </div>
            </div>

            {/* Location Groups multi-select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Location Groups</Label>
              <div className="flex flex-wrap gap-1.5">
                {LOCATION_GROUPS.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleLocationGroup(g)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      form.location_groups.includes(g)
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-secondary/50 text-muted-foreground border border-border/40 hover:bg-secondary"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Workload allocation with breakdown + remaining */}
            {form.location_groups.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Workload Allocation (%)</Label>
                <div className="space-y-3">
                  {form.location_groups.map(g => {
                    const othersTotal = getOthersTotal(cleaners, g, editing?.id ?? null);
                    const remaining = Math.max(0, 100 - othersTotal - (form.workload_share[g] ?? 0));
                    const maxAvailable = Math.max(0, 100 - othersTotal);
                    const breakdown = getGroupBreakdown(cleaners, g, editing?.id ?? null);

                    return (
                      <div key={g} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-36 truncate">{g}</span>
                          <Input
                            type="number" min={0} max={maxAvailable}
                            value={form.workload_share[g] ?? 0}
                            onChange={e => setWorkloadShare(g, parseInt(e.target.value) || 0)}
                            className="bg-secondary/50 border-border/40 w-20 h-8 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        {/* Breakdown of existing allocations */}
                        {breakdown.length > 0 && (
                          <p className="text-[10px] text-muted-foreground pl-[9.5rem]">
                            {breakdown.map(b => `${b.name}: ${b.pct}%`).join(" · ")} · Remaining: {remaining}%
                          </p>
                        )}
                        {/* Helper text for remaining */}
                        {breakdown.length === 0 && (
                          <p className="text-[10px] text-muted-foreground pl-[9.5rem]">
                            {remaining}% remaining for {g}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Non-Working Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      form.non_working_days.includes(d)
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-secondary/50 text-muted-foreground border border-border/40 hover:bg-secondary"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label className="text-xs">Active</Label>
            </div>

            {/* Notification toggles */}
            <div className="space-y-1.5">
              <Label className="text-xs">Notifications</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.notify_email} onCheckedChange={v => setForm({ ...form, notify_email: v })} />
                  <Label className="text-xs text-muted-foreground">📧 Email</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.notify_whatsapp} onCheckedChange={v => setForm({ ...form, notify_whatsapp: v })} />
                  <Label className="text-xs text-muted-foreground">💬 WhatsApp</Label>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Send daily cleaning schedule to this cleaner</p>
            </div>

            {/* Save warnings for under-allocated groups */}
            {saveWarnings.length > 0 && (
              <div className="space-y-2">
                {saveWarnings.map((w, i) => (
                  <Alert key={i} className="border-amber-500/30 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <AlertDescription className="text-xs text-amber-300">{w}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>{editing ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
