/**
 * peer-mesh — Cloud-side peer endpoints, making Cloud just another peer.
 *
 * Exposes the same surface as cms-sync's HTTP API:
 *   POST /peer-mesh/handshake
 *   POST /peer-mesh/push
 *   POST /peer-mesh/pull
 *   GET  /peer-mesh/health
 *
 * Peers authenticate via HMAC-SHA256 over the raw request body, using
 * sync_secret from public.peer_links matched by header `x-peer-node-id`.
 */
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-peer-node-id, x-peer-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCHEMA_VERSION = Deno.env.get("SCHEMA_VERSION") ?? "0.0.0";

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

async function authPeer(req: Request, raw: string, isHandshake: boolean) {
  const sig = req.headers.get("x-peer-signature");
  const peerNodeId = req.headers.get("x-peer-node-id");
  if (!sig || !peerNodeId) return { error: "missing peer auth headers" };

  const q = admin.from("peer_links").select("*");
  const { data: peers, error } = isHandshake
    ? await q.in("status", ["pending_outbound","pending_inbound","active","paused"])
    : await q.eq("peer_node_id", peerNodeId).eq("status", "active");
  if (error) return { error: error.message };

  for (const p of peers ?? []) {
    const expected = await hmac(p.sync_secret, raw);
    if (sig.length === expected.length && sig === expected) return { peer: p };
  }
  return { error: "signature mismatch" };
}

async function getIdentity() {
  const { data } = await admin
    .from("node_identity").select("node_id, display_name, node_kind, schema_version").maybeSingle();
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // Strip /peer-mesh prefix (function name path segment). Local cms-sync uses
  // /peer/* routes, so accept both /handshake and /peer/handshake variants.
  const sub = (url.pathname.replace(/^\/peer-mesh/, "") || "/").replace(/^\/peer(?=\/)/, "");

  try {
    if (sub === "/health" && req.method === "GET") {
      const id = await getIdentity();
      return json(200, { ok: true, ...(id ?? {}), schema_version: id?.schema_version ?? SCHEMA_VERSION });
    }

    if (req.method !== "POST") return json(405, { error: "method not allowed" });
    const raw = await req.text();
    const isHandshake = sub === "/handshake";
    const auth = await authPeer(req, raw, isHandshake);
    if (auth.error) return json(401, { error: auth.error });
    const peer = auth.peer!;
    const body = raw ? JSON.parse(raw) : {};

    if (sub === "/handshake") {
      const newStatus = peer.status === "pending_outbound" ? "active" : peer.status;
      await admin.from("peer_links").update({
        peer_node_id: body.my_node_id,
        schema_version: body.my_schema_version ?? null,
        last_seen_at: new Date().toISOString(),
        status: newStatus,
        display_name: body.my_display_name || peer.display_name,
      }).eq("id", peer.id);
      const id = await getIdentity();
      return json(200, { ok: true, ...(id ?? {}) });
    }

    if (sub === "/push") {
      const changes = Array.isArray(body.changes) ? body.changes : [];
      const accepted: number[] = [];
      for (const ch of changes) {
        const { error } = await admin.rpc("peer_apply_change", {
          p_origin_node_id: ch.origin_node_id || peer.peer_node_id,
          p_table: ch.table,
          p_op: ch.op,
          p_pk: ch.pk ?? {},
          p_payload: ch.payload ?? {},
          p_changed_at: ch.changed_at ?? new Date().toISOString(),
        });
        if (!error) accepted.push(ch.id);
        else console.warn("peer-mesh.push.apply.fail", peer.display_name, ch.table, error.message);
      }
      await admin.from("peer_links").update({
        last_seen_at: new Date().toISOString(),
        last_push_error: null,
      }).eq("id", peer.id);
      return json(200, { accepted });
    }

    if (sub === "/log") {
      // Local cms-sync ships compact batch summaries here so Cloud has full
      // visibility of what is being exchanged with every paired node.
      const entries = Array.isArray(body.entries) ? body.entries : [];
      if (entries.length === 0) return json(200, { accepted: 0 });
      const rows = entries.slice(0, 500).map((e: any) => ({
        peer_link_id: peer.id,
        peer_node_id: peer.peer_node_id,
        peer_name:    peer.display_name,
        direction:    ["pull","push","clone","heartbeat","handshake"].includes(e.direction) ? e.direction : "heartbeat",
        status:       ["ok","warn","error"].includes(e.status) ? e.status : "ok",
        table_name:   e.table_name ?? null,
        row_count:    Number.isFinite(Number(e.row_count)) ? Number(e.row_count) : 0,
        batch_id:     e.batch_id ? String(e.batch_id).slice(0, 64) : null,
        error_text:   e.error_text ? String(e.error_text).slice(0, 1000) : null,
        meta:         (e.meta && typeof e.meta === "object") ? e.meta : {},
      }));
      const { error } = await admin.from("sync_exchange_logs").insert(rows);
      if (error) return json(500, { error: error.message });
      await admin.from("peer_links").update({ last_seen_at: new Date().toISOString() }).eq("id", peer.id);
      return json(200, { accepted: rows.length });
    }

    if (sub === "/pull") {
      const sinceId = Number(body.since_id ?? 0) || 0;
      const limit = Math.min(Number(body.limit ?? 500) || 500, 2000);
      const { data: rows, error } = await admin
        .from("sync_outbox")
        .select("id, casino_id, table_name, op, pk, payload, changed_at, origin_node_id")
        .gt("id", sinceId)
        .or(`origin_node_id.is.null,origin_node_id.neq.${peer.peer_node_id}`)
        .order("id", { ascending: true })
        .limit(limit);
      if (error) return json(500, { error: error.message });
      const changes = (rows ?? []).map((r) => ({ ...r, table: r.table_name }));
      const next = changes.length ? changes[changes.length - 1].id : sinceId;
      await admin.from("peer_links").update({ last_seen_at: new Date().toISOString() }).eq("id", peer.id);
      return json(200, { changes, next_since_id: next });
    }

    return json(404, { error: "unknown peer route", path: sub });
  } catch (e) {
    return json(500, { error: String(e?.message ?? e) });
  }
});
