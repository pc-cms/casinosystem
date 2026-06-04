// Premier Club: self-registration. Requires club session token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyClubToken, tokenFromRequest } from "../_shared/club-token.ts";
import { hashPassword, validatePasswordStrength } from "../_shared/club-password.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_SLUGS = new Set(["arusha", "mwanza", "dodoma", "mbeya"]);

const ERROR_MESSAGES: Record<string, string> = {
  invalid_phone: "Invalid phone number.",
  invalid_first_name: "First name is required.",
  invalid_last_name: "Last name is required.",
  invalid_dob: "Date of birth is required.",
  underage: "You must be at least 18 years old.",
  invalid_casino: "Please choose a valid branch.",
  duplicate_phone: "A player with this phone number already exists. Please sign in.",
  duplicate_id: "A player with this ID number already exists.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = tokenFromRequest(req);
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const session = await verifyClubToken(token);
    if (!session) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const first = String(body.first_name ?? "").trim();
    const last = String(body.last_name ?? "").trim();
    const dob = String(body.dob ?? "").trim(); // YYYY-MM-DD
    const idNum = String(body.id_number ?? "").trim();
    const casinoSlug = String(body.casino_slug ?? "").trim().toLowerCase();

    if (!ALLOWED_SLUGS.has(casinoSlug)) {
      return new Response(JSON.stringify({ error: ERROR_MESSAGES.invalid_casino }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Short-circuit: phone already attached to a player → return that player.
    const { data: existing } = await sb
      .from("club_accounts")
      .select("player_id, players:player_id (id, first_name, last_name, phone, verification_status, casino_id)")
      .eq("phone", session.phone)
      .maybeSingle();
    if (existing?.players) {
      return new Response(JSON.stringify({ ok: true, player: existing.players, already_registered: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await sb.rpc("club_self_register", {
      _phone: session.phone,
      _first: first,
      _last: last,
      _dob: dob,
      _id_number: idNum || null,
      _casino_slug: casinoSlug,
    });
    if (error) {
      const code = (error.message || "").replace(/.*: /, "").trim();
      const msg = ERROR_MESSAGES[code] || "Registration failed. Please try again.";
      return new Response(JSON.stringify({ error: msg, code }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const playerId = (data as any)?.player_id;
    const { data: player } = await sb
      .from("players")
      .select("id, first_name, last_name, phone, verification_status, casino_id")
      .eq("id", playerId)
      .maybeSingle();

    return new Response(JSON.stringify({ ok: true, player }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
