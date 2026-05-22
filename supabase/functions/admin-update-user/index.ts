/**
 * admin-update-user — updates a user's display_name and/or login (email).
 *
 * Body: { user_id, display_name?, login? }
 *
 * Scoping: manager → own casino only; super_admin → any user.
 * Cannot target a super_admin unless caller is super_admin.
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

    const { user_id, display_name, login } = await req.json();
    if (!user_id) return json({ error: "Missing user_id" }, 400);

    const [{ data: hasManager }, { data: hasSuperAdmin }] = await Promise.all([
      adminClient.rpc("has_role", { _user_id: caller.id, _role: "manager" }),
      adminClient.rpc("has_role", { _user_id: caller.id, _role: "super_admin" }),
    ]);
    if (!hasManager && !hasSuperAdmin) {
      return json({ error: "Manager or Super Admin role required" }, 403);
    }

    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("casino_id")
      .eq("user_id", user_id)
      .maybeSingle();
    if (!targetProfile) return json({ error: "User profile not found" }, 404);

    const { data: targetIsSuper } = await adminClient.rpc("has_role", {
      _user_id: user_id,
      _role: "super_admin",
    });
    if (targetIsSuper && !hasSuperAdmin) {
      return json({ error: "Only Super Admin can modify a Super Admin account" }, 403);
    }

    if (!hasSuperAdmin) {
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("casino_id")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!callerProfile || callerProfile.casino_id !== targetProfile.casino_id) {
        return json({ error: "You can only modify users in your own casino" }, 403);
      }
    }

    // Update display_name on profile
    if (typeof display_name === "string" && display_name.trim()) {
      const { error: dnErr } = await adminClient
        .from("profiles")
        .update({ display_name: display_name.trim() })
        .eq("user_id", user_id);
      if (dnErr) throw dnErr;
    }

    // Update login (email) via admin API
    if (typeof login === "string" && login.trim()) {
      const cleanLogin = login.trim().toLowerCase().replace(/\s+/g, "");
      const newEmail = `${cleanLogin}@cms.local`;
      const { error: emErr } = await adminClient.auth.admin.updateUserById(user_id, {
        email: newEmail,
        email_confirm: true,
      });
      if (emErr) {
        const code = (emErr as { code?: string }).code;
        if (code === "email_exists" || emErr.message.toLowerCase().includes("already")) {
          return json({ error: `Login "${cleanLogin}" already exists` }, 409);
        }
        throw emErr;
      }
    }

    return json({ ok: true, user_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-update-user] failed:", message, err);
    return json({ error: message }, 400);
  }
});
