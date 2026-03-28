import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { OwnersTable } from "@/components/owners/OwnersTable";
import { OwnersCardGrid } from "@/components/owners/OwnersCardGrid";
import { OwnerPortfolio } from "@/components/owners/OwnerPortfolio";
import { List, LayoutGrid } from "lucide-react";

type ViewMode = "list" | "view";

interface SelectedOwner {
  id: string;
  name: string;
  company: string | null;
}

export default function Owners() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedOwner, setSelectedOwner] = useState<SelectedOwner | null>(null);

  // If an owner is selected in view mode, show their portfolio
  if (selectedOwner) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 lg:p-8">
          <OwnerPortfolio owner={selectedOwner} onBack={() => setSelectedOwner(null)} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Owner Portfolios</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage property owners and their portfolios</p>
          </div>
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode("view")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "view"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> View
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
          <OwnersTable />
        ) : (
          <OwnersCardGrid onSelectOwner={setSelectedOwner} />
        )}
      </div>
    </AppLayout>
  );
}
