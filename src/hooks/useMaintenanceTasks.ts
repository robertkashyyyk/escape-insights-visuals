import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MaintenanceTaskType = "maintenance" | "setup";
export type MaintenanceTaskScope = "property" | "communal";
export type MaintenanceTaskStatus = "pending" | "accepted" | "done" | "postponed";
export type MaintenanceTaskSource = "manual" | "welcome_basket";

export interface MaintenanceTask {
  id: string;
  title: string;
  description: string | null;
  type: MaintenanceTaskType;
  scope: MaintenanceTaskScope;
  status: MaintenanceTaskStatus;
  listing_id: string | null;
  communal_group_id: string | null;
  billable: boolean | null;
  cost: number | null;
  source: MaintenanceTaskSource;
  postpone_reason: string | null;
  postponed_until: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  // Embedded labels
  listing_name: string | null;
  communal_group_name: string | null;
}

/**
 * Proactive maintenance/setup tasks (spec items 7 + 9). Returns tasks newest-first
 * with the property / communal-group name resolved for display.
 */
export function useMaintenanceTasks() {
  return useQuery({
    queryKey: ["maintenance_tasks"],
    queryFn: async (): Promise<MaintenanceTask[]> => {
      const { data, error } = await (supabase.from as any)("maintenance_tasks")
        .select("*, listings(name), communal_groups(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((t) => ({
        ...t,
        listing_name: t.listings?.name ?? null,
        communal_group_name: t.communal_groups?.name ?? null,
      })) as MaintenanceTask[];
    },
    staleTime: 30_000,
  });
}
