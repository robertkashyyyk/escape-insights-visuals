import { useState, useMemo } from "react";
import { OwnerLayout } from "@/components/layout/OwnerLayout";
import { useOwnerGraphData, type GraphMetric, type ZoomLevel, METRIC_OPTIONS, METRIC_COLORS } from "@/hooks/useOwnerGraphData";
import { type OwnerPeriodType, getPeriodRange, getPeriodLabel, shiftPeriod } from "@/hooks/useOwnerPortalData";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { isFuture } from "date-fns";
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
  const now = new Date();
  const [periodType, setPeriodType] = useState<OwnerPeriodType>("Year");
  const [periodRef, setPeriodRef] = useState<Date>(now);
  const [zoom, setZoom] = useState<ZoomLevel>("Month");
  const [selectedMetrics, setSelectedMetrics] = useState<GraphMetric[]>(["revenue_checkin"]);

  const { from, to } = getPeriodRange(periodType, periodRef);
  const label = getPeriodLabel(periodType, periodRef, now);
  const { data: chartData, isLoading } = useOwnerGraphData(selectedMetrics, from, to, zoom);

  const canGoForward = (() => {
    const next = shiftPeriod(periodRef, periodType, 1);
    const { from: nf } = getPeriodRange(periodType, next);
    return !isFuture(nf);
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
                <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
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
                  {selectedMetrics.map(m => {
                    const opt = METRIC_OPTIONS.find(o => o.value === m);
                    const color = METRIC_COLORS[m];
                    if (isLineMetric(m)) {
                      return <Line key={m} type="monotone" dataKey={m} name={opt?.label} stroke={color} strokeWidth={2} dot={false} />;
                    }
                    return <Bar key={m} dataKey={m} name={opt?.label} fill={color} radius={[3, 3, 0, 0]} />;
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
