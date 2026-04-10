import { Navigate } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type AppRole = "super" | "senior" | "admin" | "client" | "cleaner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
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
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
