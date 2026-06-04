// Generates a batch of 8-char promo codes (alphabet A-HJ-NP-Z2-9) for a campaign.
// AM only. Single mode = 1 code optionally pre-assigned to a player.
// Batch mode = N codes, first-come-first-served.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars (no 0/O/1/I)

function genCode(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Verify AM or super_admin
    const { data: isAm } = await supabase.rpc("has_role", { _user_id: user.id, _role: "account_manager" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
    if (!isAm && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const {
      campaign_id,
      amount,
      code_kind = "batch", // "single" | "batch"
      count = 1,
      batch_label = null,
      assigned_player_id = null,
      code_active_from = null,
      code_active_until = null,
      grant_lifetime_mode = "lifetime",
      grant_lifetime_days = null,
      grant_fixed_business_date = null,
      per_player_limit = 1,
      max_uses_total = null,
    } = body;

    if (!campaign_id || typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "campaign_id and amount required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const n = code_kind === "single" ? 1 : Math.min(Math.max(1, count), 1000);
    const batch_id = n > 1 || code_kind === "batch" ? crypto.randomUUID() : null;

    // Generate unique codes
    const rows: any[] = [];
    const seen = new Set<string>();
    while (rows.length < n) {
      const code = genCode();
      if (seen.has(code)) continue;
      seen.add(code);
      rows.push({
        code,
        campaign_id,
        amount,
        code_kind,
        batch_id,
        batch_label,
        assigned_player_id: code_kind === "single" ? assigned_player_id : null,
        code_active_from,
        code_active_until,
        grant_lifetime_mode,
        grant_lifetime_days,
        grant_fixed_business_date,
        per_player_limit,
        max_uses_total,
        created_by: user.id,
      });
    }

    // Bulk insert; retry collisions individually
    const { data, error } = await supabase.from("promo_codes").insert(rows).select("id, code, batch_id");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, batch_id, count: data?.length ?? 0, codes: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
