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

const {
  LOCAL_DB_URL,
  CLOUD_URL,
  CASINO_ID,
  SYNC_SECRET,
  SYNC_BATCH_SIZE = "200",
  SYNC_INTERVAL_MS = "5000",
  SYNC_BACKOFF_MAX_MS = "60000",
} = process.env;

if (!LOCAL_DB_URL || !CLOUD_URL || !CASINO_ID || !SYNC_SECRET) {
  console.error("[cms-sync] FATAL: missing env (LOCAL_DB_URL/CLOUD_URL/CASINO_ID/SYNC_SECRET)");
  process.exit(1);
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
  const client = await pool.connect();
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

log("info", "sync.start", { casino_id: CASINO_ID, cloud: CLOUD_URL, batch: BATCH, tick_ms: TICK_MS });

Promise.all([
  loop("push", pushOnce, () => pushBackoff, (v) => (pushBackoff = v)),
  loop("pull", pullOnce, () => pullBackoff, (v) => (pullBackoff = v)),
  gcLoop(),
]).catch((e) => {
  log("error", "sync.crash", { err: String(e) });
  process.exit(1);
});

process.on("SIGTERM", () => {
  log("info", "sync.stop");
  pool.end().finally(() => process.exit(0));
});
