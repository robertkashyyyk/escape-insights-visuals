import { AppLayout } from "@/components/layout/AppLayout";
import { usePropertyStates, type CleanState, type PropertyState } from "@/hooks/usePropertyStates";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Loader2, CircleDashed, Timer, CheckCircle2, Clock, Flag, BedDouble, ArrowDownAZ, CalendarClock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLS: { key: CleanState; label: string; icon: any; head: string; cell: string; dot: string }[] = [
  { key: "occupied", label: "Occupied", icon: BedDouble,
    head: "text-blue-700 dark:text-blue-300", cell: "bg-blue-500/5 border-blue-500/20", dot: "bg-blue-500" },
  { key: "dirty", label: "Dirty", icon: CircleDashed,
    head: "text-red-700 dark:text-red-300", cell: "bg-red-500/5 border-red-500/20", dot: "bg-red-500" },
  { key: "in_progress", label: "In Progress", icon: Timer,
    head: "text-amber-700 dark:text-amber-300", cell: "bg-amber-500/5 border-amber-500/20", dot: "bg-amber-500" },
  { key: "clean", label: "Clean", icon: CheckCircle2,
    head: "text-emerald-700 dark:text-emerald-300", cell: "bg-emerald-500/5 border-emerald-500/20", dot: "bg-emerald-500" },
];

const shortDate = (d: string) => format(parseISO(d), "EEE d MMM");

export default function OnTheDaily() {
  const navigate = useNavigate();
  const { states, cleaners, loading } = usePropertyStates();
  const [sortMode, setSortMode] = useState<"az" | "date">("date");
  const [locationFilter, setLocationFilter] = useState("all");
  const [cleanerFilter, setCleanerFilter] = useState("all");

  const regions = useMemo(
    () => Array.from(new Set(states.map((s) => s.region).filter(Boolean))).sort() as string[],
    [states]
  );

  const board = useMemo(() => {
    const passes = (s: PropertyState) =>
      (locationFilter === "all" || s.region === locationFilter) &&
      (cleanerFilter === "all" || s.cleanerId === cleanerFilter);
    const cmp = sortMode === "az"
      ? (a: PropertyState, b: PropertyState) => a.name.localeCompare(b.name)
      : (a: PropertyState, b: PropertyState) => a.sortKey.localeCompare(b.sortKey) || a.name.localeCompare(b.name);
    const out: Record<CleanState, PropertyState[]> = { occupied: [], dirty: [], in_progress: [], clean: [] };
    for (const s of states) if (passes(s)) out[s.state].push(s);
    (Object.keys(out) as CleanState[]).forEach((k) => out[k].sort(cmp));
    return out;
  }, [states, locationFilter, cleanerFilter, sortMode]);

  const Card = ({ c }: { c: PropertyState }) => (
    <button
      onClick={() => navigate(`/operations/schedule?date=${c.sortKey.slice(0, 10)}`)}
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
        {c.expected && (
          <span className={`shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
            c.state === "in_progress" || (c.state === "clean" && c.overran)
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : c.state === "clean"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : c.state === "dirty"
              ? "bg-red-500/15 text-red-700 dark:text-red-300"
              : "bg-secondary text-muted-foreground"
          }`}>
            <Clock className="h-3 w-3" />{c.expected}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
        {c.region && <span className="rounded bg-secondary px-1.5 py-0.5">{c.region}</span>}
        {c.state === "occupied" && c.fromDate && c.toDate && (
          <span>in {shortDate(c.fromDate)} → out {shortDate(c.toDate)}</span>
        )}
        {(c.state === "dirty" || c.state === "in_progress") && c.checkoutTime && <span>CO {c.checkoutTime}</span>}
        {(c.state === "dirty" || c.state === "in_progress") && (c.cleaner ? <span>· {c.cleaner}</span> : <span className="text-red-500/70">· unassigned</span>)}
        {c.state === "clean" && c.cleaner && <span>· {c.cleaner}</span>}
      </div>
    </button>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> On The Daily
            </h1>
            <p className="text-sm text-muted-foreground">
              Every property's current state —{" "}
              <span className="text-blue-600 dark:text-blue-300 font-medium">Occupied</span> ·{" "}
              <span className="text-red-600 dark:text-red-300 font-medium">Dirty</span> ·{" "}
              <span className="text-amber-600 dark:text-amber-300 font-medium">In Progress</span> ·{" "}
              <span className="text-emerald-600 dark:text-emerald-300 font-medium">Clean</span>.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort */}
            <div className="inline-flex rounded-md border border-border/50 overflow-hidden">
              <button onClick={() => setSortMode("date")}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${sortMode === "date" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                <CalendarClock className="h-3.5 w-3.5" /> Earliest
              </button>
              <button onClick={() => setSortMode("az")}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border-l border-border/50 ${sortMode === "az" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                <ArrowDownAZ className="h-3.5 w-3.5" /> A–Z
              </button>
            </div>
            {/* Location filter */}
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All locations" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Cleaner filter */}
            <Select value={cleanerFilter} onValueChange={setCleanerFilter}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All cleaners" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cleaners</SelectItem>
                {cleaners.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLS.map((col) => {
              const list = board[col.key];
              const Icon = col.icon;
              return (
                <div key={col.key} className={`rounded-xl border ${col.cell} p-2.5 min-h-[120px]`}>
                  <div className={`flex items-center gap-1.5 mb-2 text-xs font-semibold ${col.head}`}>
                    <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <Icon className="h-3.5 w-3.5" />
                    {col.label}
                    <span className="ml-auto tabular-nums opacity-70">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.length === 0
                      ? <p className="text-[11px] text-muted-foreground/50 px-1 py-2">—</p>
                      : list.map((c) => <Card key={c.listingId} c={c} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
