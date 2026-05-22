/**
 * admin-list-users — returns enriched user list for the Users admin page.
 *
 * Output rows: { user_id, email, login, display_name, casino_id, casino_ids,
 *                disabled_at, created_at, roles[] }
 *
 * Scoping (matches create-user / reset-password):
 *   - super_admin: sees all users across all casinos
 *   - manager: sees only users whose primary casino == caller's casino
 *
 * The "login" field is derived from email (`<login>@cms.local`).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Not authenticated" }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey);

    const [{ data: hasManager }, { data: hasSuperAdmin }] = await Promise.all([
      adminClient.rpc("has_role", { _user_id: caller.id, _role: "manager" }),
      adminClient.rpc("has_role", { _user_id: caller.id, _role: "super_admin" }),
    ]);
    if (!hasManager && !hasSuperAdmin) {
      return json({ error: "Manager or Super Admin role required" }, 403);
    }

    // Resolve scope: super_admin sees everything; manager limited to own casino.
    let scopeCasinoId: string | null = null;
    if (!hasSuperAdmin) {
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("casino_id")
        .eq("user_id", caller.id)
        .maybeSingle();
      scopeCasinoId = callerProfile?.casino_id ?? null;
      if (!scopeCasinoId) return json({ rows: [] });
    }

    // 1. profiles
    let q = adminClient
      .from("profiles")
      .select("user_id, display_name, casino_id, disabled_at, created_at")
      .order("display_name");
    if (scopeCasinoId) q = q.eq("casino_id", scopeCasinoId);
    const { data: profiles, error: pErr } = await q;
    if (pErr) throw pErr;

    const userIds = (profiles || []).map((p) => p.user_id);
    if (userIds.length === 0) return json({ rows: [] });

    // 2. roles in one round-trip
    const { data: roleRows, error: rErr } = await adminClient
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);
    if (rErr) throw rErr;
    const rolesByUser = new Map<string, string[]>();
    (roleRows || []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) || [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    // 3. extra casino access (multi-casino users)
    const { data: accessRows } = await adminClient
      .from("user_casino_access")
      .select("user_id, casino_id")
      .in("user_id", userIds);
    const accessByUser = new Map<string, string[]>();
    (accessRows || []).forEach((r) => {
      const arr = accessByUser.get(r.user_id) || [];
      arr.push(r.casino_id);
      accessByUser.set(r.user_id, arr);
    });

    // 4. emails via auth.admin.listUsers (paginated). For modest user counts
    // this is fine; we walk pages until we've covered every userId.
    const emailById = new Map<string, string>();
    const wanted = new Set(userIds);
    let page = 1;
    const perPage = 1000;
    while (wanted.size > 0) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users ?? [];
      if (users.length === 0) break;
      for (const u of users) {
        if (wanted.has(u.id)) {
          emailById.set(u.id, u.email ?? "");
          wanted.delete(u.id);
        }
      }
      if (users.length < perPage) break;
      page += 1;
      if (page > 50) break; // hard safety cap (50k users)
    }

    const emailToLogin = (email: string) => {
      if (!email) return "";
      const at = email.indexOf("@");
      return at > 0 ? email.slice(0, at) : email;
    };

    const rows = (profiles || []).map((p) => {
      const email = emailById.get(p.user_id) ?? "";
      const ids = new Set<string>();
      if (p.casino_id) ids.add(p.casino_id);
      (accessByUser.get(p.user_id) || []).forEach((id) => ids.add(id));
      return {
        user_id: p.user_id,
        email,
        login: emailToLogin(email),
        display_name: p.display_name,
        casino_id: p.casino_id,
        casino_ids: Array.from(ids),
        disabled_at: p.disabled_at ?? null,
        created_at: p.created_at,
        roles: rolesByUser.get(p.user_id) || [],
      };
    });

    return json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-list-users] failed:", message, err);
    return json({ error: message }, 400);
  }
});
