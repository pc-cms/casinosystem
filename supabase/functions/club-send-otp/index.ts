// Premier Club: send OTP via BEEM Africa SMS API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BEEM_API_KEY = Deno.env.get("BEEM_API_KEY")!;
const BEEM_SECRET_KEY = Deno.env.get("BEEM_SECRET_KEY")!;
const BEEM_SENDER_ID = Deno.env.get("BEEM_SENDER_ID") || "INFO";

function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("0")) p = "255" + p.slice(1);
  if (!p.startsWith("255") && p.length <= 9) p = "255" + p;
  return p; // digits only, e.g. 2557XXXXXXXX
}

async function sha256Hex(s: string): Promise<string> {
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
    if (normalized.length < 10) {
      return new Response(JSON.stringify({ error: "invalid_phone" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Throttle: max 1 send per 45s per phone
    const { data: recent } = await sb
      .from("club_otp_codes")
      .select("created_at")
      .eq("phone", normalized)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.created_at) {
      const ageMs = Date.now() - new Date(recent.created_at).getTime();
      if (ageMs < 45_000) {
        return new Response(JSON.stringify({ error: "rate_limited", retry_in: Math.ceil((45_000 - ageMs) / 1000) }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256Hex(code);
    const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();

    const { error: insErr } = await sb.from("club_otp_codes").insert({
      phone: normalized, code_hash, expires_at,
    });
    if (insErr) {
      console.error("OTP insert failed", insErr);
      return new Response(JSON.stringify({ error: "db_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const auth = btoa(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);
    const resp = await fetch("https://apisms.beem.africa/v1/send", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source_addr: BEEM_SENDER_ID,
        schedule_time: "",
        encoding: 0,
        message: `Your Premier Club code: ${code}. Expires in 5 minutes.`,
        recipients: [{ recipient_id: "1", dest_addr: normalized }],
      }),
    });
    const body = await resp.text();
    if (!resp.ok) {
      console.error("BEEM send error", resp.status, body);
      return new Response(JSON.stringify({ error: "sms_failed", detail: body }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
