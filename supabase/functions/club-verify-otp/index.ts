// Premier Club: verify OTP via Twilio Verify, return signed session token
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { issueClubToken } from "../_shared/club-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_VERIFY_SERVICE_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;

function normalizePhone(raw: string): string {
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("0")) p = "255" + p.slice(1);
  if (!p.startsWith("+")) p = "+" + p.replace(/^\+?/, "");
  return p;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone, code } = await req.json();
    if (!phone || !code) {
      return new Response(JSON.stringify({ error: "phone and code required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const e164 = normalizePhone(phone);              // +255... for Twilio
    const storedPhone = digitsOnly(e164);            // 255... matches players.phone

    // Verify code with Twilio
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const resp = await fetch(
      `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: e164, Code: String(code) }),
      }
    );
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || body?.status !== "approved") {
      console.error("Twilio VerificationCheck failed", resp.status, body);
      return new Response(JSON.stringify({ ok: false, error: "invalid_or_expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Look up player + ensure club_account
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
