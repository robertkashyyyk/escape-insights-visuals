import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartBucket {
  label: string;
  revenue: number;
}

interface RevenueChartProps {
  data: ChartBucket[];
  isLoading: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 rounded-lg border border-border/50 shadow-xl">
      <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
      <span className="text-sm font-display font-semibold text-foreground">
        £{(payload[0].value as number).toLocaleString()}
      </span>
    </div>
  );
};

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  return (
    <div className="glass-card p-6 opacity-0 animate-fade-in" style={{ animationDelay: "300ms" }}>
      <div className="mb-6">
        <h3 className="font-display font-bold text-lg text-foreground">Revenue</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Rental revenue across all properties</p>
      </div>

      <div className="h-[340px] w-full">
        {isLoading ? (
          <div className="flex items-end gap-2 h-full pb-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${30 + Math.random() * 60}%` }} />
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 15% 18%)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(220 10% 55%)", fontSize: 12, fontFamily: "Inter" }}
                axisLine={{ stroke: "hsl(222 15% 18%)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(220 10% 55%)", fontSize: 11, fontFamily: "Inter" }}
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
  );
}
