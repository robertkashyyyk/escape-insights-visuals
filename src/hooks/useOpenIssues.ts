import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OpenIssue {
  id: string;
  listing_id: string;
  property_name: string;
  issue_type: string;
  description: string;
  urgency: "low" | "medium" | "urgent";
  status: "open" | "acknowledged" | "resolved";
  photo_paths: string[];
  reported_by_name: string | null;
  created_at: string;
  first_photo_url: string | null;
}

const URGENCY_RANK = { urgent: 0, medium: 1, low: 2 };

export function useOpenIssues() {
  const [issues, setIssues] = useState<OpenIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIssues = useCallback(async () => {
    const { data, error } = await supabase
      .from("clean_issues")
      .select(`
        id, listing_id, issue_type, description, urgency, status, photo_paths, created_at,
        reported_by_cleaner_id,
        listings!clean_issues_listing_id_fkey (name),
        cleaners!clean_issues_reported_by_cleaner_id_fkey (name)
      `)
      .in("status", ["open", "acknowledged"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("useOpenIssues error", error);
      setLoading(false);
      return;
    }

    const mapped: OpenIssue[] = await Promise.all(
      (data ?? []).map(async (r: any) => {
        let firstPhotoUrl: string | null = null;
        if (r.photo_paths?.[0]) {
          const { data: signed } = await supabase.storage
            .from("clean-issue-photos")
            .createSignedUrl(r.photo_paths[0], 3600);
          firstPhotoUrl = signed?.signedUrl ?? null;
        }
        return {
          id: r.id,
          listing_id: r.listing_id,
          property_name: r.listings?.name ?? "Unknown",
          issue_type: r.issue_type,
          description: r.description,
          urgency: r.urgency,
          status: r.status,
          photo_paths: r.photo_paths ?? [],
          reported_by_name: r.cleaners?.name ?? null,
          created_at: r.created_at,
          first_photo_url: firstPhotoUrl,
        };
      })
    );

    mapped.sort((a, b) => {
      const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      if (u !== 0) return u;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setIssues(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIssues();
    const channel = supabase
      .channel("clean_issues_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "clean_issues" }, () => fetchIssues())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchIssues]);

  const acknowledge = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("clean_issues").update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: user?.id,
    }).eq("id", id);
    fetchIssues();
  };

  const resolve = async (id: string, notes: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("clean_issues").update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
      resolution_notes: notes,
    }).eq("id", id);
    fetchIssues();
  };

  return { issues, loading, acknowledge, resolve, refresh: fetchIssues };
}
