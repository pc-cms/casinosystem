import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create a separate client to verify credentials without affecting the caller's session
    const verifyClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: authData, error: authError } = await verifyClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sign out from the verify client immediately
    await verifyClient.auth.signOut();

    const managerId = authData.user.id;

    // Check manager role using service role client
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", managerId);

    const isManager = roles?.some((r: any) => r.role === "manager" || r.role === "floor_manager");

    if (!isManager) {
      return new Response(JSON.stringify({ error: "User is not a manager or floor manager" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get display name
    const { data: profile } = await adminClient
      .from("profiles")
      .select("display_name")
      .eq("user_id", managerId)
      .single();

    return new Response(
      JSON.stringify({
        manager_id: managerId,
        display_name: profile?.display_name || email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
