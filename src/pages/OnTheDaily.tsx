import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { displayName } from "@/lib/listingName";
import { format, addDays, startOfDay, parseISO, isToday } from "date-fns";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Loader2, CircleDashed, Timer, CheckCircle2, Clock, Flag } from "lucide-react";

type Col = "dirty" | "in_progress" | "clean";

interface Card {
  id: string;
  name: string;
  region: string | null;
  cleaner: string | null;
  time: string | null;      // checkout time
  date: string;             // scheduled_date
  state: Col;
  eta: string | null;       // expected ready time / duration hint
  overran: boolean;         // completed later than expected (Clean column)
  issue: { count: number; urgent: boolean } | null;
}

// local "HH:MM" from an ISO timestamp
const clockOf = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const minsOf = (hhmm: string): number | null => {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// "HH:MM" + minutes → "HH:MM"
const hhmmPlus = (hhmm: string, addMin: number): string | null => {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + addMin;
  const h = Math.floor((total % 1440) / 60), mi = total % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
};
// started_at (ISO) + minutes → local "HH:MM"
const finishFromStarted = (iso: string, addMin: number): string => {
  const d = new Date(new Date(iso).getTime() + addMin * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

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
        .select("id, scheduled_date, status, started_at, completed_at, estimated_start_time, cleaning_duration_minutes, assigned_cleaner_id, checkout_time, listing_id, listings!clean_tasks_listing_id_fkey(name, internal_name, location_group, is_bundle)")
        .gte("scheduled_date", startStr).lte("scheduled_date", endStr)
        .not("status", "in", "(cancelled,canceled)")),
  });

  // Open (unresolved) issues flagged on cleans in this window → task_id -> {count, urgent}
  const { data: issueMap = new Map<string, { count: number; urgent: boolean }>() } = useQuery({
    queryKey: ["daily-issues", startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("clean_issues")
        .select("clean_task_id, urgency, status, maintenance_stage, clean_tasks!inner(scheduled_date)")
        .gte("clean_tasks.scheduled_date", startStr).lte("clean_tasks.scheduled_date", endStr);
      const m = new Map<string, { count: number; urgent: boolean }>();
      for (const r of (data || []) as any[]) {
        if (r.status === "resolved" || r.maintenance_stage === "complete") continue;
        const cur = m.get(r.clean_task_id) ?? { count: 0, urgent: false };
        cur.count++;
        if (r.urgency === "urgent") cur.urgent = true;
        m.set(r.clean_task_id, cur);
      }
      return m;
    },
  });

  const { todayBoard, otherBoard, counts } = useMemo(() => {
    const blank = () => ({ dirty: [] as Card[], in_progress: [] as Card[], clean: [] as Card[] });
    const tb = blank();
    const ob = blank();
    const seenToday = new Set<string>();
    for (const t of tasks) {
      if (t.listings?.is_bundle) continue; // bundles have no physical state
      const state = stateOf(t);
      const isTodayRow = t.scheduled_date === todayStr;
      const dur: number | null = t.cleaning_duration_minutes ?? null;
      // Expected ready time: in-progress = start + duration; today's dirty = estimated
      // start + duration (or just the duration if we don't have a start estimate).
      let eta: string | null = null;
      let overran = false;
      if (state === "in_progress" && t.started_at && dur) {
        eta = `ready ~${finishFromStarted(t.started_at, dur)}`;
      } else if (state === "dirty" && isTodayRow && dur) {
        const finish = t.estimated_start_time ? hhmmPlus(t.estimated_start_time, dur) : null;
        eta = finish ? `ready ~${finish}` : `~${dur}m`;
      } else if (state === "clean") {
        // Expected finish (planned start + duration, else actual start + duration) vs
        // actual finish (completed_at).
        const expected = dur
          ? (t.estimated_start_time ? hhmmPlus(t.estimated_start_time, dur)
            : t.started_at ? finishFromStarted(t.started_at, dur) : null)
          : null;
        const actual = t.completed_at ? clockOf(t.completed_at) : null;
        if (expected && actual) {
          eta = `exp ~${expected} · done ${actual}`;
          const em = minsOf(expected), am = minsOf(actual);
          overran = em != null && am != null && am > em;
        } else if (actual) {
          eta = `done ${actual}`;
        } else if (expected) {
          eta = `exp ~${expected}`;
        }
      }
      const card: Card = {
        id: t.id,
        name: displayName(t.listings) || "Unknown",
        region: t.listings?.location_group ?? null,
        cleaner: cleanerName(t.assigned_cleaner_id),
        time: fmtTime(t.checkout_time),
        date: t.scheduled_date,
        state,
        eta,
        overran,
        issue: issueMap.get(t.id) ?? null,
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
  }, [tasks, todayStr, cleanerName, issueMap]);

  const CardBox = ({ c, showDate }: { c: Card; showDate?: boolean }) => (
    <button
      onClick={() => navigate(`/operations/schedule?date=${c.date}`)}
      className="w-full text-left rounded-lg border border-border/50 bg-card px-3 py-2 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold leading-tight truncate flex items-center gap-1.5" title={c.name}>
          {c.issue && (
            <span
              className={`shrink-0 inline-flex items-center justify-center h-4 min-w-4 px-0.5 rounded text-white ${c.issue.urgent ? "bg-red-600" : "bg-orange-500"}`}
              title={`${c.issue.count} open issue${c.issue.count === 1 ? "" : "s"}${c.issue.urgent ? " (urgent)" : ""}`}
            >
              <Flag className="h-2.5 w-2.5" />
            </span>
          )}
          <span className="truncate">{c.name}</span>
        </div>
        {c.eta && (
          <span className={`shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
            c.state === "in_progress" || (c.state === "clean" && c.overran)
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : c.state === "clean"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-secondary text-muted-foreground"
          }`}>
            <Clock className="h-3 w-3" />{c.eta}
          </span>
        )}
      </div>
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
