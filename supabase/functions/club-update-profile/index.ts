// Premier Club: update editable profile fields while unverified.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyClubToken, tokenFromRequest } from "../_shared/club-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ERROR_MESSAGES: Record<string, string> = {
  player_not_found: "Player record not found.",
  profile_locked: "Profile is locked. Verification already submitted.",
  invalid_first_name: "First name is required.",
  invalid_last_name: "Last name is required.",
  invalid_dob: "Date of birth is required.",
  underage: "You must be at least 18 years old.",
  invalid_casino: "Please choose a valid branch.",
  duplicate_id: "A player with this ID number already exists.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = tokenFromRequest(req);
    if (!token) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const session = await verifyClubToken(token);
    if (!session) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const first = String(body.first_name ?? "").trim();
    const last = String(body.last_name ?? "").trim();
    const dob = String(body.dob ?? "").trim();
    const idNumber = String(body.id_number ?? "").trim();
    const casinoSlug = String(body.casino_slug ?? "").trim().toLowerCase() || null;

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: player } = await sb.from("players").select("id").eq("phone", session.phone).maybeSingle();
    if (!player) return new Response(JSON.stringify({ error: "player_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { error } = await sb.rpc("club_update_profile", {
      _player_id: player.id,
      _first: first,
      _last: last,
      _dob: dob,
      _id_number: idNumber || null,
      _casino_slug: casinoSlug,
    });
    if (error) {
      const code = (error.message || "").replace(/.*: /, "").trim();
      return new Response(JSON.stringify({ error: ERROR_MESSAGES[code] || "Update failed", code }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
