// Premier Club: cancel a pending KYC submission, unlocking the profile.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyClubToken, tokenFromRequest } from "../_shared/club-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = tokenFromRequest(req);
    if (!token) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const session = await verifyClubToken(token);
    if (!session) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: player } = await sb.from("players").select("id").eq("phone", session.phone).maybeSingle();
    if (!player) return new Response(JSON.stringify({ error: "player_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { error } = await sb.rpc("club_cancel_kyc", { _player_id: player.id });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
