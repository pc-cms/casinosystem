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
    const { user_id, new_password } = await req.json();
    if (!user_id || !new_password) return json({ error: "Missing user_id or new_password" }, 400);
    if (String(new_password).length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

    const [{ data: hasManager }, { data: hasSuperAdmin }] = await Promise.all([
      adminClient.rpc("has_role", { _user_id: caller.id, _role: "manager" }),
      adminClient.rpc("has_role", { _user_id: caller.id, _role: "super_admin" }),
    ]);
    if (!hasManager && !hasSuperAdmin) {
      return json({ error: "Manager or Super Admin role required" }, 403);
    }

    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("casino_id, display_name")
      .eq("user_id", user_id)
      .maybeSingle();
    if (!targetProfile) return json({ error: "User profile not found" }, 404);

    const { data: targetIsSuper } = await adminClient.rpc("has_role", {
      _user_id: user_id,
      _role: "super_admin",
    });
    if (targetIsSuper && !hasSuperAdmin) {
      return json({ error: "Only Super Admin can reset password for a Super Admin account" }, 403);
    }

    if (!hasSuperAdmin) {
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("casino_id")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!callerProfile || callerProfile.casino_id !== targetProfile.casino_id) {
        return json({ error: "You can only reset passwords for users in your own casino" }, 403);
      }
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
      password: String(new_password),
    });
    if (updateError) throw updateError;

    return json({ ok: true, user_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reset-user-password] failed:", message, err);
    return json({ error: message }, 400);
  }
});
