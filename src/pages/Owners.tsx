import { AppLayout } from "@/components/layout/AppLayout";
import { OwnersTable } from "@/components/owners/OwnersTable";

export default function Owners() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Owner Portfolios</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage property owners and their portfolios</p>
        </div>
        <OwnersTable />
      </div>
    </AppLayout>
  );
}
