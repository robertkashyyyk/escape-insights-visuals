import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrafficCone, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = 28; // horizon shown at once
const NO_REGION = "No region";

type State = "green" | "amber" | "red" | "empty";
interface Cell { state: State; total: number; unassigned: number; over: number; }

const CELL: Record<State, string> = {
  green: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30",
  amber: "bg-amber-500/25 text-amber-700 dark:text-amber-300 hover:bg-amber-500/35",
  red: "bg-red-500/25 text-red-700 dark:text-red-300 hover:bg-red-500/35",
  empty: "text-muted-foreground/30",
};

const cellState = (total: number, unassigned: number, over: number): State =>
  total === 0 ? "empty" : unassigned > 0 ? "red" : over > 0 ? "amber" : "green";

export default function CleaningTraffic() {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));

  const startStr = format(anchor, "yyyy-MM-dd");
  const endStr = format(addDays(anchor, DAYS - 1), "yyyy-MM-dd");
  const dates = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(anchor, i)), [anchor]);
  const today = startOfDay(new Date());

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["traffic-tasks", startStr, endStr],
    queryFn: async () => fetchAllRows<any>(() =>
      supabase.from("clean_tasks")
        .select("scheduled_date, status, assigned_cleaner_id, overloaded, listings!clean_tasks_listing_id_fkey(location_group)")
        .gte("scheduled_date", startStr).lte("scheduled_date", endStr)
        .not("status", "in", "(cancelled,canceled)")),
  });

  const { regions, grid, totals } = useMemo(() => {
    // region -> dateStr -> {total, unassigned, over}
    const acc = new Map<string, Map<string, { total: number; unassigned: number; over: number }>>();
    const tot = new Map<string, { total: number; unassigned: number; over: number }>();
    const bump = (m: Map<string, { total: number; unassigned: number; over: number }>, d: string, t: any) => {
      const c = m.get(d) ?? { total: 0, unassigned: 0, over: 0 };
      c.total++;
      const done = t.status === "completed" || t.status === "done";
      if (!t.assigned_cleaner_id && !done) c.unassigned++;
      if (t.overloaded) c.over++;
      m.set(d, c);
    };
    for (const t of tasks) {
      const region = t.listings?.location_group || NO_REGION;
      if (!acc.has(region)) acc.set(region, new Map());
      bump(acc.get(region)!, t.scheduled_date, t);
      bump(tot, t.scheduled_date, t);
    }
    const regionList = Array.from(acc.keys()).sort((a, b) =>
      a === NO_REGION ? 1 : b === NO_REGION ? -1 : a.localeCompare(b));
    return { regions: regionList, grid: acc, totals: tot };
  }, [tasks]);

  const cellFor = (region: string, d: Date): Cell => {
    const c = grid.get(region)?.get(format(d, "yyyy-MM-dd"));
    if (!c) return { state: "empty", total: 0, unassigned: 0, over: 0 };
    return { state: cellState(c.total, c.unassigned, c.over), ...c };
  };
  const totalFor = (d: Date): Cell => {
    const c = totals.get(format(d, "yyyy-MM-dd"));
    if (!c) return { state: "empty", total: 0, unassigned: 0, over: 0 };
    return { state: cellState(c.total, c.unassigned, c.over), ...c };
  };

  const openDay = (d: Date) => navigate(`/operations/schedule?date=${format(d, "yyyy-MM-dd")}`);

  const CellBox = ({ cell, d }: { cell: Cell; d: Date }) => (
    <button
      onClick={() => cell.total > 0 && openDay(d)}
      disabled={cell.total === 0}
      className={`h-11 w-full rounded-md flex flex-col items-center justify-center text-[11px] font-semibold leading-none transition-colors ${CELL[cell.state]} ${cell.total === 0 ? "cursor-default" : "cursor-pointer"}`}
      title={cell.total === 0 ? "No cleans" : `${cell.total} clean${cell.total === 1 ? "" : "s"}${cell.unassigned ? ` · ${cell.unassigned} unassigned` : ""}${cell.over ? ` · ${cell.over} over capacity` : ""}`}
    >
      {cell.total > 0 && (
        <>
          <span className="tabular-nums">{cell.total}</span>
          {cell.unassigned > 0 ? <span className="text-[9px] font-medium">{cell.unassigned} un</span>
            : cell.over > 0 ? <span className="text-[9px] font-medium">{cell.over} over</span> : null}
        </>
      )}
    </button>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><TrafficCone className="h-5 w-5 text-primary" /> Cleaning Traffic</h1>
            <p className="text-sm text-muted-foreground">Capacity per region, looking ahead. Tap a cell to open that day in the schedule.</p>
          </div>
          <div className="flex items-center gap-3">
            <Legend />
            <div className="flex items-center gap-1">
              <button onClick={() => setAnchor((a) => addDays(a, -7))} className="p-1.5 rounded-md border border-border/50 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setAnchor(startOfDay(new Date()))} className="text-xs font-medium px-2 py-1.5 rounded-md border border-border/50 hover:bg-secondary">Today</button>
              <button onClick={() => setAnchor((a) => addDays(a, 7))} className="p-1.5 rounded-md border border-border/50 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-auto max-h-[calc(100vh-190px)]">
            <table className="border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-card">
                  <th className="sticky left-0 z-20 bg-card border-b border-r border-border/60 px-3 py-2 text-left font-semibold min-w-[150px]">Region</th>
                  {dates.map((d) => (
                    <th key={d.toISOString()} className={`border-b border-border/40 px-1 py-1.5 text-center min-w-[52px] ${isSameDay(d, today) ? "bg-primary/10" : ""}`}>
                      <div className="text-[10px] text-muted-foreground uppercase">{format(d, "EEE")}</div>
                      <div className="text-xs font-semibold">{format(d, "d")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-secondary/30">
                  <td className="sticky left-0 z-10 bg-secondary/40 border-b border-r border-border/60 px-3 py-1.5 font-semibold">All regions</td>
                  {dates.map((d) => <td key={d.toISOString()} className="border-b border-border/20 px-1 py-1"><CellBox cell={totalFor(d)} d={d} /></td>)}
                </tr>
                {regions.map((region) => (
                  <tr key={region} className="hover:bg-muted/10">
                    <td className="sticky left-0 z-10 bg-background border-b border-r border-border/60 px-3 py-1.5 font-medium truncate max-w-[160px]" title={region}>{region}</td>
                    {dates.map((d) => <td key={d.toISOString()} className="border-b border-border/20 px-1 py-1"><CellBox cell={cellFor(region, d)} d={d} /></td>)}
                  </tr>
                ))}
                {regions.length === 0 && (
                  <tr><td colSpan={DAYS + 1} className="px-3 py-16 text-center text-sm text-muted-foreground">No cleans scheduled in this window.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Legend() {
  const items: { label: string; cls: string }[] = [
    { label: "OK", cls: "bg-emerald-500/40" },
    { label: "Over ideal", cls: "bg-amber-500/50" },
    { label: "Unassigned", cls: "bg-red-500/50" },
  ];
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${i.cls}`} /> {i.label}</span>
      ))}
    </div>
  );
}
