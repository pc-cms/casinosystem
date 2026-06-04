// Premier Club: get wallet (active grants, balance, recent redemptions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyClubToken, tokenFromRequest, issueClubToken } from "../_shared/club-token.ts";

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
    if (!token) return new Response(JSON.stringify({ error: "no token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const session = await verifyClubToken(token);
    if (!session) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: player } = await sb
      .from("players")
      .select("id, first_name, last_name, phone, verification_status, verified_source, verified_at, birth_date, id_number, photo_url, id_document_url, casino_id, casinos(name, slug)")
      .eq("phone", session.phone)
      .maybeSingle();
    if (!player) {
      return new Response(JSON.stringify({ ok: true, player: null, balance: 0, grants: [], redemptions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const playerOut = {
      ...player,
      dob: (player as any).birth_date,
      casino_name: (player as any).casinos?.name ?? null,
      casino_slug: (player as any).casinos?.slug ?? null,
    };

    const { data: grantsRaw } = await sb
      .from("promo_grants")
      .select("id, amount, remaining, status, source, expires_at, created_at, notes")
      .eq("player_id", player.id)
      .eq("status", "active")
      .gt("remaining", 0)
      .order("expires_at", { ascending: true, nullsFirst: false });
    const grants = grantsRaw ?? [];

    const balance = grants.reduce((s, g: any) => s + Number(g.remaining || 0), 0);

    const { data: redemptionsRaw } = await sb
      .from("promo_redemptions")
      .select("id, amount, payout_type, created_at, casino_id")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const redemptions = redemptionsRaw ?? [];

    // Short-lived rotating token used as the cashier QR payload (60s).
    const redeem_token = await issueClubToken(session.phone, 60);
    const redeem_token_exp = Math.floor(Date.now() / 1000) + 60;

    return new Response(JSON.stringify({ ok: true, player: playerOut, balance, grants, redemptions, redeem_token, redeem_token_exp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
