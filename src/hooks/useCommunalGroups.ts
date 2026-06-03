import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CommunalGroup {
  id: string;
  name: string;
  notes: string | null;
}

/**
 * Managed list of Communal Groups (named groupings of properties that share
 * communal costs). A property belongs to at most one communal group; its
 * communal_ratio_pct is its fixed share. Across a group the ratios must sum to
 * exactly 100% — see CommunalGroupsSettings for the enforcing editor.
 */
export function useCommunalGroups() {
  return useQuery({
    queryKey: ["communal_groups"],
    queryFn: async (): Promise<CommunalGroup[]> => {
      const { data, error } = await (supabase.from as any)("communal_groups")
        .select("id, name, notes")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommunalGroup[];
    },
    staleTime: 60_000,
  });
}
