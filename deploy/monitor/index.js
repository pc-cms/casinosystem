#!/usr/bin/env node
/**
 * cms-monitor — собирает раз в минуту метрики и шлёт в Cloud (report-health).
 * Также:
 *   - поднимает /admin/health (порт 8088) — внутренний JSON для VPN-доступа.
 *   - читает pending_command из ответа report-health и сохраняет в
 *     /compose/PUSH_COMMAND.json — cms-updater подхватывает.
 *   - читает /compose/PUSH_COMMAND_ACK.json (пишется updater'ом после применения)
 *     и шлёт ack обратно в Cloud вместе со следующим тиком.
 */
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import pg from "pg";

const {
  CASINO_ID, SYNC_SECRET,
  CLOUD_URL = "https://rpehngjvwcnipvkouluu.supabase.co",
  LOCAL_DB_URL,
  MONITOR_INTERVAL_MS = "60000",
  MONITOR_PORT = "8088",
  COMPOSE_DIR = "/compose",
} = process.env;

if (!CASINO_ID || !SYNC_SECRET || !LOCAL_DB_URL) {
  console.error("[monitor] FATAL: missing env"); process.exit(1);
}

const PUSH_FILE = `${COMPOSE_DIR}/PUSH_COMMAND.json`;
const ACK_FILE = `${COMPOSE_DIR}/PUSH_COMMAND_ACK.json`;

const pool = new pg.Pool({ connectionString: LOCAL_DB_URL, max: 2 });
const log = (m, e = {}) => console.log(JSON.stringify({ ts: new Date().toISOString(), ...e, msg: m }));

function sh(cmd) {
  try { return execSync(cmd, { encoding: "utf8", timeout: 5000 }).trim(); } catch { return ""; }
}

async function collect() {
  const load = readFileSync("/proc/loadavg", "utf8").split(" ").slice(0, 3).map(Number);
  const meminfo = readFileSync("/proc/meminfo", "utf8");
  const memTotal = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] ?? "0", 10);
  const memAvail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] ?? "0", 10);
  const df = sh("df -P /compose 2>/dev/null || df -P /").split("\n")[1]?.split(/\s+/) ?? [];
  const diskUsedPct = parseInt((df[4] || "0").replace("%", ""), 10);
  const ps = sh(`docker ps --format '{{.Names}}|{{.Status}}'`).split("\n").filter(Boolean)
    .map((l) => { const [name, status] = l.split("|"); return { name, status, healthy: /healthy|Up/.test(status) }; });
  let outboxUnsent = 0, lastOutbox = null;
  try {
    const r = await pool.query(`SELECT count(*)::int AS c, max(created_at) AS last FROM sync.outbox WHERE sent_at IS NULL`);
    outboxUnsent = r.rows[0].c; lastOutbox = r.rows[0].last;
  } catch {}

  return {
    casino_id: CASINO_ID,
    collected_at: new Date().toISOString(),
    load_avg: load,
    mem: { total_kb: memTotal, available_kb: memAvail, used_pct: memTotal ? Math.round((1 - memAvail / memTotal) * 100) : 0 },
    disk: { used_pct: diskUsedPct },
    containers: ps,
    sync: { outbox_unsent: outboxUnsent, oldest_unsent: lastOutbox },
  };
}

let LAST = null;

function readPendingAck() {
  if (!existsSync(ACK_FILE)) return null;
  try {
    const ack = JSON.parse(readFileSync(ACK_FILE, "utf8"));
    if (ack && ack.command_id && ack.status) return ack;
  } catch (e) { log("ack.parse_fail", { err: String(e?.message ?? e) }); }
  return null;
}

function writePushCommand(cmd) {
  // Skip if same command already pending and not yet processed by updater.
  if (existsSync(PUSH_FILE)) {
    try {
      const existing = JSON.parse(readFileSync(PUSH_FILE, "utf8"));
      if (existing?.id === cmd.id) return;
    } catch {}
  }
  writeFileSync(PUSH_FILE, JSON.stringify({ ...cmd, received_at: new Date().toISOString() }, null, 2));
  log("push.received", { id: cmd.id, target_version: cmd.target_version, auto_apply: cmd.auto_apply });
}

async function tick() {
  try {
    LAST = await collect();
    const ack = readPendingAck();
    const body = { metrics: LAST };
    if (ack) body.ack = ack;

    const r = await fetch(`${CLOUD_URL}/functions/v1/report-health`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": SYNC_SECRET, "x-casino-id": CASINO_ID },
      body: JSON.stringify(body),
    });
    if (!r.ok) { log("report.fail", { status: r.status }); return; }

    // ack accepted → remove ack file (only if server confirmed 200)
    if (ack && existsSync(ACK_FILE)) {
      try { unlinkSync(ACK_FILE); } catch {}
    }

    const json = await r.json().catch(() => null);
    if (json?.pending_command?.id) {
      writePushCommand(json.pending_command);
    }
  } catch (e) { log("tick.error", { err: String(e?.message ?? e) }); }
}

createServer((req, res) => {
  if (req.url === "/admin/health" || req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(LAST ?? { ready: false }));
  } else { res.writeHead(404); res.end(); }
}).listen(parseInt(MONITOR_PORT, 10), "0.0.0.0", () => log("monitor.listen", { port: MONITOR_PORT }));

log("monitor.start", { casino_id: CASINO_ID, interval_ms: MONITOR_INTERVAL_MS });
setInterval(tick, parseInt(MONITOR_INTERVAL_MS, 10));
tick();
process.on("SIGTERM", () => process.exit(0));
