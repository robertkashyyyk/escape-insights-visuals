import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { displayName } from "@/lib/listingName";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Flag, Camera, ClipboardCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CleanAuditPanel } from "@/components/cleaning/CleanAuditPanel";

const COMPLETED = ["completed", "done"];

interface Row {
  id: string;
  listing_id: string;
  assigned_cleaner_id: string | null;
  scheduled_date: string;
  completed_at: string | null;
  property: string;
  cleaner: string;
  done: number;
  total: number;
  flags: number;
  photos: number;
}

export default function CleaningAudit() {
  const [month, setMonth] = useState(() => new Date());
  const [openTask, setOpenTask] = useState<Row | null>(null);

  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const startStr = format(start, "yyyy-MM-dd");
  const endNextStr = format(addMonths(start, 1), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["cleaning-audit", startStr],
    queryFn: async (): Promise<Row[]> => {
      const [tasks, listings, cleaners] = await Promise.all([
        fetchAllRows(() =>
          supabase.from("clean_tasks")
            .select("id, listing_id, assigned_cleaner_id, scheduled_date, completed_at, status, completed_by_member")
            .in("status", COMPLETED)
            .gte("completed_at", `${startStr}T00:00:00`)
            .lt("completed_at", `${endNextStr}T00:00:00`)),
        supabase.from("listings").select("id, name, internal_name"),
        supabase.from("cleaners").select("id, name"),
      ]);
      const listingMap = new Map((listings.data ?? []).map((l: any) => [l.id, l]));
      const cleanerMap = new Map((cleaners.data ?? []).map((c: any) => [c.id, c.name]));

      const ids = tasks.map((t: any) => t.id);
      const checklist = ids.length
        ? await fetchAllRows(() =>
            supabase.from("clean_checklist_items")
              .select("clean_task_id, checked, flagged, photo_url")
              .in("clean_task_id", ids))
        : [];
      const agg = new Map<string, { done: number; total: number; flags: number; photos: number }>();
      for (const c of checklist as any[]) {
        const a = agg.get(c.clean_task_id) ?? { done: 0, total: 0, flags: 0, photos: 0 };
        a.total++;
        if (c.checked) a.done++;
        if (c.flagged) a.flags++;
        if (c.photo_url) a.photos++;
        agg.set(c.clean_task_id, a);
      }

      return (tasks as any[])
        .map((t) => {
          const a = agg.get(t.id) ?? { done: 0, total: 0, flags: 0, photos: 0 };
          return {
            id: t.id,
            listing_id: t.listing_id,
            assigned_cleaner_id: t.assigned_cleaner_id,
            scheduled_date: t.scheduled_date,
            completed_at: t.completed_at,
            property: displayName(listingMap.get(t.listing_id)) || "Unknown",
            cleaner: (cleanerMap.get(t.assigned_cleaner_id) ?? "Unassigned") + (t.completed_by_member ? ` · ${t.completed_by_member}` : ""),
            ...a,
          };
        })
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    },
  });

  const rows = data ?? [];
  const totals = useMemo(() => ({
    cleans: rows.length,
    flagged: rows.filter((r) => r.flags > 0).length,
    withChecklist: rows.filter((r) => r.total > 0).length,
    photos: rows.reduce((s, r) => s + r.photos, 0),
  }), [rows]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /> Cleaning Audit</h1>
            <p className="text-sm text-muted-foreground">Every completed clean, its checklist and any red flags.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth((m) => subMonths(m, 1))} className="p-1.5 rounded-md border border-border/50 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-semibold w-28 text-center">{format(month, "MMMM yyyy")}</span>
            <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-1.5 rounded-md border border-border/50 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Cleans completed" value={totals.cleans} />
          <Stat label="With checklist" value={totals.withChecklist} />
          <Stat label="Flagged" value={totals.flagged} tone={totals.flagged ? "amber" : undefined} icon={Flag} />
          <Stat label="Equipment photos" value={totals.photos} icon={Camera} />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">No completed cleans this month.</div>
            ) : (
              <div className="divide-y divide-border/30">
                <div className="hidden sm:grid grid-cols-[1fr_140px_120px_90px_70px] gap-3 px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  <span>Property</span><span>Cleaner</span><span>Completed</span><span>Checklist</span><span className="text-right">Flags</span>
                </div>
                {rows.map((r) => (
                  <button key={r.id} onClick={() => setOpenTask(r)}
                    className="w-full grid grid-cols-2 sm:grid-cols-[1fr_140px_120px_90px_70px] gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-secondary/40 transition-colors items-center">
                    <span className="font-medium text-sm">{r.property}</span>
                    <span className="text-sm text-muted-foreground">{r.cleaner}</span>
                    <span className="text-xs text-muted-foreground">{r.completed_at ? format(new Date(r.completed_at), "d MMM, HH:mm") : "—"}</span>
                    <span className="text-xs">
                      {r.total === 0 ? <span className="text-muted-foreground">—</span> : (
                        <span className={`inline-flex items-center gap-1 ${r.done === r.total ? "text-emerald-600" : "text-amber-600"}`}>
                          {r.done === r.total && <CheckCircle2 className="h-3.5 w-3.5" />}{r.done}/{r.total}
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      {r.flags > 0
                        ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium"><Flag className="h-3.5 w-3.5" />{r.flags}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CleanAuditPanel
        cleanTaskId={openTask?.id ?? null}
        propertyName={openTask?.property}
        cleanerName={openTask?.cleaner}
        completedAt={openTask?.completed_at}
        onClose={() => setOpenTask(null)}
      />
    </AppLayout>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: "amber"; icon?: any }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">{Icon && <Icon className="h-3 w-3" />}{label}</p>
        <p className={`text-2xl font-bold ${tone === "amber" && value > 0 ? "text-amber-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
