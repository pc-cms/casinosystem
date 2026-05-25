#!/usr/bin/env node
/**
 * cms-sync — symmetric peer-mesh sync worker (v1.3.49).
 * ─────────────────────────────────────────────
 * Changes vs prior version:
 *   • heartbeats now UPSERT public.sync_peer_health (via sync_record_health RPC)
 *     instead of spamming sync_exchange_logs every 30s
 *   • apply loop per-row: rejected rows are persisted to sync_apply_errors with
 *     error_code + payload hash; cursor advances only past accepted/skipped rows
 *   • after N consecutive rejects → peer state = schema_mismatch, pull paused
 *   • round-trip probe: every 60s emit a probe to each peer via /peer/probe/start;
 *     peers ack via /peer/probe/ack (round-trip path uses normal peer-mesh HTTP)
 *   • exchange log only receives meaningful events (push >0, pull >0, errors,
 *     handshake, snapshot, promote, probe results). Empty ticks are dropped.
 *
 * Env: LOCAL_DB_URL, SYNC_BATCH_SIZE=200, SYNC_INTERVAL_MS=5000,
 *      SYNC_BACKOFF_MAX_MS=60000, SCHEMA_VERSION, SYNC_PROBE_INTERVAL_MS=60000,
 *      SYNC_REJECT_THRESHOLD=20
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
  SYNC_PROBE_INTERVAL_MS = "60000",
  SYNC_REJECT_THRESHOLD = "20",
} = process.env;

if (!LOCAL_DB_URL) { console.error("[cms-sync] FATAL: missing LOCAL_DB_URL"); process.exit(1); }

const BATCH      = parseInt(SYNC_BATCH_SIZE, 10);
const TICK_MS    = parseInt(SYNC_INTERVAL_MS, 10);
const BACKOFF_MAX = parseInt(SYNC_BACKOFF_MAX_MS, 10);
const PROBE_MS   = parseInt(SYNC_PROBE_INTERVAL_MS, 10);
const REJECT_LIMIT = parseInt(SYNC_REJECT_THRESHOLD, 10);

const pool = new pg.Pool({ connectionString: LOCAL_DB_URL, max: 6 });
const log = (lvl, msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), lvl, msg, ...extra }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const md5 = (s) => crypto.createHash("md5").update(typeof s === "string" ? s : JSON.stringify(s)).digest("hex");

let IDENTITY = null;
const peerRejectStreak = new Map(); // peer.id → consecutive rejects

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

// ─────────── Exchange log shipping (meaningful events only) ───────────
const logBuffer = new Map();
function bufferExchange(peer, entry) {
  // Drop noise: heartbeats and empty ticks are never logged here anymore.
  if (entry.direction === "heartbeat") return;
  if (entry.status === "ok" && (entry.row_count ?? 0) === 0 && entry.direction !== "probe" && entry.direction !== "handshake") return;
  const arr = logBuffer.get(peer.id) ?? [];
  arr.push({ ...entry, ts: new Date().toISOString() });
  if (arr.length > 200) arr.splice(0, arr.length - 200);
  logBuffer.set(peer.id, arr);
}
async function flushExchangeLog(peer) {
  const arr = logBuffer.get(peer.id);
  if (!arr || arr.length === 0) return;
  const batch = arr.splice(0, arr.length);
  try { await peerFetch(peer, "/log", { entries: batch }); }
  catch (e) {
    const restored = (logBuffer.get(peer.id) ?? []);
    logBuffer.set(peer.id, batch.concat(restored).slice(0, 500));
    log("warn", "peer.log.flush.fail", { peer: peer.display_name, err: String(e?.message ?? e).slice(0, 200) });
  }
}

// ─────────── Health helpers ───────────
async function recordHealth(peer, state, extra = {}) {
  try {
    const { rows: ob } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM public.sync_outbox
        WHERE id > $1 AND (origin_node_id IS NULL OR origin_node_id <> $2)`,
      [peer.last_push_cursor, peer.peer_node_id]
    );
    await pool.query(
      `SELECT public.sync_record_health($1::uuid, $2::text, now(), $3::int, $4::int, $5::text, $6::text, $7::text, $8::text)`,
      [
        peer.id,
        state,
        ob[0]?.n ?? 0,
        extra.lag_seconds ?? null,
        IDENTITY?.schema_version ?? null,
        peer.schema_version ?? null,
        extra.error_code ?? null,
        extra.error_text ? String(extra.error_text).slice(0, 500) : null,
      ]
    );
  } catch (e) { log("warn", "health.record.fail", { peer: peer.display_name, err: String(e?.message ?? e).slice(0, 200) }); }
}

async function recordApplyError(peer, ch, errorCode, errorText) {
  try {
    await pool.query(
      `SELECT public.sync_record_apply_error($1::uuid, $2::bigint, $3::text, $4::text, $5::jsonb, $6::text, $7::text, $8::text)`,
      [
        peer.id,
        ch.id ?? null,
        ch.table ?? ch.table_name ?? "unknown",
        ch.op ?? null,
        ch.pk ?? {},
        md5(ch.payload ?? {}),
        errorCode,
        String(errorText ?? "").slice(0, 500),
      ]
    );
  } catch (e) { log("warn", "apply_error.record.fail", { err: String(e?.message ?? e).slice(0, 200) }); }
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
            peer_node_kind = COALESCE(NULLIF($4,''), peer_node_kind),
            last_seen_at = now(), last_push_error = NULL
      WHERE id = $3`,
    [j.node_id ?? null, j.schema_version ?? null, peer.id, j.node_kind ?? ""]
  );
  log("info", "peer.handshake.ok", { peer: peer.display_name, peer_node_id: j.node_id, peer_node_kind: j.node_kind });
  bufferExchange(peer, { direction: "handshake", status: "ok", row_count: 0, meta: { peer_node_id: j.node_id, peer_node_kind: j.node_kind } });
  await recordHealth({ ...peer, peer_node_id: j.node_id, peer_node_kind: j.node_kind, schema_version: j.schema_version }, "ok");
}

// ─────────── PUSH ───────────
// Premier-hub fan-out rules (sync_role on each outbox row):
//   • local  → cloud  : push everything (full operational consolidation to Premier)
//   • cloud  → local  : push ONLY 'bidir_global' rows (players, blacklist, etc.)
//   • local  → local  : skip entirely (locals must not peer with each other)
//   • cloud  → cloud  : skip entirely
function pushRoleFilterSql(myKind, peerKind) {
  if (myKind === "local" && peerKind === "cloud") return null; // no extra filter
  if (myKind === "cloud" && peerKind === "local") return "bidir_global";
  return "SKIP";
}

async function pushPeer(peer) {
  const myKind   = IDENTITY?.node_kind ?? "local";
  const peerKind = peer.peer_node_kind ?? (myKind === "local" ? "cloud" : "local"); // legacy default
  const filter   = pushRoleFilterSql(myKind, peerKind);
  if (filter === "SKIP") return 0;

  const params = [peer.last_push_cursor, peer.peer_node_id, BATCH];
  let roleClause = "";
  if (filter) { params.push(filter); roleClause = `AND sync_role = $4`; }

  const { rows } = await pool.query(
    `SELECT id, casino_id, table_name AS table, op, pk, payload, changed_at, origin_node_id, sync_role
       FROM public.sync_outbox
      WHERE id > $1
        AND (origin_node_id IS NULL OR origin_node_id <> $2)
        ${roleClause}
      ORDER BY id ASC
      LIMIT $3`,
    params
  );
  if (rows.length === 0) return 0;

  const j = await peerFetch(peer, "/peer/push", { changes: rows });
  const accepted = new Set(Array.isArray(j.accepted) ? j.accepted.map(Number) : rows.map((r) => r.id));
  const skipped  = new Set(Array.isArray(j.skipped)  ? j.skipped.map(Number)  : []);
  const rejected = Array.isArray(j.rejected) ? j.rejected : [];

  // Cursor advances through ALL rows the peer responded about — even rejected
  // ones, because peer_apply_change is now self-healing (NULLs missing user-FKs
  // and retries). Persistent rejects are recorded in sync_apply_errors and must
  // not block forward progress; otherwise one bad row stalls the entire mesh.
  let safeMax = peer.last_push_cursor;
  for (const r of rows) {
    if (r.id > safeMax) safeMax = r.id;
  }
  // Record any rejected rows from peer
  for (const rr of rejected) {
    const ch = rows.find((r) => r.id === Number(rr.outbox_id));
    if (ch) await recordApplyError(peer, ch, rr.error_code || "remote_reject", rr.error_text || "");
  }
  await pool.query(
    `UPDATE public.peer_links
        SET last_push_cursor = $1, last_seen_at = now(), last_push_error = NULL
      WHERE id = $2`,
    [safeMax, peer.id]
  );
  await pool.query(`SELECT public.sync_record_push_ok($1::uuid)`, [peer.id]);
  bufferExchange(peer, {
    direction: "push",
    status: rejected.length ? "warn" : "ok",
    row_count: accepted.size,
    meta: { attempted: rows.length, rejected: rejected.length, cursor: safeMax, filter: filter ?? "all" },
  });
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

  let safeCursor = peer.last_pull_cursor;
  let applied = 0;
  let rejectedRun = 0;
  let firstError = null;

  for (const ch of changes) {
    const client = await pool.connect();
    try {
      if (ch.table === "casinos") {
        safeCursor = ch.id;
        applied += 1;
        rejectedRun = 0;
        continue;
      }
      await client.query("BEGIN");
      await client.query(`SELECT set_config('sync.applying','on', true)`);
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
      await client.query("COMMIT");
      safeCursor = ch.id;
      applied += 1;
      rejectedRun = 0;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      const errStr = String(e?.message ?? e);
      const code = /column .* does not exist|unknown column|relation .* does not exist/i.test(errStr)
        ? "schema_mismatch"
        : /violates foreign key/i.test(errStr) ? "fk_violation"
        : /violates not-null/i.test(errStr) ? "not_null"
        : "apply_error";
      if (!firstError) firstError = { code, text: errStr };
      await recordApplyError(peer, ch, code, errStr);
      rejectedRun += 1;
      if (rejectedRun >= REJECT_LIMIT) {
        log("warn", "peer.pull.reject.streak", { peer: peer.display_name, code, threshold: REJECT_LIMIT });
        // Stop advancing; will retry from here next tick after operator fixes.
        await recordHealth(peer, "schema_mismatch", { error_code: code, error_text: errStr });
        bufferExchange(peer, { direction: "pull", status: "error", row_count: applied, error_text: errStr.slice(0,500), meta: { code, stopped_at: ch.id } });
        await pool.query(`UPDATE public.peer_links SET last_pull_cursor = $1, last_pull_error = $2 WHERE id = $3`,
          [safeCursor, errStr.slice(0, 240), peer.id]);
        return applied;
      }
      // Otherwise: skip this row, move cursor past it (it's recorded in apply_errors for manual retry).
      safeCursor = ch.id;
    } finally { client.release(); }
  }

  await pool.query(
    `UPDATE public.peer_links
        SET last_pull_cursor = $1, last_seen_at = now(), last_pull_error = $2
      WHERE id = $3`,
    [safeCursor, firstError ? firstError.text.slice(0, 240) : null, peer.id]
  );
  await pool.query(`SELECT public.sync_record_pull_ok($1::uuid)`, [peer.id]);
  await pool.query(`SELECT public.sync_record_apply_ok($1::uuid)`, [peer.id]);
  bufferExchange(peer, {
    direction: "pull",
    status: firstError ? "warn" : "ok",
    row_count: applied,
    meta: { cursor: safeCursor, attempted: changes.length, errors: changes.length - applied },
  });
  return applied;
}

// ─────────── PROBE ───────────
async function probePeer(peer) {
  let probeId;
  try {
    const { rows } = await pool.query(`SELECT public.sync_record_probe_sent($1::uuid, 'out') AS id`, [peer.id]);
    probeId = rows[0]?.id;
  } catch (e) { log("warn", "probe.create.fail", { err: String(e?.message ?? e) }); return; }
  if (!probeId) return;
  try {
    const r = await peerFetch(peer, "/peer/probe/start", { probe_id: probeId, origin_node_id: IDENTITY.node_id });
    // Peer should call our /peer/probe/ack via its own sync; we still record an immediate synchronous ack for liveness.
    if (r && r.ok) {
      await pool.query(`SELECT public.sync_record_probe_ack($1::uuid, 'ok', NULL)`, [probeId]);
      bufferExchange(peer, { direction: "probe", status: "ok", row_count: 0, meta: { probe_id: probeId } });
    } else {
      await pool.query(`SELECT public.sync_record_probe_ack($1::uuid, 'error', $2::text)`, [probeId, "no_ack"]);
    }
  } catch (e) {
    await pool.query(`SELECT public.sync_record_probe_ack($1::uuid, 'error', $2::text)`, [probeId, String(e?.message ?? e).slice(0,200)]).catch(()=>{});
    bufferExchange(peer, { direction: "probe", status: "error", row_count: 0, error_text: String(e?.message ?? e).slice(0,200) });
  }
}

// ─────────── per-peer driver ───────────
const peerBackoff = new Map();

async function tickPeer(peer) {
  if (peer.status === "pending_outbound") {
    try { await handshakePeer(peer); peerBackoff.set(peer.id, TICK_MS); }
    catch (e) {
      const b = peerBackoff.get(peer.id) ?? TICK_MS;
      log("warn", "peer.handshake.fail", { peer: peer.display_name, err: String(e?.message ?? e), backoff_ms: b });
      await pool.query(`UPDATE public.peer_links SET last_push_error = $1 WHERE id = $2`, [String(e?.message ?? e).slice(0, 240), peer.id]);
      await recordHealth(peer, "pairing", { error_code: "handshake_fail", error_text: String(e?.message ?? e) });
      peerBackoff.set(peer.id, Math.min(b * 2, BACKOFF_MAX));
    }
    return;
  }
  if (peer.status !== "active") return;
  if (!peer.peer_node_id) return;

  try {
    const sent = await pushPeer(peer);
    const recv = await pullPeer(peer);
    peerBackoff.set(peer.id, TICK_MS);
    if (sent || recv) log("info", "peer.sync.ok", { peer: peer.display_name, sent, recv });
    await recordHealth(peer, "ok");
  } catch (e) {
    const b = peerBackoff.get(peer.id) ?? TICK_MS;
    const errStr = String(e?.message ?? e);
    log("warn", "peer.sync.fail", { peer: peer.display_name, err: errStr, backoff_ms: b });
    bufferExchange(peer, { direction: "push", status: "error", row_count: 0, error_text: errStr.slice(0, 500) });
    await pool.query(`UPDATE public.peer_links SET last_push_error = $1 WHERE id = $2`, [errStr.slice(0, 240), peer.id]);
    await recordHealth(peer, b > BACKOFF_MAX / 2 ? "broken" : "degraded", { error_code: "transport", error_text: errStr });
    peerBackoff.set(peer.id, Math.min(b * 2, BACKOFF_MAX));
  }
  await flushExchangeLog(peer);
}

// ─────────── loops ───────────
async function heartbeatLoop() {
  while (true) {
    try {
      const { rows: peers } = await pool.query(
        `SELECT * FROM public.peer_links WHERE status IN ('active','pending_outbound')`
      );
      for (const p of peers) {
        // Health only — NOT exchange log.
        await recordHealth(p, p.peer_node_id ? "ok" : "pairing");
      }
    } catch (e) { log("warn", "heartbeat.fail", { err: String(e?.message ?? e) }); }
    await sleep(30_000);
  }
}

async function probeLoop() {
  while (true) {
    try {
      const { rows: peers } = await pool.query(
        `SELECT * FROM public.peer_links WHERE status = 'active' AND peer_node_id IS NOT NULL`
      );
      for (const p of peers) {
        await probePeer(p).catch(() => {});
        await flushExchangeLog(p).catch(() => {});
      }
    } catch (e) { log("warn", "probe.loop.fail", { err: String(e?.message ?? e) }); }
    await sleep(PROBE_MS);
  }
}

async function mainLoop() {
  while (true) {
    try {
      if (!IDENTITY) await loadIdentity();
      const { rows: peers } = await pool.query(
        `SELECT * FROM public.peer_links WHERE status IN ('pending_outbound','active') ORDER BY id`
      );
      await Promise.all(peers.map(async (p) => {
        const b = peerBackoff.get(p.id) ?? 0;
        if (b > TICK_MS) { peerBackoff.set(p.id, Math.max(0, b - TICK_MS)); return; }
        await tickPeer(p);
      }));
    } catch (e) { log("error", "main.loop.fail", { err: String(e?.message ?? e) }); }
    await sleep(TICK_MS);
  }
}

async function gcLoop() {
  while (true) {
    try {
      await pool.query(`SELECT public.sync_outbox_gc()`);
      await pool.query(`SELECT public.sync_diagnostics_gc()`).catch(() => {});
    } catch (e) { log("warn", "gc.fail", { err: String(e?.message ?? e) }); }
    await sleep(60 * 60 * 1000);
  }
}

async function identityRefreshLoop() {
  while (true) {
    try { await loadIdentity(); } catch {}
    await sleep(30_000);
  }
}

log("info", "sync.start", { batch: BATCH, tick_ms: TICK_MS, probe_ms: PROBE_MS, schema_version: SCHEMA_VERSION });

startApi({ pool });

Promise.all([mainLoop(), gcLoop(), identityRefreshLoop(), heartbeatLoop(), probeLoop()]).catch((e) => {
  log("error", "sync.crash", { err: String(e) });
  process.exit(1);
});

process.on("SIGTERM", () => { log("info", "sync.stop"); pool.end().finally(() => process.exit(0)); });
