// Caller-role auth for edge functions that should be reachable by internal callers
// (service_role: cron jobs, DB triggers) and logged-in staff/users (authenticated),
// but NOT by anyone holding only the public anon/publishable key.
//
// Use ONLY on functions deployed with verify_jwt = true, so the platform has already
// verified the JWT signature — decoding the payload for `role` is then trustworthy.

export function callerRole(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();

  // Modern service key (sb_secret_…) is an OPAQUE string, not a JWT — it has no
  // decodable role payload. The platform gateway has already validated it as a
  // service key, so an exact match against the function's own service-role env
  // value is authoritative: this caller is service_role. (Edge-to-edge calls
  // send Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") here.) Legacy projects whose
  // service key is still a JWT fall through to the decode path below and resolve
  // role="service_role" the same way.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return "service_role";

  // JWTs (all authenticated user tokens, and any legacy service_role JWT) carry
  // the role in the payload's second segment.
  const parts = token.split(".");
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
