import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { displayName } from "@/lib/listingName";
import { format, addDays, startOfDay } from "date-fns";
import { useMemo } from "react";

// Lifecycle: guest in (Occupied) → they leave (Dirty) → clean underway
// (In Progress) → done & vacant (Clean).
export type CleanState = "occupied" | "dirty" | "in_progress" | "clean";

export interface PropertyState {
  listingId: string;
  name: string;
  region: string | null;
  state: CleanState;
  cleaner: string | null;
  cleanerId: string | null;
  checkoutTime: string | null;      // CO time (dirty / in progress)
  fromDate: string | null;          // occupancy start (occupied)
  toDate: string | null;            // occupancy end (occupied)
  expected: string | null;          // "ready ~14:30" / "Wed 10 Sep" / "done 13:13"
  overran: boolean;                 // clean finished later than expected
  issue: { count: number; urgent: boolean } | null;
  sortKey: string;                  // ISO-ish for earliest-first sorting
}

const fmtTime = (t: string | null | undefined): string | null => {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
};
const hhmmPlus = (hhmm: string, addMin: number): string | null => {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + addMin;
  const h = Math.floor((total % 1440) / 60), mi = total % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
};
const finishFromStarted = (iso: string, addMin: number): string => {
  const d = new Date(new Date(iso).getTime() + addMin * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const clockOf = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const minsOf = (hhmm: string): number | null => {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const HIGH = "9999-12-31";

/**
 * Single source of truth for each active property's current cleanliness state,
 * derived live from reservations + clean_tasks (never the fragile is_clean flag).
 * Used by On The Daily and the Properties clean/dirty filter so they always agree.
 */
export function usePropertyStates() {
  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");
  const backStr = format(addDays(today, -45), "yyyy-MM-dd");
  const fwdStr = format(addDays(today, 14), "yyyy-MM-dd");
  const fresh = { staleTime: 15_000, refetchOnWindowFocus: true } as const;

  const { data: listings = [], isLoading: lLoading } = useQuery({
    queryKey: ["pstate-listings"],
    queryFn: async () => {
      const { data } = await supabase.from("listings")
        .select("id, name, internal_name, location_group, status, is_bundle")
        .eq("status", "active");
      return ((data || []) as any[]).filter((l) => !l.is_bundle);
    },
    ...fresh,
  });

  const { data: cleaners = [] } = useQuery({
    queryKey: ["pstate-cleaners"],
    queryFn: async () => {
      const { data } = await supabase.from("cleaners").select("id, name");
      return (data || []) as { id: string; name: string }[];
    },
    ...fresh,
  });

  const { data: reservations = [], isLoading: rLoading } = useQuery({
    queryKey: ["pstate-res", backStr, fwdStr],
    queryFn: async () => fetchAllRows<any>(() =>
      supabase.from("reservations")
        .select("listing_id, check_in, check_out, guest_name, status")
        .eq("status", "confirmed")
        .gte("check_out", backStr)
        .lte("check_in", fwdStr)),
    ...fresh,
  });

  const { data: cleans = [], isLoading: cLoading } = useQuery({
    queryKey: ["pstate-cleans", backStr, fwdStr],
    queryFn: async () => fetchAllRows<any>(() =>
      supabase.from("clean_tasks")
        .select("listing_id, scheduled_date, status, started_at, completed_at, estimated_start_time, cleaning_duration_minutes, checkout_time, assigned_cleaner_id")
        .gte("scheduled_date", backStr).lte("scheduled_date", fwdStr)
        .not("status", "in", "(cancelled,canceled)")),
    ...fresh,
  });

  const { data: issueMap = new Map<string, { count: number; urgent: boolean }>() } = useQuery({
    queryKey: ["pstate-issues", backStr],
    queryFn: async () => {
      const { data } = await supabase.from("clean_issues")
        .select("listing_id, urgency, status, maintenance_stage, created_at")
        .gte("created_at", `${backStr}T00:00:00Z`);
      const m = new Map<string, { count: number; urgent: boolean }>();
      for (const r of (data || []) as any[]) {
        if (r.status === "resolved" || r.maintenance_stage === "complete") continue;
        const cur = m.get(r.listing_id) ?? { count: 0, urgent: false };
        cur.count++; if (r.urgency === "urgent") cur.urgent = true;
        m.set(r.listing_id, cur);
      }
      return m;
    },
    ...fresh,
  });

  const cleanerName = useMemo(() => {
    const m = new Map(cleaners.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [cleaners]);

  const states = useMemo<PropertyState[]>(() => {
    const resByListing = new Map<string, any[]>();
    for (const r of reservations) (resByListing.get(r.listing_id) ?? resByListing.set(r.listing_id, []).get(r.listing_id))!.push(r);
    const cleansByListing = new Map<string, any[]>();
    for (const c of cleans) (cleansByListing.get(c.listing_id) ?? cleansByListing.set(c.listing_id, []).get(c.listing_id))!.push(c);

    const out: PropertyState[] = [];
    for (const l of listings) {
      const res = resByListing.get(l.id) ?? [];
      const cl = cleansByListing.get(l.id) ?? [];

      // In residence = checked in on a PRIOR day (same-day arrivals are handled by the turnover).
      const occupiedRes = res.find((r) => r.check_in < todayStr && r.check_out > todayStr) ?? null;
      const lastCheckout = res.filter((r) => r.check_out <= todayStr)
        .reduce<string | null>((m, r) => (!m || r.check_out > m ? r.check_out : m), null);
      const inProgressClean = cl.find((c) => (c.status === "in_progress" || c.started_at) && c.status !== "completed" && c.status !== "done") ?? null;
      const todayClean = cl.find((c) => c.scheduled_date === todayStr) ?? null;
      // The clean that will resolve a dirty property: earliest non-completed clean on/after the checkout.
      const pendingClean = cl.filter((c) => c.status !== "completed" && c.status !== "done" && c.scheduled_date >= (lastCheckout ?? todayStr))
        .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0] ?? todayClean ?? null;
      const completed = cl.filter((c) => c.status === "completed" || c.status === "done");
      const lastCompleted = completed.reduce<any>((m, c) => (!m || c.scheduled_date > m.scheduled_date ? c : m), null);
      const cleanedSinceCheckout = lastCheckout ? completed.some((c) => c.scheduled_date >= lastCheckout) : true;

      let state: CleanState;
      let relClean: any = null;
      if (inProgressClean) { state = "in_progress"; relClean = inProgressClean; }
      else if (occupiedRes) { state = "occupied"; }
      else if (lastCheckout && !cleanedSinceCheckout) { state = "dirty"; relClean = pendingClean; }
      else { state = "clean"; relClean = lastCompleted; }

      let checkoutTime: string | null = null, fromDate: string | null = null, toDate: string | null = null;
      let expected: string | null = null, overran = false, cleaner: string | null = null, cleanerId: string | null = null;
      let sortKey = HIGH;
      const dur: number | null = relClean?.cleaning_duration_minutes ?? null;

      if (state === "occupied" && occupiedRes) {
        fromDate = occupiedRes.check_in;
        toDate = occupiedRes.check_out;
        sortKey = occupiedRes.check_out;                     // when they leave
      } else if (state === "in_progress" && relClean) {
        cleaner = cleanerName(relClean.assigned_cleaner_id); cleanerId = relClean.assigned_cleaner_id ?? null;
        checkoutTime = fmtTime(relClean.checkout_time);
        if (relClean.started_at && dur) expected = `ready ~${finishFromStarted(relClean.started_at, dur)}`;
        sortKey = `${relClean.scheduled_date}T${(relClean.started_at ? finishFromStarted(relClean.started_at, dur ?? 0) : "00:00")}`;
      } else if (state === "dirty") {
        cleaner = cleanerName(relClean?.assigned_cleaner_id ?? null); cleanerId = relClean?.assigned_cleaner_id ?? null;
        checkoutTime = fmtTime(relClean?.checkout_time);
        if (relClean?.scheduled_date === todayStr && dur) {
          const finish = relClean.estimated_start_time ? hhmmPlus(relClean.estimated_start_time, dur) : null;
          expected = finish ? `ready ~${finish}` : `~${dur}m`;
          sortKey = `${todayStr}T${finish ?? "00:00"}`;
        } else if (relClean?.scheduled_date) {
          expected = format(new Date(relClean.scheduled_date + "T12:00:00"), "EEE d MMM");
          sortKey = relClean.scheduled_date;
        } else {
          expected = "no clean scheduled";
          sortKey = lastCheckout ?? todayStr;
        }
      } else if (state === "clean" && relClean) {
        cleaner = cleanerName(relClean.assigned_cleaner_id); cleanerId = relClean.assigned_cleaner_id ?? null;
        const exp = dur
          ? (relClean.estimated_start_time ? hhmmPlus(relClean.estimated_start_time, dur)
            : relClean.started_at ? finishFromStarted(relClean.started_at, dur) : null)
          : null;
        const actual = relClean.completed_at ? clockOf(relClean.completed_at) : null;
        if (exp && actual) { expected = `exp ~${exp} · done ${actual}`; const em = minsOf(exp), am = minsOf(actual); overran = em != null && am != null && am > em; }
        else if (actual) expected = `done ${actual}`;
        if (relClean.scheduled_date && relClean.scheduled_date !== todayStr) expected = format(new Date(relClean.scheduled_date + "T12:00:00"), "EEE d MMM");
        sortKey = relClean.scheduled_date ?? todayStr;
      }

      out.push({
        listingId: l.id,
        name: displayName(l) || "Unknown",
        region: l.location_group ?? null,
        state, cleaner, cleanerId, checkoutTime, fromDate, toDate, expected, overran,
        issue: issueMap.get(l.id) ?? null,
        sortKey,
      });
    }
    return out;
  }, [listings, reservations, cleans, issueMap, todayStr, cleanerName]);

  const byId = useMemo(() => new Map(states.map((s) => [s.listingId, s])), [states]);

  return { states, byId, cleaners, loading: lLoading || rLoading || cLoading };
}
