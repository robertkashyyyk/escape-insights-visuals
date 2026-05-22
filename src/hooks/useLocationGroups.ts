import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LocationGroup {
  id: string;
  name: string;
  display_order: number;
  archived: boolean;
}

/**
 * Returns the managed list of Location Groups. By default only non-archived
 * groups are returned, ordered by display_order then name.
 */
export function useLocationGroups(opts: { includeArchived?: boolean } = {}) {
  const { includeArchived = false } = opts;
  return useQuery({
    queryKey: ["location_groups", includeArchived],
    queryFn: async (): Promise<LocationGroup[]> => {
      let q = (supabase.from as any)("location_groups")
        .select("id, name, display_order, archived")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });
      if (!includeArchived) q = q.eq("archived", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LocationGroup[];
    },
    staleTime: 60_000,
  });
}
