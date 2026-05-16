#!/usr/bin/env node
/**
 * cms-updater — FULL-STACK auto-update from GitHub Releases.
 * ─────────────────────────────────────────────────────────────
 * Cumulative & atomic: один Apply скачивает релиз целиком (исходники + миграции
 * + frontend Docker image) и применяет ВСЁ за один раз. После успешного апдейта
 * сервер полностью автономен — интернет можно отключать на годы.
 *
 * Что обновляется:
 *   1. cms-frontend          → docker pull ghcr.io/${OWNER}/cms-frontend:${VER}
 *   2. cms-sync / cms-updater / cms-monitor / cms-backup
 *                            → пересборка из новых исходников (docker compose build)
 *   3. supabase/migrations/  → применяются psql-ом к локальному Postgres
 *   4. deploy/nginx/         → обновляются конфиги
 *   5. deploy/docker-compose.yml, sync/, monitor/, backup/, updater/ — новые версии
 *
 * Что НЕ трогается:
 *   - deploy/.env             (креды/секреты)
 *   - deploy/certs/           (TLS)
 *   - deploy/postgres/data/   (база)
 *   - storage volume          (фото игроков)
 *
 * Cumulative jump: если сервер был оффлайн 3 месяца и накопилось 30 релизов,
 * один Apply скачивает только последний (миграции идемпотентны и кумулятивны).
 *
 * Rollback: перед стартом снимается полный rsync-снапшот /cms-root → бэкап.
 * При любой ошибке (pull/build/migrations/health) — откат rsync-ом и compose up.
 */
import { execSync, spawnSync } from "node:child_process";
import {
  readFileSync, writeFileSync, existsSync, appendFileSync, unlinkSync,
  mkdirSync, readdirSync, statSync, rmSync,
} from "node:fs";
import { join } from "node:path";

const {
  GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN,
  FRONTEND_VERSION = "latest",
  CHECK_INTERVAL_MINUTES = "60",
  AUTO_APPLY = "false",
  COMPOSE_PROJECT_DIR = "/compose",
  ENV_FILE = "/compose/.env",
  CMS_ROOT_DIR = "/cms-root",
  POSTGRES_USER = "postgres",
  POSTGRES_PASSWORD = "",
  POSTGRES_DB = "postgres",
  POSTGRES_HOST = "postgres",
} = process.env;

const TICK_MS = Math.max(parseInt(CHECK_INTERVAL_MINUTES, 10), 5) * 60 * 1000;
const LOG_FILE = `${COMPOSE_PROJECT_DIR}/updater.log`;
const FLAG_FILE = `${COMPOSE_PROJECT_DIR}/UPDATE_AVAILABLE`;
const PUSH_FILE = `${COMPOSE_PROJECT_DIR}/PUSH_COMMAND.json`;
const ACK_FILE = `${COMPOSE_PROJECT_DIR}/PUSH_COMMAND_ACK.json`;
const CHECK_NOW_FILE = `${COMPOSE_PROJECT_DIR}/CHECK_NOW`;
const RECONFIGURE_FILE = `${COMPOSE_PROJECT_DIR}/RECONFIGURE_FRONTEND`;
const APPLIED_MIGRATIONS_TABLE = "public._cms_applied_migrations";
const HEALTH_TIMEOUT_S = 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────── logging ─────────────
function log(lvl, msg, extra = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), lvl, msg, ...extra });
  console.log(line);
  try { appendFileSync(LOG_FILE, line + "\n"); } catch {}
}

if (!GITHUB_OWNER || !GITHUB_REPO) {
  log("fatal", "missing env GITHUB_OWNER/GITHUB_REPO");
  process.exit(1);
}

// ───────────── helpers ─────────────
function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
function envValue(value) {
  return String(value ?? "").trim().replace(/^['"]|['"]$/g, "");
}
function writeEnvKey(key, value) {
  let txt = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(txt)) txt = txt.replace(re, `${key}=${value}`);
  else { if (!txt.endsWith("\n")) txt += "\n"; txt += `${key}=${value}\n`; }
  writeFileSync(ENV_FILE, txt);
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
}
function compose(args) {
  return run("docker", ["compose", "-f", `${COMPOSE_PROJECT_DIR}/docker-compose.yml`,
    "--env-file", ENV_FILE, ...args], { cwd: COMPOSE_PROJECT_DIR });
}
async function checkInternet() {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch("https://api.github.com", { signal: c.signal });
    clearTimeout(t); return r.ok;
  } catch { return false; }
}
async function ghFetch(url) {
  const headers = { "User-Agent": "cms-updater", "Accept": "application/vnd.github+json" };
  if (GITHUB_TOKEN && GITHUB_TOKEN !== "ghp_replace_me")
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${url}`);
  return r;
}
async function fetchLatestRelease() {
  const r = await ghFetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
  const body = await r.json();
  if (!body.tag_name) throw new Error("no tag_name in release");
  return body;
}
function isNewer(latest, current) {
  if (current === "latest") return latest !== "latest";
  const a = latest.split(".").map((x) => parseInt(x, 10) || 0);
  const b = current.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x > y) return true; if (x < y) return false;
  }
  return false;
}
async function healthCheck() {
  const deadline = Date.now() + HEALTH_TIMEOUT_S * 1000;
  while (Date.now() < deadline) {
    const r = run("curl", ["-skf", "--max-time", "3", "https://nginx/healthz"]);
    if (r.code === 0) return true;
    await sleep(2000);
  }
  return false;
}
function writeAck(cmdId, status, message) {
  if (!cmdId) return;
  try {
    writeFileSync(ACK_FILE, JSON.stringify({
      command_id: cmdId, status, message: message ?? null, ts: new Date().toISOString(),
    }, null, 2));
  } catch (e) { log("error", "ack.write_fail", { err: String(e?.message ?? e) }); }
}
function readPushCommand() {
  if (!existsSync(PUSH_FILE)) return null;
  try { return JSON.parse(readFileSync(PUSH_FILE, "utf8")); } catch { return null; }
}

// ───────────── full-stack apply ─────────────
async function downloadFile(url, dest) {
  const args = ["-fL", "--max-time", "600", "-o", dest];
  if (GITHUB_TOKEN && GITHUB_TOKEN !== "ghp_replace_me")
    args.push("-H", `Authorization: Bearer ${GITHUB_TOKEN}`);
  args.push(url);
  return run("curl", args);
}

function psql(sql) {
  return run("psql", [
    "-h", POSTGRES_HOST, "-U", POSTGRES_USER, "-d", POSTGRES_DB,
    "-v", "ON_ERROR_STOP=1", "-c", sql,
  ], { env: { ...process.env, PGPASSWORD: POSTGRES_PASSWORD } });
}
function psqlFile(file) {
  return run("psql", [
    "-h", POSTGRES_HOST, "-U", POSTGRES_USER, "-d", POSTGRES_DB,
    "-v", "ON_ERROR_STOP=1", "-1", "-f", file,
  ], { env: { ...process.env, PGPASSWORD: POSTGRES_PASSWORD } });
}
function ensureMigrationsTable() {
  psql(`CREATE TABLE IF NOT EXISTS ${APPLIED_MIGRATIONS_TABLE}(
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
}
function listAppliedMigrations() {
  const r = run("psql", [
    "-h", POSTGRES_HOST, "-U", POSTGRES_USER, "-d", POSTGRES_DB,
    "-tAc", `SELECT name FROM ${APPLIED_MIGRATIONS_TABLE}`,
  ], { env: { ...process.env, PGPASSWORD: POSTGRES_PASSWORD } });
  return new Set((r.out || "").split("\n").map((s) => s.trim()).filter(Boolean));
}
function applyMigrations(migDir) {
  if (!existsSync(migDir)) { log("info", "migrations.none"); return true; }
  ensureMigrationsTable();
  const applied = listAppliedMigrations();
  const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  let count = 0;
  for (const f of files) {
    if (applied.has(f)) continue;
    log("info", "migrations.apply", { file: f });
    const r = psqlFile(join(migDir, f));
    if (r.code !== 0) {
      log("error", "migrations.fail", { file: f, out: r.out.slice(0, 500) });
      return false;
    }
    psql(`INSERT INTO ${APPLIED_MIGRATIONS_TABLE}(name) VALUES ('${f.replace(/'/g, "''")}')`);
    count++;
  }
  log("info", "migrations.done", { applied: count, total: files.length });
  return true;
}

async function fullStackApply(targetVersion, cmdId) {
  const ts = Date.now();
  const tmpDir = `/tmp/cms-upgrade-${ts}`;
  const backupDir = `/cms-root.bak.${ts}`;
  const env = readEnv();
  const currentVersion = (envValue(env.FRONTEND_VERSION) || FRONTEND_VERSION || "latest").replace(/^v/, "");
  const target = String(targetVersion).replace(/^v/, "");
  const owner = envValue(env.GITHUB_OWNER) || GITHUB_OWNER;
  const repo = envValue(env.GITHUB_REPO) || GITHUB_REPO;
  const image = `ghcr.io/${owner}/cms-frontend:${target}`;
  const localIp = envValue(env.LOCAL_IP);
  const localApiUrl = localIp ? `https://${localIp}/api` : "";

  log("info", "apply.start", { from: currentVersion, to: target });
  writeAck(cmdId, "in_progress", `pulling sources for v${target}`);

  // 1. Internet check
  if (!(await checkInternet())) {
    log("error", "apply.no_internet");
    writeAck(cmdId, "failed", "no internet — apply requires online connection");
    return false;
  }

  // 2. Download source tarball + migrations bundle
  mkdirSync(tmpDir, { recursive: true });
  const srcUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/tags/v${target}`;
  const srcTar = `${tmpDir}/src.tar.gz`;
  log("info", "apply.download_src", { url: srcUrl });
  let dl = await downloadFile(srcUrl, srcTar);
  if (dl.code !== 0) {
    // fallback to API tarball (works with private repos + token)
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/v${target}`;
    log("warn", "apply.codeload_fail_try_api", { out: dl.out.slice(0, 200) });
    dl = await downloadFile(apiUrl, srcTar);
  }
  if (dl.code !== 0) {
    log("error", "apply.download_fail", { out: dl.out.slice(0, 500) });
    writeAck(cmdId, "failed", "source download failed");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }

  // 3. Extract
  const ex = run("tar", ["-xzf", srcTar, "-C", tmpDir]);
  if (ex.code !== 0) {
    log("error", "apply.extract_fail", { out: ex.out.slice(0, 500) });
    writeAck(cmdId, "failed", "tarball extract failed");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }
  const extracted = readdirSync(tmpDir).map((n) => join(tmpDir, n))
    .find((p) => statSync(p).isDirectory() && existsSync(join(p, "deploy")));
  if (!extracted) {
    log("error", "apply.bad_tarball", { tmp: tmpDir });
    writeAck(cmdId, "failed", "tarball missing deploy/");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }

  // 4. (Frontend image is built locally per-casino — URL is baked at build time.
  //     We rebuild it in step 9 along with cms-sync etc. No registry pull.)
  log("info", "apply.skip_image_pull", { reason: "frontend is per-casino local build" });


  // 5. Snapshot current install for rollback
  log("info", "apply.backup", { backupDir });
  const bak = run("rsync", ["-a", "--delete", `${CMS_ROOT_DIR}/`, `${backupDir}/`]);
  if (bak.code !== 0) {
    log("error", "apply.backup_fail", { out: bak.out.slice(0, 500) });
    writeAck(cmdId, "failed", "backup snapshot failed");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }

  // 6. rsync new sources over current root (preserve .env / certs / postgres data / volumes)
  writeAck(cmdId, "in_progress", "syncing new sources");
  const sync = run("rsync", [
    "-a", "--delete",
    "--exclude", "deploy/.env",
    "--exclude", "deploy/certs/",
    "--exclude", "deploy/postgres/data/",
    "--exclude", "deploy/vpn/config/",
    "--exclude", "deploy/dist/",
    "--exclude", "node_modules/",
    "--exclude", ".git/",
    "--exclude", "deploy/UPDATE_AVAILABLE",
    "--exclude", "deploy/PUSH_COMMAND.json",
    "--exclude", "deploy/PUSH_COMMAND_ACK.json",
    "--exclude", "deploy/CHECK_NOW",
    "--exclude", "deploy/updater.log",
    `${extracted}/`, `${CMS_ROOT_DIR}/`,
  ]);
  if (sync.code !== 0) {
    log("error", "apply.rsync_fail", { out: sync.out.slice(0, 500) });
    rollbackFrom(backupDir, currentVersion);
    writeAck(cmdId, "failed", "rsync failed — rolled back");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }

  // 7. Save previous version + bump FRONTEND_VERSION in .env
  writeEnvKey("PREVIOUS_VERSION", currentVersion);
  writeEnvKey("FRONTEND_VERSION", target);

  // 8. Apply DB migrations
  writeAck(cmdId, "in_progress", "applying database migrations");
  const migDir = `${CMS_ROOT_DIR}/supabase/migrations`;
  if (!applyMigrations(migDir)) {
    rollbackFrom(backupDir, currentVersion);
    writeAck(cmdId, "failed", "migrations failed — rolled back");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }

  // 9. Rebuild ALL locally-built services (including cms-frontend — it bakes the
  //    local Supabase URL at build time, so a registry image would point at Cloud).
  //    Force --no-cache for cms-frontend to guarantee the new VITE_SUPABASE_URL
  //    build-args are picked up even if Dockerfile lines haven't changed.
  writeAck(cmdId, "in_progress", "rebuilding local services (frontend + sync + monitor + backup)");
  log("info", "apply.compose_build");
  if (!localIp || localApiUrl.includes("supabase.co")) {
    log("error", "apply.local_frontend_env_invalid", { localIp, localApiUrl });
    rollbackFrom(backupDir, currentVersion);
    writeAck(cmdId, "failed", "LOCAL_IP invalid — refused to build frontend against Cloud");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }
  const cfg = compose(["config"]);
  if (cfg.code !== 0 || !cfg.out.includes(`VITE_SUPABASE_URL: ${localApiUrl}`)) {
    log("error", "apply.local_frontend_config_missing", { expected: localApiUrl, out: cfg.out.slice(0, 800) });
    rollbackFrom(backupDir, currentVersion);
    writeAck(cmdId, "failed", `compose does not bake local API URL (${localApiUrl})`);
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }
  // Remove old frontend image so the build is truly fresh
  run("docker", ["image", "rm", "-f", `cms-frontend:${target}`, "cms-frontend:local"]);
  const build = compose(["build", "--no-cache", "cms-frontend", "cms-sync", "cms-monitor", "cms-backup", "cms-updater"]);
  if (build.code !== 0) {
    log("error", "apply.build_fail", { out: build.out.slice(0, 800) });
    rollbackFrom(backupDir, currentVersion);
    writeAck(cmdId, "failed", "compose build failed — rolled back");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }

  log("info", "apply.compose_up");
  const up = compose(["up", "-d", "--remove-orphans"]);
  if (up.code !== 0) {
    log("error", "apply.up_fail", { out: up.out.slice(0, 800) });
    rollbackFrom(backupDir, currentVersion);
    writeAck(cmdId, "failed", "compose up failed — rolled back");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }

  // 10. Health check
  writeAck(cmdId, "in_progress", "health-checking new version");
  if (!(await healthCheck())) {
    log("error", "apply.health_fail");
    rollbackFrom(backupDir, currentVersion);
    writeAck(cmdId, "failed", "healthcheck failed — rolled back");
    rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }

  // 11. Cleanup
  log("info", "apply.ok", { version: target, backup: backupDir });
  writeFileSync(FLAG_FILE, JSON.stringify({
    applied: target, ts: new Date().toISOString(), backup: backupDir,
  }, null, 2));
  writeAck(cmdId, "applied", `v${target} live; backup at ${backupDir}`);
  try { unlinkSync(PUSH_FILE); } catch {}
  rmSync(tmpDir, { recursive: true, force: true });
  // Prune old backups (keep last 3)
  pruneBackups(3);
  return true;
}

function rollbackFrom(backupDir, prevVersion) {
  log("warn", "rollback.start", { backupDir, to: prevVersion });
  if (existsSync(backupDir)) {
    run("rsync", ["-a", "--delete", `${backupDir}/`, `${CMS_ROOT_DIR}/`]);
  }
  writeEnvKey("FRONTEND_VERSION", prevVersion);
  const r = compose(["up", "-d", "--remove-orphans"]);
  log(r.code === 0 ? "warn" : "error", "rollback.done", { code: r.code, out: r.out.slice(0, 500) });
}

function pruneBackups(keep) {
  try {
    const parent = "/";
    const backups = readdirSync(parent)
      .filter((n) => n.startsWith("cms-root.bak."))
      .map((n) => ({ name: n, ts: parseInt(n.split(".").pop(), 10) || 0 }))
      .sort((a, b) => b.ts - a.ts);
    for (const b of backups.slice(keep)) {
      log("info", "backup.prune", { name: b.name });
      rmSync(join(parent, b.name), { recursive: true, force: true });
    }
  } catch (e) { log("warn", "backup.prune_fail", { err: String(e?.message ?? e) }); }
}

// ───────────── tick ─────────────
async function tick() {
  log("info", "tick.start");

  // 1) Process pushed command first
  const cmd = readPushCommand();
  if (cmd?.id && cmd?.target_version) {
    const env = readEnv();
    const current = (env.FRONTEND_VERSION || FRONTEND_VERSION || "latest").replace(/^v/, "");
    const target = String(cmd.target_version).replace(/^v/, "");
    if (target === current) {
      log("info", "push.already_current", { target });
      writeAck(cmd.id, "applied", "already at target version");
      try { unlinkSync(PUSH_FILE); } catch {}
    } else {
      log("info", "push.process", { target, current });
      await fullStackApply(target, cmd.id);
    }
    return;
  }

  if (!(await checkInternet())) { log("warn", "no_internet"); return; }

  let release;
  try { release = await fetchLatestRelease(); }
  catch (e) { log("error", "fetch_releases.fail", { err: String(e?.message ?? e) }); return; }

  const env = readEnv();
  const current = (env.FRONTEND_VERSION || FRONTEND_VERSION || "latest").replace(/^v/, "");
  const latest = String(release.tag_name).replace(/^v/, "");

  if (!isNewer(latest, current)) {
    log("info", "up_to_date", { current, latest });
    return;
  }

  log("info", "update_available", { current, latest, auto_apply: AUTO_APPLY });
  writeFileSync(FLAG_FILE, JSON.stringify({
    available: latest, current, ts: new Date().toISOString(),
    notes: release.body?.slice(0, 500) ?? null,
  }, null, 2));

  if (AUTO_APPLY === "true") await fullStackApply(latest, null);
}

// ───────────── main loop ─────────────
log("info", "updater.start", {
  owner: GITHUB_OWNER, repo: GITHUB_REPO,
  interval_min: CHECK_INTERVAL_MINUTES, auto_apply: AUTO_APPLY,
});

const FAST_POLL_MS = 10_000;
(async function main() {
  await sleep(30_000);
  let lastFullTick = 0;
  while (true) {
    try {
      const now = Date.now();
      const checkNow = existsSync(CHECK_NOW_FILE);
      const pushPending = existsSync(PUSH_FILE);
      const reconfigure = existsSync(RECONFIGURE_FILE);
      const due = now - lastFullTick >= TICK_MS;

      // Highest priority: hot-reconfigure cms-frontend (slug/name change)
      if (reconfigure) {
        try { unlinkSync(RECONFIGURE_FILE); } catch {}
        log("info", "reconfigure.frontend.start");
        const env = readEnv();
        const localDomain = envValue(env.LOCAL_DOMAIN);
        const localApiUrl = localDomain ? `https://${localDomain}/api` : "";
        if (!localDomain || localApiUrl.includes("supabase.co")) {
          log("error", "reconfigure.frontend.invalid_local_domain", { localDomain, localApiUrl });
        } else {
          run("docker", ["image", "rm", "-f", `cms-frontend:${envValue(env.FRONTEND_VERSION) || "local"}`, "cms-frontend:local"]);
          const b = compose(["build", "--no-cache", "cms-frontend"]);
          const r = b.code === 0 ? compose(["up", "-d", "--force-recreate", "cms-frontend", "nginx"]) : b;
          log(r.code === 0 ? "info" : "error", "reconfigure.frontend.done",
              { code: r.code, localApiUrl, out: r.out.slice(-400) });
        }
      }

      if (checkNow || pushPending || due) {
        if (checkNow) { try { unlinkSync(CHECK_NOW_FILE); } catch {}
          log("info", "tick.triggered_by_check_now"); }
        await tick();
        lastFullTick = now;
      }
    } catch (e) { log("error", "tick.crash", { err: String(e?.message ?? e) }); }
    await sleep(FAST_POLL_MS);
  }
})();

process.on("SIGTERM", () => { log("info", "updater.stop"); process.exit(0); });
