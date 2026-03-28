import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is a manager
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, serviceKey);
    
    // Check caller has manager role
    const { data: hasManager } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "manager",
    });
    if (!hasManager) throw new Error("Manager role required");

    const { login, password, display_name, roles } = await req.json();
    if (!login || !password || !display_name) throw new Error("Missing fields");

    const email = `${login.toLowerCase().trim()}@cms.local`;

    // Create user via admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name },
    });
    if (createError) throw createError;

    // Assign roles
    if (roles && Array.isArray(roles)) {
      for (const role of roles) {
        await adminClient.from("user_roles").insert({
          user_id: newUser.user.id,
          role,
        });
      }
    }

    return new Response(JSON.stringify({ id: newUser.user.id, login }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
