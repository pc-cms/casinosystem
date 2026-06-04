// Premier Club: place a shop order (debits promo wallet via shop_orders trigger flow)
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
    if (!token) return new Response(JSON.stringify({ error: "no token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const session = await verifyClubToken(token);
    if (!session) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { item_id, qty = 1, pickup_casino_id } = await req.json();
    if (!item_id || qty <= 0) return new Response(JSON.stringify({ error: "item_id + qty required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: player, error: pe } = await sb.from("players").select("id").eq("phone", session.phone).maybeSingle();
    if (pe || !player) return new Response(JSON.stringify({ error: "player_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: item, error: ie } = await sb.from("shop_items").select("id, price_credits, stock, is_active").eq("id", item_id).maybeSingle();
    if (ie || !item || !item.is_active) return new Response(JSON.stringify({ error: "item_unavailable" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (Number(item.stock) < qty) return new Response(JSON.stringify({ error: "out_of_stock" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const totalCost = Number(item.price_credits) * qty;

    // Insert order; DB trigger reserves stock + debits wallet (per migration spec)
    const { data: order, error: oe } = await sb.from("shop_orders").insert({
      player_id: player.id,
      item_id,
      qty,
      total_credits: totalCost,
      pickup_casino_id: pickup_casino_id ?? null,
      status: "queued",
    }).select("id, status, total_credits").single();

    if (oe) return new Response(JSON.stringify({ error: oe.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true, order }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
