/**
 * register-local-server — pairing flow для on-prem серверов.
 *
 * Endpoints:
 *   POST   /functions/v1/register-local-server
 *     body: { server_name, server_slug?, server_ip?, hostname?, system_info? }
 *     anon — генерит pairing_code, создаёт row, возвращает { pairing_code, expires_at }
 *
 *   GET    /functions/v1/register-local-server?code=ABCD1234
 *     anon — polling. Возвращает { status } или (если approved):
 *     { status:"approved", casino_id, sync_secret, seed_token, supabase_url, anon_key }
 *
 *   POST   /functions/v1/register-local-server/approve
 *     headers: Authorization: Bearer <super_admin JWT>
 *     body: { id, casino_id }
 *     → генерит sync_secret + seed_token (HS256), создаёт local_servers row.
 *
 *   POST   /functions/v1/register-local-server/reject
 *     headers: Authorization: Bearer <super_admin JWT>
 *     body: { id, reason? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { create as createJwt } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const JWT_SECRET = Deno.env.get("SUPABASE_JWT_SECRET") ?? SERVICE_ROLE;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // base32 без 0/O/1/I/L
const genPairingCode = () => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]).join("");
};
const genSecret = (len = 48) => {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, len);
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function makeSeedToken(casinoId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
  return await createJwt(
    { alg: "HS256", typ: "JWT" },
    { kind: "seed", casino_id: casinoId, exp },
    key,
  );
}

async function requireSuperAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "super_admin")
    .maybeSingle();
  return roleRow ? userData.user : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/.*\/register-local-server/, "") || "/";
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // ─────────── REGISTER ───────────
    if (req.method === "POST" && path === "/") {
      const body = await req.json().catch(() => ({}));
      const server_name = String(body.server_name ?? "").trim();
      if (!server_name) return json(400, { error: "server_name required" });

      // expire старые pending записи
      await admin
        .from("pending_server_registrations")
        .update({ status: "expired" })
        .eq("status", "pending")
        .lt("expires_at", new Date().toISOString());

      let pairing_code = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        pairing_code = genPairingCode();
        const { data, error } = await admin
          .from("pending_server_registrations")
          .insert({
            pairing_code,
            server_name,
            server_slug: body.server_slug ?? null,
            server_ip: body.server_ip ?? null,
            hostname: body.hostname ?? null,
            system_info: body.system_info ?? {},
          })
          .select("id, pairing_code, expires_at")
          .single();
        if (!error && data) {
          return json(200, {
            id: data.id,
            pairing_code: data.pairing_code,
            expires_at: data.expires_at,
          });
        }
        if (error && !error.message.includes("duplicate")) {
          return json(500, { error: error.message });
        }
      }
      return json(500, { error: "could not generate unique pairing code" });
    }

    // ─────────── POLL ───────────
    if (req.method === "GET") {
      const code = (url.searchParams.get("code") ?? "").toUpperCase();
      if (!/^[A-Z0-9]{8}$/.test(code)) return json(400, { error: "invalid code" });

      const { data: row } = await admin
        .from("pending_server_registrations")
        .select("*")
        .eq("pairing_code", code)
        .maybeSingle();
      if (!row) return json(404, { error: "not found" });

      // авто-expire
      if (row.status === "pending" && new Date(row.expires_at).getTime() < Date.now()) {
        await admin.from("pending_server_registrations")
          .update({ status: "expired" }).eq("id", row.id);
        return json(200, { status: "expired" });
      }

      if (row.status === "approved") {
        return json(200, {
          status: "approved",
          id: row.id,
          casino_id: row.approved_casino_id,
          sync_secret: row.sync_secret,
          seed_token: row.seed_token,
          supabase_url: SUPABASE_URL,
          anon_key: ANON_KEY,
        });
      }
      return json(200, { status: row.status });
    }

    // ─────────── APPROVE ───────────
    if (req.method === "POST" && path === "/approve") {
      const user = await requireSuperAdmin(req);
      if (!user) return json(403, { error: "super_admin required" });

      const body = await req.json().catch(() => ({}));
      const { id, casino_id } = body;
      if (!id || !casino_id) return json(400, { error: "id + casino_id required" });

      const { data: row } = await admin
        .from("pending_server_registrations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!row) return json(404, { error: "not found" });
      if (row.status !== "pending") return json(409, { error: `status=${row.status}` });

      const sync_secret = genSecret(48);
      const seed_token = await makeSeedToken(casino_id);
      const seed_token_expires_at = new Date(Date.now() + 24 * 3600_000).toISOString();

      // upsert local_servers (одна строка на (casino_id, server_ip))
      await admin.from("local_servers").upsert({
        casino_id,
        server_ip: row.server_ip ?? "0.0.0.0",
        server_name: row.server_name,
        is_online: false,
        sync_secret,
        linked_by: user.id,
        linked_at: new Date().toISOString(),
      }, { onConflict: "casino_id,server_ip" });

      const { error: updErr } = await admin
        .from("pending_server_registrations")
        .update({
          status: "approved",
          approved_casino_id: casino_id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          sync_secret,
          seed_token,
          seed_token_expires_at,
        })
        .eq("id", id);
      if (updErr) return json(500, { error: updErr.message });

      return json(200, { ok: true });
    }

    // ─────────── REJECT ───────────
    if (req.method === "POST" && path === "/reject") {
      const user = await requireSuperAdmin(req);
      if (!user) return json(403, { error: "super_admin required" });
      const body = await req.json().catch(() => ({}));
      const { id, reason } = body;
      if (!id) return json(400, { error: "id required" });
      await admin.from("pending_server_registrations")
        .update({ status: "rejected", rejected_reason: reason ?? null, approved_by: user.id })
        .eq("id", id);
      return json(200, { ok: true });
    }

    return json(404, { error: "unknown endpoint" });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
