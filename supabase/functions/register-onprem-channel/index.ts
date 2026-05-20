// register-onprem-channel
// ------------------------
// Called by the on-prem installer wizard once the operator has paired the
// box with their super_admin login. Flow:
//
//   1. installer POSTs { slug, casino_id, tunnel_hostname, cf_tunnel_id?,
//                        bootstrap_secret, version? }
//   2. function validates bootstrap_secret == ONPREM_REGISTER_SECRET
//   3. function mints a fresh 32-byte HMAC secret, stores its SHA-256 hash
//      in onprem_channels.hmac_secret_hash, returns the plaintext ONCE
//   4. installer writes the plaintext to /etc/casino/onprem-hmac.key (chmod 600)
//      — the Cloud-side node-control edge function later signs requests with it.
//
// This endpoint deliberately runs WITHOUT JWT verification — the installer
// has no Supabase user. The bootstrap secret is the only gatekeeper.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_SLUGS = new Set(["mwz", "aru", "dod", "mbi"]);

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const bootstrapSecret = String(body.bootstrap_secret ?? "");
  const expected = Deno.env.get("ONPREM_REGISTER_SECRET") ?? "";
  if (!expected) {
    return json({ error: "server_misconfigured", detail: "ONPREM_REGISTER_SECRET not set" }, 500);
  }
  if (bootstrapSecret.length < 16 || bootstrapSecret !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const slug = String(body.slug ?? "").toLowerCase();
  const casinoId = String(body.casino_id ?? "");
  const tunnelHostname = String(body.tunnel_hostname ?? "").toLowerCase();
  const cfTunnelId = body.cf_tunnel_id ? String(body.cf_tunnel_id) : null;
  const version = body.version ? String(body.version) : null;

  if (!ALLOWED_SLUGS.has(slug)) {
    return json({ error: "invalid_slug", detail: `must be one of ${[...ALLOWED_SLUGS].join(",")}` }, 400);
  }
  if (!/^[0-9a-f-]{36}$/.test(casinoId)) {
    return json({ error: "invalid_casino_id" }, 400);
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(tunnelHostname)) {
    return json({ error: "invalid_tunnel_hostname" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Confirm casino exists
  const { data: casino, error: casinoErr } = await supabase
    .from("casinos")
    .select("id, slug")
    .eq("id", casinoId)
    .maybeSingle();
  if (casinoErr) return json({ error: "db_error", detail: casinoErr.message }, 500);
  if (!casino) return json({ error: "casino_not_found" }, 404);

  // Mint fresh HMAC secret + 8-digit pairing code (pairing UI flow is optional;
  // bootstrap_secret alone is sufficient for first registration).
  const hmacSecret = randomHex(32); // 64-char hex
  const hmacHash = await sha256Hex(hmacSecret);
  const pairingCode = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  const pairingExpiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

  // Upsert by slug — re-registration rotates the secret.
  const { data: existing } = await supabase
    .from("onprem_channels")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  const row = {
    casino_id: casinoId,
    slug,
    tunnel_hostname: tunnelHostname,
    cf_tunnel_id: cfTunnelId,
    hmac_secret_hash: hmacHash,
    pairing_code: pairingCode,
    pairing_expires_at: pairingExpiresAt,
    status: "pending" as const,
    version,
    last_seen_at: new Date().toISOString(),
  };

  let channelId: string;
  if (existing) {
    const { data, error } = await supabase
      .from("onprem_channels")
      .update(row)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) return json({ error: "db_update_failed", detail: error.message }, 500);
    channelId = data.id;
  } else {
    const { data, error } = await supabase
      .from("onprem_channels")
      .insert(row)
      .select("id")
      .single();
    if (error) return json({ error: "db_insert_failed", detail: error.message }, 500);
    channelId = data.id;
  }

  return json({
    ok: true,
    channel_id: channelId,
    slug,
    hmac_secret: hmacSecret,        // returned ONCE — installer must persist
    pairing_code: pairingCode,      // operator confirms in browser wizard
    pairing_expires_at: pairingExpiresAt,
  });
});
