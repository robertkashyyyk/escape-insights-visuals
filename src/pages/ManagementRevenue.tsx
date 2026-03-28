import { AppLayout } from "@/components/layout/AppLayout";
import { useAgencyRevenue } from "@/hooks/useAgencyRevenue";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 rounded-lg border border-border/50 shadow-xl">
      <p className="text-xs font-medium text-foreground mb-1">{label}</p>
      <p className="text-sm font-bold text-primary">{fmt(payload[0].value)}</p>
    </div>
  );
}

export default function ManagementRevenue() {
  const { data, isLoading } = useAgencyRevenue();

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Management Revenue</h1>
          <p className="text-sm text-muted-foreground mt-1">Agency earnings from management fees</p>
        </div>

        {/* KPI */}
        <div className="max-w-sm">
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : (
            <KpiCard
              title="Agency Revenue YTD"
              value={fmt(data?.totalYTD ?? 0)}
              icon={DollarSign}
              accentColor="primary"
            />
          )}
        </div>

        {/* Line Chart */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Monthly Agency Revenue</h2>
          {isLoading ? (
            <Skeleton className="h-72 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 10 Table */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Top 10 Most Profitable Properties</h2>
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Agency Revenue</TableHead>
                  <TableHead className="text-right">Mgmt %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.topProperties ?? []).map((p, i) => (
                  <TableRow key={p.listingId}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.location}</TableCell>
                    <TableCell className="text-right">{fmt(p.totalRevenue)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{fmt(p.agencyRevenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.managementPct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
