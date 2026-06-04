// Cashier: scan player's QR token and redeem promo credits via FIFO.
// Verifies the player's club-token, then calls redeem_promo_fifo as service.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyClubToken } from "../_shared/club-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing_auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify cashier auth (Supabase user)
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "invalid_auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { qr_token, amount, casino_id, cage_id, shift_id } = body as {
      qr_token?: string; amount?: number; casino_id?: string; cage_id?: string | null; shift_id?: string;
    };

    if (!qr_token || !amount || amount <= 0 || !casino_id || !shift_id) {
      return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const session = await verifyClubToken(qr_token);
    if (!session) {
      return new Response(JSON.stringify({ error: "invalid_qr" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: player, error: pErr } = await svc.from("players").select("id, first_name, last_name").eq("phone", session.phone).maybeSingle();
    if (pErr || !player) {
      return new Response(JSON.stringify({ error: "player_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call RPC as the cashier (so audit trail records actor)
    const { data: result, error: rpcErr } = await userClient.rpc("redeem_promo_fifo", {
      p_player_id: player.id,
      p_casino_id: casino_id,
      p_amount: amount,
      p_cage_id: cage_id ?? null,
      p_cashier_id: userData.user.id,
      p_shift_id: shift_id,
      p_payout_type: "chips",
    });
    if (rpcErr) {
      return new Response(JSON.stringify({ error: rpcErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, player, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
