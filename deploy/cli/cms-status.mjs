#!/usr/bin/env node
/**
 * cms-status — local CLI for diagnosing the on-prem Casino System node.
 * Talks directly to Postgres (Unix socket via Docker network) and Docker.
 * Works even when frontend/HTTPS is down.
 *
 * Usage:
 *   cms-status                        — overall status
 *   cms-status mirror                 — per-peer health table
 *   cms-status logs [N]               — last N exchange log entries (default 20)
 *   cms-status errors [N]             — last N unresolved apply errors
 *   cms-status probe <peer-name>      — synchronous round-trip probe
 *   cms-status repair pairing|snapshot|errors
 *   cms-status restart sync|api|all
 *   cms-status pull-cmd               — pull queued commands from Cloud (no SSH)
 */
import { execSync, spawnSync } from "node:child_process";
import pg from "pg";
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const ENV_FILE = "/opt/casino-system/deploy/.env";
const COMPOSE_FILE = "/opt/casino-system/deploy/docker-compose.yml";

function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return out;
}
const env = readEnv();
const PG_URL = env.LOCAL_DB_URL || process.env.LOCAL_DB_URL || "postgres://postgres:postgres@127.0.0.1:5432/postgres";
const pool = new pg.Pool({ connectionString: PG_URL, max: 2, connectionTimeoutMillis: 4000 });

const C = { reset:"\x1b[0m", bold:"\x1b[1m", dim:"\x1b[2m", red:"\x1b[31m", green:"\x1b[32m", yellow:"\x1b[33m", cyan:"\x1b[36m" };
const c = (col, s) => `${C[col]}${s}${C.reset}`;
const ok = (s) => c("green", s);
const warn = (s) => c("yellow", s);
const bad = (s) => c("red", s);
const head = (s) => { console.log(""); console.log(c("bold", s)); console.log(c("dim", "─".repeat(s.length))); };
const fmt = (ts) => ts ? new Date(ts).toISOString().replace("T"," ").slice(0,19) : "—";
const age = (ts) => ts ? `${Math.round((Date.now()-new Date(ts).getTime())/1000)}s ago` : "—";

async function q(sql, params=[]) { try { const r = await pool.query(sql, params); return r.rows; } catch (e) { return { __err: String(e?.message||e) }; } }

function dockerPs() {
  try {
    const out = execSync(`docker compose -f ${COMPOSE_FILE} ps --format json`, { encoding:"utf8", timeout: 8000 });
    return out.trim().split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; }}).filter(Boolean);
  } catch { return []; }
}

async function statusCmd() {
  head(`Casino System — Node Status`);
  const version = env.FRONTEND_VERSION || "unknown";
  console.log(`  Version:    ${ok(version)}`);
  console.log(`  Casino:     ${env.CASINO_SLUG || "?"}  (id ${env.CASINO_ID || "?"})`);
  console.log(`  Domain:     ${env.LOCAL_DOMAIN || "?"}  →  ${env.LOCAL_IP || "?"}`);

  head("Containers");
  const ps = dockerPs();
  if (ps.length === 0) console.log(bad("  No containers reported (Docker reachable?)"));
  for (const p of ps) {
    const state = p.State === "running" ? ok(p.State) : bad(p.State);
    console.log(`  ${p.Service.padEnd(18)} ${state}  ${p.Status||""}`);
  }

  head("Database");
  const ping = await q(`SELECT now() AS t, current_database() AS db`);
  if (ping.__err) console.log(bad(`  ${ping.__err}`));
  else console.log(`  ${ok("connected")}  db=${ping[0].db}  t=${fmt(ping[0].t)}`);

  head("Identity & Pairing");
  const id = await q(`SELECT node_id, display_name, node_kind, schema_version FROM public.node_identity WHERE id=true`);
  if (Array.isArray(id) && id[0]) {
    console.log(`  node_id:    ${id[0].node_id}`);
    console.log(`  name:       ${id[0].display_name}  (${id[0].node_kind})`);
    console.log(`  schema:     v${id[0].schema_version}`);
  } else console.log(bad("  node_identity not initialised"));
  const peers = await q(`SELECT status, count(*)::int AS n FROM public.peer_links GROUP BY status`);
  if (Array.isArray(peers)) {
    const m = Object.fromEntries(peers.map(p => [p.status, p.n]));
    console.log(`  peers:      active=${m.active||0}  pending=${(m.pending_outbound||0)+(m.pending_inbound||0)}  paused=${m.paused||0}`);
  }

  head("Snapshot");
  const snap = await q(`SELECT snapshot_id, source, imported_at, COALESCE(jsonb_object_keys_count(table_counts), 0) AS n FROM (SELECT s.*, (SELECT count(*) FROM jsonb_object_keys(table_counts)) AS jsonb_object_keys_count FROM public.sync_snapshot_state s WHERE casino_id = $1::uuid) z`,
    [env.CASINO_ID]).catch(()=>[]);
  // Fallback simple query
  const snap2 = await q(`SELECT snapshot_id, source, imported_at FROM public.sync_snapshot_state WHERE casino_id = $1::uuid`, [env.CASINO_ID]);
  if (Array.isArray(snap2) && snap2[0]) console.log(`  ${ok("imported")}  ${snap2[0].snapshot_id || "?"}  ${age(snap2[0].imported_at)}  src=${snap2[0].source||"?"}`);
  else console.log(warn("  no snapshot recorded — seed-import may not have run"));

  head("Outbox & Apply Errors");
  const out = await q(`SELECT COUNT(*)::int AS pending FROM public.sync_outbox`);
  if (Array.isArray(out)) console.log(`  outbox pending: ${out[0].pending}`);
  const errs = await q(`SELECT COUNT(*)::int AS n FROM public.sync_apply_errors WHERE resolved_at IS NULL`);
  if (Array.isArray(errs)) {
    const n = errs[0].n;
    console.log(`  apply errors:   ${n === 0 ? ok("0") : bad(String(n))} unresolved`);
    if (n > 0) {
      const last = await q(`SELECT table_name, error_code, last_seen_at FROM public.sync_apply_errors WHERE resolved_at IS NULL ORDER BY last_seen_at DESC LIMIT 5`);
      for (const e of last) console.log(`    · ${fmt(e.last_seen_at)}  ${e.table_name.padEnd(24)} ${bad(e.error_code)}`);
    }
  }

  head("Last Probe");
  const pr = await q(`SELECT pl.display_name, pe.sent_at, pe.status, pe.latency_ms FROM public.sync_probe_events pe LEFT JOIN public.peer_links pl ON pl.id=pe.peer_link_id ORDER BY pe.sent_at DESC LIMIT 3`);
  if (Array.isArray(pr) && pr.length) for (const p of pr) console.log(`  ${fmt(p.sent_at)}  ${p.display_name?.padEnd(20)||"—".padEnd(20)} ${(p.status==="ok"?ok:bad)(p.status)}  ${p.latency_ms ?? "?"}ms`);
  else console.log(warn("  no probes yet"));
  await pool.end();
}

async function mirrorCmd() {
  head("Mirror Health");
  const rows = await q(`
    SELECT h.peer_name, h.state, h.last_heartbeat_at, h.last_push_ok_at, h.last_pull_ok_at,
           h.last_probe_latency_ms, h.pending_outbox_count, h.apply_errors_count,
           h.schema_version_local, h.schema_version_remote, h.last_error_text
      FROM public.sync_peer_health h
     ORDER BY h.peer_name`);
  if (rows.__err) { console.log(bad(rows.__err)); await pool.end(); return; }
  if (rows.length === 0) { console.log(warn("  no peers")); await pool.end(); return; }
  for (const r of rows) {
    const st = r.state === "ok" ? ok(r.state) : r.state === "degraded" ? warn(r.state) : bad(r.state);
    console.log(`\n  ${c("bold", r.peer_name || "?")}  [${st}]`);
    console.log(`    schema:  local v${r.schema_version_local||"?"}  ↔  remote v${r.schema_version_remote||"?"}`);
    console.log(`    heart:   ${age(r.last_heartbeat_at)}    push ok: ${age(r.last_push_ok_at)}    pull ok: ${age(r.last_pull_ok_at)}`);
    console.log(`    probe:   ${r.last_probe_latency_ms ?? "?"}ms   outbox pending: ${r.pending_outbox_count}   apply errors: ${r.apply_errors_count}`);
    if (r.last_error_text) console.log(`    err:     ${bad(r.last_error_text.slice(0,200))}`);
  }
  await pool.end();
}

async function logsCmd(n=20) {
  const limit = Math.min(parseInt(n,10) || 20, 200);
  head(`Exchange Log (last ${limit})`);
  const rows = await q(`SELECT created_at, peer_name, direction, status, row_count, error_text, meta FROM public.sync_exchange_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
  if (rows.__err) { console.log(bad(rows.__err)); await pool.end(); return; }
  for (const r of rows.reverse()) {
    const st = r.status==="ok"?ok("ok"):r.status==="warn"?warn("warn"):bad("err");
    const tail = r.error_text ? bad(r.error_text.slice(0,80)) : (r.meta?.cursor ? `cur ${r.meta.cursor}` : "");
    console.log(`  ${fmt(r.created_at)}  ${(r.peer_name||"-").padEnd(18)}  ${r.direction.padEnd(9)}  ${st}  rows=${String(r.row_count).padStart(4)}  ${tail}`);
  }
  await pool.end();
}

async function errorsCmd(n=20) {
  const limit = Math.min(parseInt(n,10) || 20, 200);
  head(`Apply Errors (last ${limit} unresolved)`);
  const rows = await q(`SELECT id, peer_name, table_name, op, error_code, error_text, last_seen_at, attempts FROM public.sync_apply_errors WHERE resolved_at IS NULL ORDER BY last_seen_at DESC LIMIT $1`, [limit]);
  if (rows.__err) { console.log(bad(rows.__err)); await pool.end(); return; }
  if (rows.length === 0) { console.log(ok("  no unresolved apply errors")); await pool.end(); return; }
  for (const r of rows) {
    console.log(`\n  #${r.id}  ${fmt(r.last_seen_at)}  ${r.peer_name||"-"}  ${r.table_name}  ${r.op}  ${bad(r.error_code)}  x${r.attempts}`);
    if (r.error_text) console.log(`    ${c("dim", r.error_text.slice(0,300))}`);
  }
  await pool.end();
}

async function restartCmd(target) {
  const map = { sync: ["cms-sync"], api: ["cms-frontend"], all: [] };
  const services = map[target];
  if (services == null) { console.log(bad(`unknown target: ${target}`)); process.exit(1); }
  const args = ["compose", "-f", COMPOSE_FILE, "restart", ...services];
  console.log(c("cyan", `  docker ${args.join(" ")}`));
  const r = spawnSync("docker", args, { stdio: "inherit" });
  process.exit(r.status ?? 0);
}

async function repairCmd(what) {
  if (what === "errors") {
    const r = await q(`UPDATE public.sync_apply_errors SET resolved_at=now(), resolution='cli_retry' WHERE resolved_at IS NULL RETURNING id`);
    console.log(ok(`  marked ${Array.isArray(r) ? r.length : 0} apply errors as resolved (they will be retried on next outbox replay)`));
  } else if (what === "pairing") {
    const r = await q(`UPDATE public.peer_links SET status='pending_outbound', last_push_error=NULL WHERE status IN ('paused','rejected') RETURNING id`);
    console.log(ok(`  reset ${Array.isArray(r) ? r.length : 0} peer links to pending_outbound`));
  } else if (what === "snapshot") {
    console.log(warn("  use 'pair.sh' to re-run snapshot import"));
  } else { console.log(bad(`unknown repair target: ${what}`)); process.exit(1); }
  await pool.end();
}

async function probeCmd(name) {
  if (!name) { console.log(bad("usage: cms-status probe <peer-name>")); process.exit(1); }
  const peers = await q(`SELECT * FROM public.peer_links WHERE display_name ILIKE $1 OR display_name ILIKE $2 LIMIT 1`, [name, `%${name}%`]);
  if (!Array.isArray(peers) || peers.length === 0) { console.log(bad("peer not found")); await pool.end(); return; }
  const peer = peers[0];
  if (!peer.peer_url || !peer.sync_secret) { console.log(bad("peer has no url/secret")); await pool.end(); return; }
  const { rows: idRows } = await pool.query(`SELECT node_id FROM public.node_identity WHERE id=true`);
  const nodeId = idRows[0]?.node_id;
  const probe = await q(`SELECT public.sync_record_probe_sent($1::uuid, 'out') AS id`, [peer.id]);
  const probeId = Array.isArray(probe) ? probe[0]?.id : null;
  const body = JSON.stringify({ probe_id: probeId, origin_node_id: nodeId });
  const sig = crypto.createHmac("sha256", peer.sync_secret).update(body).digest("hex");
  const t0 = Date.now();
  try {
    const r = await fetch(`${peer.peer_url}/peer/probe/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-peer-node-id": nodeId, "x-peer-signature": sig },
      body,
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - t0;
    if (r.ok) { console.log(ok(`  probe ok — ${latency}ms`)); await q(`SELECT public.sync_record_probe_ack($1::uuid, 'ok', NULL)`, [probeId]); }
    else { console.log(bad(`  probe HTTP ${r.status} — ${latency}ms`)); await q(`SELECT public.sync_record_probe_ack($1::uuid, 'error', $2::text)`, [probeId, `http_${r.status}`]); }
  } catch (e) { console.log(bad(`  probe failed: ${String(e?.message||e)}`)); }
  await pool.end();
}

async function pullCmdCmd() {
  // Fetches queued commands from Cloud peer-mesh /node/commands/pop, runs whitelist.
  const peers = await q(`SELECT peer_url, sync_secret FROM public.peer_links WHERE status='active' AND peer_url LIKE '%supabase%' LIMIT 1`);
  if (!Array.isArray(peers) || peers.length === 0) { console.log(warn("  no Cloud peer configured")); await pool.end(); return; }
  const peer = peers[0];
  const body = JSON.stringify({ node_id: (await pool.query(`SELECT node_id FROM public.node_identity WHERE id=true`)).rows[0]?.node_id });
  const sig = crypto.createHmac("sha256", peer.sync_secret).update(body).digest("hex");
  try {
    const r = await fetch(`${peer.peer_url}/node/commands/pop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-peer-signature": sig },
      body,
    });
    if (!r.ok) { console.log(warn(`  pull-cmd HTTP ${r.status}`)); await pool.end(); return; }
    const j = await r.json();
    const cmd = j?.command;
    if (!cmd) { console.log(ok("  no commands queued")); await pool.end(); return; }
    const allow = new Set(["restart_sync","repair_pairing","retry_errors","rebuild_snapshot"]);
    if (!allow.has(cmd.action)) { console.log(bad(`  unsupported action: ${cmd.action}`)); await pool.end(); return; }
    console.log(c("cyan", `  executing: ${cmd.action}`));
    if (cmd.action === "restart_sync") spawnSync("docker", ["compose","-f",COMPOSE_FILE,"restart","cms-sync"], { stdio:"inherit" });
    if (cmd.action === "repair_pairing") await repairCmd("pairing");
    if (cmd.action === "retry_errors") await repairCmd("errors");
  } catch (e) { console.log(bad(`  pull-cmd: ${String(e?.message||e)}`)); }
  await pool.end();
}

const [, , cmd, ...rest] = process.argv;
const main = {
  "": statusCmd, "status": statusCmd,
  "mirror": mirrorCmd,
  "logs": () => logsCmd(rest[0]),
  "errors": () => errorsCmd(rest[0]),
  "probe": () => probeCmd(rest[0]),
  "repair": () => repairCmd(rest[0]),
  "restart": () => restartCmd(rest[0] || "all"),
  "pull-cmd": pullCmdCmd,
}[cmd || ""];

if (!main) { console.log(`Usage: cms-status [status|mirror|logs|errors|probe|repair|restart|pull-cmd]`); process.exit(1); }
main().catch((e) => { console.error(bad(`fatal: ${String(e?.message||e)}`)); process.exit(1); });
