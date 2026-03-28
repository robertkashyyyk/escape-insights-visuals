import { LayoutDashboard, CalendarDays, Building2, Users, Upload, Settings, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type AppRole = "super" | "senior" | "admin" | "client";

const allNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["super", "senior", "admin", "client"] as AppRole[] },
  { title: "Reservations", url: "/reservations", icon: CalendarDays, roles: ["super", "senior", "admin", "client"] as AppRole[] },
  { title: "Properties", url: "/properties", icon: Building2, roles: ["super", "senior", "admin", "client"] as AppRole[] },
  { title: "Owner Portfolios", url: "/owners", icon: Users, roles: ["super", "senior"] as AppRole[] },
  { title: "Upload Data", url: "/upload", icon: Upload, roles: ["super", "senior"] as AppRole[] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["super"] as AppRole[] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { role } = useRole();

  const navItems = allNavItems.filter(
    (item) => !role || item.roles.includes(role)
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex h-16 items-center px-4 border-b border-border/30">
        {!collapsed && (
          <div className="flex items-center gap-2.5 animate-fade-in">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-display font-bold text-sm">E</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-sm text-foreground tracking-tight">Escape Grids</h1>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">Analytics</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center mx-auto">
            <span className="text-primary font-display font-bold text-sm">E</span>
          </div>
        )}
      </div>

      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        }`}
                        activeClassName=""
                      >
                        <item.icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? "text-primary" : ""}`} />
                        {!collapsed && <span>{item.title}</span>}
                        {isActive && !collapsed && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {!collapsed && (
        <div className="p-4 mt-auto border-t border-border/30 space-y-3">
          {user && (
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-foreground">
                  {(profile?.display_name || user.email || "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground font-medium truncate">
                  {profile?.display_name || user.email}
                </p>
                {role && (
                  <Badge variant="outline" className="mt-0.5 text-[9px] px-1.5 py-0 border-primary/30 text-primary capitalize">
                    {role}
                  </Badge>
                )}
              </div>
              <button
                onClick={signOut}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="glass-card p-3 rounded-lg">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Managed by</p>
            <p className="text-xs text-foreground font-display font-semibold">Escape Ordinary</p>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
