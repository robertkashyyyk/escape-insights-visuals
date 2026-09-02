import { Navigate, useLocation } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { areaForPath } from "@/lib/permissions";
import { Loader2 } from "lucide-react";

type AppRole = "super" | "senior" | "admin" | "client" | "cleaner" | "maintenance";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
  excludeRoles?: AppRole[];
}

const homeFor = (role: AppRole | null): string => {
  if (role === "client") return "/owner";
  if (role === "cleaner") return "/cleaner";
  if (role === "maintenance") return "/operations/maintenance";
  return "/today";
};

export function ProtectedRoute({ children, requiredRoles, excludeRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { role } = useRole();
  const perm = usePermissions();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRoles && role && !requiredRoles.includes(role)) {
    return <Navigate to={homeFor(role)} replace />;
  }

  if (excludeRoles && role && excludeRoles.includes(role)) {
    return <Navigate to={homeFor(role)} replace />;
  }

  // Per-area permission gating (phase 1: block only level "none"). No per-route
  // wiring needed — the area is resolved from the path. The pathname guard stops a
  // redirect loop if a user's own home area were ever set to "none".
  const area = areaForPath(location.pathname);
  const home = homeFor(role);
  if (area && !perm.loading && perm.level(area.key) === "none" && location.pathname !== home) {
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
