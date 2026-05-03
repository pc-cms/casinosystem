#!/usr/bin/env node
/**
 * seed-import.js — поточный импорт NDJSON-дампа из cloud-seed-export
 *                  в локальный PostgreSQL.
 *
 * Запускается из install.sh так:
 *   curl -fsSL "$CLOUD/functions/v1/cloud-seed-export?casino_id=$ID" \
 *     -H "x-service-key: $KEY" \
 *   | docker run --rm -i --network=host \
 *       -e PGHOST=localhost -e PGUSER=... -e PGPASSWORD=... -e PGDATABASE=postgres \
 *       node:20-alpine sh -c "npm i -g pg && node /seed-import.js"
 *
 * Каждая строка — один из:
 *   {"_meta":{...}}            — служебное, логируем
 *   {"table":"X","row":{...}}  — INSERT INTO X ... ON CONFLICT (id) DO NOTHING
 *   {"_error":{...}}           — пропускаем с warning
 *   {"_done":true,"counts":..} — финальная статистика
 *
 * После успешного завершения:
 *   • выставляет sync.cloud_cursor.last_pulled_at = NOW() для casino_id
 *     из _meta, чтобы cms-sync не дублировал импортированные строки.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import pkg from "pg";
const { Client } = pkg;

const SOURCE = process.argv[2] || "/dev/stdin";

const pg = new Client({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432", 10),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || "postgres",
});

const log = (m, x) => console.log(`[seed] ${m}`, x ?? "");
const warn = (m, x) => console.warn(`[seed] ⚠ ${m}`, x ?? "");

function buildInsert(table, row) {
  const cols = Object.keys(row);
  if (cols.length === 0) return null;
  const params = cols.map((_, i) => `$${i + 1}`).join(",");
  const vals = cols.map((c) => {
    const v = row[c];
    // Postgres-driver сам сериализует Date/JSON, но JSON-объекты надо привести к JSON-строке.
    if (v !== null && typeof v === "object" && !Array.isArray(v)) return JSON.stringify(v);
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return JSON.stringify(v);
    return v;
  });
  // Все таблицы имеют PK = id (UUID). Если нет — упадём; статистика покажет пробел.
  const sql = `INSERT INTO public."${table}" (${cols.map((c) => `"${c}"`).join(",")})
               VALUES (${params})
               ON CONFLICT DO NOTHING`;
  return { sql, vals };
}

async function main() {
  await pg.connect();
  log("connected to postgres");

  // Отключаем триггеры на время импорта, чтобы не плодить outbox-события
  // (мы импортируем "из Cloud" — события уже там).
  await pg.query("SET session_replication_role = 'replica'");
  log("triggers disabled for seed import (session_replication_role=replica)");

  const stream = SOURCE === "/dev/stdin" ? process.stdin : createReadStream(SOURCE);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  const counts = {};
  const errors = {};
  let casinoId = null;
  let rowsTotal = 0;
  let lastLog = Date.now();

  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { warn("bad json line", line.slice(0, 80)); continue; }

    if (obj._meta) {
      casinoId = obj._meta.casino_id;
      log(`meta: casino_id=${casinoId}, since_days=${obj._meta.since_days}, tables=${obj._meta.tables.length}`);
      continue;
    }
    if (obj._error) { warn(`server error in ${obj._error.table}:`, obj._error.msg); continue; }
    if (obj._fatal) { warn(`server FATAL:`, obj._fatal); continue; }
    if (obj._done) {
      log("server signalled _done, counts from server:", JSON.stringify(obj.counts));
      continue;
    }
    if (!obj.table || !obj.row) continue;

    const ins = buildInsert(obj.table, obj.row);
    if (!ins) continue;

    try {
      const r = await pg.query(ins.sql, ins.vals);
      counts[obj.table] = (counts[obj.table] || 0) + (r.rowCount || 0);
      rowsTotal++;
      if (Date.now() - lastLog > 2000) {
        log(`progress: ${rowsTotal} rows imported`);
        lastLog = Date.now();
      }
    } catch (e) {
      const k = `${obj.table}: ${e.code || ""} ${e.message?.slice(0, 80) || e}`;
      errors[k] = (errors[k] || 0) + 1;
    }
  }

  // Включаем триггеры обратно
  await pg.query("SET session_replication_role = 'origin'");
  log("triggers re-enabled");

  // Двигаем sync.cloud_cursor → cms-sync пропустит уже импортированное.
  if (casinoId) {
    try {
      await pg.query(
        `INSERT INTO sync.cloud_cursor (casino_id, last_pulled_at)
         VALUES ($1, NOW())
         ON CONFLICT (casino_id) DO UPDATE SET last_pulled_at = EXCLUDED.last_pulled_at`,
        [casinoId]
      );
      log(`sync.cloud_cursor advanced to NOW() for casino ${casinoId}`);
    } catch (e) {
      warn(`could not advance cloud_cursor:`, e.message);
    }
  }

  console.log("\n[seed] ───── DONE ─────");
  console.log("[seed] inserted by table:");
  for (const [t, n] of Object.entries(counts).sort()) console.log(`  ${t.padEnd(35)} ${n}`);
  if (Object.keys(errors).length > 0) {
    console.log("\n[seed] errors (collapsed):");
    for (const [k, n] of Object.entries(errors)) console.log(`  ×${n}  ${k}`);
  }
  console.log(`\n[seed] total rows imported: ${rowsTotal}`);

  await pg.end();
}

main().catch((e) => { console.error("[seed] FATAL:", e); process.exit(1); });
