/**
 * mirror-parity — peer endpoint that returns Cloud's parity snapshot
 * for a casino. Called by local server (or Admin UI) to compare
 * checksums against its own snapshot.
 *
 * GET  /mirror-parity?casino_id=<uuid>
 *   Auth: HMAC-signed via x-peer-node-id + x-peer-signature
 *         OR x-service-key === SERVICE_ROLE_KEY
 *         OR Bearer JWT of a super_admin user.
 */
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-service-key, x-peer-node-id, x-peer-signature",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function hmac(secret: string, raw: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorize(req: Request, raw: string): Promise<{ ok: boolean; reason?: string }> {
  const skey = req.headers.get("x-service-key");
  if (skey && skey === SERVICE_KEY) return { ok: true };

  const peerSig = req.headers.get("x-peer-signature");
  const peerNode = req.headers.get("x-peer-node-id");
  if (peerSig && peerNode) {
    const { data: peers } = await admin.from("peer_links")
      .select("sync_secret").eq("peer_node_id", peerNode).eq("status", "active");
    for (const p of peers ?? []) {
      const expected = await hmac(p.sync_secret, raw);
      if (expected === peerSig) return { ok: true };
    }
    return { ok: false, reason: "peer signature mismatch" };
  }

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const { data: userRes } = await admin.auth.getUser(token);
    if (userRes?.user) {
      const { data: roles } = await admin.from("user_roles")
        .select("role").eq("user_id", userRes.user.id);
      if ((roles ?? []).some((r: any) => r.role === "super_admin")) return { ok: true };
    }
    return { ok: false, reason: "super_admin required" };
  }
  return { ok: false, reason: "auth required" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json(405, { error: "method not allowed" });

  const raw = ""; // GET — empty body for HMAC
  const authz = await authorize(req, raw);
  if (!authz.ok) return json(401, { error: authz.reason });

  const url = new URL(req.url);
  const casinoId = url.searchParams.get("casino_id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(casinoId)) return json(400, { error: "casino_id required (uuid)" });

  const { data, error } = await admin.rpc("mirror_full_parity_snapshot", { p_casino_id: casinoId });
  if (error) return json(500, { error: error.message });

  return json(200, {
    casino_id: casinoId,
    captured_at: new Date().toISOString(),
    rows: data ?? [],
  });
});
