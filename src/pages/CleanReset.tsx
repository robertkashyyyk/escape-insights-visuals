import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sparkles, Brush, AlertTriangle, Search, Loader2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { format } from "date-fns";

type CleanState = "clean" | "dirty" | "unknown";

interface Row {
  id: string;
  name: string;
  is_clean: boolean;
  status: string;
  state: CleanState;
  lastCleanAt: string | null;
  nextCheckIn: string | null;
  nextCheckOut: string | null;
  hasScheduledCleanOpen: boolean;
  guestInHouse: boolean;
  sameDayCheckoutToday: boolean;
  sameDayCheckinToday: boolean;
  lastResetAt: string | null;
  lastResetState: string | null;
}

const REASONS = [
  "Initial Day 1 setup",
  "Manual correction",
  "Cleaner completed but forgot to mark complete",
  "Owner/guest usage changed state",
  "Inspection correction",
  "Other",
];

type Filter = "all" | "clean" | "dirty" | "unknown" | "checkout_today" | "checkin_today";

export default function CleanReset() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null | { listings: Row[]; newState: "clean" | "dirty" }>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: listings }, { data: completedTasks }, { data: openTasks }, { data: resv }, { data: resets }] =
        await Promise.all([
          supabase
            .from("listings")
            .select("id,name,is_clean,status")
            .eq("status", "active")
            .order("name"),
          supabase
            .from("clean_tasks")
            .select("listing_id, completed_at")
            .in("status", ["completed", "done"])
            .not("completed_at", "is", null)
            .order("completed_at", { ascending: false }),
          supabase
            .from("clean_tasks")
            .select("listing_id, scheduled_date, status")
            .not("status", "in", "(completed,done,cancelled)")
            .gte("scheduled_date", todayStr),
          supabase
            .from("reservations")
            .select("listing_id, check_in, check_out, status")
            .gte("check_out", todayStr),
          supabase
            .from("clean_state_resets")
            .select("listing_id, reset_at, new_state")
            .order("reset_at", { ascending: false }),
        ]);

      const lastCleanByListing = new Map<string, string>();
      (completedTasks || []).forEach((t: any) => {
        if (!lastCleanByListing.has(t.listing_id)) lastCleanByListing.set(t.listing_id, t.completed_at);
      });

      const openByListing = new Map<string, boolean>();
      (openTasks || []).forEach((t: any) => openByListing.set(t.listing_id, true));

      const nextInByListing = new Map<string, string>();
      const nextOutByListing = new Map<string, string>();
      const inHouseByListing = new Map<string, boolean>();
      (resv || [])
        .filter((r: any) => !["cancelled", "canceled", "declined", "expired", "inquiry"].includes((r.status || "").toLowerCase()))
        .forEach((r: any) => {
          if (r.check_in >= todayStr) {
            const prev = nextInByListing.get(r.listing_id);
            if (!prev || r.check_in < prev) nextInByListing.set(r.listing_id, r.check_in);
          }
          if (r.check_out >= todayStr) {
            const prev = nextOutByListing.get(r.listing_id);
            if (!prev || r.check_out < prev) nextOutByListing.set(r.listing_id, r.check_out);
          }
          if (r.check_in <= todayStr && r.check_out > todayStr) inHouseByListing.set(r.listing_id, true);
        });

      const lastResetByListing = new Map<string, { at: string; state: string }>();
      (resets || []).forEach((r: any) => {
        if (!lastResetByListing.has(r.listing_id)) lastResetByListing.set(r.listing_id, { at: r.reset_at, state: r.new_state });
      });

      const built: Row[] = (listings || []).map((l: any) => {
        const lastCleanAt = lastCleanByListing.get(l.id) || null;
        const lastReset = lastResetByListing.get(l.id) || null;
        const initialized = !!lastCleanAt || !!lastReset;
        const state: CleanState = !initialized ? "unknown" : l.is_clean ? "clean" : "dirty";
        const nextIn = nextInByListing.get(l.id) || null;
        const nextOut = nextOutByListing.get(l.id) || null;
        return {
          id: l.id,
          name: l.name,
          is_clean: !!l.is_clean,
          status: l.status,
          state,
          lastCleanAt,
          nextCheckIn: nextIn,
          nextCheckOut: nextOut,
          hasScheduledCleanOpen: !!openByListing.get(l.id),
          guestInHouse: !!inHouseByListing.get(l.id),
          sameDayCheckoutToday: nextOut === todayStr,
          sameDayCheckinToday: nextIn === todayStr,
          lastResetAt: lastReset?.at || null,
          lastResetState: lastReset?.state || null,
        };
      });
      setRows(built);
    } catch (e: any) {
      toast.error("Failed to load properties", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "clean": return r.state === "clean";
        case "dirty": return r.state === "dirty";
        case "unknown": return r.state === "unknown";
        case "checkout_today": return r.sameDayCheckoutToday;
        case "checkin_today": return r.sameDayCheckinToday;
        default: return true;
      }
    });
  }, [rows, search, filter]);

  const counts = useMemo(() => ({
    total: rows.length,
    clean: rows.filter((r) => r.state === "clean").length,
    dirty: rows.filter((r) => r.state === "dirty").length,
    unknown: rows.filter((r) => r.state === "unknown").length,
  }), [rows]);

  const toggleSel = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAllVisible = () => {
    setSelected((s) => {
      const allSelected = filtered.every((r) => s.has(r.id));
      const n = new Set(s);
      filtered.forEach((r) => allSelected ? n.delete(r.id) : n.add(r.id));
      return n;
    });
  };

  const openSingle = (row: Row, newState: "clean" | "dirty") => {
    setReason(REASONS[0]); setNote("");
    setDialog({ listings: [row], newState });
  };
  const openBulk = (newState: "clean" | "dirty") => {
    const list = rows.filter((r) => selected.has(r.id));
    if (list.length === 0) return;
    setReason(REASONS[0]); setNote("");
    setDialog({ listings: list, newState });
  };

  const submit = async () => {
    if (!dialog || !user) return;
    setSubmitting(true);
    try {
      const { listings, newState } = dialog;
      const audits = listings.map((l) => ({
        listing_id: l.id,
        previous_state: l.state,
        new_state: newState,
        reason,
        note: note || null,
        reset_by: user.id,
      }));
      const { error: insErr } = await supabase.from("clean_state_resets").insert(audits as any);
      if (insErr) throw insErr;

      // Update listings in two grouped updates
      const toClean = listings.filter((l) => newState === "clean").map((l) => l.id);
      const toDirty = listings.filter((l) => newState === "dirty").map((l) => l.id);
      if (toClean.length) {
        const { error } = await supabase.from("listings").update({ is_clean: true } as any).in("id", toClean);
        if (error) throw error;
      }
      if (toDirty.length) {
        const { error } = await supabase.from("listings").update({ is_clean: false } as any).in("id", toDirty);
        if (error) throw error;
      }

      toast.success(`${listings.length} ${listings.length === 1 ? "property" : "properties"} marked ${newState}`);
      setDialog(null);
      setSelected(new Set());
      await load();
    } catch (e: any) {
      toast.error("Reset failed", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const warnings = useMemo(() => {
    if (!dialog) return [] as string[];
    const ws: string[] = [];
    const { listings, newState } = dialog;
    const sameDay = listings.filter((l) => l.sameDayCheckoutToday || l.sameDayCheckinToday);
    if (sameDay.length) ws.push(`${sameDay.length} have a check-in or check-out today.`);
    if (newState === "clean") {
      const open = listings.filter((l) => l.hasScheduledCleanOpen);
      if (open.length) ws.push(`${open.length} have an unresolved scheduled clean. Marking clean will not cancel it.`);
    }
    if (newState === "dirty") {
      const inHouse = listings.filter((l) => l.guestInHouse);
      if (inHouse.length) ws.push(`${inHouse.length} have a guest currently in-house.`);
    }
    return ws;
  }, [dialog]);

  const StatePill = ({ s }: { s: CleanState }) => {
    if (s === "clean") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" />Clean</Badge>;
    if (s === "dirty") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1"><Brush className="h-3 w-3" />Dirty</Badge>;
    return <Badge variant="outline" className="gap-1 text-muted-foreground"><HelpCircle className="h-3 w-3" />Unknown</Badge>;
  };

  const fmt = (d: string | null) => d ? format(new Date(d), "d MMM yyyy") : "—";

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const body = (
    <>
      <div className={embedded ? "space-y-6" : "p-4 md:p-6 lg:p-8 space-y-6"}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Clean State Reset
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Manually initialise or correct the real-world cleaning state of each property. Booking data, cleaning history and future schedules are not modified.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total active</div><div className="text-2xl font-semibold mt-1">{counts.total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Clean</div><div className="text-2xl font-semibold mt-1 text-emerald-400">{counts.clean}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Dirty</div><div className="text-2xl font-semibold mt-1 text-amber-400">{counts.dirty}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Unknown</div><div className="text-2xl font-semibold mt-1">{counts.unknown}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Properties</CardTitle>
            <CardDescription>Use the filters or search to find properties, then mark them Clean or Dirty.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search property name" className="pl-9" />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All properties</SelectItem>
                  <SelectItem value="clean">Clean</SelectItem>
                  <SelectItem value="dirty">Dirty</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="checkout_today">Has checkout today</SelectItem>
                  <SelectItem value="checkin_today">Has check-in today</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                <Button size="sm" variant="outline" disabled={selected.size === 0} onClick={() => openBulk("clean")} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />Mark Clean
                </Button>
                <Button size="sm" variant="outline" disabled={selected.size === 0} onClick={() => openBulk("dirty")} className="gap-1.5">
                  <Brush className="h-4 w-4 text-amber-400" />Mark Dirty
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/40 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Select all visible" />
                    </th>
                    <th className="px-3 py-2 text-left">Property</th>
                    <th className="px-3 py-2 text-left">State</th>
                    <th className="px-3 py-2 text-left">Last clean</th>
                    <th className="px-3 py-2 text-left">Next check-in</th>
                    <th className="px-3 py-2 text-left">Next checkout</th>
                    <th className="px-3 py-2 text-left">Last reset</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">No properties match.</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border/30 hover:bg-secondary/20">
                      <td className="px-3 py-2"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSel(r.id)} /></td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {r.guestInHouse && <Badge variant="outline" className="text-[10px] py-0 h-4">Guest in-house</Badge>}
                          {r.sameDayCheckoutToday && <Badge variant="outline" className="text-[10px] py-0 h-4">Checkout today</Badge>}
                          {r.sameDayCheckinToday && <Badge variant="outline" className="text-[10px] py-0 h-4">Check-in today</Badge>}
                          {r.hasScheduledCleanOpen && <Badge variant="outline" className="text-[10px] py-0 h-4">Open clean</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2"><StatePill s={r.state} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{fmt(r.lastCleanAt)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmt(r.nextCheckIn)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmt(r.nextCheckOut)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.lastResetAt ? `${format(new Date(r.lastResetAt), "d MMM")} · ${r.lastResetState}` : "—"}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openSingle(r, "clean")} className="gap-1 text-emerald-400 hover:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />Clean
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openSingle(r, "dirty")} className="gap-1 text-amber-400 hover:text-amber-300">
                          <Brush className="h-3.5 w-3.5" />Dirty
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialog?.newState === "clean" ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Brush className="h-5 w-5 text-amber-400" />}
              Mark {dialog?.listings.length} {dialog?.listings.length === 1 ? "property" : "properties"} as {dialog?.newState}
            </DialogTitle>
            <DialogDescription>
              This updates the current cleaning state only. Bookings, history and future schedules are not modified.
            </DialogDescription>
          </DialogHeader>

          {dialog && dialog.listings.length <= 8 && (
            <div className="text-xs text-muted-foreground max-h-24 overflow-y-auto border border-border/30 rounded p-2">
              {dialog.listings.map((l) => <div key={l.id}>{l.name} <span className="opacity-60">· {l.state}</span></div>)}
            </div>
          )}
          {dialog && dialog.listings.length > 8 && (
            <div className="text-xs text-muted-foreground">{dialog.listings.length} properties selected.</div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" />Heads up</div>
              {warnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context for the audit log…" rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="gap-1.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm {dialog?.newState === "clean" ? "Mark Clean" : "Mark Dirty"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
