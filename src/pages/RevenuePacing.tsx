import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRevenuePacing, useDefaultPacingMonth, usePortfolioPacing } from "@/hooks/useRevenuePacing";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, TrendingDown, Minus, Layers } from "lucide-react";
import { addMonths, startOfMonth, format } from "date-fns";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const formatGBP = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function getPacingStatus(pct: number): { label: string; color: string; bgClass: string; textClass: string } {
  if (pct >= 100) return { label: "AHEAD", color: "hsl(var(--success))", bgClass: "bg-emerald-500/10 border-emerald-500/30", textClass: "text-emerald-400" };
  if (pct >= 80) return { label: "TRACKING", color: "hsl(var(--primary))", bgClass: "bg-primary/10 border-primary/30", textClass: "text-primary" };
  return { label: "BEHIND", color: "hsl(var(--destructive))", bgClass: "bg-red-500/10 border-red-500/30", textClass: "text-red-400" };
}

export default function RevenuePacing() {
  const months = useMemo(() => {
    const next = startOfMonth(addMonths(new Date(), 1));
    return Array.from({ length: 8 }, (_, i) => startOfMonth(addMonths(next, i)));
  }, []);

  const { data: defaultIdx } = useDefaultPacingMonth(months);
  // -1 = portfolio view, 0+ = individual month
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (selectedIdx === null && defaultIdx !== undefined) {
      setSelectedIdx(defaultIdx);
    }
  }, [defaultIdx, selectedIdx]);

  const isPortfolio = selectedIdx === -1;
  const activeIdx = isPortfolio ? 0 : (selectedIdx ?? 0);
  const targetMonth = months[activeIdx];

  const { data, isLoading } = useRevenuePacing(targetMonth);
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolioPacing(months);

  const pacingPct = data?.pacingPct ?? 0;
  const clampedPct = Math.min(pacingPct, 200);
  const status = getPacingStatus(pacingPct);

  const hasData = !isLoading && data && (data.currentOTB > 0 || data.lastYearFinal > 0);

  const progressPct = data?.lastYearFinal
    ? Math.min((data.currentOTB / data.lastYearFinal) * 100, 100)
    : 0;
  const capturedPct = data?.lastYearFinal
    ? Math.round((data.currentOTB / data.lastYearFinal) * 100)
    : 0;

  const velocityData = useMemo(() => {
    if (!data) return [];
    const map = new Map<number, { daysOut: number; thisYear: number; lastYear: number }>();
    for (const p of data.velocityCurrent) {
      map.set(p.daysOut, { daysOut: p.daysOut, thisYear: p.cumulative, lastYear: 0 });
    }
    for (const p of data.velocityLastYear) {
      const existing = map.get(p.daysOut);
      if (existing) {
        existing.lastYear = p.cumulative;
      } else {
        map.set(p.daysOut, { daysOut: p.daysOut, thisYear: 0, lastYear: p.cumulative });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.daysOut - b.daysOut);
  }, [data]);

  // Portfolio chart data
  const portfolioChartData = useMemo(() => {
    if (!portfolio) return [];
    return portfolio.months.map(m => ({
      label: m.label,
      currentOTB: m.currentOTB,
      samePointLY: m.samePointLY,
    }));
  }, [portfolio]);

  const portfolioStatus = portfolio ? getPacingStatus(portfolio.portfolioPacingPct) : null;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            Revenue Pacing
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compare current bookings against the same point last year
          </p>
        </div>

        {/* Month Tabs — Portfolio tab first */}
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 w-fit flex-wrap">
          <button
            onClick={() => setSelectedIdx(-1)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              isPortfolio
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            All Months
          </button>
          {months.map((m, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                !isPortfolio && i === activeIdx
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {format(m, "MMM yyyy")}
            </button>
          ))}
        </div>

        {/* ─── PORTFOLIO VIEW ─── */}
        {isPortfolio && (
          portfolioLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : portfolio ? (
            <div className="space-y-6">
              {/* Section 1 — Portfolio KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-6 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total OTB Revenue</p>
                  <p className="text-2xl font-display font-bold text-foreground">{formatGBP(portfolio.totalOTB)}</p>
                </div>
                <div className="glass-card p-6 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total LY Final</p>
                  <p className="text-2xl font-display font-bold text-foreground">{formatGBP(portfolio.totalLYFinal)}</p>
                </div>
                <div className="glass-card p-6 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Portfolio Pacing</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-display font-bold text-foreground">
                      {Math.round(portfolio.portfolioPacingPct)}%
                    </p>
                    {portfolioStatus && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${portfolioStatus.bgClass} ${portfolioStatus.textClass}`}>
                        {portfolioStatus.label === "AHEAD" && <TrendingUp className="w-3 h-3" />}
                        {portfolioStatus.label === "TRACKING" && <Minus className="w-3 h-3" />}
                        {portfolioStatus.label === "BEHIND" && <TrendingDown className="w-3 h-3" />}
                        {portfolioStatus.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    vs {formatGBP(portfolio.totalSamePointLY)} same point last year · LY full year total: {formatGBP(portfolio.totalLYFinal)}
                  </p>
                </div>
                <div className="glass-card p-6 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Months Ahead</p>
                  <p className="text-2xl font-display font-bold text-foreground">
                    {portfolio.monthsAhead} <span className="text-sm text-muted-foreground font-normal">/ {portfolio.months.length}</span>
                  </p>
                </div>
              </div>

              {/* Section 2 — Grouped bar chart */}
              <div className="glass-card p-6 space-y-4">
                <p className="text-sm font-display font-semibold text-foreground">Month-by-Month Pacing</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={portfolioChartData} barGap={2} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                        formatter={(v: number, name: string) => [
                          formatGBP(v),
                          name === "currentOTB" ? "Current OTB" : "Same Point LY",
                        ]}
                      />
                      <Legend
                        formatter={(value) => value === "currentOTB" ? "Current OTB" : "Same Point LY"}
                        wrapperStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="currentOTB" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="samePointLY" fill="hsl(var(--muted-foreground))" opacity={0.35} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Section 3 — Month summary table */}
              <div className="glass-card p-6 space-y-4">
                <p className="text-sm font-display font-semibold text-foreground">Month Summary</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    <div className="col-span-3">Month</div>
                    <div className="col-span-2 text-right">Current OTB</div>
                    <div className="col-span-2 text-right">Same Pt LY</div>
                    <div className="col-span-2 text-right">LY Final</div>
                    <div className="col-span-1 text-right">Pacing</div>
                    <div className="col-span-2 text-right">Status</div>
                  </div>
                  {portfolio.months.map((m, i) => {
                    const ps = getPacingStatus(m.pacingPct);
                    return (
                      <button
                        key={m.label}
                        onClick={() => setSelectedIdx(i)}
                        className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors items-center w-full text-left cursor-pointer"
                      >
                        <div className="col-span-3 text-sm text-foreground font-medium">{m.label}</div>
                        <div className="col-span-2 text-sm text-foreground text-right font-medium">{formatGBP(m.currentOTB)}</div>
                        <div className="col-span-2 text-sm text-muted-foreground text-right">{formatGBP(m.samePointLY)}</div>
                        <div className="col-span-2 text-sm text-muted-foreground text-right">{formatGBP(m.lastYearFinal)}</div>
                        <div className="col-span-1 text-sm text-right font-semibold" style={{ color: ps.color }}>
                          {m.pacingPct > 900 ? "∞" : `${Math.round(m.pacingPct)}%`}
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ps.bgClass} ${ps.textClass}`}>
                            {ps.label === "AHEAD" && <TrendingUp className="w-3 h-3" />}
                            {ps.label === "TRACKING" && <Minus className="w-3 h-3" />}
                            {ps.label === "BEHIND" && <TrendingDown className="w-3 h-3" />}
                            {ps.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null
        )}

        {/* ─── INDIVIDUAL MONTH VIEW (unchanged) ─── */}
        {!isPortfolio && (
          <>
            {isLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-64 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
                </div>
              </div>
            ) : !hasData ? (
              <div className="glass-card p-8 flex flex-col items-center gap-3 border border-primary/30 bg-primary/5">
                <AlertCircle className="h-10 w-10 text-primary" />
                <p className="text-sm text-center text-muted-foreground max-w-md">
                  No booking data yet for <span className="font-semibold text-foreground">{format(targetMonth, "MMMM yyyy")}</span>.
                  This view will populate as bookings are confirmed.
                </p>
              </div>
            ) : (
              <>
                {/* Pacing Gauge */}
                <div className="glass-card p-8 flex flex-col items-center">
                  <svg viewBox="0 0 200 120" className="w-72 h-36 mb-4">
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="hsl(var(--secondary))" strokeWidth="14" strokeLinecap="round" />
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={status.color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(clampedPct / 200) * 251.2} 251.2`} className="transition-all duration-700" />
                    <text x="100" y="78" textAnchor="middle" className="fill-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }} fontSize="30">
                      {pacingPct > 900 ? "∞" : `${Math.round(pacingPct)}%`}
                    </text>
                    <text x="100" y="100" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="2" fill={status.color}>
                      {status.label}
                    </text>
                  </svg>
                  <p className="text-xs text-muted-foreground font-medium">
                    {data!.isStarted
                      ? `${data!.daysOut} days into ${format(targetMonth, "MMMM")}`
                      : `${data!.daysOut} days until ${format(targetMonth, "MMMM")} starts`}
                  </p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glass-card p-6 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Current OTB Revenue</p>
                    <p className="text-2xl font-display font-bold text-foreground">{formatGBP(data!.currentOTB)}</p>
                    <p className="text-xs text-muted-foreground">{data!.currentBookingCount} bookings</p>
                  </div>
                  <div className="glass-card p-6 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Same Point Last Year</p>
                    <p className="text-2xl font-display font-bold text-foreground">{formatGBP(data!.samePointLastYear)}</p>
                    <p className="text-xs text-muted-foreground">At {data!.daysOut} days {data!.isStarted ? "in" : "out"}</p>
                  </div>
                  <div className="glass-card p-6 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Last Year Final</p>
                    <p className="text-2xl font-display font-bold text-foreground">{formatGBP(data!.lastYearFinal)}</p>
                    <p className="text-xs text-muted-foreground">{capturedPct}% of last year's final captured</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="glass-card p-6 space-y-3">
                  <p className="text-sm font-display font-semibold text-foreground">Progress vs Last Year's Final</p>
                  <div className="relative">
                    <div className="h-5 rounded-full bg-secondary/50 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, backgroundColor: status.color }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatGBP(data!.currentOTB)} booked</span>
                    <span>{formatGBP(data!.lastYearFinal)} last year total</span>
                  </div>
                </div>

                {/* Property Breakdown */}
                {data!.propertyBreakdown.length > 0 && (
                  <div className="glass-card p-6 space-y-4">
                    <p className="text-sm font-display font-semibold text-foreground">Property-Level Pacing</p>
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        <div className="col-span-4">Property</div>
                        <div className="col-span-2">Location</div>
                        <div className="col-span-2 text-right">Current OTB</div>
                        <div className="col-span-2 text-right">Same Pt LY</div>
                        <div className="col-span-1 text-right">Pacing</div>
                        <div className="col-span-1 text-right">Status</div>
                      </div>
                      {data!.propertyBreakdown.map((prop) => {
                        const ps = getPacingStatus(prop.pacingPct);
                        return (
                          <div key={prop.listingId} className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors items-center">
                            <div className="col-span-4 text-sm text-foreground font-medium truncate">{prop.propertyName}</div>
                            <div className="col-span-2 text-xs text-muted-foreground truncate">{prop.locationGroup || "—"}</div>
                            <div className="col-span-2 text-sm text-foreground text-right font-medium">{formatGBP(prop.currentOTB)}</div>
                            <div className="col-span-2 text-sm text-muted-foreground text-right">{formatGBP(prop.samePointLY)}</div>
                            <div className="col-span-1 text-sm text-right font-semibold" style={{ color: ps.color }}>
                              {prop.pacingPct > 900 ? "∞" : `${Math.round(prop.pacingPct)}%`}
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ps.bgClass} ${ps.textClass}`}>
                                {ps.label === "AHEAD" && <TrendingUp className="w-3 h-3" />}
                                {ps.label === "TRACKING" && <Minus className="w-3 h-3" />}
                                {ps.label === "BEHIND" && <TrendingDown className="w-3 h-3" />}
                                {ps.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Velocity Chart */}
                {velocityData.length > 0 && (
                  <div className="glass-card p-6 space-y-4">
                    <p className="text-sm font-display font-semibold text-foreground">Booking Velocity</p>
                    <p className="text-xs text-muted-foreground">Cumulative revenue build-up — days before month start</p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={velocityData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="daysOut" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v === 0 ? "0" : `${v}d`} ticks={[-120, -90, -60, -30, -14, -7, 0].filter(t => velocityData.some(d => d.daysOut <= t + 5 && d.daysOut >= t - 5) || velocityData[0]?.daysOut <= t)} />
                          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(value: number, name: string) => [formatGBP(value), name === "thisYear" ? "This Year" : "Last Year"]} labelFormatter={(v) => `${v} days`} />
                          <Line type="monotone" dataKey="thisYear" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name="thisYear" />
                          <Line type="monotone" dataKey="lastYear" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="6 3" dot={false} name="lastYear" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
