import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { usePricingStrategy } from "@/hooks/usePricingStrategy";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 rounded-lg border border-border/50 shadow-xl">
      <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">€{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PricingStrategy() {
  const [locationGroup, setLocationGroup] = useState<string | null>(null);
  const { data, locationGroups, isLoading } = usePricingStrategy(locationGroup);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              Pricing Strategy
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Actual ADR vs listing rates by season
            </p>
          </div>

          <Select
            value={locationGroup || "__all__"}
            onValueChange={(v) => setLocationGroup(v === "__all__" ? null : v)}
          >
            <SelectTrigger className="w-[220px] glass-card border-border/30">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Locations</SelectItem>
              {locationGroups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chart */}
        <div className="glass-card rounded-xl p-6">
          {isLoading ? (
            <Skeleton className="h-[400px] w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={data} barGap={4} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="season"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${v}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="actualADR" name="Actual ADR" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgMinRate" name="Avg Min Rate" fill="hsl(45, 93%, 47%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgBaseRate" name="Avg Base Rate" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
