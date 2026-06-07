// Premier Club: redeem a promo code typed by a logged-in player.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyClubToken, tokenFromRequest } from "../_shared/club-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ERR: Record<string, string> = {
  code_required: "Enter a promo code.",
  code_not_found: "Promo code not found.",
  code_not_started: "This code is not active yet.",
  code_expired: "This code has expired.",
  code_exhausted: "This code has reached its usage limit.",
  already_redeemed: "You've already used this code.",
  house_fund_insufficient: "Promo fund is empty — try again later.",
  player_not_found: "Player record not found.",
  player_id_required: "Player record not found.",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = tokenFromRequest(req);
    if (!token) return json({ error: "unauthorized" }, 401);
    const session = await verifyClubToken(token);
    if (!session) return json({ error: "invalid_token" }, 401);

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    if (!code) return json({ error: ERR.code_required, code: "code_required" }, 400);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: player } = await sb
      .from("players")
      .select("id")
      .eq("phone", session.phone)
      .maybeSingle();
    if (!player) return json({ error: ERR.player_not_found, code: "player_not_found" }, 404);

    const { data, error } = await sb.rpc("club_redeem_promo_code", {
      p_player_id: player.id,
      p_code: code,
    });

    if (error) {
      const raw = (error.message || "").replace(/.*: /, "").trim();
      return json({ error: ERR[raw] || "Could not redeem this code.", code: raw }, 400);
    }

    return json({ ok: true, ...(data as any) });
  } catch (e) {
    console.error("club-redeem-code", e);
    return json({ error: String(e) }, 500);
  }
});
