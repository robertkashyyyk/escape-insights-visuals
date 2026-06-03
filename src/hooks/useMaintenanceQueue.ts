import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MaintenanceStage =
  | "reported"
  | "claimed"
  | "in_progress"
  | "pending_parts"
  | "handoff"
  | "complete";

export interface MaintenanceIssue {
  id: string;
  listing_id: string;
  property_name: string;
  issue_type: string;
  description: string;
  urgency: "low" | "medium" | "urgent";
  status: string;
  maintenance_stage: MaintenanceStage;
  photo_paths: string[];
  photo_urls: string[];
  reported_by_name: string | null;
  created_at: string;
  claimed_by: string | null;
  claimed_by_name: string | null;
  claimed_at: string | null;
  handoff_to: string | null;
  handoff_to_name: string | null;
  handoff_note: string | null;
  handoff_at: string | null;
  completion_note: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
}

const URGENCY_RANK: Record<string, number> = { urgent: 0, medium: 1, low: 2 };

async function fetchAll(): Promise<MaintenanceIssue[]> {
  const { data, error } = await supabase
    .from("clean_issues")
    .select(`
      id, listing_id, issue_type, description, urgency, status, photo_paths, created_at,
      maintenance_stage, claimed_by, claimed_at, handoff_to, handoff_note, handoff_at,
      completion_note, completed_at, completed_by,
      listings!clean_issues_listing_id_fkey (name),
      cleaners!clean_issues_reported_by_cleaner_id_fkey (name)
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const userIds = new Set<string>();
  (data ?? []).forEach((r: any) => {
    if (r.claimed_by) userIds.add(r.claimed_by);
    if (r.handoff_to) userIds.add(r.handoff_to);
    if (r.completed_by) userIds.add(r.completed_by);
  });
  let profilesMap: Record<string, string> = {};
  if (userIds.size > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(userIds));
    (profs ?? []).forEach((p: any) => { profilesMap[p.id] = p.display_name ?? "User"; });
  }

  const issues: MaintenanceIssue[] = await Promise.all((data ?? []).map(async (r: any) => {
    const photo_urls: string[] = [];
    for (const path of (r.photo_paths ?? [])) {
      const { data: signed } = await supabase.storage.from("clean-issue-photos").createSignedUrl(path, 3600);
      if (signed?.signedUrl) photo_urls.push(signed.signedUrl);
    }
    return {
      id: r.id,
      listing_id: r.listing_id,
      property_name: r.listings?.name ?? "Unknown",
      issue_type: r.issue_type,
      description: r.description,
      urgency: r.urgency,
      status: r.status,
      maintenance_stage: (r.maintenance_stage ?? "reported") as MaintenanceStage,
      photo_paths: r.photo_paths ?? [],
      photo_urls,
      reported_by_name: r.cleaners?.name ?? null,
      created_at: r.created_at,
      claimed_by: r.claimed_by,
      claimed_by_name: r.claimed_by ? (profilesMap[r.claimed_by] ?? null) : null,
      claimed_at: r.claimed_at,
      handoff_to: r.handoff_to,
      handoff_to_name: r.handoff_to ? (profilesMap[r.handoff_to] ?? null) : null,
      handoff_note: r.handoff_note,
      handoff_at: r.handoff_at,
      completion_note: r.completion_note,
      completed_at: r.completed_at,
      completed_by: r.completed_by,
      completed_by_name: r.completed_by ? (profilesMap[r.completed_by] ?? null) : null,
    };
  }));

  issues.sort((a, b) => {
    const u = (URGENCY_RANK[a.urgency] ?? 9) - (URGENCY_RANK[b.urgency] ?? 9);
    if (u !== 0) return u;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return issues;
}

export function useMaintenanceQueue(options: { subscribe?: boolean } = {}) {
  const { subscribe = true } = options;
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["maintenance_queue"], queryFn: fetchAll });

  useEffect(() => {
    // Only one realtime channel should exist for this topic. The page-level
    // hook subscribes; per-card instances pass { subscribe: false } so they
    // don't open a duplicate channel (which throws "cannot add postgres_changes
    // callbacks ... after subscribe()" and crashes the page).
    if (!subscribe) return;
    const channel = supabase
      .channel("maintenance_queue_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "clean_issues" }, () => {
        qc.invalidateQueries({ queryKey: ["maintenance_queue"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, subscribe]);

  const update = async (id: string, patch: Record<string, any>) => {
    const { error } = await (supabase.from("clean_issues") as any).update(patch).eq("id", id);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["maintenance_queue"] });
  };

  const getUid = async () => (await supabase.auth.getUser()).data.user?.id;

  const claimTask = useMutation({
    mutationFn: async (id: string) => {
      const uid = await getUid();
      await update(id, {
        claimed_by: uid,
        claimed_at: new Date().toISOString(),
        maintenance_stage: "claimed",
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: uid,
      });
    },
  });

  const startWork = useMutation({
    mutationFn: async (id: string) => update(id, { maintenance_stage: "in_progress", status: "in_progress" }),
  });

  const setPendingParts = useMutation({
    mutationFn: async (vars: { id: string; note: string }) =>
      update(vars.id, { maintenance_stage: "pending_parts", handoff_note: vars.note }),
  });

  const resumeWork = useMutation({
    mutationFn: async (id: string) => update(id, { maintenance_stage: "in_progress", status: "in_progress" }),
  });

  const handOffTask = useMutation({
    mutationFn: async (vars: { id: string; to: string; note: string }) =>
      update(vars.id, {
        handoff_to: vars.to,
        handoff_note: vars.note,
        handoff_at: new Date().toISOString(),
        maintenance_stage: "handoff",
      }),
  });

  const acceptHandoff = useMutation({
    mutationFn: async (id: string) => {
      const uid = await getUid();
      await update(id, {
        claimed_by: uid,
        claimed_at: new Date().toISOString(),
        handoff_to: null,
        maintenance_stage: "in_progress",
        status: "in_progress",
      });
    },
  });

  const completeTask = useMutation({
    mutationFn: async (vars: { id: string; note: string }) => {
      const uid = await getUid();
      await update(vars.id, {
        completion_note: vars.note,
        completed_at: new Date().toISOString(),
        completed_by: uid,
        maintenance_stage: "complete",
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: uid,
        resolution_notes: vars.note,
      });
    },
  });

  const reassign = useMutation({
    mutationFn: async (vars: { id: string; to: string }) => {
      await update(vars.id, {
        claimed_by: vars.to,
        claimed_at: new Date().toISOString(),
        maintenance_stage: "claimed",
        handoff_to: null,
      });
    },
  });

  return {
    issues: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refresh: () => qc.invalidateQueries({ queryKey: ["maintenance_queue"] }),
    claimTask, startWork, setPendingParts, resumeWork, handOffTask, acceptHandoff, completeTask, reassign,
  };
}
