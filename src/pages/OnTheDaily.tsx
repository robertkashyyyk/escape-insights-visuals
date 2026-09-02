import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { displayName } from "@/lib/listingName";
import { format, addDays, startOfDay, parseISO, isToday } from "date-fns";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Loader2, CircleDashed, Timer, CheckCircle2 } from "lucide-react";

type Col = "dirty" | "in_progress" | "clean";

interface Card {
  id: string;
  name: string;
  region: string | null;
  cleaner: string | null;
  time: string | null;      // checkout time
  date: string;             // scheduled_date
  state: Col;
}

const stateOf = (t: any): Col => {
  const s = (t.status || "").toLowerCase();
  if (s === "completed" || s === "done") return "clean";
  if (s === "in_progress" || t.started_at) return "in_progress";
  return "dirty";
};

const COLS: { key: Col; label: string; icon: any; head: string; cell: string; dot: string }[] = [
  { key: "dirty", label: "Dirty", icon: CircleDashed,
    head: "text-red-700 dark:text-red-300", cell: "bg-red-500/5 border-red-500/20", dot: "bg-red-500" },
  { key: "in_progress", label: "In Progress", icon: Timer,
    head: "text-amber-700 dark:text-amber-300", cell: "bg-amber-500/5 border-amber-500/20", dot: "bg-amber-500" },
  { key: "clean", label: "Clean", icon: CheckCircle2,
    head: "text-emerald-700 dark:text-emerald-300", cell: "bg-emerald-500/5 border-emerald-500/20", dot: "bg-emerald-500" },
];

const fmtTime = (t: string | null | undefined): string | null => {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
};

export default function OnTheDaily() {
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");
  const startStr = format(addDays(today, -7), "yyyy-MM-dd");
  const endStr = format(addDays(today, 14), "yyyy-MM-dd");

  const { data: cleaners = [] } = useQuery({
    queryKey: ["daily-cleaners"],
    queryFn: async () => {
      const { data } = await supabase.from("cleaners").select("id, name");
      return (data || []) as { id: string; name: string }[];
    },
  });
  const cleanerName = useMemo(() => {
    const m = new Map(cleaners.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [cleaners]);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["daily-tasks", startStr, endStr],
    queryFn: async () => fetchAllRows<any>(() =>
      supabase.from("clean_tasks")
        .select("id, scheduled_date, status, started_at, assigned_cleaner_id, checkout_time, listing_id, listings!clean_tasks_listing_id_fkey(name, internal_name, location_group, is_bundle)")
        .gte("scheduled_date", startStr).lte("scheduled_date", endStr)
        .not("status", "in", "(cancelled,canceled)")),
  });

  const { todayBoard, otherBoard, counts } = useMemo(() => {
    const blank = () => ({ dirty: [] as Card[], in_progress: [] as Card[], clean: [] as Card[] });
    const tb = blank();
    const ob = blank();
    const seenToday = new Set<string>();
    for (const t of tasks) {
      if (t.listings?.is_bundle) continue; // bundles have no physical state
      const state = stateOf(t);
      const card: Card = {
        id: t.id,
        name: displayName(t.listings) || "Unknown",
        region: t.listings?.location_group ?? null,
        cleaner: cleanerName(t.assigned_cleaner_id),
        time: fmtTime(t.checkout_time),
        date: t.scheduled_date,
        state,
      };
      if (t.scheduled_date === todayStr) {
        // one card per property in the Today band (keep the most "active" state)
        const key = t.listing_id;
        if (seenToday.has(key)) continue;
        seenToday.add(key);
        tb[state].push(card);
      } else {
        ob[state].push(card);
      }
    }
    // Other: soonest first
    const bydate = (a: Card, b: Card) => a.date.localeCompare(b.date);
    (["dirty", "in_progress", "clean"] as Col[]).forEach((k) => {
      tb[k].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
      ob[k].sort(bydate);
    });
    const counts = {
      today: { dirty: tb.dirty.length, in_progress: tb.in_progress.length, clean: tb.clean.length },
      other: { dirty: ob.dirty.length, in_progress: ob.in_progress.length, clean: ob.clean.length },
    };
    return { todayBoard: tb, otherBoard: ob, counts };
  }, [tasks, todayStr, cleanerName]);

  const CardBox = ({ c, showDate }: { c: Card; showDate?: boolean }) => (
    <button
      onClick={() => navigate(`/operations/schedule?date=${c.date}`)}
      className="w-full text-left rounded-lg border border-border/50 bg-card px-3 py-2 hover:border-primary/40 transition-colors"
    >
      <div className="text-sm font-semibold leading-tight truncate" title={c.name}>{c.name}</div>
      <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
        {c.region && <span className="rounded bg-secondary px-1.5 py-0.5">{c.region}</span>}
        {c.time && <span>CO {c.time}</span>}
        {showDate && <span className="font-medium">{format(parseISO(c.date), "EEE d MMM")}</span>}
        {c.cleaner ? <span>· {c.cleaner}</span> : <span className="text-red-500/70">· unassigned</span>}
      </div>
    </button>
  );

  const Band = ({ title, subtitle, board, cnt, showDate }: {
    title: string; subtitle: string; board: Record<Col, Card[]>; cnt: Record<Col, number>; showDate?: boolean;
  }) => (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {COLS.map((col) => {
          const list: Card[] = board[col.key];
          const Icon = col.icon;
          return (
            <div key={col.key} className={`rounded-xl border ${col.cell} p-2.5 min-h-[80px]`}>
              <div className={`flex items-center gap-1.5 mb-2 text-xs font-semibold ${col.head}`}>
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <Icon className="h-3.5 w-3.5" />
                {col.label}
                <span className="ml-auto tabular-nums opacity-70">{cnt[col.key]}</span>
              </div>
              <div className="space-y-2">
                {list.length === 0
                  ? <p className="text-[11px] text-muted-foreground/50 px-1 py-2">—</p>
                  : list.map((c) => <CardBox key={c.id} c={c} showDate={showDate} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> On The Daily
          </h1>
          <p className="text-sm text-muted-foreground">
            Property cleanliness at a glance — <span className="text-red-600 dark:text-red-300 font-medium">Dirty</span> ·{" "}
            <span className="text-amber-600 dark:text-amber-300 font-medium">In Progress</span> ·{" "}
            <span className="text-emerald-600 dark:text-emerald-300 font-medium">Clean</span>. Tap a card to open that day in the schedule.
          </p>
        </div>

        {isLoading ? (
          <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6">
            <Band
              title="Today"
              subtitle={format(today, "EEEE d MMMM")}
              board={todayBoard}
              cnt={counts.today}
            />
            <div className="border-t border-border/40" />
            <Band
              title="Other"
              subtitle="Backlog &amp; upcoming turnovers"
              board={otherBoard}
              cnt={counts.other}
              showDate
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
