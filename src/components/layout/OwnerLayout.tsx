import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import { OwnerProfileMenu } from "@/components/owner/OwnerProfileMenu";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemePicker } from "@/components/ThemePicker";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Home, CalendarDays, FileText, Eye, BarChart3, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrinChatFAB } from "@/components/orin/OrinChatFAB";

const navItems = [
  { to: "/owner", label: "My Portfolio", icon: Home },
  { to: "/owner/reservations", label: "My Reservations", icon: CalendarDays },
  { to: "/owner/statements", label: "My Statements", icon: FileText },
  { to: "/owner/graphs", label: "My Graphs", icon: BarChart3 },
];

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isPreviewMode, selectedOwnerId, setSelectedOwnerId, allOwners, selectedOwnerName } = useOwnerPreview();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const displayName = isPreviewMode ? selectedOwnerName : profile?.display_name;

  return (
    <div className="min-h-screen bg-background">
      {/* Admin preview banner */}
      {isPreviewMode && (
        <div className="bg-primary/15 border-b border-primary/30 px-4 py-2.5 flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-primary">Preview Mode</span>
          <div className="flex-1" />
          <select
            value={selectedOwnerId ?? ""}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            className="text-xs bg-background/50 border border-border/30 rounded-md px-2 py-1 text-foreground"
          >
            {allOwners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <a
            href="/today"
            className="text-xs text-primary hover:text-primary/80 transition-colors font-medium ml-2"
          >
            ← Back to app
          </a>
        </div>
      )}

      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left — Logo */}
            <div className="flex items-center gap-3">
              <img
                src="/images/eg_icon_standalone.png"
                alt="Escape Grids"
                className="h-7 w-7 object-contain"
              />
              <span className="text-sm font-display font-semibold text-foreground hidden sm:block">
                Escape Grids
              </span>
            </div>

            {/* Centre — Nav links */}
            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/owner"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Right — theme toggle + profile menu */}
            <div className="flex items-center gap-2">
              <ThemePicker />
              <OwnerProfileMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {children}
      </main>
      <OrinChatFAB />
    </div>
  );
}
