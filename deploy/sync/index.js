#!/usr/bin/env node
/**
 * cms-sync — bidirectional sync worker
 * ─────────────────────────────────────
 * PUSH:  читает sync.outbox → POST в Cloud edge function `pull-changes`
 *        → помечает строки sent_at=now()
 * PULL:  GET с курсором → upsert в локальные таблицы под GUC sync.applying='on'
 *        чтобы не зациклить outbox.
 *
 * Конфигурация через env (см. docker-compose.yml):
 *   LOCAL_DB_URL, CLOUD_URL, CASINO_ID, SYNC_SECRET
 *   SYNC_BATCH_SIZE (default 200)
 *   SYNC_INTERVAL_MS (default 5000)
 *   SYNC_BACKOFF_MAX_MS (default 60000)
 */
import pg from "pg";
import { startApi } from "./api.js";

const {
  LOCAL_DB_URL,
  SYNC_MODE = "hybrid",
  SYNC_BATCH_SIZE = "200",
  SYNC_INTERVAL_MS = "5000",
  SYNC_BACKOFF_MAX_MS = "60000",
} = process.env;

if (!LOCAL_DB_URL) {
  console.error("[cms-sync] FATAL: missing LOCAL_DB_URL");
  process.exit(1);
}

// Cloud creds are read from the public.cloud_connection table at runtime
// and refreshed every tick. While `connected` is false, push/pull/jobLoop idle.
let CLOUD_URL = process.env.CLOUD_URL || null;
let CASINO_ID = process.env.CASINO_ID || null;
let SYNC_SECRET = process.env.SYNC_SECRET || null;
let CONNECTED = false;

async function refreshCreds(client) {
  try {
    const { rows } = await client.query(
      `SELECT cloud_url, status, casino_id, sync_secret FROM public.cloud_connection WHERE id = 1`
    );
    const row = rows[0];
    if (row && row.status === "connected" && row.casino_id && row.sync_secret) {
      CLOUD_URL = row.cloud_url || CLOUD_URL;
      CASINO_ID = row.casino_id;
      SYNC_SECRET = row.sync_secret;
      CONNECTED = true;
    } else {
      CONNECTED = false;
    }
  } catch {
    // table may not exist on first boot before migrations applied — stay idle
    CONNECTED = false;
  }
}

function setCredsInMemory(creds) {
  if (!creds) {
    CLOUD_URL = process.env.CLOUD_URL || null;
    CASINO_ID = null;
    SYNC_SECRET = null;
    CONNECTED = false;
    return;
  }
  CLOUD_URL = creds.cloudUrl;
  CASINO_ID = creds.casinoId;
  SYNC_SECRET = creds.syncSecret;
  CONNECTED = true;
}

if (SYNC_MODE === "standalone") {
  console.log("[cms-sync] SYNC_MODE=standalone → push/pull disabled");
}

const BATCH = parseInt(SYNC_BATCH_SIZE, 10);
const TICK_MS = parseInt(SYNC_INTERVAL_MS, 10);
const BACKOFF_MAX = parseInt(SYNC_BACKOFF_MAX_MS, 10);

const pool = new pg.Pool({ connectionString: LOCAL_DB_URL, max: 4 });

let pushBackoff = TICK_MS;
let pullBackoff = TICK_MS;

const log = (lvl, msg, extra) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), lvl, msg, ...extra }));

// ───────────── PUSH ─────────────
async function pushOnce() {
  if (!CONNECTED || SYNC_MODE === "standalone") return 0;
  const client = await pool.connect();
  try {
    await refreshCreds(client);
    if (!CONNECTED) return 0;
  try {
    const { rows } = await client.query(
      `SELECT id, casino_id, table_name, op, pk, payload, attempts
         FROM sync.outbox
        WHERE sent_at IS NULL
        ORDER BY id ASC
        LIMIT $1`,
      [BATCH]
    );
    if (rows.length === 0) return 0;

    const res = await fetch(`${CLOUD_URL}/functions/v1/pull-changes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": SYNC_SECRET,
        "x-casino-id": CASINO_ID,
      },
      body: JSON.stringify({
        casino_id: CASINO_ID,
        changes: rows.map((r) => ({
          local_id: r.id,
          table: r.table_name,
          op: r.op,
          pk: r.pk,
          payload: r.payload,
        })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`push HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const body = await res.json();
    const accepted = Array.isArray(body.accepted) ? body.accepted : rows.map((r) => r.id);

    await client.query(
      `UPDATE sync.outbox
          SET sent_at = now(), last_error = NULL
        WHERE id = ANY($1::bigint[])`,
      [accepted]
    );
    log("info", "push.ok", { count: accepted.length });
    return accepted.length;
  } finally {
    client.release();
  }
}

// ───────────── PULL ─────────────
async function pullOnce() {
  const client = await pool.connect();
  try {
    const { rows: c } = await client.query(
      `SELECT last_pulled_at FROM sync.cloud_cursor WHERE casino_id = $1`,
      [CASINO_ID]
    );
    const since = c[0]?.last_pulled_at?.toISOString() ?? "1970-01-01T00:00:00Z";

    const url = new URL(`${CLOUD_URL}/functions/v1/pull-changes`);
    url.searchParams.set("since", since);
    url.searchParams.set("limit", String(BATCH));

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-sync-secret": SYNC_SECRET,
        "x-casino-id": CASINO_ID,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`pull HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const { changes = [], next_since } = await res.json();
    if (changes.length === 0) {
      // курсор всё равно двигаем если сервер прислал next_since
      if (next_since) await bumpCursor(client, next_since);
      return 0;
    }

    await client.query("BEGIN");
    await client.query(`SELECT set_config('sync.applying','on', true)`);
    for (const ch of changes) {
      await applyChange(client, ch);
    }
    await bumpCursor(client, next_since ?? changes[changes.length - 1]?.changed_at);
    await client.query("COMMIT");
    log("info", "pull.ok", { count: changes.length });
    return changes.length;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function bumpCursor(client, ts) {
  if (!ts) return;
  await client.query(
    `INSERT INTO sync.cloud_cursor (casino_id, last_pulled_at)
       VALUES ($1, $2)
     ON CONFLICT (casino_id) DO UPDATE
       SET last_pulled_at = EXCLUDED.last_pulled_at,
           updated_at = now()`,
    [CASINO_ID, ts]
  );
}

async function applyChange(client, ch) {
  const { table, op, pk, payload } = ch;
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    log("warn", "apply.skip.bad_table", { table });
    return;
  }
  if (op === "DELETE") {
    await client.query(`DELETE FROM public.${table} WHERE id = $1`, [pk?.id]);
    return;
  }
  // INSERT / UPDATE → upsert
  const cols = Object.keys(payload);
  const vals = cols.map((_, i) => `$${i + 1}`);
  const updates = cols.filter((c) => c !== "id").map((c) => `${c} = EXCLUDED.${c}`);
  const sql = `
    INSERT INTO public.${table} (${cols.join(",")})
    VALUES (${vals.join(",")})
    ON CONFLICT (id) DO UPDATE SET ${updates.join(",")}`;
  await client.query(sql, cols.map((c) => payload[c]));
}

// ───────────── Loop ─────────────
async function loop(name, fn, getBackoff, setBackoff) {
  while (true) {
    try {
      const n = await fn();
      setBackoff(TICK_MS);
      await sleep(n > 0 ? 250 : TICK_MS); // если был батч — сразу ещё
    } catch (e) {
      const b = getBackoff();
      log("error", `${name}.fail`, { err: String(e?.message ?? e), backoff_ms: b });
      await sleep(b);
      setBackoff(Math.min(b * 2, BACKOFF_MAX));
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gcLoop() {
  while (true) {
    try {
      await pool.query(`SELECT sync.gc()`);
    } catch (e) {
      log("warn", "gc.fail", { err: String(e?.message ?? e) });
    }
    await sleep(60 * 60 * 1000); // hourly
  }
}

// ───────────── Initial Sync Job Poller ─────────────
// Поллит cloud-функцию initial-sync-trigger (GET) каждые 10 сек.
// Если найден pending job для этого казино — запускает full snapshot import
// через cloud-seed-export (NDJSON stream) с авторизацией по x-sync-secret.

let initialSyncBusy = false;

async function postJobUpdate(jobId, patch) {
  try {
    await fetch(`${CLOUD_URL}/functions/v1/initial-sync-trigger`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": SYNC_SECRET,
        "x-casino-id": CASINO_ID,
      },
      body: JSON.stringify({ job_id: jobId, ...patch }),
    });
  } catch (e) {
    log("warn", "job.patch.fail", { err: String(e?.message ?? e) });
  }
}

function buildSeedInsert(table, row) {
  const cols = Object.keys(row);
  if (cols.length === 0) return null;
  const params = cols.map((_, i) => `$${i + 1}`).join(",");
  const vals = cols.map((c) => {
    const v = row[c];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) return JSON.stringify(v);
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return JSON.stringify(v);
    return v;
  });
  const sql = `INSERT INTO public."${table}" (${cols.map((c) => `"${c}"`).join(",")})
               VALUES (${params})
               ON CONFLICT DO NOTHING`;
  return { sql, vals };
}

async function runInitialSync(job) {
  log("info", "initial-sync.start", { job_id: job.id });
  await postJobUpdate(job.id, { status: "running" });

  const client = await pool.connect();
  let rowsDone = 0;
  let tablesDone = 0;
  let currentTable = null;
  const tableCounts = {};
  const errors = {};
  let lastProgressAt = Date.now();

  try {
    // Disable triggers — мы импортируем "из Cloud", outbox-события не нужны.
    await client.query("SET session_replication_role = 'replica'");

    const res = await fetch(
      `${CLOUD_URL}/functions/v1/cloud-seed-export?days=all`,
      {
        method: "GET",
        headers: {
          "x-sync-secret": SYNC_SECRET,
          "x-casino-id": CASINO_ID,
          Accept: "application/x-ndjson",
        },
      }
    );
    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      throw new Error(`seed-export HTTP ${res.status}: ${txt.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    const handleLine = async (line) => {
      if (!line.trim()) return;
      let obj;
      try { obj = JSON.parse(line); } catch { return; }

      if (obj._meta) {
        await postJobUpdate(job.id, { tables_total: obj._meta.tables?.length ?? 0 });
        return;
      }
      if (obj._error || obj._fatal) {
        log("warn", "seed.server-error", { table: obj._error?.table, msg: obj._error?.msg ?? obj._fatal });
        return;
      }
      if (obj._done) return;
      if (!obj.table || !obj.row) return;

      if (currentTable !== obj.table) {
        if (currentTable !== null) tablesDone += 1;
        currentTable = obj.table;
        tableCounts[currentTable] = 0;
      }

      const ins = buildSeedInsert(obj.table, obj.row);
      if (!ins) return;
      try {
        await client.query(ins.sql, ins.vals);
        tableCounts[obj.table] += 1;
        rowsDone += 1;
      } catch (e) {
        const k = `${obj.table}: ${e.code || ""} ${(e.message || "").slice(0, 80)}`;
        errors[k] = (errors[k] || 0) + 1;
      }

      if (Date.now() - lastProgressAt > 2000) {
        lastProgressAt = Date.now();
        await postJobUpdate(job.id, {
          rows_done: rowsDone,
          tables_done: tablesDone,
          current_table: currentTable,
        });
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        await handleLine(line);
      }
    }
    if (buf.trim()) await handleLine(buf);

    if (currentTable !== null) tablesDone += 1;

    // Двигаем cloud_cursor → обычный pull не задублирует.
    await client.query(
      `INSERT INTO sync.cloud_cursor (casino_id, last_pulled_at)
       VALUES ($1, NOW())
       ON CONFLICT (casino_id) DO UPDATE SET last_pulled_at = EXCLUDED.last_pulled_at`,
      [CASINO_ID]
    );

    await postJobUpdate(job.id, {
      status: "done",
      rows_done: rowsDone,
      tables_done: tablesDone,
      current_table: null,
    });
    log("info", "initial-sync.done", { rows: rowsDone, tables: tablesDone, errors: Object.keys(errors).length });
  } catch (e) {
    log("error", "initial-sync.fail", { err: String(e?.message ?? e) });
    await postJobUpdate(job.id, {
      status: "failed",
      error: String(e?.message ?? e).slice(0, 500),
      rows_done: rowsDone,
      tables_done: tablesDone,
    });
  } finally {
    try { await client.query("SET session_replication_role = 'origin'"); } catch {}
    client.release();
  }
}

async function jobPollOnce() {
  if (initialSyncBusy) return;
  const res = await fetch(`${CLOUD_URL}/functions/v1/initial-sync-trigger`, {
    method: "GET",
    headers: { "x-sync-secret": SYNC_SECRET, "x-casino-id": CASINO_ID },
  });
  if (!res.ok) return;
  const { job } = await res.json();
  if (!job || job.status === "done" || job.status === "failed") return;
  if (job.status === "running") return; // уже стартовали (возможно, рестарт контейнера)
  initialSyncBusy = true;
  try { await runInitialSync(job); }
  finally { initialSyncBusy = false; }
}

async function jobLoop() {
  while (true) {
    try { await jobPollOnce(); }
    catch (e) { log("warn", "job.poll.fail", { err: String(e?.message ?? e) }); }
    await sleep(10_000);
  }
}

log("info", "sync.start", { casino_id: CASINO_ID, cloud: CLOUD_URL, batch: BATCH, tick_ms: TICK_MS });

Promise.all([
  loop("push", pushOnce, () => pushBackoff, (v) => (pushBackoff = v)),
  loop("pull", pullOnce, () => pullBackoff, (v) => (pullBackoff = v)),
  gcLoop(),
  jobLoop(),
]).catch((e) => {
  log("error", "sync.crash", { err: String(e) });
  process.exit(1);
});

process.on("SIGTERM", () => {
  log("info", "sync.stop");
  pool.end().finally(() => process.exit(0));
});
