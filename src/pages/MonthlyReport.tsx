import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMonthlyReport, type MonthlyReportData } from "@/hooks/useMonthlyReport";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, format, subQuarters } from "date-fns";
import {
  PoundSterling, Moon, PercentCircle, Briefcase, Building2,
  TrendingUp, TrendingDown, Minus, FileDown, Gauge,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type PeriodMode = "month" | "quarter" | "custom";

function getDefaultMonth(): Date {
  // Most recent completed month
  const now = new Date();
  return startOfMonth(subMonths(now, 1));
}

function YoYBadge({ current, previous }: { current: number; previous: number }) {
  if (current === 0 && previous === 0) {
    return (
      <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-border text-muted-foreground gap-1">
        <Minus className="h-3 w-3" /> No Data
      </Badge>
    );
  }
  if (current > 0 && previous === 0) {
    return (
      <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-primary/30 text-primary bg-primary/10 gap-1 font-semibold">
        New
      </Badge>
    );
  }
  if (current === 0 && previous > 0) {
    return (
      <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-amber-500/30 text-amber-400 bg-amber-500/10 gap-1 font-semibold">
        <Minus className="h-3 w-3" /> Pending
      </Badge>
    );
  }
  const change = ((current - previous) / previous) * 100;
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

function KpiCard({ icon: Icon, label, value, accentClass }: {
  icon: React.ElementType;
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className={`h-10 w-10 rounded-xl ${accentClass} flex items-center justify-center mb-3`}>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground tracking-tight">{value}</p>
    </div>
  );
}

export default function MonthlyReport() {
  // Owners list
  const { data: owners } = useQuery({
    queryKey: ["owners_list"],
    queryFn: async () => {
      const { data } = await supabase.from("property_owners").select("id, name").order("name");
      return data ?? [];
    },
  });

  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
  const [selectedQuarter, setSelectedQuarter] = useState(() => startOfQuarter(subQuarters(new Date(), 1)));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Auto-select first owner
  const ownerId = selectedOwnerId ?? owners?.[0]?.id ?? null;

  const { periodStart, periodEnd } = useMemo(() => {
    if (periodMode === "month") {
      return { periodStart: selectedMonth, periodEnd: endOfMonth(selectedMonth) };
    }
    if (periodMode === "quarter") {
      return { periodStart: selectedQuarter, periodEnd: endOfQuarter(selectedQuarter) };
    }
    // custom
    if (customStart && customEnd) {
      return { periodStart: new Date(customStart), periodEnd: new Date(customEnd) };
    }
    return { periodStart: selectedMonth, periodEnd: endOfMonth(selectedMonth) };
  }, [periodMode, selectedMonth, selectedQuarter, customStart, customEnd]);

  const { data: report, isLoading } = useMonthlyReport(ownerId, periodStart, periodEnd);

  // Build month options (last 24 months)
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = 1; i <= 24; i++) {
      const d = startOfMonth(subMonths(new Date(), i));
      opts.push({ value: d.toISOString(), label: format(d, "MMMM yyyy") });
    }
    return opts;
  }, []);

  // Quarter options
  const quarterOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = 1; i <= 8; i++) {
      const d = startOfQuarter(subQuarters(new Date(), i));
      opts.push({ value: d.toISOString(), label: `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}` });
    }
    return opts;
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground">Monthly Report</h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled className="gap-2 opacity-60">
                <FileDown className="h-4 w-4" /> Export PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Owner */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Owner</label>
            <Select value={ownerId ?? ""} onValueChange={setSelectedOwnerId}>
              <SelectTrigger className="w-[200px] h-9 text-xs border-border/50">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {owners?.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period mode */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Period</label>
            <div className="flex rounded-lg border border-border/50 overflow-hidden h-9">
              {(["month", "quarter", "custom"] as PeriodMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPeriodMode(m)}
                  className={`px-3 text-xs font-medium capitalize transition-colors ${
                    periodMode === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Month/Quarter/Custom selector */}
          {periodMode === "month" && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Month</label>
              <Select value={selectedMonth.toISOString()} onValueChange={(v) => setSelectedMonth(new Date(v))}>
                <SelectTrigger className="w-[180px] h-9 text-xs border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {periodMode === "quarter" && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Quarter</label>
              <Select value={selectedQuarter.toISOString()} onValueChange={(v) => setSelectedQuarter(new Date(v))}>
                <SelectTrigger className="w-[140px] h-9 text-xs border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarterOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {periodMode === "custom" && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">From</label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-[150px] h-9 text-xs border-border/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">To</label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-[150px] h-9 text-xs border-border/50"
                />
              </div>
            </>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          </div>
        )}

        {/* No data */}
        {!isLoading && !report && ownerId && (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground text-sm">No data available for this owner and period.</p>
          </div>
        )}

        {/* Report content */}
        {report && (
          <div className="space-y-6 animate-fade-in">
            {/* Section 1 — Header */}
            <div className="glass-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-display font-bold text-foreground">{report.owner.name}</h2>
                  {report.owner.company && (
                    <p className="text-sm text-muted-foreground mt-0.5">{report.owner.company}</p>
                  )}
                  <p className="text-sm text-primary font-medium mt-2">{report.periodLabel}</p>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm font-medium">{report.propertyCount} {report.propertyCount === 1 ? "property" : "properties"}</span>
                </div>
              </div>
            </div>

            {/* Section 2 — KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard icon={PoundSterling} label="Rental Revenue" value={fmt(report.totalRevenue)} accentClass="bg-primary/10" />
              <KpiCard icon={Briefcase} label="Management Fees" value={fmt(report.managementFee)} accentClass="bg-accent/10" />
              <KpiCard icon={Moon} label="Nights Occupied" value={String(report.totalNights)} accentClass="bg-chart-3/10" />
              <KpiCard icon={PercentCircle} label="Avg Occupancy" value={`${report.avgOccupancy.toFixed(1)}%`} accentClass="bg-chart-4/10" />
              <KpiCard icon={Gauge} label="Avg Nightly Rate" value={fmt(report.avgNightlyRate)} accentClass="bg-chart-5/10" />
            </div>

            {/* Section 3 — YoY Comparison */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">vs Prior Year</h3>
              <div className="space-y-0">
                {[
                  { label: "Revenue", current: report.totalRevenue, previous: report.prevRevenue, format: fmt },
                  { label: "ADR", current: report.currentAdr, previous: report.prevAdr, format: fmt },
                  { label: "Occupancy", current: report.currentOccupancy, previous: report.prevOccupancy, format: (v: number) => `${v.toFixed(1)}%` },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-3 border-b border-border/30 last:border-b-0">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{row.label}</p>
                      <p className="text-sm font-semibold text-foreground">{row.format(row.current)}</p>
                    </div>
                    <YoYBadge current={row.current} previous={row.previous} />
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4 — Property breakdown */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">Property Breakdown</h3>
              <div className="space-y-0">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-2 pb-2 border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  <div className="col-span-4">Property</div>
                  <div className="col-span-1 text-right">Nights</div>
                  <div className="col-span-2 text-right">Revenue</div>
                  <div className="col-span-2 text-right">ADR</div>
                  <div className="col-span-1 text-right">Occ %</div>
                  <div className="col-span-2 text-right">vs Last Year</div>
                </div>
                {report.properties.map((p) => (
                  <div key={p.listingId} className="grid grid-cols-12 gap-2 py-3 border-b border-border/20 last:border-b-0 items-center">
                    <div className="col-span-4 text-sm font-medium text-foreground truncate">{p.name}</div>
                    <div className="col-span-1 text-sm text-muted-foreground text-right">{p.nights}</div>
                    <div className="col-span-2 text-sm text-foreground font-medium text-right">{fmt(p.revenue)}</div>
                    <div className="col-span-2 text-sm text-muted-foreground text-right">{fmt(p.adr)}</div>
                    <div className="col-span-1 text-sm text-muted-foreground text-right">{p.occupancy.toFixed(0)}%</div>
                    <div className="col-span-2 flex justify-end">
                      <YoYBadge current={p.revenue} previous={p.prevRevenue} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5 — Monthly trend */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">Revenue Trend — Last 6 Months</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.monthlyTrend} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                    />
                    <ReTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(v: number) => [fmt(v), "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
