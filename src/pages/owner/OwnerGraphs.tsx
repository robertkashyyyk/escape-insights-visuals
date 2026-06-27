import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import { OwnerLayout } from "@/components/layout/OwnerLayout";
import { useOwnerGraphData, type GraphMetric, type ZoomLevel, METRIC_OPTIONS, METRIC_COLORS } from "@/hooks/useOwnerGraphData";
import { type OwnerPeriodType, getPeriodRange, getPeriodLabel, shiftPeriod } from "@/hooks/useOwnerPortalData";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

const periods: OwnerPeriodType[] = ["Week", "Month", "Quarter", "Year"];
const zoomLevels: ZoomLevel[] = ["Day", "Week", "Month", "Quarter", "Year"];

// Metrics that make sense as lines vs bars
const LINE_METRICS = new Set<string>(["occupancy", "adr"]);
const isLineMetric = (m: GraphMetric) => {
  const base = m.replace("_checkin", "").replace("_created", "");
  return LINE_METRICS.has(base);
};

export default function OwnerGraphs() {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId } = useOwnerPreview();

  const now = new Date();
  const [periodType, setPeriodType] = useState<OwnerPeriodType>("Year");
  const [periodRef, setPeriodRef] = useState<Date>(now);
  const [zoom, setZoom] = useState<ZoomLevel>("Month");
  const [selectedMetrics, setSelectedMetrics] = useState<GraphMetric[]>(["revenue_checkin"]);
  const [filterListing, setFilterListing] = useState<string>("all");
  const [compare, setCompare] = useState(false);

  // Fetch owner's listings for the property filter dropdown
  const { data: ownerListings } = useQuery({
    queryKey: ["owner_graph_listings", isPreviewMode ? selectedOwnerId : user?.id],
    enabled: !!(isPreviewMode ? selectedOwnerId : user),
    queryFn: async () => {
      let q = supabase.from("listings").select("id, name").order("name");
      if (isPreviewMode && selectedOwnerId) {
        q = q.eq("owner_id", selectedOwnerId);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const { from, to } = getPeriodRange(periodType, periodRef);
  const label = getPeriodLabel(periodType, periodRef, now);
  const listingArg = filterListing === "all" ? null : filterListing;
  const { data: chartData, isLoading } = useOwnerGraphData(selectedMetrics, from, to, zoom, listingArg);

  // Compare: same period one year earlier, overlaid as "(Prev Yr)" series.
  const prevRef = useMemo(() => { const d = new Date(periodRef); d.setFullYear(d.getFullYear() - 1); return d; }, [periodRef]);
  const { from: prevFrom, to: prevTo } = getPeriodRange(periodType, prevRef);
  const { data: prevChartData } = useOwnerGraphData(selectedMetrics, prevFrom, prevTo, zoom, listingArg, compare);

  // Merge prev-year values onto the current buckets by index (same period length + zoom).
  const mergedData = useMemo(() => {
    if (!chartData) return chartData;
    if (!compare || !prevChartData) return chartData;
    return chartData.map((row: any, i: number) => {
      const prev = prevChartData[i] as any;
      if (!prev) return row;
      const withPrev: any = { ...row };
      for (const m of selectedMetrics) withPrev[`${m}_prev`] = prev[m];
      return withPrev;
    });
  }, [chartData, prevChartData, compare, selectedMetrics]);

  const canGoForward = (() => {
    const next = shiftPeriod(periodRef, periodType, 1);
    const { from: nf } = getPeriodRange(periodType, next);
    // Allow browsing forward into future periods (future bookings exist) up to a 2-year
    // horizon, rather than locking at the current period.
    const horizon = new Date(); horizon.setFullYear(horizon.getFullYear() + 2);
    return nf <= horizon;
  })();

  const toggleMetric = (m: GraphMetric) => {
    setSelectedMetrics(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const handlePeriodChange = (p: OwnerPeriodType) => {
    setPeriodType(p);
    setPeriodRef(now);
  };

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold text-foreground">My Graphs</h1>

        {/* Period + Zoom controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          {/* Period Type */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/50 border border-border/30">
            {periods.map(p => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  periodType === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Period Nav */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriodRef(shiftPeriod(periodRef, periodType, -1))}
              className="h-8 w-8 rounded-md border border-border/30 bg-secondary/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-foreground min-w-[180px] text-center">{label}</span>
            <button
              onClick={() => canGoForward && setPeriodRef(shiftPeriod(periodRef, periodType, 1))}
              disabled={!canGoForward}
              className={`h-8 w-8 rounded-md border border-border/30 bg-secondary/30 flex items-center justify-center transition-colors ${
                canGoForward ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {(() => {
              const cs = getPeriodRange(periodType, now).from;
              const ss = getPeriodRange(periodType, periodRef).from;
              if (cs.getTime() !== ss.getTime()) {
                return (
                  <button onClick={() => setPeriodRef(now)} className="text-[11px] text-primary hover:text-primary/80 font-medium ml-1">
                    Today
                  </button>
                );
              }
              return null;
            })()}
          </div>

          {/* Zoom By */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Zoom:</span>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-secondary/50 border border-border/30">
              {zoomLevels.map(z => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    zoom === z ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* Compare to previous year */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-primary" />
            Compare to prev year
          </label>

          {/* Property Filter */}
          <div className="sm:ml-auto">
            <Select value={filterListing} onValueChange={setFilterListing}>
              <SelectTrigger className="h-8 w-[200px] text-xs border-border/30">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {ownerListings?.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex flex-wrap gap-1.5">
          {METRIC_OPTIONS.map(opt => {
            const active = selectedMetrics.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleMetric(opt.value)}
                className={`px-2.5 py-1.5 text-[11px] font-medium rounded-full border transition-all ${
                  active
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/30 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                }`}
              >
                {opt.label}
                {active && <X className="h-3 w-3 inline ml-1 -mr-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-4 sm:p-6">
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : !chartData || chartData.length === 0 || selectedMetrics.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
                {selectedMetrics.length === 0 ? "Select at least one metric to display" : "No data for this period"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={420}>
                <ComposedChart data={mergedData ?? chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => {
                      if (value === 0) return [null, null]; // hide zero pipeline entries
                      const isRevenue = name.toLowerCase().includes("revenue") || name.toLowerCase().includes("adr");
                      const formatted = isRevenue
                        ? `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : name.toLowerCase().includes("occupancy")
                          ? `${value}%`
                          : value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
                      return [formatted, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {selectedMetrics.flatMap(m => {
                    const opt = METRIC_OPTIONS.find(o => o.value === m);
                    const color = METRIC_COLORS[m];
                    const isCheckin = m.endsWith("_checkin");
                    const els: any[] = [];

                    if (isLineMetric(m)) {
                      els.push(<Line key={m} type="monotone" dataKey={m} name={opt?.label} stroke={color} strokeWidth={2} dot={false} />);
                      if (isCheckin) {
                        els.push(<Line key={`${m}_pipeline`} type="monotone" dataKey={`${m}_pipeline`} name={`${opt?.label} (Pipeline)`} stroke={color} strokeWidth={2} strokeDasharray="5 5" dot={false} opacity={0.4} />);
                      }
                    } else if (isCheckin) {
                      els.push(<Bar key={m} dataKey={m} name={opt?.label} fill={color} stackId={`stack_${m}`} radius={[0, 0, 0, 0]} />);
                      els.push(<Bar key={`${m}_pipeline`} dataKey={`${m}_pipeline`} name={`${opt?.label} (Pipeline)`} fill={color} stackId={`stack_${m}`} opacity={0.3} radius={[3, 3, 0, 0]} />);
                    } else {
                      els.push(<Bar key={m} dataKey={m} name={opt?.label} fill={color} radius={[3, 3, 0, 0]} />);
                    }

                    // Previous-year overlay (dashed line) when Compare is on.
                    if (compare) {
                      els.push(<Line key={`${m}_prev`} type="monotone" dataKey={`${m}_prev`} name={`${opt?.label} (Prev Yr)`} stroke={color} strokeWidth={2} strokeDasharray="2 3" dot={false} opacity={0.55} />);
                    }
                    return els;
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </OwnerLayout>
  );
}
