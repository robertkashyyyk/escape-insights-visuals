import {
  LayoutDashboard, TrendingUp, Grid3X3, PoundSterling, CalendarDays,
  Building2, Users, Briefcase, Settings, LogOut, Telescope,
  Gauge, Target, Sparkles, Home, ChevronRight, Brush, BookOpen,
  FileText, Link, UserSearch, Mail, Send, Megaphone, ClipboardList,
  Eye, Sun, Moon, MapPin, Wrench, Receipt, UploadCloud, Banknote,
  LucideIcon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemePicker } from "@/components/ThemePicker";
import { Badge } from "@/components/ui/badge";
import { useState, useCallback } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type AppRole = "super" | "senior" | "admin" | "client" | "cleaner";

interface NavChild {
  title: string;
  url: string;
}

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  roles: AppRole[];
  children?: NavChild[];
}

interface NavSection {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

const allRoles: AppRole[] = ["super", "senior", "admin", "client"];
const managementRoles: AppRole[] = ["super", "senior"];

const sections: NavSection[] = [
  {
    label: "Intelligence",
    items: [
      {
        title: "The Orin Brief", url: "/orin", icon: Sparkles, roles: allRoles,
      },
    ],
  },
  {
    label: "Performance",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: allRoles },
      { title: "YoY Performance", url: "/yoy", icon: TrendingUp, roles: allRoles },
      { title: "Occupancy Heatmap", url: "/heatmap", icon: Grid3X3, roles: allRoles },
      { title: "Pricing Strategy", url: "/pricing", icon: PoundSterling, roles: allRoles },
      { title: "Revenue Pacing", url: "/pacing", icon: Gauge, roles: allRoles },
      { title: "Revenue Forecaster", url: "/forecast", icon: Target, roles: allRoles },
    ],
  },
  {
    label: "Bookings",
    items: [
      { title: "Reservations", url: "/reservations", icon: CalendarDays, roles: allRoles },
      { title: "Future Pipeline", url: "/pipeline", icon: Telescope, roles: allRoles },
    ],
  },
  {
    label: "Operations",
    collapsible: true,
    items: [
      { title: "Cleaning Schedule", url: "/operations/schedule", icon: CalendarDays, roles: allRoles },
      { title: "Maintenance", url: "/operations/maintenance", icon: Wrench, roles: allRoles },
      { title: "Cleaning Numbers", url: "/operations/numbers", icon: PoundSterling, roles: managementRoles },
      { title: "OTA Imports", url: "/operations/imports", icon: UploadCloud, roles: managementRoles },
      { title: "Property Knowledge", url: "/property-knowledge", icon: BookOpen, roles: allRoles },
      { title: "Amenities", url: "/amenities", icon: MapPin, roles: managementRoles },
    ],
  },
  {
    label: "Finance",
    collapsible: true,
    items: [
      { title: "Management Revenue", url: "/management", icon: Briefcase, roles: managementRoles },
      { title: "Expenses", url: "/finance/expenses", icon: Receipt, roles: managementRoles },
      { title: "Bills on Behalf", url: "/finance/bills-on-behalf", icon: Banknote, roles: managementRoles },
      {
      title: "Owner Reports", url: "/owner-reports", icon: FileText, roles: managementRoles,
        children: [
          { title: "Monthly Report", url: "/owner-reports" },
          { title: "Invoice Generator", url: "/owner-reports/invoice" },
        ],
      },
      { title: "Xero Sync", url: "/xero-sync", icon: Link, roles: managementRoles },
    ],
  },
  {
    label: "Guests & Marketing",
    collapsible: true,
    items: [
      { title: "Guest Database", url: "/guests", icon: UserSearch, roles: allRoles },
      {
        title: "Campaigns", url: "/campaigns", icon: Megaphone, roles: allRoles,
        children: [
          { title: "Active Campaigns", url: "/campaigns" },
          { title: "Segments", url: "/campaigns/segments" },
          { title: "Campaign History", url: "/campaigns/history" },
        ],
      },
      { title: "Mailchimp Sync", url: "/mailchimp-sync", icon: Send, roles: allRoles },
    ],
  },
  {
    label: "Portfolio",
    collapsible: true,
    items: [
      { title: "Properties", url: "/properties", icon: Building2, roles: allRoles },
      { title: "Owner Portfolios", url: "/owners", icon: Users, roles: managementRoles },
      { title: "Owner Portal", url: "/owner", icon: Eye, roles: managementRoles },
      { title: "Leads & Enquiries", url: "/leads", icon: ClipboardList, roles: allRoles },
    ],
  },
];
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { role } = useRole();
  const { theme, toggleTheme } = useTheme();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const getInitialSectionState = (): Record<string, boolean> => {
    try {
      const stored = sessionStorage.getItem("sidebar-sections");
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  };

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const stored = getInitialSectionState();
    const collapsibleLabels = sections.filter(s => s.collapsible).map(s => s.label);
    const defaults: Record<string, boolean> = {};
    collapsibleLabels.forEach(label => {
      defaults[label] = stored[label] !== undefined ? stored[label] : true;
    });
    return defaults;
  });

  const toggleSection = useCallback((label: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [label]: !prev[label] };
      try { sessionStorage.setItem("sidebar-sections", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const isRouteActive = (url: string) => {
    if (url.includes("?")) return location.pathname === url.split("?")[0];
    return location.pathname === url;
  };

  const isParentActive = (item: NavItem) => {
    if (isRouteActive(item.url)) return true;
    return item.children?.some((c) => isRouteActive(c.url)) ?? false;
  };

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !role || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b border-border/30">
        {!collapsed && (
          <div className="animate-fade-in">
            <img src="/images/eg_logo_full_v2.png" alt="Escape Grids" className="h-9 object-contain" />
          </div>
        )}
        {collapsed && (
          <img src="/images/eg_icon_64.png" alt="Escape Grids" className="h-8 w-8 object-contain mx-auto" />
        )}
      </div>

      <SidebarContent className="pt-2">
        {/* Today — always visible at top */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/today"
                    end
                    className={`group flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      location.pathname === "/today"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                    activeClassName=""
                  >
                    <Home className={`h-5 w-5 shrink-0 ${location.pathname === "/today" ? "text-primary" : ""}`} />
                    {!collapsed && <span>Today</span>}
                    {location.pathname === "/today" && !collapsed && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Grouped sections */}
        {filteredSections.map((section) => {
          const isSectionCollapsible = section.collapsible === true;
          const isSectionCollapsed = isSectionCollapsible && (collapsedSections[section.label] ?? true);

          return (
            <SidebarGroup key={section.label}>
              {!collapsed && (
                isSectionCollapsible ? (
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="flex items-center justify-between w-full px-3 mb-1 group cursor-pointer"
                  >
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                      {section.label}
                    </span>
                    <ChevronRight
                      className={`h-3 w-3 text-muted-foreground/40 transition-transform duration-200 group-hover:text-muted-foreground ${
                        !isSectionCollapsed ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium px-3 mb-1">
                    {section.label}
                  </SidebarGroupLabel>
                )
              )}
              {!isSectionCollapsed && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const active = isParentActive(item);
                      const hasChildren = item.children && item.children.length > 0;
                      const isExpanded = expandedItems[item.title] ?? active;

                      return (
                        <SidebarMenuItem key={item.title}>
                          {hasChildren ? (
                            <>
                              <SidebarMenuButton
                                onClick={() => toggleExpand(item.title)}
                                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full cursor-pointer ${
                                  active
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                }`}
                              >
                                <item.icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-primary" : ""}`} />
                                {!collapsed && (
                                  <>
                                    <span className="flex-1 text-left">{item.title}</span>
                                    <ChevronRight
                                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                                        isExpanded ? "rotate-90" : ""
                                      }`}
                                    />
                                  </>
                                )}
                              </SidebarMenuButton>
                              {!collapsed && isExpanded && (
                                <div className="ml-7 mt-0.5 space-y-0.5 border-l border-border/30 pl-3">
                                  {item.children!.map((child) => {
                                    const childActive = isRouteActive(child.url);
                                    return (
                                      <NavLink
                                        key={child.url}
                                        to={child.url}
                                        className={`block px-2 py-1.5 rounded-md text-xs transition-colors ${
                                          childActive
                                            ? "text-primary font-medium"
                                            : "text-muted-foreground hover:text-foreground"
                                        }`}
                                        activeClassName=""
                                      >
                                        {child.title}
                                      </NavLink>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          ) : (
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={item.url}
                                end
                                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  active
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                }`}
                                activeClassName=""
                              >
                                <item.icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-primary" : ""}`} />
                                {!collapsed && <span>{item.title}</span>}
                                {active && !collapsed && (
                                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
                                )}
                              </NavLink>
                            </SidebarMenuButton>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}

        {/* Settings */}
        {(!role || role === "super" || role === "senior" || role === "admin") && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {(!role || role === "super") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/settings/team"
                        end
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          location.pathname === "/settings/team"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        }`}
                        activeClassName=""
                      >
                        <Users className={`h-[18px] w-[18px] shrink-0 ${location.pathname === "/settings/team" ? "text-primary" : ""}`} />
                        {!collapsed && <span>Team & Users</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/settings/clean-reset"
                      end
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        location.pathname === "/settings/clean-reset"
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                      activeClassName=""
                    >
                      <Brush className={`h-[18px] w-[18px] shrink-0 ${location.pathname === "/settings/clean-reset" ? "text-primary" : ""}`} />
                      {!collapsed && <span>Clean Reset</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {(!role || role === "super") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/settings"
                        end
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          location.pathname === "/settings"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        }`}
                        activeClassName=""
                      >
                        <Settings className={`h-[18px] w-[18px] shrink-0 ${location.pathname === "/settings" ? "text-primary" : ""}`} />
                        {!collapsed && <span>Settings</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
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
              <ThemePicker />
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
