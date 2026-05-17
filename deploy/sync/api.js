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
const RECONFIGURE_FILE = `${COMPOSE_DIR}/RECONFIGURE_FRONTEND`;

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

      // ── Initial seed push (Local→Cloud): backfill outbox from existing rows ──
      if (req.method === "POST" && path === "/node/seed-push") {
        const body = await readJson(req);
        const env = readEnvMap();
        const cid = String(body.casino_id || env.CASINO_ID || "").trim();
        if (!/^[0-9a-f-]{36}$/i.test(cid)) return send(res, 400, { error: "casino_id required (uuid)" });
        try {
          const { rows } = await pool.query(
            `SELECT * FROM public.sync_seed_from_existing($1::uuid)`,
            [cid]
          );
          const total = rows.reduce((s, r) => s + Number(r.inserted_count || 0), 0);
          return send(res, 200, { ok: true, counts: rows, total_inserted: total });
        } catch (e) {
          return send(res, 500, { error: String(e?.message || e) });
        }
      }
      if (req.method === "GET" && path === "/node/seed-push/status") {
        const env = readEnvMap();
        const cid = String(url.searchParams.get("casino_id") || env.CASINO_ID || "").trim();
        if (!/^[0-9a-f-]{36}$/i.test(cid)) return send(res, 400, { error: "casino_id required (uuid)" });
        try {
          const { rows: marks } = await pool.query(
            `SELECT table_name, row_count, completed_at
               FROM public.sync_seed_marker WHERE casino_id = $1 ORDER BY table_name`,
            [cid]
          );
          const { rows: out } = await pool.query(
            `SELECT COUNT(*)::int AS pending,
                    COALESCE(MAX(id),0)::bigint AS max_id
               FROM public.sync_outbox WHERE casino_id = $1`,
            [cid]
          );
          const { rows: peers } = await pool.query(
            `SELECT display_name, status, last_push_cursor, last_pull_cursor, last_push_error
               FROM public.peer_links ORDER BY display_name`
          );
          return send(res, 200, { marks, outbox: out[0] ?? {}, peers });
        } catch (e) {
          return send(res, 500, { error: String(e?.message || e) });
        }
      }

      // ── Clone-from-Cloud (Cloud→Local wipe & replace) ──
      // Streams cloud-seed-export with the local sync_secret credentials, wipes
      // local data tables for this casino_id, then imports the NDJSON stream
      // with sync.applying='on' so import doesn't re-emit to outbox.
      if (req.method === "POST" && path === "/node/clone-from-cloud") {
        const env = readEnvMap();
        const cid = env.CASINO_ID;
        if (!/^[0-9a-f-]{36}$/i.test(cid || "")) {
          return send(res, 400, { error: "this server has no CASINO_ID configured" });
        }
        // Look up the active peer = Cloud (cloud_connection row)
        const { rows: cc } = await pool.query(
          `SELECT cloud_url, sync_secret, casino_id, status FROM public.cloud_connection WHERE id = 1`
        );
        const conn = cc[0];
        if (!conn || conn.status !== "connected") {
          return send(res, 400, { error: "Cloud connection not active — pair this server first" });
        }
        if (conn.casino_id !== cid) {
          return send(res, 400, { error: `Cloud casino_id (${conn.casino_id}) ≠ local CASINO_ID (${cid})` });
        }
        // Stream + import (fire-and-forget; client polls /node/clone-from-cloud/status)
        // Pass initiator userId so their auth row is never wiped mid-clone.
        cloneFromCloud(pool, conn, cid, userId).catch((e) => {
          console.error("[clone] fatal", e);
        });
        return send(res, 202, { ok: true, message: "Clone started — poll /node/clone-from-cloud/status" });
      }
      if (req.method === "GET" && path === "/node/clone-from-cloud/status") {
        return send(res, 200, getCloneStatus());
      }

      // ── Server Identity (CASINO_SLUG / CASINO_ID / NAME / DOMAIN / IP) ──
      if (req.method === "GET" && path === "/node/server-identity") {
        const env = readEnvMap();
        return send(res, 200, {
          casino_id:    env.CASINO_ID    || "",
          casino_slug:  env.CASINO_SLUG  || "local",
          casino_name:  env.CASINO_NAME  || "",
          local_domain: env.LOCAL_DOMAIN || "",
          local_ip:     env.LOCAL_IP     || "",
          unconfigured: !env.CASINO_SLUG || env.CASINO_SLUG === "local" || !env.CASINO_ID,
        });
      }
      if (req.method === "POST" && path === "/node/server-identity") {
        const body = await readJson(req);
        const slug = String(body.casino_slug || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
        const cid  = String(body.casino_id   || "").trim();
        const name = String(body.casino_name || "").slice(0, 120);
        const dom  = String(body.local_domain|| "").slice(0, 120);
        const ip   = String(body.local_ip    || "").slice(0, 64);
        if (!slug) return send(res, 400, { error: "casino_slug required" });
        if (cid && !/^[0-9a-f-]{8,}$/i.test(cid)) return send(res, 400, { error: "casino_id must be UUID" });
        try {
          writeEnvKey("CASINO_SLUG", slug);
          if (cid)  writeEnvKey("CASINO_ID",    cid);
          if (name) writeEnvKey("CASINO_NAME",  name);
          if (dom)  writeEnvKey("LOCAL_DOMAIN", dom);
          if (ip)   writeEnvKey("LOCAL_IP",     ip);
          writeFileSync(RECONFIGURE_FILE, new Date().toISOString());
        } catch (e) {
          return send(res, 500, { error: String(e?.message ?? e) });
        }
        return send(res, 200, {
          ok: true,
          message: "saved; cms-frontend will restart in ~10s and become available again after ~30s",
        });
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
  if (changes.length === 0) return send(res, 200, { accepted: [], rejected: [] });

  const accepted = [];
  const rejected = [];
  const client = await pool.connect();
  try {
    for (const ch of changes) {
      try {
        // Casino rows are environment-owned per node. Cloud and Local can have
        // different display names/slugs for the same casino, and applying old
        // casino row payloads can violate child-table FKs. Accept and advance.
        if (ch.table === "casinos") {
          accepted.push(ch.id);
          continue;
        }
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
        const errMsg = String(e?.message ?? e).slice(0, 480);
        const errCode = e?.code || "apply_failed";
        console.log(JSON.stringify({ ts: new Date().toISOString(), lvl: "warn", msg: "peer.push.apply.fail", peer: peer.display_name, table: ch.table, id: ch.id, err: errMsg }));
        rejected.push({ outbox_id: ch.id, error_code: errCode, error_text: errMsg });
        // Persist for diagnostics
        try {
          const payloadHash = crypto.createHash("md5").update(JSON.stringify(ch.payload ?? {})).digest("hex");
          await client.query(
            `SELECT public.sync_record_apply_error($1::uuid, $2::bigint, $3::text, $4::text, $5::jsonb, $6::text, $7::text, $8::text)`,
            [peer.id, ch.id ?? null, ch.table ?? "unknown", ch.op ?? null, ch.pk ?? {}, payloadHash, errCode, errMsg]
          );
        } catch { /* swallow */ }
      }
    }
    await client.query(
      `UPDATE public.peer_links
          SET last_seen_at = now(), last_push_error = $2
        WHERE id = $1`,
      [peer.id, rejected.length ? `${rejected.length} rejected` : null]
    );
  } finally {
    client.release();
  }
  return send(res, 200, { accepted, rejected });
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

// ─────────── Updater helpers ───────────
function writeEnvKey(key, value) {
  let txt = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const quoted = `'${String(value).replace(/'/g, "'\\''")}'`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(txt)) txt = txt.replace(re, `${key}=${quoted}`);
  else { if (txt && !txt.endsWith("\n")) txt += "\n"; txt += `${key}=${quoted}\n`; }
  writeFileSync(ENV_FILE, txt);
}
function readEnvMap() {
  try {
    if (!existsSync(ENV_FILE)) return {};
    const out = {};
    for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
    return out;
  } catch (e) {
    console.warn(`[updater] cannot read ${ENV_FILE}: ${e?.message || e}`);
    return {};
  }
}
function safeReadJson(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}
function tailLog(file, n = 30) {
  try {
    const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
    return lines.slice(-n);
  } catch { return []; }
}
function getUpdaterStatus() {
  const env = readEnvMap();
  const flag = safeReadJson(FLAG_FILE);
  const push = safeReadJson(PUSH_FILE);
  const ack = safeReadJson(ACK_FILE);
  return {
    current_version: (env.FRONTEND_VERSION || "unknown").replace(/^v/, ""),
    previous_version: env.PREVIOUS_VERSION ? env.PREVIOUS_VERSION.replace(/^v/, "") : null,
    available_version: flag?.available ? String(flag.available).replace(/^v/, "") : null,
    available_image: flag?.image ?? null,
    available_pushed: flag?.push === true,
    auto_apply: env.AUTO_APPLY === "true",
    push_command: push,
    push_ack: ack,
    log_tail: tailLog(LOG_FILE, 30),
  };
}

// ─────────── Clone-from-Cloud ───────────
// In-memory status — survives until process restart. UI polls every 2s.
let cloneState = {
  status: "idle",        // idle | running | error | done
  started_at: null,
  finished_at: null,
  current_table: null,
  counts: {},            // { table_name: rows_imported }
  errors_by_table: {},   // { table_name: rows_failed }
  error_samples: {},     // { table_name: ["first error msg", ...] (max 3) }
  error: null,
};
function getCloneStatus() { return cloneState; }

function recordCloneError(table, msg) {
  cloneState.errors_by_table[table] = (cloneState.errors_by_table[table] || 0) + 1;
  const arr = cloneState.error_samples[table] || (cloneState.error_samples[table] = []);
  if (arr.length < 3) arr.push(String(msg || "").slice(0, 240));
}

async function cloneFromCloud(pool, conn, casinoId, initiatorUserId) {
  cloneState = {
    status: "running",
    started_at: new Date().toISOString(),
    finished_at: null,
    current_table: null,
    counts: {},
    errors_by_table: {},
    error_samples: {},
    error: null,
  };
  const client = await pool.connect();
  try {
    // Tables to wipe — same list whose scope=='full' in cloud-seed-export.
    // Order: child rows first (so FK cascades don't bite), parents last.
    const wipeTables = [
      // operational (FK-children of players/staff/tables)
      "transactions","shifts","cage_transfers","expenses",
      "wallet_transactions","chip_emissions","chip_transfers",
      "chip_snapshots","chip_baseline","chip_initial_baseline","chip_inventory",
      "casino_visits","breaklist","pit_rota","staff_rota",
      "dealer_attendance","staff_attendance","attendance_hours","attendance_holidays",
      "table_tracker","table_daily_results","business_day_closures",
      "cash_counts","cash_count_snapshots","cashless_transactions",
      "bank_checks","cctv_observations",
      "player_chip_adjustments","player_position_history",
      "client_sessions","incidents",
      "daily_summaries","daily_review","inter_casino_transfers",
      "payroll_entries","payroll_periods","payroll_settings",
      "monthly_tips_entries","monthly_tips_pools",
      "weekly_bonus_entries","weekly_bonus_pools",
      // players / cards / groups
      "player_tags","player_notes","group_members","player_groups",
      "player_cards","players",
      // staff
      "dealers","staff_members",
      // config
      "gaming_tables","chip_color_settings",
      "financial_wallets","budget_items","budget_periods","budget_categories",
      // user links (auth.users wiped separately — see below)
      "user_module_permissions","user_casino_access",
    ];

    // Global tables to wipe (no casino_id filter)
    const wipeGlobalTables = [
      "blacklist","role_module_defaults","payroll_paye_brackets","tax_brackets",
    ];

    await client.query("BEGIN");
    await client.query(`SELECT set_config('sync.applying','on', true)`);
    // Disable FK + user triggers for the import — eliminates silent FK losses
    // on child tables (e.g. staff_rota.staff_member_id referencing a row that
    // hasn't been streamed yet). The sync.applying GUC already prevents the
    // outbox enqueue triggers from firing, so this is safe.
    await client.query(`SET LOCAL session_replication_role = replica`);

    // 1) Clear sync_outbox + seed markers + advance peer cursors so we don't
    //    push the freshly-imported rows back to Cloud.
    await client.query(`SELECT public.sync_reset_outbox($1::uuid, true)`, [casinoId]);

    // 2) Wipe casino-scoped rows
    for (const t of wipeTables) {
      try {
        await client.query("SAVEPOINT clone_wipe_table");
        await client.query(`DELETE FROM public.${t} WHERE casino_id = $1::uuid`, [casinoId]);
        await client.query("RELEASE SAVEPOINT clone_wipe_table");
      } catch (e) {
        await client.query("ROLLBACK TO SAVEPOINT clone_wipe_table").catch(() => {});
        await client.query("RELEASE SAVEPOINT clone_wipe_table").catch(() => {});
        // table may not exist or lack casino_id; continue
        console.log(`[clone] wipe.skip ${t}: ${String(e?.message || e).slice(0, 120)}`);
      }
    }

    // 2b) Wipe global tables (no casino_id filter)
    for (const t of wipeGlobalTables) {
      try {
        await client.query("SAVEPOINT clone_wipe_global");
        await client.query(`DELETE FROM public.${t}`);
        await client.query("RELEASE SAVEPOINT clone_wipe_global");
      } catch (e) {
        await client.query("ROLLBACK TO SAVEPOINT clone_wipe_global").catch(() => {});
        await client.query("RELEASE SAVEPOINT clone_wipe_global").catch(() => {});
        console.log(`[clone] wipe.skip ${t}: ${String(e?.message || e).slice(0, 120)}`);
      }
    }

    // 2c) NOTE: auth.users is no longer pre-wiped. Pre-wiping was killing the
    //     active super_admin session ("users appeared for a second and vanished").
    //     Instead, after the stream finishes (step 4) we delete only users
    //     ABSENT from the cloud snapshot — and never the initiator,
    //     never superadmin@cms.local.
    const importedAuthIds = new Set();

    // 3) Stream NDJSON from cloud-seed-export
    const seedUrl = `${conn.cloud_url}/functions/v1/cloud-seed-export?casino_id=${casinoId}&days=all`;
    const r = await fetch(seedUrl, {
      headers: { "x-sync-secret": conn.sync_secret, "x-casino-id": casinoId },
    });
    if (!r.ok || !r.body) {
      throw new Error(`cloud-seed-export ${r.status}: ${(await r.text().catch(()=>""))?.slice(0,300)}`);
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        if (obj._meta || obj._done) continue;
        if (obj._error || obj._fatal) {
          console.log(`[clone] seed-export error`, obj);
          continue;
        }

        // ── auth.users: пишем напрямую в auth-схему, сохраняя
        //    encrypted_password (bcrypt-хеш) и id — тогда логины Cloud
        //    работают на локали с теми же паролями.
        if (obj.auth_user) {
          const u = obj.auth_user;
          try {
            await client.query("SAVEPOINT clone_auth_user");
            await client.query(`
              INSERT INTO auth.users
                (instance_id, id, aud, role, email, encrypted_password,
                 email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                 created_at, updated_at, phone)
              VALUES
                ('00000000-0000-0000-0000-000000000000', $1,
                 COALESCE($2,'authenticated'), COALESCE($3,'authenticated'),
                 $4, $5,
                 COALESCE($6, now()),
                 COALESCE($7::jsonb, '{"provider":"email","providers":["email"]}'::jsonb),
                 COALESCE($8::jsonb, '{}'::jsonb),
                 COALESCE($9, now()), now(), $10)
              ON CONFLICT (id) DO UPDATE SET
                email              = EXCLUDED.email,
                encrypted_password = EXCLUDED.encrypted_password,
                email_confirmed_at = EXCLUDED.email_confirmed_at,
                raw_app_meta_data  = EXCLUDED.raw_app_meta_data,
                raw_user_meta_data = EXCLUDED.raw_user_meta_data,
                phone              = EXCLUDED.phone,
                updated_at         = now()
            `, [
              u.id, u.aud, u.role, u.email, u.encrypted_password,
              u.email_confirmed_at,
              u.raw_app_meta_data  ? JSON.stringify(u.raw_app_meta_data)  : null,
              u.raw_user_meta_data ? JSON.stringify(u.raw_user_meta_data) : null,
              u.created_at, u.phone,
            ]);
            // mirror into auth.identities so Supabase auth recognises email login
            await client.query(`
              INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
              VALUES (gen_random_uuid(), $1,
                      jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
                      'email', $1::text, now(), now(), now())
              ON CONFLICT (provider, provider_id) DO NOTHING
            `, [u.id, u.email]);
            await client.query("RELEASE SAVEPOINT clone_auth_user");
            cloneState.counts["auth.users"] = (cloneState.counts["auth.users"] || 0) + 1;
            importedAuthIds.add(u.id);
          } catch (e) {
            await client.query("ROLLBACK TO SAVEPOINT clone_auth_user").catch(() => {});
            await client.query("RELEASE SAVEPOINT clone_auth_user").catch(() => {});
            recordCloneError("auth.users", `${u?.email}: ${e?.message || e}`);
            console.log(`[clone] auth.user fail ${u?.email}: ${String(e?.message || e).slice(0, 200)}`);
          }
          continue;
        }

        if (!obj.table || !obj.row) continue;
        // Strip GENERATED ALWAYS columns — Postgres rejects explicit inserts.
        const CLONE_STRIP = { player_position_history: ["duration_seconds"] };
        for (const c of (CLONE_STRIP[obj.table] || [])) delete obj.row[c];
        cloneState.current_table = obj.table;
        const cols = Object.keys(obj.row);
        if (cols.length === 0) continue;
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
        const setlist = cols.filter(c => c !== "id")
          .map(c => `"${c}" = EXCLUDED."${c}"`).join(",") || `"id" = EXCLUDED."id"`;
        const sql = `INSERT INTO public."${obj.table}" (${cols.map(c => `"${c}"`).join(",")})
                     VALUES (${placeholders})
                     ON CONFLICT (id) DO UPDATE SET ${setlist}`;
        const fallbackSql = `INSERT INTO public."${obj.table}" (${cols.map(c => `"${c}"`).join(",")})
                             VALUES (${placeholders})
                             ON CONFLICT DO NOTHING`;
        try {
          await client.query("SAVEPOINT clone_row");
          await client.query(sql, cols.map(c => obj.row[c]));
          await client.query("RELEASE SAVEPOINT clone_row");
          cloneState.counts[obj.table] = (cloneState.counts[obj.table] || 0) + 1;
        } catch (e) {
          await client.query("ROLLBACK TO SAVEPOINT clone_row").catch(() => {});
          await client.query("RELEASE SAVEPOINT clone_row").catch(() => {});
          try {
            await client.query("SAVEPOINT clone_row_fallback");
            const rr = await client.query(fallbackSql, cols.map(c => obj.row[c]));
            await client.query("RELEASE SAVEPOINT clone_row_fallback");
            if (rr.rowCount > 0) {
              cloneState.counts[obj.table] = (cloneState.counts[obj.table] || 0) + rr.rowCount;
            } else {
              recordCloneError(obj.table, String(e?.message || e));
            }
          } catch (e2) {
            await client.query("ROLLBACK TO SAVEPOINT clone_row_fallback").catch(() => {});
            await client.query("RELEASE SAVEPOINT clone_row_fallback").catch(() => {});
            recordCloneError(obj.table, String(e2?.message || e2 || e));
            console.log(`[clone] insert.fail ${obj.table}: ${String(e2?.message || e2 || e).slice(0, 200)}`);
          }
        }
      }
    }

    // 4) Post-import auth GC: delete only users ABSENT from the cloud
    //    snapshot — never the initiator, never the bootstrap superadmin.
    //    This replaces the old destructive pre-wipe.
    if (importedAuthIds.size > 0) {
      try {
        await client.query("SAVEPOINT clone_auth_gc");
        const idsArr = Array.from(importedAuthIds);
        await client.query(`
          WITH casino_users AS (
            SELECT u.id, u.email
              FROM auth.users u
             WHERE u.id IN (
               SELECT user_id FROM public.user_casino_access WHERE casino_id = $1::uuid
               UNION
               SELECT id      FROM public.profiles            WHERE casino_id = $1::uuid
             )
          )
          DELETE FROM auth.users
           WHERE id IN (
             SELECT id FROM casino_users
              WHERE email <> 'superadmin@cms.local'
                AND ($3::uuid IS NULL OR id <> $3::uuid)
                AND NOT (id = ANY($2::uuid[]))
           )
        `, [casinoId, idsArr, initiatorUserId || null]);
        await client.query("RELEASE SAVEPOINT clone_auth_gc");
      } catch (e) {
        await client.query("ROLLBACK TO SAVEPOINT clone_auth_gc").catch(() => {});
        await client.query("RELEASE SAVEPOINT clone_auth_gc").catch(() => {});
        recordCloneError("auth.users.gc", e?.message || e);
        console.log(`[clone] auth.users gc skip: ${String(e?.message || e).slice(0, 200)}`);
      }
    }

    await client.query("COMMIT");
    cloneState.status = "done";
    cloneState.finished_at = new Date().toISOString();
    cloneState.current_table = null;
    const totalErrors = Object.values(cloneState.errors_by_table).reduce((s, n) => s + n, 0);
    console.log("[clone] done", { counts: cloneState.counts, errors: totalErrors, errors_by_table: cloneState.errors_by_table });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    cloneState.status = "error";
    cloneState.error = String(e?.message || e);
    cloneState.finished_at = new Date().toISOString();
    console.error("[clone] error", e);
  } finally {
    client.release();
  }
}
