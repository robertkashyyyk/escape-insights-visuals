import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { OrinChatFAB } from "@/components/orin/OrinChatFAB";
import { SyncHealthIndicator } from "./SyncHealthIndicator";
import { AppBreadcrumbs } from "./AppBreadcrumbs";
import { CleanCompletionWatcher } from "./CleanCompletionWatcher";
import { useRole } from "@/contexts/AuthContext";
import { useTodayCleaningProgress } from "@/hooks/useTodayCleaningProgress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

function HeaderCleaningProgress() {
  const { total, completed, unassigned, isLoading } = useTodayCleaningProgress();

  if (isLoading) {
    return <Skeleton className="h-5 w-[200px]" />;
  }
  if (total === 0) return null;

  const pct = Math.min(100, Math.round((completed / total) * 100));
  const done = completed >= total;
  const barColor = done ? "bg-green-500" : "bg-amber-500";

  return (
    <Link
      to="/operations/cleaning"
      className="hidden md:flex items-center gap-2.5 px-2 py-1 rounded-md hover:bg-secondary/40 transition-colors"
      title={`${completed} of ${total} cleans complete${unassigned > 0 ? ` · ${unassigned} unassigned` : ""}`}
    >
      <div className="relative h-1.5 w-[120px] rounded-full bg-secondary overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {completed} / {total} cleans
      </span>
      {unassigned > 0 && (
        <span className="flex items-center gap-1 text-xs text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {unassigned} unassigned
        </span>
      )}
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { role } = useRole();
  const showSyncHealth = role === "super" || role === "senior";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border/30 px-4 backdrop-blur-sm bg-background/80 sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />
            <AppBreadcrumbs />
            <HeaderCleaningProgress />
            <div className="ml-auto flex items-center gap-2">
              {showSyncHealth && <SyncHealthIndicator />}
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <OrinChatFAB />
      <CleanCompletionWatcher />
    </SidebarProvider>
  );
}
