import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useYoYData, PeriodType } from "@/hooks/useYoYData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const QUARTERS = ["Q1","Q2","Q3","Q4"];

function getPeriodOptions(type: PeriodType) {
  if (type === "month") return MONTHS.map((m, i) => ({ label: m, value: String(i + 1) }));
  if (type === "quarter") return QUARTERS.map((q, i) => ({ label: q, value: String(i + 1) }));
  return Array.from({ length: 52 }, (_, i) => ({ label: `W${i + 1}`, value: String(i + 1) }));
}

function getDefaultPeriodValue(type: PeriodType): number {
  const now = new Date();
  if (type === "month") return now.getMonth() + 1;
  if (type === "quarter") return Math.ceil((now.getMonth() + 1) / 3);
  return 1;
}

type MetricStatus = "pending" | "new" | "no-data" | "normal";

function getMetricStatus(current: number, previous: number): MetricStatus {
  if (current === 0 && previous > 0) return "pending";
  if (current > 0 && previous === 0) return "new";
  if (current === 0 && previous === 0) return "no-data";
  return "normal";
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function YoYBadge({ status, change }: { status: MetricStatus; change: number | null }) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-amber-500/30 text-amber-400 bg-amber-500/10 gap-1 font-semibold">
        <Minus className="h-3 w-3" /> Pending
      </Badge>
    );
  }
  if (status === "new") {
    return (
      <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-primary/30 text-primary bg-primary/10 gap-1 font-semibold">
        New
      </Badge>
    );
  }
  if (status === "no-data") {
    return (
      <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-border text-muted-foreground gap-1">
        <Minus className="h-3 w-3" /> No Data
      </Badge>
    );
  }
  if (change === null) {
    return (
      <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-border text-muted-foreground gap-1">
        <Minus className="h-3 w-3" /> N/A
      </Badge>
    );
  }
  const positive = change >= 0;
  return (
    <Badge
      variant="outline"
      className={`text-[11px] px-2 py-0.5 gap-1 font-semibold ${
        positive
          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
          : "border-red-500/30 text-red-400 bg-red-500/10"
      }`}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{change.toFixed(1)}%
    </Badge>
  );
}

function MetricRow({ label, value, current, previous }: { label: string; value: string; current: number; previous: number }) {
  const status = getMetricStatus(current, previous);
  const change = status === "normal" ? pctChange(current, previous) : null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
      <YoYBadge status={status} change={change} />
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="glass-card border-border/30">
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function YoYPerformance() {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [periodValue, setPeriodValue] = useState<number>(getDefaultPeriodValue("month"));
  const [year, setYear] = useState(2026);

  const { data, isLoading } = useYoYData(periodType, periodValue, year);
  const options = getPeriodOptions(periodType);

  const handleTypeChange = (type: PeriodType) => {
    setPeriodType(type);
    setPeriodValue(getDefaultPeriodValue(type));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground">YoY Performance</h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period type toggle */}
            <div className="flex rounded-lg border border-border/50 overflow-hidden">
              {(["week", "month", "quarter"] as PeriodType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    periodType === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Period value select */}
            <Select value={String(periodValue)} onValueChange={(v) => setPeriodValue(Number(v))}>
              <SelectTrigger className="w-[140px] h-8 text-xs border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year selector */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-foreground w-12 text-center">{year}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Comparing {year} vs {year - 1} · Sorted by revenue growth
        </p>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : data?.length === 0
              ? (
                <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
                  No reservation data for this period.
                </div>
              )
              : data?.map((p) => (
                <Card key={p.listingId} className="glass-card border-border/30 hover:border-primary/20 transition-colors">
                  <CardContent className="p-5">
                    <h3 className="font-display font-semibold text-foreground text-sm truncate">{p.name}</h3>
                    {p.city && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{p.city}</p>
                    )}
                    <div className="mt-4">
                      <MetricRow label="Revenue" value={fmt(p.currentRevenue)} current={p.currentRevenue} previous={p.previousRevenue} />
                      <MetricRow label="ADR" value={fmt(p.currentAdr)} current={p.currentAdr} previous={p.previousAdr} />
                      <MetricRow
                        label="Occupancy"
                        value={`${p.currentOccupancy.toFixed(1)}%`}
                        current={p.currentOccupancy}
                        previous={p.previousOccupancy}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </AppLayout>
  );
}
