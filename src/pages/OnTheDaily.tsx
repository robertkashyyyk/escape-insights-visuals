import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { displayName } from "@/lib/listingName";
import { format, addDays, startOfDay, parseISO } from "date-fns";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Loader2, CircleDashed, Timer, CheckCircle2, Clock, Flag, BedDouble } from "lucide-react";

// Lifecycle: a guest is in (Occupied) → they leave (Dirty) → clean underway
// (In Progress) → done & vacant (Clean).
type Col = "occupied" | "dirty" | "in_progress" | "clean";

interface Card {
  id: string;               // listing id — one card per property
  name: string;
  region: string | null;
  state: Col;
  cleaner: string | null;
  time: string | null;      // checkout time (dirty / in progress)
  sub: string | null;       // occupancy note or clean date
  eta: string | null;       // expected/actual ready time
  overran: boolean;
  issue: { count: number; urgent: boolean } | null;
  navDate: string;          // date to open in the schedule
}

const COLS: { key: Col; label: string; icon: any; head: string; cell: string; dot: string }[] = [
  { key: "occupied", label: "Occupied", icon: BedDouble,
    head: "text-blue-700 dark:text-blue-300", cell: "bg-blue-500/5 border-blue-500/20", dot: "bg-blue-500" },
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
const hhmmPlus = (hhmm: string, addMin: number): string | null => {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + addMin;
  const h = Math.floor((total % 1440) / 60), mi = total % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
};
const finishFromStarted = (iso: string, addMin: number): string => {
  const d = new Date(new Date(iso).getTime() + addMin * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const clockOf = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const minsOf = (hhmm: string): number | null => {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export default function OnTheDaily() {
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");
  const backStr = format(addDays(today, -45), "yyyy-MM-dd");
  const fwdStr = format(addDays(today, 2), "yyyy-MM-dd");

  const { data: listings = [], isLoading: lLoading } = useQuery({
    queryKey: ["daily-listings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, name, internal_name, location_group, status, is_bundle")
        .eq("status", "active");
      return ((data || []) as any[]).filter((l) => !l.is_bundle);
    },
  });

  const { data: cleaners = [] } = useQuery({
    queryKey: ["daily-cleaners"],
    queryFn: async () => {
      const { data } = await supabase.from("cleaners").select("id, name");
      return (data || []) as { id: string; name: string }[];
    },
  });

  // Reservations that could bear on current occupancy / recent checkouts.
  const { data: reservations = [], isLoading: rLoading } = useQuery({
    queryKey: ["daily-res", backStr, fwdStr],
    queryFn: async () => fetchAllRows<any>(() =>
      supabase.from("reservations")
        .select("listing_id, check_in, check_out, guest_name, status")
        .eq("status", "confirmed")
        .gte("check_out", backStr)
        .lte("check_in", format(addDays(today, 1), "yyyy-MM-dd"))),
  });

  // Cleans over the recent window (for in-progress, today's turnover, and
  // "cleaned since last checkout").
  const { data: cleans = [], isLoading: cLoading } = useQuery({
    queryKey: ["daily-cleans", backStr, fwdStr],
    queryFn: async () => fetchAllRows<any>(() =>
      supabase.from("clean_tasks")
        .select("listing_id, scheduled_date, status, started_at, completed_at, estimated_start_time, cleaning_duration_minutes, checkout_time, assigned_cleaner_id")
        .gte("scheduled_date", backStr).lte("scheduled_date", fwdStr)
        .not("status", "in", "(cancelled,canceled)")),
  });

  // Open (unresolved) issues, per property.
  const { data: issueMap = new Map<string, { count: number; urgent: boolean }>() } = useQuery({
    queryKey: ["daily-issues", backStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("clean_issues")
        .select("listing_id, urgency, status, maintenance_stage, created_at")
        .gte("created_at", `${backStr}T00:00:00Z`);
      const m = new Map<string, { count: number; urgent: boolean }>();
      for (const r of (data || []) as any[]) {
        if (r.status === "resolved" || r.maintenance_stage === "complete") continue;
        const cur = m.get(r.listing_id) ?? { count: 0, urgent: false };
        cur.count++;
        if (r.urgency === "urgent") cur.urgent = true;
        m.set(r.listing_id, cur);
      }
      return m;
    },
  });

  const cleanerName = useMemo(() => {
    const m = new Map(cleaners.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [cleaners]);

  const { todayBoard, otherBoard, counts } = useMemo(() => {
    // Group reservations & cleans by listing.
    const resByListing = new Map<string, any[]>();
    for (const r of reservations) (resByListing.get(r.listing_id) ?? resByListing.set(r.listing_id, []).get(r.listing_id))!.push(r);
    const cleansByListing = new Map<string, any[]>();
    for (const c of cleans) (cleansByListing.get(c.listing_id) ?? cleansByListing.set(c.listing_id, []).get(c.listing_id))!.push(c);

    const blank = () => ({ occupied: [] as Card[], dirty: [] as Card[], in_progress: [] as Card[], clean: [] as Card[] });
    const tb = blank();
    const ob = blank();

    for (const l of listings) {
      const res = resByListing.get(l.id) ?? [];
      const cl = cleansByListing.get(l.id) ?? [];

      // "In residence" = checked in on a PRIOR day (strictly before today). A guest
      // whose check-in is today is a same-day arrival: the turnover clean still has to
      // happen first, so the property is Dirty/In Progress until then — not Occupied.
      const occupiedRes = res.find((r) => r.check_in < todayStr && r.check_out > todayStr) ?? null;
      const checkoutToday = res.find((r) => r.check_out === todayStr) ?? null;
      const lastCheckout = res
        .filter((r) => r.check_out <= todayStr)
        .reduce<string | null>((m, r) => (!m || r.check_out > m ? r.check_out : m), null);

      const inProgressClean = cl.find((c) => (c.status === "in_progress" || c.started_at) && c.status !== "completed" && c.status !== "done") ?? null;
      const todayClean = cl.find((c) => c.scheduled_date === todayStr) ?? null;
      const completed = cl.filter((c) => c.status === "completed" || c.status === "done");
      const lastCompleted = completed.reduce<any>((m, c) => (!m || c.scheduled_date > m.scheduled_date ? c : m), null);
      const cleanedSinceCheckout = lastCheckout ? completed.some((c) => c.scheduled_date >= lastCheckout) : true;

      // State (priority): a clean underway → In Progress; a guest currently in →
      // Occupied; vacated & not cleaned since → Dirty; else Clean.
      let state: Col;
      let relClean: any = null;
      if (inProgressClean) { state = "in_progress"; relClean = inProgressClean; }
      else if (occupiedRes) { state = "occupied"; }
      else if (lastCheckout && !cleanedSinceCheckout) { state = "dirty"; relClean = todayClean; }
      else { state = "clean"; relClean = lastCompleted; }

      // Card meta by state.
      let time: string | null = null, sub: string | null = null, eta: string | null = null, overran = false, cleaner: string | null = null;
      const dur: number | null = relClean?.cleaning_duration_minutes ?? null;
      if (state === "occupied" && occupiedRes) {
        sub = `${occupiedRes.guest_name?.split(/\s+/)[0] ?? "Guest"} · out ${format(parseISO(occupiedRes.check_out), "EEE d MMM")}`;
      } else if (state === "in_progress" && relClean) {
        cleaner = cleanerName(relClean.assigned_cleaner_id);
        time = fmtTime(relClean.checkout_time);
        if (relClean.started_at && dur) eta = `ready ~${finishFromStarted(relClean.started_at, dur)}`;
      } else if (state === "dirty") {
        cleaner = cleanerName(relClean?.assigned_cleaner_id ?? null);
        time = fmtTime(relClean?.checkout_time ?? checkoutToday?.check_out_time);
        if (relClean?.scheduled_date === todayStr && dur) {
          const finish = relClean.estimated_start_time ? hhmmPlus(relClean.estimated_start_time, dur) : null;
          eta = finish ? `ready ~${finish}` : `~${dur}m`;
        } else if (lastCheckout) {
          sub = `out ${format(parseISO(lastCheckout), "EEE d MMM")}`;
        }
      } else if (state === "clean" && relClean) {
        cleaner = cleanerName(relClean.assigned_cleaner_id);
        const expected = dur
          ? (relClean.estimated_start_time ? hhmmPlus(relClean.estimated_start_time, dur)
            : relClean.started_at ? finishFromStarted(relClean.started_at, dur) : null)
          : null;
        const actual = relClean.completed_at ? clockOf(relClean.completed_at) : null;
        if (expected && actual) { eta = `exp ~${expected} · done ${actual}`; const em = minsOf(expected), am = minsOf(actual); overran = em != null && am != null && am > em; }
        else if (actual) eta = `done ${actual}`;
        if (relClean.scheduled_date && relClean.scheduled_date !== todayStr) sub = format(parseISO(relClean.scheduled_date), "EEE d MMM");
      }

      const card: Card = {
        id: l.id,
        name: displayName(l) || "Unknown",
        region: l.location_group ?? null,
        state,
        cleaner,
        time,
        sub,
        eta,
        overran,
        issue: issueMap.get(l.id) ?? null,
        navDate: relClean?.scheduled_date ?? todayStr,
      };

      // Today band = a turnover happening today (checkout today or a clean today).
      const isTodayTurnover = !!checkoutToday || !!todayClean;
      (isTodayTurnover ? tb : ob)[state].push(card);
    }

    const byName = (a: Card, b: Card) => a.name.localeCompare(b.name);
    (["occupied", "dirty", "in_progress", "clean"] as Col[]).forEach((k) => { tb[k].sort(byName); ob[k].sort(byName); });
    const counts = {
      today: { occupied: tb.occupied.length, dirty: tb.dirty.length, in_progress: tb.in_progress.length, clean: tb.clean.length },
      other: { occupied: ob.occupied.length, dirty: ob.dirty.length, in_progress: ob.in_progress.length, clean: ob.clean.length },
    };
    return { todayBoard: tb, otherBoard: ob, counts };
  }, [listings, reservations, cleans, issueMap, todayStr, cleanerName]);

  const isLoading = lLoading || rLoading || cLoading;

  const CardBox = ({ c }: { c: Card }) => (
    <button
      onClick={() => navigate(`/operations/schedule?date=${c.navDate}`)}
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
        {c.sub && <span>{c.sub}</span>}
        {(c.state === "dirty" || c.state === "in_progress") && (c.cleaner ? <span>· {c.cleaner}</span> : <span className="text-red-500/70">· unassigned</span>)}
        {c.state === "clean" && c.cleaner && <span>· {c.cleaner}</span>}
      </div>
    </button>
  );

  const Band = ({ title, subtitle, board, cnt }: {
    title: string; subtitle: string; board: Record<Col, Card[]>; cnt: Record<Col, number>;
  }) => (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLS.map((col) => {
          const list = board[col.key];
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
                  : list.map((c) => <CardBox key={c.id} c={c} />)}
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
            Every property's current state —{" "}
            <span className="text-blue-600 dark:text-blue-300 font-medium">Occupied</span> ·{" "}
            <span className="text-red-600 dark:text-red-300 font-medium">Dirty</span> ·{" "}
            <span className="text-amber-600 dark:text-amber-300 font-medium">In Progress</span> ·{" "}
            <span className="text-emerald-600 dark:text-emerald-300 font-medium">Clean</span>. Tap a card to open the schedule.
          </p>
        </div>

        {isLoading ? (
          <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6">
            <Band title="Today" subtitle={`${format(today, "EEEE d MMMM")} · turning over today`} board={todayBoard} cnt={counts.today} />
            <div className="border-t border-border/40" />
            <Band title="Other" subtitle="Everything else — current state" board={otherBoard} cnt={counts.other} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
