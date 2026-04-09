import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, SprayCan } from "lucide-react";

const REGIONS = ["Fermanagh", "North Coast", "Belfast", "Other"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Cleaner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  region: string;
  non_working_days: string[];
  max_cleans_per_day: number | null;
  rate_per_clean: number | null;
  active: boolean;
}

const empty: Omit<Cleaner, "id"> = { name: "", phone: "", email: "", region: "Other", non_working_days: [], max_cleans_per_day: 3, rate_per_clean: 0, active: true };

export function CleanersSettings() {
  const { toast } = useToast();
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cleaner | null>(null);
  const [form, setForm] = useState<Omit<Cleaner, "id">>(empty);

  const fetch = async () => {
    const { data } = await supabase.from("cleaners" as any).select("*").order("name");
    if (data) setCleaners(data as any);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Cleaner) => { setEditing(c); setForm({ name: c.name, phone: c.phone, email: c.email, region: c.region, non_working_days: c.non_working_days || [], max_cleans_per_day: c.max_cleans_per_day, rate_per_clean: c.rate_per_clean, active: c.active }); setOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      await (supabase.from("cleaners" as any) as any).update(form).eq("id", editing.id);
      toast({ title: "Cleaner updated" });
    } else {
      await (supabase.from("cleaners" as any) as any).insert(form);
      toast({ title: "Cleaner added" });
    }
    setOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("cleaners" as any) as any).delete().eq("id", id);
    toast({ title: "Cleaner removed" });
    fetch();
  };

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      non_working_days: f.non_working_days.includes(day) ? f.non_working_days.filter((d) => d !== day) : [...f.non_working_days, day],
    }));
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
          {cleaners.map((c) => (
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
                  <p>📍 {c.region} · Max {c.max_cleans_per_day}/day · £{c.rate_per_clean}/clean</p>
                  {c.non_working_days?.length > 0 && <p>🚫 Off: {c.non_working_days.join(", ")}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border/30">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{editing ? "Edit Cleaner" : "Add Cleaner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-secondary/50 border-border/40" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-secondary/50 border-border/40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-secondary/50 border-border/40" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Region</Label>
                <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                  <SelectTrigger className="bg-secondary/50 border-border/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Cleans / Day</Label>
                <Input type="number" min={1} value={form.max_cleans_per_day ?? 3} onChange={(e) => setForm({ ...form, max_cleans_per_day: parseInt(e.target.value) || 1 })} className="bg-secondary/50 border-border/40" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rate per Clean (£)</Label>
              <Input type="number" min={0} value={form.rate_per_clean ?? 0} onChange={(e) => setForm({ ...form, rate_per_clean: parseFloat(e.target.value) || 0 })} className="bg-secondary/50 border-border/40 w-32" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Non-Working Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
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
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label className="text-xs">Active</Label>
            </div>
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
