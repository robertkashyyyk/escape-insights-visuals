import { AppLayout } from "@/components/layout/AppLayout";
import { useRevenueForecaster } from "@/hooks/useRevenueForecaster";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, AlertCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const formatCurrency = (v: number) =>
  `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const otb = payload.find((p: any) => p.dataKey === "otbRevenue")?.value ?? 0;
  const pickup = payload.find((p: any) => p.dataKey === "projectedPickup")?.value ?? 0;
  return (
    <div className="glass-card p-3 rounded-lg border border-border/30 text-sm space-y-1">
      <p className="font-display font-semibold text-foreground">{label}</p>
      <p className="text-primary">OTB Revenue: {formatCurrency(otb)}</p>
      <p className="text-primary/60">Projected Pickup: {formatCurrency(pickup)}</p>
      <p className="text-foreground font-medium border-t border-border/30 pt-1 mt-1">
        Projected Final: {formatCurrency(otb + pickup)}
      </p>
    </div>
  );
}

export default function RevenueForecaster() {
  const { data: months, isLoading } = useRevenueForecaster();

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            Revenue Forecaster
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stacked forecast — confirmed OTB revenue plus projected pickup based on historical booking curves.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-[350px] w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Stacked Bar Chart */}
            <div className="glass-card p-6 rounded-xl">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={months} barSize={64}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
                  />
                  <Bar
                    dataKey="otbRevenue"
                    name="OTB Revenue"
                    stackId="a"
                    fill="hsl(var(--primary))"
                    radius={[0, 0, 4, 4]}
                  />
                  <Bar
                    dataKey="projectedPickup"
                    name="Projected Pickup"
                    stackId="a"
                    fill="hsl(var(--primary) / 0.35)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(months ?? []).map((m, i) => {
                const otbPct = m.projectedFinal > 0 ? (m.otbRevenue / m.projectedFinal) * 100 : 100;
                return (
                  <div
                    key={m.month}
                    className="glass-card p-5 rounded-xl space-y-4 opacity-0 animate-fade-in"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {m.month}
                      </p>
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Target className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-2xl font-display font-bold text-foreground tracking-tight">
                      {formatCurrency(m.projectedFinal)}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>OTB: {formatCurrency(m.otbRevenue)}</span>
                        <span>Pickup: {formatCurrency(m.projectedPickup)}</span>
                      </div>
                      <Progress value={otbPct} className="h-2" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {m.hasHistoricalData ? (
                        <>
                          <TrendingUp className="h-3 w-3 text-primary" />
                          <span className="text-muted-foreground">Based on historical data</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">No historical data — OTB only</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
