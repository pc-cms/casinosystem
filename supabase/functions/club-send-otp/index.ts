// Premier Club: send OTP via Beem Africa SMS
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BEEM_API_KEY = Deno.env.get("BEEM_API_KEY")!;
const BEEM_SECRET_KEY = Deno.env.get("BEEM_SECRET_KEY")!;
const BEEM_SENDER_ID = Deno.env.get("BEEM_SENDER_ID") ?? "INFO";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizePhone(raw: string): string {
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("0")) p = "255" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  return p;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone } = await req.json();
    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ error: "phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const normalized = normalizePhone(phone);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    await sb.from("club_otp_codes").insert({ phone: normalized, code_hash: codeHash, expires_at: expiresAt });

    const auth = btoa(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);
    const beemResp = await fetch("https://apisms.beem.africa/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        source_addr: BEEM_SENDER_ID,
        encoding: 0,
        schedule_time: "",
        message: `Premier Club code: ${code}. Valid 5 minutes.`,
        recipients: [{ recipient_id: 1, dest_addr: normalized }],
      }),
    });
    const beemBody = await beemResp.text();
    if (!beemResp.ok) {
      console.error("Beem error", beemResp.status, beemBody);
      return new Response(JSON.stringify({ error: "sms_failed", detail: beemBody }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
