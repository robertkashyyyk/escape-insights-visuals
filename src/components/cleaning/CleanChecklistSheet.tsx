import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, ConciergeBell, SprayCan, Wrench, ListChecks, Camera, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

// NB: we deliberately do NOT resize equipment photos in the browser. Decoding a
// full 12MP phone shot into a canvas spikes memory hard enough for iOS Safari to
// evict + reload the tab mid-capture (which read as the checklist "throwing you
// out"). We upload the original file straight to storage instead — a few MB is a
// non-issue for internal equipment checks, and it can never crash the tab.

const fileExt = (file: File) => {
  const m = /\.([a-z0-9]+)$/i.exec(file.name || "");
  if (m) return m[1].toLowerCase();
  const t = (file.type || "").split("/")[1];
  return t ? t.replace("jpeg", "jpg") : "jpg";
};

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
  flagged: boolean;
  requires_photo: boolean;
}

interface Props {
  task: { id: string; listing_id: string; property_name: string } | null;
  requestLabels: string[];   // guest requests (High Chair / Cot …) for the arriving guest
  userId: string | null;
  onClose: () => void;
  onChanged?: () => void;
  onComplete?: () => void;   // fired from the sheet's "Complete Job" button (only when 100%)
  readOnly?: boolean;        // before the job is started: viewable, not tickable
  memberName?: string | null; // team cleaner: which member is ticking (attribution)
}

const roomTitle = (type: string, index: number, count: number) =>
  count > 1 ? `${type === "kitchen" ? "Kitchen" : "Bathroom"} ${index}` : (type === "kitchen" ? "Kitchen" : "Bathroom");

export function CleanChecklistSheet({ task, requestLabels, userId, onClose, onChanged, onComplete, readOnly = false, memberName = null }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

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
        (supabase.from as any)("property_equipment").select("id, name, requires_photo").eq("listing_id", task.listing_id).eq("active", true).order("name"),
      ]);
      if (cancelled) return;
      const kitchens = Math.max(1, (listingRes.data as any)?.kitchens ?? 1);
      const bathrooms = Math.max(1, (listingRes.data as any)?.bathrooms ?? 1);
      const cons = (consRes.data ?? []) as any[];
      const kitchenItems = cons.filter((c) => c.room_type === "kitchen");
      const bathItems = cons.filter((c) => c.room_type === "bathroom");

      // NB: set requires_photo on EVERY row. In a mixed-array insert, PostgREST
      // inserts NULL (not the column default) for rows that omit a key another row
      // has — which breaks the not-null constraint. Non-equipment items = false.
      const rows: any[] = [];
      for (const label of requestLabels) rows.push({ clean_task_id: task.id, category: "request", label, requires_photo: false });
      for (let k = 1; k <= kitchens; k++) for (const c of kitchenItems) rows.push({ clean_task_id: task.id, category: "consumable", room_type: "kitchen", room_index: k, label: c.name, ref_id: c.id, requires_photo: false });
      for (let b = 1; b <= bathrooms; b++) for (const c of bathItems) rows.push({ clean_task_id: task.id, category: "consumable", room_type: "bathroom", room_index: b, label: c.name, ref_id: c.id, requires_photo: false });
      for (const e of (equipRes.data ?? []) as any[]) rows.push({ clean_task_id: task.id, category: "equipment", label: e.name, ref_id: e.id, requires_photo: e.requires_photo ?? true });

      if (rows.length) {
        const { error: insErr } = await supabase.from("clean_checklist_items").insert(rows);
        if (insErr) toast.error(`Checklist couldn't be set up: ${insErr.message}`);
      }
      const { data } = await supabase.from("clean_checklist_items").select("*").eq("clean_task_id", task.id);
      if (cancelled) return;
      setItems((data ?? []) as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [task?.id]);

  const toggle = async (item: ChecklistItem) => {
    if (readOnly) return;
    const next = !item.checked;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: next, checked_at: next ? now : null, check_all: false } : i)));
    setBusy(item.id);
    await supabase.from("clean_checklist_items")
      .update({ checked: next, checked_at: next ? now : null, checked_by: userId, checked_by_member: next ? memberName : null, check_all: false }).eq("id", item.id);
    setBusy(null);
    onChanged?.();
  };

  const handlePhoto = async (item: ChecklistItem, file: File) => {
    if (!task || readOnly) return;
    setUploading(item.id);
    try {
      // Upload the original file — no in-browser decode (see note at top of file).
      const path = `${task.id}/${item.id}.${fileExt(file)}`;
      const { error: upErr } = await supabase.storage.from("clean-photos")
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      const url = `${supabase.storage.from("clean-photos").getPublicUrl(path).data.publicUrl}?t=${Date.now()}`;
      const now = new Date().toISOString();
      await supabase.from("clean_checklist_items").update({ photo_url: url, checked: true, checked_at: now, checked_by: userId, checked_by_member: memberName }).eq("id", item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, photo_url: url, checked: true, checked_at: now } : i)));
      onChanged?.();
    } catch (e: any) {
      toast.error(`Photo upload failed: ${e?.message ?? "try again"}`);
    } finally {
      setUploading(null);
    }
  };

  const checkAll = async (groupItems: ChecklistItem[]) => {
    if (readOnly) return;
    const ids = groupItems.filter((i) => !i.checked).map((i) => i.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, checked: true, checked_at: now, check_all: true } : i)));
    await supabase.from("clean_checklist_items")
      .update({ checked: true, checked_at: now, checked_by: userId, checked_by_member: memberName, check_all: true }).in("id", ids);
    onChanged?.();
  };

  // Red-flag rushed rooms: a consumables room where every item was ticked via
  // "Check All" or within <5s of each other — "Check All Without Due Attention".
  const flagRushedRooms = async () => {
    if (!task) return;
    const groups = new Map<string, ChecklistItem[]>();
    for (const c of items.filter((i) => i.category === "consumable")) {
      const k = `${c.room_type}-${c.room_index}`;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
    }
    const toFlag: string[] = [];
    for (const its of groups.values()) {
      if (!its.length || !its.every((i) => i.checked)) continue;
      const times = its.map((i) => (i.checked_at ? Date.parse(i.checked_at) : NaN)).filter((t) => !isNaN(t));
      const span = times.length ? Math.max(...times) - Math.min(...times) : 0;
      if (its.length > 1 && (its.some((i) => i.check_all) || span < 5000)) toFlag.push(...its.map((i) => i.id));
    }
    if (toFlag.length) await supabase.from("clean_checklist_items").update({ flagged: true }).in("id", toFlag);
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await flagRushedRooms();
      onComplete?.();
    } finally {
      setCompleting(false);
    }
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
      onClick={() => toggle(item)} disabled={busy === item.id || readOnly}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${item.checked ? "bg-emerald-500/10" : readOnly ? "" : "hover:bg-secondary/40"}`}
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
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto p-0"
        hideClose
        // Don't let the native camera handing focus back count as a click-away —
        // that was closing the panel after each equipment photo. Close via Back only.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-3 pb-3 border-b border-border/30 sticky top-0 bg-background/95 backdrop-blur z-10 space-y-1">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 -ml-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <SheetTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> {task?.property_name}</SheetTitle>
          <SheetDescription>Tick each item. Everything must be done to complete the job.</SheetDescription>
          {!loading && total > 0 && (
            <div className="pt-1">
              <Progress value={(done / total) * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground mt-1">{done} / {total} done</p>
            </div>
          )}
        </SheetHeader>

        {readOnly && !loading && total > 0 && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-400">
            View only — <span className="font-semibold">Start the job</span> to tick items and take photos.
          </div>
        )}

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
                          {!readOnly && (
                            <button onClick={() => checkAll(g.items)} disabled={allDone}
                              className="text-[11px] font-medium text-primary disabled:text-muted-foreground disabled:opacity-60">
                              {allDone ? "All done" : "Check all"}
                            </button>
                          )}
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
                  {equipment.map((i) =>
                    // Tick-only equipment (e.g. Coffee Machine) — no photo, just a tick.
                    i.requires_photo === false ? (
                      <Row key={i.id} item={i} />
                    ) : (
                      <div key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${i.photo_url ? "bg-emerald-500 border-emerald-500 text-white" : "border-border"}`}>
                          {i.photo_url && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className={`text-sm flex-1 ${i.photo_url ? "text-muted-foreground" : "text-foreground"}`}>{i.label}</span>
                        {i.photo_url ? (
                          <div className="flex items-center gap-3">
                            {/* No inline <img>: decoding the full-size photo for a
                                thumbnail spikes memory and, stacked, makes the next
                                capture fail with iOS "low memory". View opens it on
                                demand instead. */}
                            <a href={i.photo_url} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] font-medium text-emerald-600">View</a>
                            {!readOnly && (
                              <label className="text-[11px] text-primary cursor-pointer">
                                Retake
                                <input type="file" accept="image/*" capture="environment" className="hidden"
                                  onChange={(e) => e.target.files?.[0] && handlePhoto(i, e.target.files[0])} />
                              </label>
                            )}
                          </div>
                        ) : readOnly ? (
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> Photo needed</span>
                        ) : (
                          <label className={`text-xs font-medium px-2.5 py-1.5 rounded-md border inline-flex items-center gap-1.5 cursor-pointer ${uploading === i.id ? "opacity-60" : "border-primary/40 text-primary hover:bg-primary/10"}`}>
                            {uploading === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Photo
                            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading === i.id}
                              onChange={(e) => e.target.files?.[0] && handlePhoto(i, e.target.files[0])} />
                          </label>
                        )}
                      </div>
                    )
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Camera items must be photographed in approved condition; the rest are a tick.</p>
              </Section>
            )}
          </div>
        )}

        {onComplete && !loading && total > 0 && !readOnly && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/30 p-4">
            <button
              onClick={handleComplete}
              disabled={done < total || completing}
              className={`w-full min-h-[48px] rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                done < total
                  ? "bg-secondary text-muted-foreground cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {done < total ? `${done}/${total} done — finish all to complete` : "Complete Job"}
            </button>
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
