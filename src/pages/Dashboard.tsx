import { useState, useEffect } from "react";
import { PoundSterling, Calendar, TrendingUp, Moon, Hash } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { TopProperties } from "@/components/dashboard/TopProperties";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { useDashboardData, type PeriodType } from "@/hooks/useDashboardData";

const STORAGE_KEY = "dashboard.dateFilter.v1";

interface PersistedFilter {
  from: string;
  to: string;
  periodType: PeriodType;
}

function loadPersisted(): PersistedFilter | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedFilter;
    if (!parsed.from || !parsed.to || !parsed.periodType) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const now = new Date();
  const persisted = loadPersisted();

  const [dateRange, setDateRange] = useState(() =>
    persisted
      ? { from: new Date(persisted.from), to: new Date(persisted.to) }
      : { from: startOfMonth(now), to: endOfMonth(now) }
  );
  const [periodType, setPeriodType] = useState<PeriodType>(
    persisted?.periodType ?? "Month"
  );

  // Persist selection across navigation within the session
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
          periodType,
        })
      );
    } catch {
      // sessionStorage unavailable — silently ignore
    }
  }, [dateRange, periodType]);

  const { data, isLoading } = useDashboardData(dateRange, periodType);
  const kpis = data?.kpis;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
            Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Performance overview across your portfolio
          </p>
        </div>
        <DateFilter
          dateRange={dateRange}
          periodType={periodType}
          onDateRangeChange={setDateRange}
          onPeriodTypeChange={setPeriodType}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Revenue"
          value={isLoading ? "..." : `£${(kpis?.totalRevenue ?? 0).toLocaleString()}`}
          subtitle="Net revenue after channel fees"
          icon={PoundSterling}
          accentColor="primary"
          delay={0}
        />
        <KpiCard
          title="Avg Occupancy"
          value={isLoading ? "..." : `${kpis?.avgOccupancy ?? 0}%`}
          subtitle="Active listings"
          icon={TrendingUp}
          accentColor="accent"
          delay={60}
        />
        <KpiCard
          title="Avg Daily Rate"
          value={isLoading ? "..." : `£${kpis?.avgDailyRate ?? 0}`}
          subtitle="Per night"
          icon={Moon}
          accentColor="chart-5"
          delay={120}
        />
        <KpiCard
          title="Nights Booked"
          value={isLoading ? "..." : (kpis?.nightsBooked ?? 0).toLocaleString()}
          subtitle="Total across portfolio"
          icon={Calendar}
          accentColor="chart-3"
          delay={180}
        />
        <KpiCard
          title="Reservations"
          value={isLoading ? "..." : (kpis?.reservationsCount ?? 0).toLocaleString()}
          subtitle="Total bookings"
          icon={Hash}
          accentColor="chart-4"
          delay={240}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-3 flex">
          <div className="flex-1">
            <RevenueChart data={data?.chartData ?? []} isLoading={isLoading} />
          </div>
        </div>
        <div className="lg:col-span-2 flex">
          <div className="flex-1">
            <TopProperties properties={data?.topProperties ?? []} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
