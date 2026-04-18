import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useYoYData, PeriodType } from "@/hooks/useYoYData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, LayoutGrid, Table as TableIcon } from "lucide-react";
import { YoYTable } from "@/components/yoy/YoYTable";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const QUARTERS = ["Q1","Q2","Q3","Q4"];

function getPeriodOptions(type: PeriodType) {
  if (type === "month") return MONTHS.map((m, i) => ({ label: m, value: String(i + 1) }));
  if (type === "quarter") return QUARTERS.map((q, i) => ({ label: q, value: String(i + 1) }));
  return Array.from({ length: 52 }, (_, i) => ({ label: `W${i + 1}`, value: String(i + 1) }));
}

function getDefaultPeriodValue(type: PeriodType): number {
  const now = new Date();
  if (type === "month") {
    const m = now.getMonth(); // 0-indexed, so this is "last month" as 1-indexed
    return m === 0 ? 12 : m;
  }
  if (type === "quarter") {
    const q = Math.ceil((now.getMonth() + 1) / 3);
    return q === 1 ? 4 : q - 1;
  }
  return 1;
}

function getDefaultYear(type: PeriodType): number {
  const now = new Date();
  if (type === "month" && now.getMonth() === 0) return now.getFullYear() - 1;
  if (type === "quarter" && Math.ceil((now.getMonth() + 1) / 3) === 1) return now.getFullYear() - 1;
  return now.getFullYear();
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
  const [year, setYear] = useState(getDefaultYear("month"));
  const [likeForLike, setLikeForLike] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    try {
      const stored = sessionStorage.getItem("yoy-view-mode");
      return stored === "table" ? "table" : "card";
    } catch { return "card"; }
  });

  const handleViewMode = (m: "card" | "table") => {
    setViewMode(m);
    try { sessionStorage.setItem("yoy-view-mode", m); } catch {}
  };

  const { data, isLoading } = useYoYData(periodType, periodValue, year);
  const options = getPeriodOptions(periodType);

  // Like-for-like: only properties with confirmed reservations in BOTH years
  const filteredData = useMemo(() => {
    if (!data) return data;
    if (!likeForLike) return data;
    return data.filter(
      (p) => !p.isNew && p.previousRevenue > 0 && p.currentRevenue > 0
    );
  }, [data, likeForLike]);

  const handleTypeChange = (type: PeriodType) => {
    setPeriodType(type);
    setPeriodValue(getDefaultPeriodValue(type));
    setYear(getDefaultYear(type));
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Comparing {year} vs {year - 1} · Sorted by revenue growth
            {likeForLike && filteredData && data && (
              <span className="ml-2 text-foreground/70">
                · Showing {filteredData.length} of {data.length} properties (like-for-like)
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex rounded-lg border border-border/50 overflow-hidden">
              <button
                onClick={() => handleViewMode("card")}
                className={`px-2.5 py-1 text-xs font-medium gap-1.5 inline-flex items-center transition-colors ${
                  viewMode === "card"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
                aria-pressed={viewMode === "card"}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
              <button
                onClick={() => handleViewMode("table")}
                className={`px-2.5 py-1 text-xs font-medium gap-1.5 inline-flex items-center transition-colors ${
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
                aria-pressed={viewMode === "table"}
              >
                <TableIcon className="h-3.5 w-3.5" /> Table
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="like-for-like"
                checked={likeForLike}
                onCheckedChange={setLikeForLike}
              />
              <Label htmlFor="like-for-like" className="text-xs text-muted-foreground cursor-pointer">
                Like-for-like only
                <span className="block text-[10px] text-muted-foreground/70">
                  Excludes properties without bookings in both years
                </span>
              </Label>
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === "table" ? (
          isLoading ? (
            <div className="glass-card p-6"><Skeleton className="h-64 w-full" /></div>
          ) : (
            <YoYTable
              data={filteredData ?? []}
              currentYear={year}
              previousYear={year - 1}
              filenamePrefix={`yoy-${year - 1}-vs-${year}`}
            />
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : filteredData?.length === 0
                ? (
                  <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
                    {likeForLike
                      ? "No properties have confirmed bookings in both years for this period."
                      : "No reservation data for this period."}
                  </div>
                )
                : filteredData?.map((p) => (
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
        )}
      </div>
    </AppLayout>
  );
}
