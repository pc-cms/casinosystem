// Premier Club: verify OTP against club_otp_codes, issue session token
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { issueClubToken } from "../_shared/club-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("0")) p = "255" + p.slice(1);
  if (!p.startsWith("255") && p.length <= 9) p = "255" + p;
  return p;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone, code } = await req.json();
    if (!phone || !code) {
      return new Response(JSON.stringify({ error: "phone and code required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const storedPhone = normalizePhone(phone);
    const codeStr = String(code).replace(/\D/g, "");
    if (codeStr.length !== 6) {
      return new Response(JSON.stringify({ error: "invalid_or_expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: row } = await sb
      .from("club_otp_codes")
      .select("id, code_hash, expires_at, used_at, attempts")
      .eq("phone", storedPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now() || (row.attempts ?? 0) >= 5) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_or_expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hash = await sha256Hex(codeStr);
    if (hash !== row.code_hash) {
      await sb.from("club_otp_codes").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
      return new Response(JSON.stringify({ ok: false, error: "invalid_or_expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await sb.from("club_otp_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    const { data: player } = await sb.from("players").select("id, first_name, last_name, verification_status").eq("phone", storedPhone).maybeSingle();
    if (player) {
      const { data: existing } = await sb.from("club_accounts").select("id").eq("phone", storedPhone).maybeSingle();
      if (!existing) {
        await sb.from("club_accounts").insert({ player_id: player.id, phone: storedPhone });
      }
      await sb.from("club_accounts").update({ last_login_at: new Date().toISOString() }).eq("phone", storedPhone);
    }

    const token = await issueClubToken(storedPhone);
    return new Response(
      JSON.stringify({ ok: true, player_exists: !!player, player, token, phone: storedPhone }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
