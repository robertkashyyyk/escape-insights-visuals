import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { defaultLevel, meets, type PermLevel, type AppRole } from "@/lib/permissions";

/**
 * Effective per-area permissions for the current user.
 * Effective level = per-user override (if any) else the role default.
 * Fails safe: if the overrides table isn't there yet, everyone falls back to
 * role defaults, so behaviour is unchanged.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { role } = useRole();

  const { data: overrides = {}, isLoading } = useQuery({
    queryKey: ["area-permissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_area_permissions" as any)
        .select("area_key, level")
        .eq("user_id", user!.id);
      if (error || !data) return {} as Record<string, PermLevel>;
      const map: Record<string, PermLevel> = {};
      for (const r of data as any[]) map[r.area_key] = r.level as PermLevel;
      return map;
    },
  });

  const level = (areaKey: string): PermLevel =>
    overrides[areaKey] ?? defaultLevel(role as AppRole | null, areaKey);

  const can = (areaKey: string, min: PermLevel = "view"): boolean =>
    meets(level(areaKey), min);

  return { level, can, loading: isLoading };
}
