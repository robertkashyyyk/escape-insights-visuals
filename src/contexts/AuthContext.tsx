import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "super" | "senior" | "admin" | "client" | "cleaner";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const userDataPromise = Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
    ]);

    const [profileRes, roleRes] = await Promise.race([
      userDataPromise,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Timed out loading user data")), 8000);
      }),
    ]);

    setProfile((profileRes.data as Profile) ?? null);
    setRole((roleRes.data?.role as AppRole) ?? null);
  };

  useEffect(() => {
    let isMounted = true;

    const loadUserData = async (userId: string) => {
      try {
        await fetchUserData(userId);
      } catch (error) {
        console.error("Failed to load authenticated user data", error);
        if (!isMounted) return;
        setProfile(null);
        setRole(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Skip INITIAL_SESSION — handled by getSession() below to avoid double-init
        if (_event === 'INITIAL_SESSION') return;

        if (!['SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(_event)) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (_event === 'SIGNED_OUT') {
          setProfile(null);
          setRole(null);
          setLoading(false);
          return;
        }

        if (_event === 'SIGNED_IN' && session?.user) {
          // Defer Supabase queries until after the auth callback returns.
          setTimeout(() => {
            if (isMounted) void loadUserData(session.user.id);
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (!session?.user) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      void loadUserData(session.user.id);
    }).catch((error) => {
      console.error("Failed to initialise auth session", error);
      if (!isMounted) return;
      setSession(null);
      setUser(null);
      setProfile(null);
      setRole(null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function useRole() {
  const { role } = useAuth();
  return {
    role,
    isSuper: role === "super",
    isSenior: role === "senior",
    isAdmin: role === "admin",
    isClient: role === "client",
    isCleaner: role === ("cleaner" as AppRole),
    hasRole: (...roles: AppRole[]) => role !== null && roles.includes(role),
  };
}
