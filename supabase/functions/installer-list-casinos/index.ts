// installer-list-casinos
// Public read-only list of casinos for the universal installer (cms-installer.sh).
// Returns slug, display name, code, and expected subdomain.
// No auth — public information used during on-prem server setup.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key);

    const { data, error } = await sb
      .from("casinos")
      .select("id, slug, name, code")
      .order("name", { ascending: true });

    if (error) throw error;

    const casinos = (data ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      code: c.code,
      subdomain: `${c.slug}.casinosystem.app`,
    }));

    return new Response(JSON.stringify({ casinos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
