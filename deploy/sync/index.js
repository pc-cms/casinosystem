#!/usr/bin/env node
/**
 * cms-sync — symmetric peer-mesh sync worker.
 * ─────────────────────────────────────────────
 * For each `peer_links` row with status='active', this process:
 *
 *   • runs outbound HANDSHAKE for status='pending_outbound' rows
 *   • PUSHes new sync_outbox rows (id > last_push_cursor) signed with HMAC
 *   • PULLs peer's outbox rows since last_pull_cursor and applies them
 *     via the public.peer_apply_change RPC (which sets origin_node_id so
 *     re-emitted outbox rows are tagged with the source peer → no loops)
 *
 * No primary/replica. Every node runs this same loop. Cloud is just another peer.
 *
 * Env:
 *   LOCAL_DB_URL          (required)
 *   SYNC_BATCH_SIZE       default 200
 *   SYNC_INTERVAL_MS      default 5000
 *   SYNC_BACKOFF_MAX_MS   default 60000
 *   SCHEMA_VERSION        embedded in handshake (read from package.json by container)
 */
import pg from "pg";
import crypto from "node:crypto";
import { startApi } from "./api.js";

const {
  LOCAL_DB_URL,
  SYNC_BATCH_SIZE = "200",
  SYNC_INTERVAL_MS = "5000",
  SYNC_BACKOFF_MAX_MS = "60000",
  SCHEMA_VERSION = "0.0.0",
} = process.env;

if (!LOCAL_DB_URL) { console.error("[cms-sync] FATAL: missing LOCAL_DB_URL"); process.exit(1); }

const BATCH      = parseInt(SYNC_BATCH_SIZE, 10);
const TICK_MS    = parseInt(SYNC_INTERVAL_MS, 10);
const BACKOFF_MAX = parseInt(SYNC_BACKOFF_MAX_MS, 10);

const pool = new pg.Pool({ connectionString: LOCAL_DB_URL, max: 6 });
const log = (lvl, msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), lvl, msg, ...extra }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let IDENTITY = null; // cached node_identity row

async function loadIdentity() {
  const { rows } = await pool.query(
    `SELECT node_id, display_name, node_kind, schema_version FROM public.node_identity WHERE id = true`
  );
  IDENTITY = rows[0] ?? null;
  if (IDENTITY && IDENTITY.schema_version !== SCHEMA_VERSION) {
    await pool.query(
      `UPDATE public.node_identity SET schema_version = $1 WHERE id = true`,
      [SCHEMA_VERSION]
    );
    IDENTITY.schema_version = SCHEMA_VERSION;
  }
  return IDENTITY;
}

const sign = (secret, raw) =>
  crypto.createHmac("sha256", secret).update(raw).digest("hex");

async function peerFetch(peer, path, body) {
  const raw = body ? JSON.stringify(body) : "";
  const headers = {
    "Content-Type": "application/json",
    "x-peer-node-id": IDENTITY.node_id,
    "x-peer-signature": sign(peer.sync_secret, raw),
  };
  const res = await fetch(`${peer.peer_url}${path}`, {
    method: "POST",
    headers,
    body: raw || "{}",
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${(json?.error ?? text).toString().slice(0, 200)}`);
  return json ?? {};
}

// ─────────── HANDSHAKE ───────────
async function handshakePeer(peer) {
  const body = {
    my_node_id: IDENTITY.node_id,
    my_display_name: IDENTITY.display_name,
    my_node_kind: IDENTITY.node_kind,
    my_schema_version: IDENTITY.schema_version,
  };
  const j = await peerFetch(peer, "/peer/handshake", body);
  await pool.query(
    `UPDATE public.peer_links
        SET peer_node_id = $1, schema_version = $2, status = 'active',
            last_seen_at = now(), last_push_error = NULL
      WHERE id = $3`,
    [j.node_id ?? null, j.schema_version ?? null, peer.id]
  );
  log("info", "peer.handshake.ok", { peer: peer.display_name, peer_node_id: j.node_id });
}

// ─────────── PUSH ───────────
async function pushPeer(peer) {
  // Read outbox slice strictly greater than last_push_cursor,
  // excluding rows authored by this peer (loop prevention).
  const { rows } = await pool.query(
    `SELECT id, casino_id, table_name AS table, op, pk, payload, changed_at, origin_node_id
       FROM public.sync_outbox
      WHERE id > $1
        AND (origin_node_id IS NULL OR origin_node_id <> $2)
      ORDER BY id ASC
      LIMIT $3`,
    [peer.last_push_cursor, peer.peer_node_id, BATCH]
  );
  if (rows.length === 0) return 0;

  const j = await peerFetch(peer, "/peer/push", { changes: rows });
  const accepted = new Set(Array.isArray(j.accepted) ? j.accepted.map(Number) : rows.map((r) => r.id));
  const maxId = rows.reduce((m, r) => (r.id > m && accepted.has(r.id) ? r.id : m), peer.last_push_cursor);
  await pool.query(
    `UPDATE public.peer_links
        SET last_push_cursor = $1, last_seen_at = now(), last_push_error = NULL
      WHERE id = $2`,
    [maxId, peer.id]
  );
  return rows.length;
}

// ─────────── PULL ───────────
async function pullPeer(peer) {
  const j = await peerFetch(peer, "/peer/pull", {
    since_id: peer.last_pull_cursor,
    limit: BATCH,
  });
  const changes = Array.isArray(j.changes) ? j.changes : [];
  if (changes.length === 0) {
    if (j.next_since_id && j.next_since_id !== peer.last_pull_cursor) {
      await pool.query(
        `UPDATE public.peer_links SET last_pull_cursor = $1 WHERE id = $2`,
        [j.next_since_id, peer.id]
      );
    }
    return 0;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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
      } catch (e) {
        log("warn", "peer.pull.apply.fail", { peer: peer.display_name, table: ch.table, id: ch.id, err: String(e?.message ?? e).slice(0, 200) });
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  const nextSince = j.next_since_id ?? changes[changes.length - 1].id;
  await pool.query(
    `UPDATE public.peer_links
        SET last_pull_cursor = $1, last_seen_at = now(), last_pull_error = NULL
      WHERE id = $2`,
    [nextSince, peer.id]
  );
  return changes.length;
}

// ─────────── per-peer driver ───────────
const peerBackoff = new Map(); // peer.id → ms

async function tickPeer(peer) {
  if (peer.status === "pending_outbound") {
    try { await handshakePeer(peer); peerBackoff.set(peer.id, TICK_MS); }
    catch (e) {
      const b = peerBackoff.get(peer.id) ?? TICK_MS;
      log("warn", "peer.handshake.fail", { peer: peer.display_name, err: String(e?.message ?? e), backoff_ms: b });
      await pool.query(
        `UPDATE public.peer_links SET last_push_error = $1 WHERE id = $2`,
        [String(e?.message ?? e).slice(0, 240), peer.id]
      );
      peerBackoff.set(peer.id, Math.min(b * 2, BACKOFF_MAX));
    }
    return;
  }
  if (peer.status !== "active") return;
  if (!peer.peer_node_id) return; // not yet handshaken

  try {
    const sent = await pushPeer(peer);
    const recv = await pullPeer(peer);
    peerBackoff.set(peer.id, TICK_MS);
    if (sent || recv) log("info", "peer.sync.ok", { peer: peer.display_name, sent, recv });
  } catch (e) {
    const b = peerBackoff.get(peer.id) ?? TICK_MS;
    log("warn", "peer.sync.fail", { peer: peer.display_name, err: String(e?.message ?? e), backoff_ms: b });
    await pool.query(
      `UPDATE public.peer_links SET last_push_error = $1 WHERE id = $2`,
      [String(e?.message ?? e).slice(0, 240), peer.id]
    );
    peerBackoff.set(peer.id, Math.min(b * 2, BACKOFF_MAX));
  }
}

// ─────────── main loop ───────────
async function mainLoop() {
  while (true) {
    try {
      if (!IDENTITY) await loadIdentity();
      const { rows: peers } = await pool.query(
        `SELECT * FROM public.peer_links WHERE status IN ('pending_outbound','active') ORDER BY id`
      );
      // Run each peer with its own backoff
      await Promise.all(peers.map(async (p) => {
        const b = peerBackoff.get(p.id) ?? 0;
        if (b > TICK_MS) { peerBackoff.set(p.id, Math.max(0, b - TICK_MS)); return; }
        await tickPeer(p);
      }));
    } catch (e) {
      log("error", "main.loop.fail", { err: String(e?.message ?? e) });
    }
    await sleep(TICK_MS);
  }
}

async function gcLoop() {
  while (true) {
    try { await pool.query(`SELECT public.sync_outbox_gc()`); }
    catch (e) { log("warn", "gc.fail", { err: String(e?.message ?? e) }); }
    await sleep(60 * 60 * 1000);
  }
}

async function identityRefreshLoop() {
  while (true) {
    try { await loadIdentity(); } catch {}
    await sleep(30_000);
  }
}

log("info", "sync.start", { batch: BATCH, tick_ms: TICK_MS, schema_version: SCHEMA_VERSION });

startApi({ pool });

Promise.all([mainLoop(), gcLoop(), identityRefreshLoop()]).catch((e) => {
  log("error", "sync.crash", { err: String(e) });
  process.exit(1);
});

process.on("SIGTERM", () => { log("info", "sync.stop"); pool.end().finally(() => process.exit(0)); });
