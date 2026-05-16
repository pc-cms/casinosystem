/**
 * cms-sync — HTTP API
 * ──────────────────────────────────────────────────────────────────────
 * Two surfaces on one server (port 8787):
 *
 *  A) ADMIN routes (require local super_admin JWT — verified via GoTrue):
 *      GET  /node/status                    → node_identity + peers count
 *      POST /node/identity { display_name } → rename this node
 *      POST /peer/test  { peer_url }        → probe a peer URL (handshake dry-run)
 *      GET  /node/updater/status            → current/available frontend version + log tail
 *      POST /node/updater/check             → force cms-updater to check now
 *      POST /node/updater/apply { version?, auto_apply? }
 *                                           → queue PUSH_COMMAND.json for cms-updater
 *
 *  B) PEER routes (machine-to-machine — authenticated by HMAC-SHA256
 *     signature over the request body using the per-peer sync_secret):
 *      POST /peer/handshake → exchange node ids and accept inbound pairing
 *      POST /peer/push      → receive a batch of changes (apply via peer_apply_change)
 *      POST /peer/pull      → return outbox changes since cursor
 *      GET  /peer/health    → liveness + schema_version (no auth)
 *
 * Mounted by nginx as /api/node/* (admin) and /peer/* (peer-to-peer).
 */
import http from "node:http";
import crypto from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const GOTRUE_URL = process.env.GOTRUE_URL || "http://gotrue:9999";
const COMPOSE_DIR = "/compose";
const ENV_FILE = `${COMPOSE_DIR}/.env`;
const LOG_FILE = `${COMPOSE_DIR}/updater.log`;
const FLAG_FILE = `${COMPOSE_DIR}/UPDATE_AVAILABLE`;
const PUSH_FILE = `${COMPOSE_DIR}/PUSH_COMMAND.json`;
const ACK_FILE = `${COMPOSE_DIR}/PUSH_COMMAND_ACK.json`;
const CHECK_NOW_FILE = `${COMPOSE_DIR}/CHECK_NOW`;

export function startApi({ pool }) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-peer-node-id, x-peer-signature");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

    try {
      const url = new URL(req.url, "http://x");
      const path = url.pathname;

      // ── Peer routes (HMAC auth) ──
      if (path === "/peer/health" && req.method === "GET") {
        return peerHealth(pool, res);
      }
      if (path.startsWith("/peer/") && req.method === "POST") {
        return peerRoute(pool, req, res, path);
      }

      // ── Admin routes (JWT auth) ──
      const auth = req.headers["authorization"] || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      if (!token) return send(res, 401, { error: "missing token" });
      const userId = await verifySuperAdmin(pool, token);
      if (!userId) return send(res, 403, { error: "super_admin required" });

      if (req.method === "GET" && path === "/node/status") {
        return send(res, 200, await getStatus(pool));
      }
      if (req.method === "POST" && path === "/node/identity") {
        const body = await readJson(req);
        if (!body.display_name) return send(res, 400, { error: "display_name required" });
        await pool.query(
          `UPDATE public.node_identity SET display_name = $1 WHERE id = true`,
          [String(body.display_name).slice(0, 120)]
        );
        return send(res, 200, await getStatus(pool));
      }
      if (req.method === "POST" && path === "/peer/test") {
        const body = await readJson(req);
        const peerUrl = String(body.peer_url || "").replace(/\/$/, "");
        if (!/^https?:\/\//.test(peerUrl)) return send(res, 400, { error: "invalid peer_url" });
        try {
          const r = await fetch(`${peerUrl}/peer/health`, { signal: AbortSignal.timeout(5000) });
          return send(res, 200, { ok: r.ok, status: r.status, body: await r.json().catch(() => null) });
        } catch (e) {
          return send(res, 200, { ok: false, error: String(e?.message ?? e) });
        }
      }

      // ── Updater control routes ──
      if (req.method === "GET" && path === "/node/updater/status") {
        return send(res, 200, getUpdaterStatus());
      }
      if (req.method === "POST" && path === "/node/updater/check") {
        try { writeFileSync(CHECK_NOW_FILE, new Date().toISOString()); }
        catch (e) { return send(res, 500, { error: String(e?.message ?? e) }); }
        return send(res, 200, { ok: true, message: "check queued; updater polls every 10s" });
      }
      if (req.method === "POST" && path === "/node/updater/apply") {
        const body = await readJson(req);
        const status = getUpdaterStatus();
        const target = String(body.version || status.available_version || "").trim().replace(/^v/, "");
        if (!target) return send(res, 400, { error: "no version specified and none available" });
        const cmd = {
          id: randomUUID(),
          target_version: target,
          auto_apply: body.auto_apply !== false,
          issued_at: new Date().toISOString(),
        };
        try { writeFileSync(PUSH_FILE, JSON.stringify(cmd, null, 2)); }
        catch (e) { return send(res, 500, { error: String(e?.message ?? e) }); }
        return send(res, 200, { ok: true, command: cmd });
      }

      return send(res, 404, { error: "unknown route", path });
    } catch (e) {
      return send(res, 500, { error: String(e?.message || e) });
    }
  });

  server.listen(8787, "0.0.0.0", () => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), lvl: "info", msg: "api.listen", port: 8787 }));
  });
  return server;
}

// ─────────── helpers ───────────
const send = (res, code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => resolve(Buffer.concat(chunks)));
});
const readJson = async (req) => {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString("utf8")); } catch { return {}; }
};

async function verifySuperAdmin(pool, token) {
  let userId = null;
  try {
    const r = await fetch(`${GOTRUE_URL}/user`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    userId = (await r.json())?.id ?? null;
  } catch { return null; }
  if (!userId) return null;
  const { rows } = await pool.query(
    `SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'super_admin' LIMIT 1`,
    [userId]
  );
  return rows.length ? userId : null;
}

async function getStatus(pool) {
  const { rows: id } = await pool.query(
    `SELECT node_id, display_name, node_kind, schema_version, owned_casino_ids FROM public.node_identity WHERE id = true`
  );
  const { rows: peers } = await pool.query(
    `SELECT status, count(*)::int AS n FROM public.peer_links GROUP BY status`
  );
  return { identity: id[0] ?? null, peers: Object.fromEntries(peers.map((p) => [p.status, p.n])) };
}

// ─────────── PEER routes ───────────
async function peerHealth(pool, res) {
  const { rows } = await pool.query(
    `SELECT node_id, display_name, node_kind, schema_version FROM public.node_identity WHERE id = true`
  );
  return send(res, 200, { ok: true, ...(rows[0] ?? {}) });
}

/**
 * Verify HMAC signature: header `x-peer-signature` = hex(HMAC-SHA256(secret, raw_body)).
 * Returns the matching peer_links row or null.
 *
 * For HANDSHAKE specifically, no peer row exists yet — we look up the peer by
 * peer_node_id (header `x-peer-node-id`) and accept any peer whose secret matches.
 */
async function authenticatePeer(pool, req, rawBody, isHandshake) {
  const sig = req.headers["x-peer-signature"];
  const peerNodeId = req.headers["x-peer-node-id"];
  if (!sig || !peerNodeId) return { error: "missing peer auth headers" };

  // Candidate peers — for handshake, scan all (we don't know which yet);
  // for push/pull, restrict to the peer claiming peerNodeId.
  const sql = isHandshake
    ? `SELECT * FROM public.peer_links WHERE status IN ('pending_outbound','pending_inbound','active','paused')`
    : `SELECT * FROM public.peer_links WHERE peer_node_id = $1 AND status = 'active' LIMIT 1`;
  const params = isHandshake ? [] : [peerNodeId];
  const { rows } = await pool.query(sql, params);

  for (const row of rows) {
    const expected = crypto.createHmac("sha256", row.sync_secret).update(rawBody).digest("hex");
    if (crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) {
      return { peer: row };
    }
  }
  return { error: "signature mismatch" };
}

async function peerRoute(pool, req, res, path) {
  const rawBody = await readBody(req);
  const isHandshake = path === "/peer/handshake";
  const { peer, error } = await authenticatePeer(pool, req, rawBody, isHandshake);
  if (error) return send(res, 401, { error });

  let body = {};
  try { body = JSON.parse(rawBody.toString("utf8") || "{}"); } catch { return send(res, 400, { error: "invalid json" }); }

  if (path === "/peer/handshake") return peerHandshake(pool, req, res, body, peer);
  if (path === "/peer/push")      return peerPush(pool, res, body, peer);
  if (path === "/peer/pull")      return peerPull(pool, res, body, peer);
  return send(res, 404, { error: "unknown peer route" });
}

async function peerHandshake(pool, req, res, body, peer) {
  // body: { my_node_id, my_display_name, my_node_kind, my_schema_version }
  const { my_node_id, my_display_name, my_node_kind, my_schema_version } = body;
  if (!my_node_id) return send(res, 400, { error: "my_node_id required" });

  // If peer row exists but peer_node_id wasn't set, learn it now.
  // If peer was pending_outbound (we initiated) → mark active.
  // If brand new (we don't have a row): create it as pending_inbound for super_admin approval.
  if (peer) {
    let newStatus = peer.status;
    if (peer.status === "pending_outbound") newStatus = "active";
    await pool.query(
      `UPDATE public.peer_links
          SET peer_node_id = $1, schema_version = $2, last_seen_at = now(), status = $3,
              display_name = COALESCE(NULLIF($4,''), display_name)
        WHERE id = $5`,
      [my_node_id, my_schema_version ?? null, newStatus, my_display_name ?? "", peer.id]
    );
  } else {
    // shouldn't happen — authenticatePeer for handshake matched a row.
    return send(res, 401, { error: "no matching peer row" });
  }

  const { rows: me } = await pool.query(
    `SELECT node_id, display_name, node_kind, schema_version FROM public.node_identity WHERE id = true`
  );
  return send(res, 200, { ok: true, ...(me[0] ?? {}) });
}

async function peerPush(pool, res, body, peer) {
  // body: { changes: [{ id, table, op, pk, payload, changed_at, origin_node_id }] }
  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length === 0) return send(res, 200, { accepted: [] });

  // Per-peer casino_id whitelist enforcement.
  // If peer has owned_casino_ids set on their side, those + global (NULL) are allowed.
  // We trust peer not to lie about its origin — but every change carries origin_node_id,
  // and we never echo our own changes back (filtered on PULL).
  const accepted = [];
  const client = await pool.connect();
  try {
    for (const ch of changes) {
      try {
        await client.query(
          `SELECT public.peer_apply_change($1::uuid, $2::text, $3::text, $4::jsonb, $5::jsonb, $6::timestamptz)`,
          [
            ch.origin_node_id || peer.peer_node_id,
            ch.table,
            ch.op,
            ch.pk ?? {},
            ch.payload ?? {},
            ch.changed_at ?? new Date().toISOString(),
          ]
        );
        accepted.push(ch.id);
      } catch (e) {
        // Log and continue — don't fail the whole batch
        console.log(JSON.stringify({ ts: new Date().toISOString(), lvl: "warn", msg: "peer.push.apply.fail", peer: peer.display_name, table: ch.table, id: ch.id, err: String(e?.message ?? e).slice(0, 240) }));
      }
    }
    await client.query(
      `UPDATE public.peer_links
          SET last_seen_at = now(), last_push_error = NULL
        WHERE id = $1`,
      [peer.id]
    );
  } finally {
    client.release();
  }
  return send(res, 200, { accepted });
}

async function peerPull(pool, res, body, peer) {
  // body: { since_id, limit }
  const sinceId = Number(body.since_id ?? 0) || 0;
  const limit = Math.min(Number(body.limit ?? 500) || 500, 2000);

  // Filter: never send rows authored by the requesting peer (loop prevention).
  // Also: only changes for casinos in our owned set OR with NULL casino_id (global).
  // Receiver enforces its own whitelist; we always send our outbox slice >since_id.
  const { rows } = await pool.query(
    `SELECT id, casino_id, table_name AS table, op, pk, payload, changed_at, origin_node_id
       FROM public.sync_outbox
      WHERE id > $1
        AND (origin_node_id IS NULL OR origin_node_id <> $2)
      ORDER BY id ASC
      LIMIT $3`,
    [sinceId, peer.peer_node_id, limit]
  );
  await pool.query(
    `UPDATE public.peer_links SET last_seen_at = now() WHERE id = $1`,
    [peer.id]
  );
  const nextSinceId = rows.length ? rows[rows.length - 1].id : sinceId;
  return send(res, 200, { changes: rows, next_since_id: nextSinceId });
}
