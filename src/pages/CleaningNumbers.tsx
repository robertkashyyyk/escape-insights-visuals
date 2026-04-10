import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format, addDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, isBefore, isAfter, isSameMonth, startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CleanerInfo {
  id: string;
  name: string;
  rate_per_clean: number;
  active: boolean;
  location_groups: string[];
  workload_share: Record<string, number>;
  non_working_days: string[];
}

interface UnifiedTask {
  id: string;
  assigned_cleaner_id: string | null;
  scheduled_date: string;
  status: string;
  cleaning_duration_minutes: number;
  source: "db" | "reservation";
}

export default function CleaningNumbers() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const rangeStart = period === "week"
    ? startOfWeek(selectedDate, { weekStartsOn: 1 })
    : startOfMonth(selectedDate);
  const rangeEnd = period === "week"
    ? endOfWeek(selectedDate, { weekStartsOn: 1 })
    : endOfMonth(selectedDate);
  const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
  const rangeEndStr = format(rangeEnd, "yyyy-MM-dd");

  const today = startOfDay(new Date());
  const isPast = isAfter(today, rangeEnd);
  const isCurrent = !isBefore(today, rangeStart) && !isAfter(today, rangeEnd);

  // Previous period for comparison
  const prevRangeStart = period === "month" ? startOfMonth(subMonths(selectedDate, 1)) : startOfWeek(subWeeks(selectedDate, 1), { weekStartsOn: 1 });
  const prevRangeEnd = period === "month" ? endOfMonth(subMonths(selectedDate, 1)) : endOfWeek(subWeeks(selectedDate, 1), { weekStartsOn: 1 });
  const prevStartStr = format(prevRangeStart, "yyyy-MM-dd");
  const prevEndStr = format(prevRangeEnd, "yyyy-MM-dd");

  const { data: cleaners = [] } = useQuery({
    queryKey: ["cleaners-numbers"],
    queryFn: async () => {
      const { data } = await supabase.from("cleaners" as any).select("*").eq("active", true).order("name");
      return ((data || []) as any[]).map((c: any): CleanerInfo => ({
        id: c.id, name: c.name, rate_per_clean: c.rate_per_clean ?? 0, active: c.active,
        location_groups: c.location_groups || [], workload_share: c.workload_share || {},
        non_working_days: c.non_working_days || [],
      }));
    },
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["listings-numbers"],
    queryFn: async () => {
      const { data } = await supabase.from("listings").select("id, location_group, cleaning_duration_minutes").eq("status", "active");
      return (data || []) as { id: string; location_group: string | null; cleaning_duration_minutes: number | null }[];
    },
  });

  const listingMap = useMemo(() => {
    const m = new Map<string, { location_group: string | null; cleaning_duration_minutes: number | null }>();
    listings.forEach(l => m.set(l.id, l));
    return m;
  }, [listings]);

  // DB clean_tasks
  const { data: dbTasks = [] } = useQuery({
    queryKey: ["clean-tasks-numbers", rangeStartStr, rangeEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("clean_tasks" as any)
        .select("id, assigned_cleaner_id, scheduled_date, status, cleaning_duration_minutes")
        .gte("scheduled_date", rangeStartStr)
        .lte("scheduled_date", rangeEndStr);
      return (data || []) as any[];
    },
  });

  // Reservation checkouts in range (to fill dates without DB tasks)
  const { data: checkoutReservations = [] } = useQuery({
    queryKey: ["reservations-numbers-checkouts", rangeStartStr, rangeEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("reservations")
        .select("id, listing_id, check_out, status")
        .gte("check_out", rangeStartStr)
        .lte("check_out", rangeEndStr)
        .in("status", ["confirmed", "new", "modified"]);
      return (data || []) as { id: string; listing_id: string; check_out: string; status: string }[];
    },
  });

  // Previous period reservations for comparison
  const { data: prevCheckoutReservations = [] } = useQuery({
    queryKey: ["reservations-numbers-prev-checkouts", prevStartStr, prevEndStr],
    enabled: period === "month",
    queryFn: async () => {
      const { data } = await supabase
        .from("reservations")
        .select("id, listing_id, check_out, status")
        .gte("check_out", prevStartStr)
        .lte("check_out", prevEndStr)
        .in("status", ["confirmed", "new", "modified"]);
      return (data || []) as { id: string; listing_id: string; check_out: string; status: string }[];
    },
  });

  const { data: prevDbTasks = [] } = useQuery({
    queryKey: ["clean-tasks-numbers-prev", prevStartStr, prevEndStr],
    enabled: period === "month",
    queryFn: async () => {
      const { data } = await supabase
        .from("clean_tasks" as any)
        .select("id, status")
        .gte("scheduled_date", prevStartStr)
        .lte("scheduled_date", prevEndStr);
      return (data || []) as any[];
    },
  });

  // Merge: for each date, use DB tasks if they exist, otherwise derive from reservations
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const tasks: UnifiedTask[] = useMemo(() => {
    // Find which dates have DB tasks
    const dbDates = new Set(dbTasks.map((t: any) => t.scheduled_date));
    
    // Start with all DB tasks
    const result: UnifiedTask[] = dbTasks.map((t: any) => ({
      id: t.id,
      assigned_cleaner_id: t.assigned_cleaner_id,
      scheduled_date: t.scheduled_date,
      status: t.status,
      cleaning_duration_minutes: t.cleaning_duration_minutes ?? 90,
      source: "db" as const,
    }));

    // For dates without DB tasks, derive from reservation checkouts
    // Simple round-robin allocation based on workload_share
    const resByDate = new Map<string, typeof checkoutReservations>();
    checkoutReservations.forEach(r => {
      if (dbDates.has(r.check_out)) return; // skip dates with DB tasks
      if (!resByDate.has(r.check_out)) resByDate.set(r.check_out, []);
      resByDate.get(r.check_out)!.push(r);
    });

    resByDate.forEach((reservations, dateStr) => {
      const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
      const dayName = DAY_NAMES[dayOfWeek];
      
      // Simple allocation: distribute among eligible cleaners by workload_share
      const cleanerTaskCounts: Record<string, number> = {};
      
      reservations.forEach(r => {
        const listing = listingMap.get(r.listing_id);
        const locationGroup = listing?.location_group ?? "Other";
        
        // Find eligible cleaners
        const eligible = cleaners.filter(c => {
          if (!c.location_groups.includes(locationGroup)) return false;
          if (c.non_working_days.includes(dayName)) return false;
          return true;
        });

        let assignedId: string | null = null;
        if (eligible.length > 0) {
          // Pick cleaner with highest deficit vs target share
          let best = eligible[0];
          let bestDeficit = -Infinity;
          const totalInRegion = eligible.reduce((sum, c) => sum + (cleanerTaskCounts[c.id] ?? 0), 0);
          for (const c of eligible) {
            const targetShare = c.workload_share[locationGroup] ?? 100;
            const actualShare = totalInRegion > 0 ? ((cleanerTaskCounts[c.id] ?? 0) / totalInRegion) * 100 : 0;
            const deficit = targetShare - actualShare;
            if (deficit > bestDeficit) { bestDeficit = deficit; best = c; }
          }
          assignedId = best.id;
          cleanerTaskCounts[best.id] = (cleanerTaskCounts[best.id] ?? 0) + 1;
        }

        result.push({
          id: `res-${r.id}`,
          assigned_cleaner_id: assignedId,
          scheduled_date: r.check_out,
          status: "scheduled",
          cleaning_duration_minutes: listing?.cleaning_duration_minutes ?? 90,
          source: "reservation",
        });
      });
    });

    return result;
  }, [dbTasks, checkoutReservations, cleaners, listingMap]);

  // Previous period: merge DB tasks + reservations
  const prevTotalCleans = useMemo(() => {
    const prevDbDates = new Set(prevDbTasks.map((t: any) => t.scheduled_date));
    const fromDb = prevDbTasks.length;
    const fromRes = prevCheckoutReservations.filter(r => !prevDbDates.has(r.check_out)).length;
    return fromDb + fromRes;
  }, [prevDbTasks, prevCheckoutReservations]);

  const navigate = (dir: number) => {
    if (period === "week") setSelectedDate(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setSelectedDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
  };

  const periodLabel = period === "week"
    ? `Week of ${format(rangeStart, "d MMM yyyy")}`
    : format(selectedDate, "MMMM yyyy");

  // Stats
  const totalCleans = tasks.length;
  const completedCleans = tasks.filter((t: any) => t.status === "completed" || t.status === "complete").length;
  const pendingCleans = totalCleans - completedCleans;

  const totalCost = useMemo(() => {
    let cost = 0;
    tasks.forEach((t: any) => {
      const cleaner = cleaners.find(c => c.id === t.assigned_cleaner_id);
      cost += cleaner?.rate_per_clean ?? 0;
    });
    return cost;
  }, [tasks, cleaners]);

  const avgPerDay = period === "week" ? (totalCleans / 7) : (totalCleans / (rangeEnd.getDate()));

  // Busiest cleaner
  const cleanerCounts = useMemo(() => {
    const counts: Record<string, { completed: number; pending: number }> = {};
    tasks.forEach((t: any) => {
      const cid = t.assigned_cleaner_id;
      if (!cid) return;
      if (!counts[cid]) counts[cid] = { completed: 0, pending: 0 };
      if (t.status === "completed" || t.status === "complete") counts[cid].completed++;
      else counts[cid].pending++;
    });
    return counts;
  }, [tasks]);

  const busiestCleaner = useMemo(() => {
    let best = { name: "—", count: 0 };
    Object.entries(cleanerCounts).forEach(([cid, { completed, pending }]) => {
      const total = completed + pending;
      if (total > best.count) {
        const c = cleaners.find(cl => cl.id === cid);
        best = { name: c?.name ?? "Unknown", count: total };
      }
    });
    return best;
  }, [cleanerCounts, cleaners]);

  // Month comparison
  const monthChange = prevTotalCleans > 0 ? Math.round(((totalCleans - prevTotalCleans) / prevTotalCleans) * 100) : 0;

  // Chart data
  const chartData = useMemo(() => {
    if (period === "week") {
      const days: { label: string; cleans: number; completionRatio: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(rangeStart, i);
        const ds = format(d, "yyyy-MM-dd");
        const dayTasks = tasks.filter((t) => t.scheduled_date === ds);
        const completed = dayTasks.filter(t => t.status === "completed" || t.status === "complete").length;
        const ratio = dayTasks.length > 0 ? completed / dayTasks.length : 0;
        days.push({ label: format(d, "EEE"), cleans: dayTasks.length, completionRatio: ratio });
      }
      return days;
    } else {
      const weeks: { label: string; cleans: number; completionRatio: number }[] = [];
      let ws = startOfWeek(rangeStart, { weekStartsOn: 1 });
      let weekNum = 1;
      while (isBefore(ws, rangeEnd)) {
        const we = endOfWeek(ws, { weekStartsOn: 1 });
        const wsStr = format(ws, "yyyy-MM-dd");
        const weStr = format(we, "yyyy-MM-dd");
        const weekTasks = tasks.filter((t) => t.scheduled_date >= wsStr && t.scheduled_date <= weStr);
        const completed = weekTasks.filter(t => t.status === "completed" || t.status === "complete").length;
        const ratio = weekTasks.length > 0 ? completed / weekTasks.length : 0;
        weeks.push({ label: `Week ${weekNum}`, cleans: weekTasks.length, completionRatio: ratio });
        ws = addWeeks(ws, 1);
        weekNum++;
      }
      return weeks;
    }
  }, [period, tasks, rangeStart, rangeEnd]);

  // Interpolate amber → green based on completion ratio
  const getBarColor = (ratio: number): string => {
    // amber: hsl(38, 92%, 50%) → green: hsl(142, 71%, 45%)
    const h = 38 + (142 - 38) * ratio;
    const s = 92 + (71 - 92) * ratio;
    const l = 50 + (45 - 50) * ratio;
    return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
  };

  // Badge helper
  const statusBadge = isPast
    ? <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Actual</Badge>
    : isCurrent
    ? <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Projected</Badge>
    : <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Estimate</Badge>;

  // Cleaner breakdown
  const cleanerBreakdown = useMemo(() => {
    return cleaners.map(c => {
      const counts = cleanerCounts[c.id] ?? { completed: 0, pending: 0 };
      const actualCost = counts.completed * c.rate_per_clean;
      const estimateCost = counts.pending * c.rate_per_clean;
      const totalCleaner = actualCost + estimateCost;
      return {
        ...c,
        completed: counts.completed,
        pending: counts.pending,
        total: counts.completed + counts.pending,
        actualCost,
        estimateCost,
        totalCost: totalCleaner,
      };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [cleaners, cleanerCounts]);

  // Invoice readiness
  const invoiceReadiness = useMemo(() => {
    if (!isPast && !isCurrent) return [];
    return cleanerBreakdown.map(c => ({
      name: c.name,
      confirmed: c.completed,
      unconfirmed: c.pending,
      cost: c.completed * c.rate_per_clean,
      ready: c.pending === 0,
    }));
  }, [cleanerBreakdown, isPast, isCurrent]);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight font-display">
            Cleaning Numbers
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Financial performance and cleaner totals
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg border border-border/30 p-1">
            <button
              onClick={() => setPeriod("week")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === "week" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Week
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === "month" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Month
            </button>
          </div>

          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg border border-border/30 p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 py-1.5 text-xs font-medium text-foreground min-w-[140px] text-center">
              {periodLabel}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {statusBadge}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/30 bg-card/50">
            <CardContent className="p-4">
              <p className="text-2xl font-display font-bold text-foreground">{totalCleans}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Total cleans {period === "week" ? "this week" : "this month"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/50">
            <CardContent className="p-4">
              <p className="text-2xl font-display font-bold text-foreground">
                £{totalCost.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Total cleaner cost {isPast ? "(actual)" : "(estimate)"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/50">
            <CardContent className="p-4">
              <p className="text-2xl font-display font-bold text-foreground">
                {avgPerDay.toFixed(1)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Average cleans per {period === "week" ? "day" : "week"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/50">
            <CardContent className="p-4">
              {period === "week" ? (
                <>
                  <p className="text-2xl font-display font-bold text-foreground">{busiestCleaner.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{busiestCleaner.count} cleans</p>
                </>
              ) : (
                <>
                  <p className={`text-2xl font-display font-bold ${monthChange >= 0 ? "text-success" : "text-destructive"}`}>
                    {monthChange >= 0 ? "+" : ""}{monthChange}%
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    vs {format(subMonths(selectedDate, 1), "MMMM yyyy")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cleaner Breakdown */}
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider mb-3">
            Cleaner Breakdown
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {cleanerBreakdown.map(c => (
              <Card key={c.id} className="border-border/30 bg-card/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{c.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-semibold text-foreground text-sm">{c.name}</h4>
                      <p className="text-[11px] text-muted-foreground">£{c.rate_per_clean}/clean</p>
                    </div>
                    {isPast ? (
                      <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Actual</Badge>
                    ) : isCurrent ? (
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Projected</Badge>
                    ) : (
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Estimate</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-display font-bold text-foreground">{c.completed}</p>
                      <p className="text-[10px] text-muted-foreground">Completed</p>
                    </div>
                    <div>
                      <p className="text-lg font-display font-bold text-foreground">{c.pending}</p>
                      <p className="text-[10px] text-muted-foreground">Pending</p>
                    </div>
                    <div>
                      <p className="text-lg font-display font-bold text-primary">£{c.totalCost.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>
                  {isCurrent && c.pending > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/20 pt-2">
                      £{c.actualCost.toLocaleString()} actual + £{c.estimateCost.toLocaleString()} estimated = £{c.totalCost.toLocaleString()} projected
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
            {cleanerBreakdown.length === 0 && (
              <Card className="border-border/30 bg-card/50 p-8 text-center col-span-2">
                <p className="text-sm text-muted-foreground">No cleaning data for this period.</p>
              </Card>
            )}
          </div>
        </div>

        {/* Trend Chart */}
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider mb-3">
            {period === "week" ? "Week Trend" : "Monthly Trend"}
          </h3>
          <Card className="border-border/30 bg-card/50">
            <CardContent className="p-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(222 22% 10%)",
                        border: "1px solid hsl(222 15% 18%)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "hsl(220 20% 92%)" }}
                      formatter={(value: number, _name: string, props: any) => {
                        const ratio = props.payload.completionRatio;
                        const completed = Math.round(ratio * (props.payload.cleans));
                        const pending = props.payload.cleans - completed;
                        return [`${completed} completed · ${pending} pending`, "Cleans"];
                      }}
                    />
                    <Bar dataKey="cleans" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={getBarColor(entry.completionRatio)} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No data for chart</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invoice Readiness */}
        {(isPast || isCurrent) && invoiceReadiness.length > 0 && (
          <div>
            <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider mb-3">
              Invoice Readiness
            </h3>
            <div className="space-y-2">
              {invoiceReadiness.map(r => (
                <div
                  key={r.name}
                  className={`glass-card rounded-xl border p-4 flex items-center justify-between ${
                    r.ready ? "border-success/20" : "border-primary/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {r.ready ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-primary shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-display font-semibold text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.confirmed} clean{r.confirmed !== 1 ? "s" : ""} confirmed · £{r.cost.toLocaleString()}
                        {!r.ready && ` · ${r.unconfirmed} clean${r.unconfirmed !== 1 ? "s" : ""} unconfirmed`}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      r.ready
                        ? "border-success/30 text-success"
                        : "border-primary/30 text-primary"
                    }`}
                  >
                    {r.ready ? "Ready to invoice ✓" : "Not ready ⚠"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
