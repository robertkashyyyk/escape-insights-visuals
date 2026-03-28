import { DollarSign, Calendar, TrendingUp, Moon, Hash } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { TopProperties } from "@/components/dashboard/TopProperties";
import { DateFilter } from "@/components/dashboard/DateFilter";

export default function Dashboard() {
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
        <DateFilter />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Revenue"
          value="£451,100"
          subtitle="All properties, 2025"
          change={{ value: "12.4%", positive: true }}
          icon={DollarSign}
          accentColor="primary"
          delay={0}
        />
        <KpiCard
          title="Avg Occupancy"
          value="73%"
          subtitle="Across 18 listings"
          change={{ value: "3.2%", positive: true }}
          icon={TrendingUp}
          accentColor="accent"
          delay={60}
        />
        <KpiCard
          title="Avg Daily Rate"
          value="£142"
          subtitle="Per night, all properties"
          change={{ value: "£8", positive: true }}
          icon={Moon}
          accentColor="chart-5"
          delay={120}
        />
        <KpiCard
          title="Nights Booked"
          value="3,176"
          subtitle="Total across portfolio"
          icon={Calendar}
          accentColor="chart-3"
          delay={180}
        />
        <KpiCard
          title="Reservations"
          value="847"
          subtitle="Total bookings"
          change={{ value: "8.1%", positive: true }}
          icon={Hash}
          accentColor="chart-4"
          delay={240}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <RevenueChart />
        </div>
        <div className="lg:col-span-2">
          <TopProperties />
        </div>
      </div>
    </div>
  );
}
