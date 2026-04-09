import { useState } from "react";
import { useOwnerPortfolio } from "@/hooks/useOwnerPortfolio";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ChevronLeft, ChevronRight, PoundSterling, Percent, BedDouble } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface OwnerPortfolioProps {
  owner: { id: string; name: string; company: string | null };
  onBack: () => void;
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 rounded-lg border border-border/50 shadow-xl">
      <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
      <span className="text-sm font-display font-semibold text-foreground">{fmt(payload[0].value)}</span>
    </div>
  );
};

export function OwnerPortfolio({ owner, onBack }: OwnerPortfolioProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useOwnerPortfolio(owner.id, year);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">{owner.name}</h2>
            {owner.company && <p className="text-xs text-muted-foreground">{owner.company}</p>}
          </div>
        </div>
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))
        ) : (
          <>
            <KpiCard
              title="Portfolio Revenue"
              value={fmt(data?.totalRevenue ?? 0)}
              icon={PoundSterling}
              accentColor="primary"
              delay={0}
            />
            <KpiCard
              title="Avg Occupancy"
              value={`${(data?.avgOccupancy ?? 0).toFixed(1)}%`}
              icon={Percent}
              accentColor="accent"
              delay={100}
            />
            <KpiCard
              title="Blended ADR"
              value={fmt(data?.blendedAdr ?? 0)}
              icon={BedDouble}
              accentColor="chart-3"
              delay={200}
            />
          </>
        )}
      </div>

      {/* Monthly Revenue Chart */}
      <div className="glass-card p-6">
        <h3 className="font-display font-bold text-lg text-foreground mb-1">Monthly Revenue</h3>
        <p className="text-xs text-muted-foreground mb-6">Revenue breakdown by month for {year}</p>
        <div className="h-[300px] w-full">
          {isLoading ? (
            <div className="flex items-end gap-2 h-full pb-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${30 + Math.random() * 60}%` }} />
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyRevenue ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 15% 18%)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(220 10% 55%)", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(222 15% 18%)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(222 15% 18% / 0.3)" }} />
                <Bar dataKey="revenue" fill="hsl(38 92% 50%)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Property Breakdown */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-6 pb-3">
          <h3 className="font-display font-bold text-lg text-foreground">Property Breakdown</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue contribution by property</p>
        </div>
        {isLoading ? (
          <div className="p-6 pt-0 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : data?.properties.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No reservation data for {year}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Nights</TableHead>
                <TableHead className="text-right">ADR</TableHead>
                <TableHead className="w-[140px]">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.properties.map((p) => (
                <TableRow key={p.listingId}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{fmt(p.revenue)}</TableCell>
                  <TableCell className="text-right">{p.nights}</TableCell>
                  <TableCell className="text-right">{fmt(p.adr)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(p.pctOfTotal, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{p.pctOfTotal.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
