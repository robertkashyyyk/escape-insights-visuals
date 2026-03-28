import { AppLayout } from "@/components/layout/AppLayout";
import { PropertiesTable } from "@/components/properties/PropertiesTable";

export default function Properties() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Properties</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage all your short-term rental listings</p>
        </div>
        <PropertiesTable />
      </div>
    </AppLayout>
  );
}
