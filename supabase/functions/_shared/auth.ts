// Caller-role auth for edge functions that should be reachable by internal callers
// (service_role: cron jobs, DB triggers) and logged-in staff/users (authenticated),
// but NOT by anyone holding only the public anon/publishable key.
//
// Use ONLY on functions deployed with verify_jwt = true, so the platform has already
// verified the JWT signature — decoding the payload for `role` is then trustworthy.

export function callerRole(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  const parts = h.slice(7).split(".");
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return (JSON.parse(atob(b64)).role as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns a 401 Response if the caller is anon / unauthenticated, else null.
 * Allows service_role (internal) and authenticated (logged-in users).
 */
export function rejectAnon(req: Request, corsHeaders: Record<string, string> = {}): Response | null {
  const role = callerRole(req);
  if (role === "service_role" || role === "authenticated") return null;
  return new Response(
    JSON.stringify({ error: "unauthorized", detail: "requires an authenticated or service-role token" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
