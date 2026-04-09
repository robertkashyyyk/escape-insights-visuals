import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { OrinChatFAB } from "@/components/orin/OrinChatFAB";
import { SyncHealthIndicator } from "./SyncHealthIndicator";
import { useRole } from "@/contexts/AuthContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { role } = useRole();
  const showSyncHealth = role === "super" || role === "senior";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/30 px-4 backdrop-blur-sm bg-background/80 sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2">
              {showSyncHealth && <SyncHealthIndicator />}
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <OrinChatFAB />
    </SidebarProvider>
  );
}
