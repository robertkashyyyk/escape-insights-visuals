import { AppLayout } from "@/components/layout/AppLayout";
import { ReservationsTable } from "@/components/reservations/ReservationsTable";

export default function Reservations() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Reservations</h2>
          <p className="text-sm text-muted-foreground mt-1">View all guest reservations across your properties</p>
        </div>
        <ReservationsTable />
      </div>
    </AppLayout>
  );
}
