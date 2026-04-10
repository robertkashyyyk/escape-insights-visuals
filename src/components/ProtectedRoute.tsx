import { Navigate } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type AppRole = "super" | "senior" | "admin" | "client" | "cleaner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
  excludeRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles, excludeRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { role } = useRole();

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
    // Redirect to appropriate home based on role
    if (role === "client") return <Navigate to="/owner" replace />;
    if (role === "cleaner") return <Navigate to="/cleaner" replace />;
    return <Navigate to="/today" replace />;
  }

  if (excludeRoles && role && excludeRoles.includes(role)) {
    if (role === "client") return <Navigate to="/owner" replace />;
    if (role === "cleaner") return <Navigate to="/cleaner" replace />;
    return <Navigate to="/today" replace />;
  }

  return <>{children}</>;
}
