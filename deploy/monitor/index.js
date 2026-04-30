#!/usr/bin/env node
/**
 * cms-monitor — собирает раз в минуту метрики и шлёт в Cloud (report-health).
 * Также поднимает /admin/health (порт 8088) — внутренний JSON для VPN-доступа.
 */
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";

const {
  CASINO_ID, SYNC_SECRET,
  CLOUD_URL = "https://rpehngjvwcnipvkouluu.supabase.co",
  LOCAL_DB_URL,
  MONITOR_INTERVAL_MS = "60000",
  MONITOR_PORT = "8088",
} = process.env;

if (!CASINO_ID || !SYNC_SECRET || !LOCAL_DB_URL) {
  console.error("[monitor] FATAL: missing env"); process.exit(1);
}

const pool = new pg.Pool({ connectionString: LOCAL_DB_URL, max: 2 });
const log = (m, e = {}) => console.log(JSON.stringify({ ts: new Date().toISOString(), ...e, msg: m }));

function sh(cmd) {
  try { return execSync(cmd, { encoding: "utf8", timeout: 5000 }).trim(); } catch { return ""; }
}

async function collect() {
  // CPU load
  const load = readFileSync("/proc/loadavg", "utf8").split(" ").slice(0, 3).map(Number);
  // RAM
  const meminfo = readFileSync("/proc/meminfo", "utf8");
  const memTotal = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] ?? "0", 10);
  const memAvail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] ?? "0", 10);
  // Disk (root of compose mount)
  const df = sh("df -P /compose 2>/dev/null || df -P /").split("\n")[1]?.split(/\s+/) ?? [];
  const diskUsedPct = parseInt((df[4] || "0").replace("%", ""), 10);
  // Containers
  const ps = sh(`docker ps --format '{{.Names}}|{{.Status}}'`).split("\n").filter(Boolean)
    .map((l) => { const [name, status] = l.split("|"); return { name, status, healthy: /healthy|Up/.test(status) }; });
  // Sync state
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

async function tick() {
  try {
    LAST = await collect();
    const r = await fetch(`${CLOUD_URL}/functions/v1/report-health`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": SYNC_SECRET, "x-casino-id": CASINO_ID },
      body: JSON.stringify({ metrics: LAST }),
    });
    if (!r.ok) log("report.fail", { status: r.status });
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
