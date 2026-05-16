#!/usr/bin/env node
/**
 * cms-updater — auto-update cms-frontend from GitHub Releases.
 * ────────────────────────────────────────────────────────────
 * Каждые CHECK_INTERVAL_MINUTES опрашивает
 *   https://api.github.com/repos/${OWNER}/${REPO}/releases/latest
 * и сравнивает tag_name с FRONTEND_VERSION (из .env).
 *
 * Если новее:
 *   1. Проверяет интернет (api.github.com доступен).
 *   2. docker pull нового образа (если pull упал → лог + следующий цикл).
 *   3. Если AUTO_APPLY=true:
 *        - сохраняет PREVIOUS_VERSION = текущую
 *        - правит FRONTEND_VERSION в .env
 *        - docker compose up -d cms-frontend nginx
 *        - health-check https://localhost/health (через nginx) 30 с
 *        - при failure: rollback FRONTEND_VERSION → PREVIOUS_VERSION + restart
 *      Если AUTO_APPLY=false: только пишет в /compose/UPDATE_AVAILABLE
 *      (админ запустит install.sh --upgrade-to <version> вручную).
 *
 * Все события — в /compose/updater.log (json lines).
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, appendFileSync, unlinkSync } from "node:fs";

const {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_TOKEN,
  FRONTEND_VERSION = "latest",
  CHECK_INTERVAL_MINUTES = "60",
  AUTO_APPLY = "false",
  COMPOSE_PROJECT_DIR = "/compose",
  ENV_FILE = "/compose/.env",
} = process.env;

const TICK_MS = Math.max(parseInt(CHECK_INTERVAL_MINUTES, 10), 5) * 60 * 1000;
const LOG_FILE = `${COMPOSE_PROJECT_DIR}/updater.log`;
const FLAG_FILE = `${COMPOSE_PROJECT_DIR}/UPDATE_AVAILABLE`;
const PUSH_FILE = `${COMPOSE_PROJECT_DIR}/PUSH_COMMAND.json`;
const ACK_FILE = `${COMPOSE_PROJECT_DIR}/PUSH_COMMAND_ACK.json`;
const HEALTH_URL = "https://nginx/healthz";
const HEALTH_TIMEOUT_S = 30;

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
  const txt = readFileSync(ENV_FILE, "utf8");
  const out = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeEnvKey(key, value) {
  let txt = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(txt)) {
    txt = txt.replace(re, `${key}=${value}`);
  } else {
    if (!txt.endsWith("\n")) txt += "\n";
    txt += `${key}=${value}\n`;
  }
  writeFileSync(ENV_FILE, txt);
}

function compose(args) {
  const r = spawnSync("docker", ["compose", "-f", `${COMPOSE_PROJECT_DIR}/docker-compose.yml`, "--env-file", ENV_FILE, ...args], {
    cwd: COMPOSE_PROJECT_DIR,
    encoding: "utf8",
  });
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
}

function dockerPull(image) {
  const r = spawnSync("docker", ["pull", image], { encoding: "utf8" });
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
}

async function checkInternet() {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch("https://api.github.com", { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

async function fetchLatestTag() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  const headers = { "User-Agent": "cms-updater" };
  if (GITHUB_TOKEN && GITHUB_TOKEN !== "ghp_replace_me") {
    headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const body = await res.json();
  if (!body.tag_name) throw new Error("no tag_name in release");
  return String(body.tag_name).replace(/^v/, "");
}

function isNewer(latest, current) {
  if (current === "latest") return latest !== "latest";
  const a = latest.split(".").map((x) => parseInt(x, 10) || 0);
  const b = current.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

async function healthCheck() {
  const deadline = Date.now() + HEALTH_TIMEOUT_S * 1000;
  while (Date.now() < deadline) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 3000);
      // -k: self-signed CA локальный
      const r = spawnSync("curl", ["-skf", "--max-time", "3", HEALTH_URL], { encoding: "utf8" });
      clearTimeout(t);
      if (r.status === 0) return true;
    } catch {}
    await sleep(2000);
  }
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function writeAck(cmdId, status, message) {
  try {
    writeFileSync(ACK_FILE, JSON.stringify({ command_id: cmdId, status, message: message ?? null, ts: new Date().toISOString() }, null, 2));
  } catch (e) { log("error", "ack.write_fail", { err: String(e?.message ?? e) }); }
}

function readPushCommand() {
  if (!existsSync(PUSH_FILE)) return null;
  try { return JSON.parse(readFileSync(PUSH_FILE, "utf8")); } catch { return null; }
}

async function applyVersion(target, autoApply, cmdId) {
  const env = readEnv();
  const owner = env.GITHUB_OWNER || GITHUB_OWNER;
  const image = `ghcr.io/${owner}/cms-frontend:${target}`;
  const pull = dockerPull(image);
  if (pull.code !== 0) {
    log("error", "push.pull_fail", { image, out: pull.out.slice(0, 500) });
    if (cmdId) writeAck(cmdId, "failed", `pull failed: ${pull.out.slice(0, 200)}`);
    return false;
  }
  log("info", "push.pull_ok", { image });

  if (cmdId) writeAck(cmdId, "acknowledged", `pulled ${image}`);

  if (!autoApply) {
    writeFileSync(FLAG_FILE, JSON.stringify({ available: target, image, push: true, ts: new Date().toISOString() }, null, 2));
    log("info", "push.flag_written", { target });
    return true;
  }

  const current = (env.FRONTEND_VERSION || FRONTEND_VERSION || "latest").replace(/^v/, "");
  writeEnvKey("PREVIOUS_VERSION", current);
  writeEnvKey("FRONTEND_VERSION", target);
  const up = compose(["up", "-d", "cms-frontend", "nginx"]);
  if (up.code !== 0) {
    log("error", "push.compose_fail", { out: up.out.slice(0, 500) });
    rollback(current);
    if (cmdId) writeAck(cmdId, "failed", `compose up failed`);
    return false;
  }
  if (!(await healthCheck())) {
    rollback(current);
    if (cmdId) writeAck(cmdId, "failed", `healthcheck failed`);
    return false;
  }
  log("info", "push.applied", { from: current, to: target });
  if (cmdId) writeAck(cmdId, "applied", `version ${target}`);
  try { unlinkSync(PUSH_FILE); } catch {}
  return true;
}

async function tick() {
  log("info", "tick.start");

  // 1) Check pushed command first (Cloud admin push). Always processed even offline-from-GitHub.
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
      const autoApply = cmd.auto_apply === true || AUTO_APPLY === "true";
      log("info", "push.process", { target, autoApply, current });
      await applyVersion(target, autoApply, cmd.id);
    }
    return;
  }

  if (!(await checkInternet())) {
    log("warn", "no_internet");
    return;
  }

  let latest;
  try {
    latest = await fetchLatestTag();
  } catch (e) {
    log("error", "fetch_releases.fail", { err: String(e?.message ?? e) });
    return;
  }

  const env = readEnv();
  const current = (env.FRONTEND_VERSION || FRONTEND_VERSION || "latest").replace(/^v/, "");

  if (!isNewer(latest, current)) {
    log("info", "up_to_date", { current, latest });
    return;
  }

  log("info", "update_available", { current, latest, auto_apply: AUTO_APPLY });

  // Pre-pull новый image (валидируем что он реально есть в registry)
  const owner = env.GITHUB_OWNER || GITHUB_OWNER;
  const image = `ghcr.io/${owner}/cms-frontend:${latest}`;
  const pull = dockerPull(image);
  if (pull.code !== 0) {
    log("error", "pull.fail", { image, out: pull.out.slice(0, 500) });
    return;
  }
  log("info", "pull.ok", { image });

  if (AUTO_APPLY !== "true") {
    // Просто сообщаем админу
    writeFileSync(FLAG_FILE, JSON.stringify({ available: latest, current, image, ts: new Date().toISOString() }, null, 2));
    log("info", "flag.written", { flag: FLAG_FILE });
    return;
  }

  // ─── AUTO APPLY ───
  log("info", "apply.start", { from: current, to: latest });
  writeEnvKey("PREVIOUS_VERSION", current);
  writeEnvKey("FRONTEND_VERSION", latest);

  const up = compose(["up", "-d", "cms-frontend", "nginx"]);
  if (up.code !== 0) {
    log("error", "compose_up.fail", { out: up.out.slice(0, 500) });
    rollback(current);
    return;
  }

  const healthy = await healthCheck();
  if (!healthy) {
    log("error", "healthcheck.fail", { url: HEALTH_URL, timeout_s: HEALTH_TIMEOUT_S });
    rollback(current);
    return;
  }

  log("info", "apply.ok", { version: latest });
  try { writeFileSync(FLAG_FILE, JSON.stringify({ applied: latest, ts: new Date().toISOString() }, null, 2)); } catch {}
}

function rollback(prev) {
  log("warn", "rollback.start", { to: prev });
  writeEnvKey("FRONTEND_VERSION", prev);
  const r = compose(["up", "-d", "cms-frontend", "nginx"]);
  log(r.code === 0 ? "warn" : "error", "rollback.done", { code: r.code, out: r.out.slice(0, 500) });
}

// ───────────── loop ─────────────
log("info", "updater.start", {
  owner: GITHUB_OWNER, repo: GITHUB_REPO,
  interval_min: CHECK_INTERVAL_MINUTES, auto_apply: AUTO_APPLY,
});

const CHECK_NOW_FILE = `${COMPOSE_PROJECT_DIR}/CHECK_NOW`;
const FAST_POLL_MS = 10_000;

(async function main() {
  // первая проверка через 30 сек (даём стеку прогреться)
  await sleep(30_000);
  let lastFullTick = 0;
  while (true) {
    try {
      const now = Date.now();
      const checkNow = existsSync(CHECK_NOW_FILE);
      const pushPending = existsSync(PUSH_FILE);
      const due = now - lastFullTick >= TICK_MS;

      if (checkNow || pushPending || due) {
        if (checkNow) { try { unlinkSync(CHECK_NOW_FILE); } catch {} log("info", "tick.triggered_by_check_now"); }
        await tick();
        lastFullTick = now;
      }
    } catch (e) {
      log("error", "tick.crash", { err: String(e?.message ?? e) });
    }
    await sleep(FAST_POLL_MS);
  }
})();

process.on("SIGTERM", () => { log("info", "updater.stop"); process.exit(0); });
