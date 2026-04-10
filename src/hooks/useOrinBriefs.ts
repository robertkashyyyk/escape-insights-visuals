import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OrinBrief {
  id: string;
  period_type: "monthly" | "quarterly";
  period_label: string;
  period_start: string;
  period_end: string;
  content: any;
  status: "generated" | "generating" | "failed";
  generated_at: string;
}

// Define all historical periods that should exist
function getExpectedPeriods(): { period_type: "monthly" | "quarterly"; period_label: string; period_start: string; period_end: string }[] {
  const today = new Date();
  const periods: any[] = [];

  // Quarterly: Q4 2025, Q1 2026, and any subsequent completed quarters
  const quarters = [
    { label: "Q4 2025", start: "2025-10-01", end: "2025-12-31" },
    { label: "Q1 2026", start: "2026-01-01", end: "2026-03-31" },
    { label: "Q2 2026", start: "2026-04-01", end: "2026-06-30" },
    { label: "Q3 2026", start: "2026-07-01", end: "2026-09-30" },
    { label: "Q4 2026", start: "2026-10-01", end: "2026-12-31" },
  ];
  quarters.forEach(q => {
    if (new Date(q.end) < today) {
      periods.push({ period_type: "quarterly" as const, ...q });
    }
  });

  // Monthly: Oct 2025 through current month (only completed months)
  const startMonth = new Date(2025, 9, 1); // Oct 2025
  const current = new Date(today.getFullYear(), today.getMonth(), 1);
  let m = new Date(startMonth);
  while (m < current) {
    const nextMonth = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const label = m.toLocaleString("en-GB", { month: "long", year: "numeric" });
    periods.push({
      period_type: "monthly" as const,
      period_label: label,
      period_start: m.toISOString().slice(0, 10),
      period_end: new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10),
    });
    m = nextMonth;
  }

  return periods;
}

// Get next upcoming period (locked)
export function getNextPeriod(type: "monthly" | "quarterly") {
  const today = new Date();
  if (type === "quarterly") {
    const quarters = [
      { label: "Q1", startMonth: 0, endMonth: 2 },
      { label: "Q2", startMonth: 3, endMonth: 5 },
      { label: "Q3", startMonth: 6, endMonth: 8 },
      { label: "Q4", startMonth: 9, endMonth: 11 },
    ];
    for (const q of quarters) {
      const end = new Date(today.getFullYear(), q.endMonth + 1, 0);
      if (end >= today) {
        const availableDate = new Date(today.getFullYear(), q.endMonth + 1, 1);
        return {
          label: `${q.label} ${today.getFullYear()}`,
          availableDate: availableDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        };
      }
    }
    return { label: `Q1 ${today.getFullYear() + 1}`, availableDate: `1 April ${today.getFullYear() + 1}` };
  }
  // Monthly: current month
  const nextAvailable = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return {
    label: today.toLocaleString("en-GB", { month: "long", year: "numeric" }),
    availableDate: nextAvailable.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  };
}

export function useOrinBriefs(type?: "monthly" | "quarterly") {
  return useQuery({
    queryKey: ["orin-briefs", type],
    queryFn: async () => {
      let q = supabase.from("orin_briefs").select("*").order("period_start", { ascending: false });
      if (type) q = q.eq("period_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as OrinBrief[];
    },
  });
}

export function useGenerateBriefs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: { force?: boolean; specificPeriods?: any[] } = {}) => {
      const periods = options?.specificPeriods || getExpectedPeriods();
      if (periods.length === 0) {
        toast.info("No completed periods to generate briefs for.");
        return { results: [] };
      }

      const { data, error } = await supabase.functions.invoke("generate-orin-brief", {
        body: { periods: periods.map(p => ({ ...p, force: options?.force })) },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orin-briefs"] });
      const generated = data?.results?.filter((r: any) => r.status === "generated").length || 0;
      if (generated > 0) toast.success(`Generated ${generated} brief(s)`);
    },
    onError: (err) => {
      toast.error("Failed to generate briefs: " + (err as Error).message);
    },
  });
}

export function useRegenerateBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (brief: { period_type: string; period_label: string; period_start: string; period_end: string }) => {
      const { data, error } = await supabase.functions.invoke("generate-orin-brief", {
        body: { ...brief, force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orin-briefs"] });
      toast.success("Brief regenerated");
    },
    onError: (err) => {
      toast.error("Failed to regenerate: " + (err as Error).message);
    },
  });
}
