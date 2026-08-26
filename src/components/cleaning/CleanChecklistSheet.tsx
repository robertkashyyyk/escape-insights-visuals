import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, ConciergeBell, SprayCan, Wrench, ListChecks } from "lucide-react";

export interface ChecklistItem {
  id: string;
  category: "request" | "consumable" | "equipment";
  room_type: string | null;
  room_index: number | null;
  label: string;
  checked: boolean;
  checked_at: string | null;
  check_all: boolean;
  photo_url: string | null;
}

interface Props {
  task: { id: string; listing_id: string; property_name: string } | null;
  requestLabels: string[];   // guest requests (High Chair / Cot …) for the arriving guest
  userId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

const roomTitle = (type: string, index: number, count: number) =>
  count > 1 ? `${type === "kitchen" ? "Kitchen" : "Bathroom"} ${index}` : (type === "kitchen" ? "Kitchen" : "Bathroom");

export function CleanChecklistSheet({ task, requestLabels, userId, onClose, onChanged }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Already materialised?
      const { data: existing } = await supabase
        .from("clean_checklist_items").select("*").eq("clean_task_id", task.id);
      if (cancelled) return;
      if (existing && existing.length) { setItems(existing as any); setLoading(false); return; }

      // Build the expected set from config.
      const [listingRes, consRes, equipRes] = await Promise.all([
        supabase.from("listings").select("kitchens, bathrooms").eq("id", task.listing_id).single(),
        (supabase.from as any)("consumables").select("id, name, room_type, display_order").is("listing_id", null).eq("active", true).order("display_order"),
        (supabase.from as any)("property_equipment").select("id, name").eq("listing_id", task.listing_id).eq("active", true).order("name"),
      ]);
      if (cancelled) return;
      const kitchens = Math.max(1, (listingRes.data as any)?.kitchens ?? 1);
      const bathrooms = Math.max(1, (listingRes.data as any)?.bathrooms ?? 1);
      const cons = (consRes.data ?? []) as any[];
      const kitchenItems = cons.filter((c) => c.room_type === "kitchen");
      const bathItems = cons.filter((c) => c.room_type === "bathroom");

      const rows: any[] = [];
      for (const label of requestLabels) rows.push({ clean_task_id: task.id, category: "request", label });
      for (let k = 1; k <= kitchens; k++) for (const c of kitchenItems) rows.push({ clean_task_id: task.id, category: "consumable", room_type: "kitchen", room_index: k, label: c.name, ref_id: c.id });
      for (let b = 1; b <= bathrooms; b++) for (const c of bathItems) rows.push({ clean_task_id: task.id, category: "consumable", room_type: "bathroom", room_index: b, label: c.name, ref_id: c.id });
      for (const e of (equipRes.data ?? []) as any[]) rows.push({ clean_task_id: task.id, category: "equipment", label: e.name, ref_id: e.id });

      if (rows.length) await supabase.from("clean_checklist_items").insert(rows);
      const { data } = await supabase.from("clean_checklist_items").select("*").eq("clean_task_id", task.id);
      if (cancelled) return;
      setItems((data ?? []) as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [task?.id]);

  const toggle = async (item: ChecklistItem) => {
    const next = !item.checked;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: next, checked_at: next ? now : null, check_all: false } : i)));
    setBusy(item.id);
    await supabase.from("clean_checklist_items")
      .update({ checked: next, checked_at: next ? now : null, checked_by: userId, check_all: false }).eq("id", item.id);
    setBusy(null);
    onChanged?.();
  };

  const checkAll = async (groupItems: ChecklistItem[]) => {
    const ids = groupItems.filter((i) => !i.checked).map((i) => i.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, checked: true, checked_at: now, check_all: true } : i)));
    await supabase.from("clean_checklist_items")
      .update({ checked: true, checked_at: now, checked_by: userId, check_all: true }).in("id", ids);
    onChanged?.();
  };

  const { requests, roomGroups, equipment, done, total, kitchenCount, bathCount } = useMemo(() => {
    const requests = items.filter((i) => i.category === "request");
    const equipment = items.filter((i) => i.category === "equipment");
    const cons = items.filter((i) => i.category === "consumable");
    const kitchenCount = new Set(cons.filter((c) => c.room_type === "kitchen").map((c) => c.room_index)).size;
    const bathCount = new Set(cons.filter((c) => c.room_type === "bathroom").map((c) => c.room_index)).size;
    const groups = new Map<string, ChecklistItem[]>();
    for (const c of cons) { const k = `${c.room_type}-${c.room_index}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(c); }
    const roomGroups = Array.from(groups.entries())
      .map(([k, its]) => ({ key: k, type: its[0].room_type!, index: its[0].room_index!, items: its }))
      .sort((a, b) => (a.type === b.type ? a.index - b.index : a.type === "kitchen" ? -1 : 1));
    return { requests, roomGroups, equipment, done: items.filter((i) => i.checked).length, total: items.length, kitchenCount, bathCount };
  }, [items]);

  const Row = ({ item }: { item: ChecklistItem }) => (
    <button
      onClick={() => toggle(item)} disabled={busy === item.id}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${item.checked ? "bg-emerald-500/10" : "hover:bg-secondary/40"}`}
    >
      <span className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${item.checked ? "bg-emerald-500 border-emerald-500 text-white" : "border-border"}`}>
        {item.checked && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className={`text-sm ${item.checked ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.label}</span>
      {item.check_all && <span className="ml-auto text-[9px] uppercase tracking-wide text-muted-foreground">check-all</span>}
    </button>
  );

  return (
    <Sheet open={!!task} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/30 sticky top-0 bg-background/95 backdrop-blur z-10">
          <SheetTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> {task?.property_name}</SheetTitle>
          <SheetDescription>Tick each item. Everything must be done to complete the job.</SheetDescription>
          {!loading && total > 0 && (
            <div className="pt-1">
              <Progress value={(done / total) * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground mt-1">{done} / {total} done</p>
            </div>
          )}
        </SheetHeader>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : total === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground px-6">No checklist items configured for this property yet.</div>
        ) : (
          <div className="p-4 space-y-5">
            {requests.length > 0 && (
              <Section icon={ConciergeBell} title="Guest Requests">
                <div className="rounded-lg border border-border/40 divide-y divide-border/20 overflow-hidden">
                  {requests.map((i) => <Row key={i.id} item={i} />)}
                </div>
              </Section>
            )}

            {roomGroups.length > 0 && (
              <Section icon={SprayCan} title="Consumables">
                <div className="space-y-3">
                  {roomGroups.map((g) => {
                    const allDone = g.items.every((i) => i.checked);
                    return (
                      <div key={g.key} className="rounded-lg border border-border/40 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                          <span className="text-xs font-semibold">{roomTitle(g.type, g.index, g.type === "kitchen" ? kitchenCount : bathCount)}</span>
                          <button onClick={() => checkAll(g.items)} disabled={allDone}
                            className="text-[11px] font-medium text-primary disabled:text-muted-foreground disabled:opacity-60">
                            {allDone ? "All done" : "Check all"}
                          </button>
                        </div>
                        <div className="divide-y divide-border/20">{g.items.map((i) => <Row key={i.id} item={i} />)}</div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {equipment.length > 0 && (
              <Section icon={Wrench} title="Equipment">
                <div className="rounded-lg border border-border/40 divide-y divide-border/20 overflow-hidden">
                  {equipment.map((i) => <Row key={i.id} item={i} />)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Photo capture for equipment lands in the next update.</p>
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</div>
      {children}
    </div>
  );
}
