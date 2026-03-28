import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useOTBData } from "@/hooks/useOTBData";
import { DollarSign, CalendarDays, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const formatCurrency = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 rounded-lg border border-border/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export default function FuturePipeline() {
  const { data, isLoading } = useOTBData();

  return (
    <AppLayout title="Future Pipeline (OTB)" subtitle="Confirmed bookings with future check-in dates">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          <>
            <KpiCard
              title="Future Revenue"
              value={formatCurrency(data?.totalRevenue || 0)}
              icon={DollarSign}
              accentColor="primary"
              delay={0}
            />
            <KpiCard
              title="Future Nights Booked"
              value={(data?.totalNights || 0).toLocaleString()}
              icon={CalendarDays}
              accentColor="accent"
              delay={100}
            />
            <KpiCard
              title="Avg Lead Time"
              value={`${data?.avgLeadTime || 0} days`}
              icon={Clock}
              accentColor="chart-3"
              delay={200}
            />
          </>
        )}
      </div>

      {/* Revenue Bar Chart */}
      <div className="glass-card p-6 rounded-xl mb-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Confirmed Revenue — Next 6 Months
        </h3>
        {isLoading ? (
          <Skeleton className="h-72 rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={288}>
            <BarChart data={data?.monthlyData || []} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Upcoming Check-ins Table */}
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Upcoming Check-ins — Next 14 Days
        </h3>
        {isLoading ? (
          <Skeleton className="h-48 rounded-lg" />
        ) : !data?.upcomingByProperty.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No check-ins in the next 14 days</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="text-right">Nights</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.upcomingByProperty.map((group) => (
                <>
                  <TableRow key={group.propertyName}>
                    <TableCell colSpan={5} className="bg-secondary/30 font-semibold text-foreground text-xs uppercase tracking-wider py-2">
                      {group.propertyName}
                    </TableCell>
                  </TableRow>
                  {group.reservations.map((r, i) => (
                    <TableRow key={`${group.propertyName}-${i}`}>
                      <TableCell>{r.guestName}</TableCell>
                      <TableCell>{format(new Date(r.checkIn), "dd MMM")}</TableCell>
                      <TableCell>{format(new Date(r.checkOut), "dd MMM")}</TableCell>
                      <TableCell className="text-right">{r.nights}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AppLayout>
  );
}
