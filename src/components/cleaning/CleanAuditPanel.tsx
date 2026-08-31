import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Loader2, Check, X, Flag, ConciergeBell, SprayCan, Wrench, Zap } from "lucide-react";

interface AuditItem {
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
  checked_by_member: string | null;
}

interface Props {
  cleanTaskId: string | null;
  propertyName?: string;
  cleanerName?: string;
  completedAt?: string | null;
  onClose: () => void;
}

const when = (iso: string | null) => (iso ? format(new Date(iso), "d MMM, HH:mm:ss") : "—");
const roomLabel = (type: string, index: number, count: number) =>
  count > 1 ? `${type === "kitchen" ? "Kitchen" : "Bathroom"} ${index}` : type === "kitchen" ? "Kitchen" : "Bathroom";

export function CleanAuditPanel({ cleanTaskId, propertyName, cleanerName, completedAt, onClose }: Props) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cleanTaskId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("clean_checklist_items").select("*").eq("clean_task_id", cleanTaskId);
      if (cancelled) return;
      setItems((data ?? []) as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [cleanTaskId]);

  const { requests, roomGroups, equipment, done, total, flags, kitchenCount, bathCount } = useMemo(() => {
    const requests = items.filter((i) => i.category === "request");
    const equipment = items.filter((i) => i.category === "equipment");
    const cons = items.filter((i) => i.category === "consumable");
    const kitchenCount = new Set(cons.filter((c) => c.room_type === "kitchen").map((c) => c.room_index)).size;
    const bathCount = new Set(cons.filter((c) => c.room_type === "bathroom").map((c) => c.room_index)).size;
    const groups = new Map<string, AuditItem[]>();
    for (const c of cons) { const k = `${c.room_type}-${c.room_index}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(c); }
    const roomGroups = Array.from(groups.entries())
      .map(([k, its]) => ({ key: k, type: its[0].room_type!, index: its[0].room_index!, items: its, flagged: its.some((i) => i.flagged) }))
      .sort((a, b) => (a.type === b.type ? a.index - b.index : a.type === "kitchen" ? -1 : 1));
    return { requests, roomGroups, equipment, done: items.filter((i) => i.checked).length, total: items.length, flags: items.filter((i) => i.flagged).length, kitchenCount, bathCount };
  }, [items]);

  const ItemRow = ({ i }: { i: AuditItem }) => (
    <div className={`flex items-center gap-3 px-3 py-2 ${i.flagged ? "bg-amber-500/10" : ""}`}>
      <span className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${i.checked ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
        {i.checked ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className="text-sm flex-1">{i.label}</span>
      {i.photo_url && <img src={i.photo_url} alt={i.label} className="h-8 w-8 rounded object-cover border border-border/40" />}
      {i.check_all && <span className="text-[9px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-0.5"><Zap className="h-3 w-3" />all</span>}
      {i.flagged && <Flag className="h-3.5 w-3.5 text-amber-500" />}
      {i.checked_by_member && <span className="text-[10px] font-medium text-primary shrink-0">{i.checked_by_member}</span>}
      <span className="text-[11px] text-muted-foreground tabular-nums w-[112px] text-right shrink-0">{when(i.checked_at)}</span>
    </div>
  );

  return (
    <Dialog open={!!cleanTaskId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{propertyName ?? "Cleaning audit"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground -mt-1">
          {cleanerName && <span>Cleaned by <span className="text-foreground font-medium">{cleanerName}</span></span>}
          {completedAt && <span>· Completed {when(completedAt)}</span>}
        </div>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : total === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No checklist recorded for this clean.</div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium ${done === total ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{done}/{total} done</span>
              {flags > 0 && <span className="px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-600 inline-flex items-center gap-1"><Flag className="h-3 w-3" />{flags} flagged — Check All without due attention</span>}
            </div>

            <div className="space-y-4 mt-1">
              {requests.length > 0 && (
                <AuditSection icon={ConciergeBell} title="Guest Requests">
                  {requests.map((i) => <ItemRow key={i.id} i={i} />)}
                </AuditSection>
              )}
              {roomGroups.map((g) => (
                <AuditSection key={g.key} icon={SprayCan} title={roomLabel(g.type, g.index, g.type === "kitchen" ? kitchenCount : bathCount)} flagged={g.flagged}>
                  {g.items.map((i) => <ItemRow key={i.id} i={i} />)}
                </AuditSection>
              ))}
              {equipment.length > 0 && (
                <AuditSection icon={Wrench} title="Equipment">
                  {equipment.map((i) => <ItemRow key={i.id} i={i} />)}
                </AuditSection>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditSection({ icon: Icon, title, flagged, children }: { icon: any; title: string; flagged?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
        {flagged && <Flag className="h-3 w-3 text-amber-500 ml-1" />}
      </div>
      <div className="rounded-lg border border-border/40 divide-y divide-border/20 overflow-hidden">{children}</div>
    </div>
  );
}
