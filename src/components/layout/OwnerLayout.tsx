import { useAuth } from "@/contexts/AuthContext";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Home, CalendarDays, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/owner", label: "My Portfolio", icon: Home },
  { to: "/owner/reservations", label: "My Reservations", icon: CalendarDays },
  { to: "/owner/statements", label: "My Statements", icon: FileText },
];

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
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

            {/* Right — Name + Sign out */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden md:block">
                {profile?.display_name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
