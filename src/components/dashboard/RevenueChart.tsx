import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data2025 = [
  { month: "Jan", revenue: 18200 },
  { month: "Feb", revenue: 22400 },
  { month: "Mar", revenue: 28600 },
  { month: "Apr", revenue: 35100 },
  { month: "May", revenue: 42300 },
  { month: "Jun", revenue: 52800 },
  { month: "Jul", revenue: 61200 },
  { month: "Aug", revenue: 58900 },
  { month: "Sep", revenue: 44100 },
  { month: "Oct", revenue: 33200 },
  { month: "Nov", revenue: 24800 },
  { month: "Dec", revenue: 29500 },
];

const data2026 = [
  { month: "Jan", revenue: 24100 },
  { month: "Feb", revenue: 28900 },
  { month: "Mar", revenue: 35200 },
  { month: "Apr", revenue: null },
  { month: "May", revenue: null },
  { month: "Jun", revenue: null },
  { month: "Jul", revenue: null },
  { month: "Aug", revenue: null },
  { month: "Sep", revenue: null },
  { month: "Oct", revenue: null },
  { month: "Nov", revenue: null },
  { month: "Dec", revenue: null },
];

const yoyData = data2025.map((d, i) => ({
  month: d.month,
  "2025": d.revenue,
  "2026": data2026[i].revenue,
}));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 rounded-lg border border-border/50 shadow-xl">
      <p className="text-xs text-muted-foreground font-medium mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-xs text-muted-foreground">{p.dataKey}:</span>
          <span className="text-sm font-display font-semibold text-foreground">
            £{(p.value as number).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

export function RevenueChart() {
  const [showYoY, setShowYoY] = useState(false);

  return (
    <div className="glass-card p-6 opacity-0 animate-fade-in" style={{ animationDelay: "300ms" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">Monthly Revenue</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Rental revenue across all properties</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/50">
          <button
            onClick={() => setShowYoY(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              !showYoY ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            2025
          </button>
          <button
            onClick={() => setShowYoY(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              showYoY ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            YoY
          </button>
        </div>
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {showYoY ? (
            <BarChart data={yoyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 15% 18%)" vertical={false} />
              <XAxis
                dataKey="month"
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
              <Legend
                wrapperStyle={{ fontSize: 12, fontFamily: "Inter" }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="2025" fill="hsl(222 18% 30%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="2026" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          ) : (
            <BarChart data={data2025}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 15% 18%)" vertical={false} />
              <XAxis
                dataKey="month"
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
              <Bar dataKey="revenue" fill="hsl(38 92% 50%)" radius={[6, 6, 0, 0]} maxBarSize={40}>
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
