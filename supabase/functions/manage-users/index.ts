import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "list"
  | "create"
  | "update_role"
  | "delete"
  | "reset_password"
  | "invite_email"
  | "resend_invite";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const callerId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "super")
      .maybeSingle();

    if (!roleRow) return json({ error: "Only super users allowed" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = (body?.action ?? "list") as Action;

    if (action === "list") {
      // Fetch all auth users (paginated)
      const allUsers: any[] = [];
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) return json({ error: error.message }, 500);
        allUsers.push(...data.users);
        if (data.users.length < perPage) break;
        page++;
      }

      const ids = allUsers.map((u) => u.id);

      const [rolesRes, profilesRes, ownersRes, cleanersRes] = await Promise.all([
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
        admin.from("profiles").select("id, display_name, avatar_url").in("id", ids),
        admin.from("property_owners").select("id, name, user_id").in("user_id", ids),
        admin.from("cleaners").select("id, name, user_id").in("user_id", ids),
      ]);

      const roleMap = new Map((rolesRes.data ?? []).map((r) => [r.user_id, r.role]));
      const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      const ownerMap = new Map((ownersRes.data ?? []).map((o) => [o.user_id, o]));
      const cleanerMap = new Map((cleanersRes.data ?? []).map((c) => [c.user_id, c]));

      const users = allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role: roleMap.get(u.id) ?? null,
        display_name: profileMap.get(u.id)?.display_name ?? null,
        avatar_url: profileMap.get(u.id)?.avatar_url ?? null,
        owner_link: ownerMap.get(u.id) ?? null,
        cleaner_link: cleanerMap.get(u.id) ?? null,
      }));

      users.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
      return json({ users });
    }

    if (action === "update_role") {
      const { user_id, role } = body;
      if (!user_id || !role) return json({ error: "user_id and role required" }, 400);
      const valid = ["super", "senior", "admin", "client", "cleaner"];
      if (!valid.includes(role)) return json({ error: "Invalid role" }, 400);
      if (user_id === callerId && role !== "super") {
        return json({ error: "You cannot demote yourself" }, 400);
      }

      // Upsert: delete existing, insert new (table has unique on (user_id, role) but a user may only have one role here)
      await admin.from("user_roles").delete().eq("user_id", user_id);
      const { error } = await admin.from("user_roles").insert({ user_id, role });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "create") {
      const { email, name, role, linkTable, linkId, credential_mode, password } = body;
      if (!email || !role) return json({ error: "email and role are required" }, 400);
      const valid = ["super", "senior", "admin", "client", "cleaner"];
      if (!valid.includes(role)) return json({ error: "Invalid role" }, 400);
      const validLinkTables = ["cleaners", "property_owners"];
      if (linkTable && !validLinkTables.includes(linkTable)) {
        return json({ error: "Invalid linkTable" }, 400);
      }
      const mode = credential_mode === "temp_password" ? "temp_password" : "invite";
      if (mode === "temp_password" && (typeof password !== "string" || password.length < 8)) {
        return json({ error: "A temporary password of at least 8 characters is required" }, 400);
      }

      // Idempotent: adopt an existing account for this email instead of erroring.
      // This is what prevents half-finished-account orphans (create succeeds, a
      // later step fails, retry hits "already registered").
      let userId: string | undefined;
      let adopted = false;
      const existing = await findUserByEmail(admin, String(email));
      if (existing) {
        userId = existing.id;
        adopted = true;
        if (mode === "temp_password") {
          const { error } = await admin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
          });
          if (error) return json({ error: `Set password failed: ${error.message}` }, 500);
        }
      } else if (mode === "temp_password") {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role, name },
        });
        if (error) return json({ error: `Create failed: ${error.message}` }, 400);
        userId = data.user?.id;
      } else {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { role, name },
        });
        if (error) return json({ error: `Invite failed: ${error.message}` }, 400);
        userId = data.user?.id;
      }
      if (!userId) return json({ error: "Could not resolve the user id" }, 500);

      // Assign role (single-role model: clear then set). Errors are surfaced.
      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role });
      if (roleErr) return json({ error: `Role assignment failed: ${roleErr.message}` }, 500);

      // Link the domain record (cleaner / owner). Errors are surfaced.
      if (linkTable && linkId) {
        const { error: linkErr } = await admin.from(linkTable).update({ user_id: userId }).eq("id", linkId);
        if (linkErr) return json({ error: `Linking ${linkTable} failed: ${linkErr.message}` }, 500);
      }

      if (name) {
        await admin.from("profiles").upsert({ id: userId, display_name: name }, { onConflict: "id" });
      }

      return json({ success: true, user_id: userId, adopted, mode });
    }

    if (action === "invite_email" || action === "resend_invite") {
      let { email } = body;
      const { user_id } = body;
      if (!email && user_id) {
        const { data } = await admin.auth.admin.getUserById(user_id);
        email = data?.user?.email ?? undefined;
      }
      if (!email) return json({ error: "email or user_id required" }, 400);
      const { error } = await admin.auth.admin.inviteUserByEmail(email);
      if (error) {
        return json(
          { error: `Could not send invite: ${error.message}. If the account already exists, use a temporary password instead.` },
          400,
        );
      }
      return json({ success: true });
    }

    if (action === "reset_password") {
      const { user_id, password } = body;
      if (!user_id || !password) return json({ error: "user_id and password required" }, 400);
      if (typeof password !== "string" || password.length < 8) {
        return json({ error: "Password must be at least 8 characters" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      if (user_id === callerId) return json({ error: "You cannot delete yourself" }, 400);

      // Unlink from owners/cleaners first (set user_id to null)
      await admin.from("property_owners").update({ user_id: null }).eq("user_id", user_id);
      await admin.from("cleaners").update({ user_id: null }).eq("user_id", user_id);
      await admin.from("user_roles").delete().eq("user_id", user_id);

      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("manage-users error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// Find an existing auth user by email (case-insensitive). GoTrue admin has no
// server-side email filter in this version, so paginate. Admin action, infrequent.
async function findUserByEmail(admin: any, email: string): Promise<any | null> {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u: any) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
    page++;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
