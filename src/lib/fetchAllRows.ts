// Page through a Supabase/PostgREST query past the default 1000-row cap.
//
// PostgREST returns at most ~1000 rows per request, so any portfolio-wide query
// (e.g. all confirmed reservations in a year ≈ 2000 rows) is silently truncated,
// which halves revenue/occupancy/nights metrics. Pass a thunk that builds the
// query fresh each call (filters + select, NO .range); this re-runs it per page
// with .range() and a stable id ordering, then concatenates.
//
//   const rows = await fetchAllRows(() =>
//     supabase.from("reservations").select("*").eq("status", "confirmed").gte("check_in", from));
export async function fetchAllRows<T = any>(
  buildQuery: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery()
      .order("id", { ascending: true })           // stable order so pages don't overlap/skip
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
