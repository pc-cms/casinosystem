#!/usr/bin/env node
/**
 * pair-cli.js — direct-DB pairing CLI for cms-sync container.
 *
 * Bypasses HTTP auth (super_admin Bearer) by running INSIDE the cms-sync
 * container, talking to local Postgres + Cloud register-local-server endpoint
 * directly. Used by /pair.sh one-shot installer.
 *
 * Commands:
 *   start            register on Cloud, print pairing_code, store in cloud_connection
 *   poll             poll Cloud once → exits 0 (connected) | 2 (still pending) | 3 (rejected/expired)
 *   wait [seconds]   poll loop until connected or timeout (default 900s = 15min)
 *   sync             trigger initial-sync-trigger on Cloud (must be connected)
 *   status           print current cloud_connection row
 *
 * Env required (already set in cms-sync container):
 *   LOCAL_DB_URL, CLOUD_URL, CLOUD_ANON_KEY (optional, has fallback)
 */
import pg from "pg";
import os from "node:os";

const { LOCAL_DB_URL, CLOUD_URL: ENV_CLOUD_URL } = process.env;
const CLOUD_ANON_KEY =
  process.env.CLOUD_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZWhuZ2p2d2NuaXB2a291bHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTcwMjAsImV4cCI6MjA5MDI3MzAyMH0.KTJEJRCYpNjj51H28x3pYFLvfMz5qtRjxnUFw3Hnwr0";

if (!LOCAL_DB_URL) {
  console.error("FATAL: LOCAL_DB_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: LOCAL_DB_URL });

const cloudHeaders = {
  "Content-Type": "application/json",
  apikey: CLOUD_ANON_KEY,
  Authorization: `Bearer ${CLOUD_ANON_KEY}`,
};

async function getRow() {
  const { rows } = await pool.query(`SELECT * FROM public.cloud_connection WHERE id = 1`);
  return rows[0] || null;
}

async function ensureRow() {
  await pool.query(`INSERT INTO public.cloud_connection (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
}

async function start(cloudUrl) {
  await ensureRow();
  const payload = {
    server_name: process.env.CASINO_NAME || os.hostname(),
    server_slug: process.env.CASINO_SLUG || null,
    server_ip: process.env.LOCAL_IP || null,
    hostname: os.hostname(),
    system_info: {
      ram_gb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      platform: os.platform(),
      release: os.release(),
    },
  };
  const r = await fetch(`${cloudUrl}/functions/v1/register-local-server`, {
    method: "POST",
    headers: cloudHeaders,
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.pairing_code) {
    throw new Error(`Cloud register failed: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  }
  await pool.query(
    `UPDATE public.cloud_connection
       SET cloud_url = $1, status = 'pairing', pairing_id = $2, pairing_code = $3,
           pairing_expires_at = $4, casino_id = NULL, sync_secret = NULL,
           connected_at = NULL, last_polled_at = now(), last_error = NULL
     WHERE id = 1`,
    [cloudUrl, j.id, j.pairing_code, j.expires_at]
  );
  return { pairing_code: j.pairing_code, expires_at: j.expires_at };
}

async function pollOnce() {
  const row = await getRow();
  if (!row) return { status: "disconnected" };
  if (row.status === "connected") return { status: "connected", casino_id: row.casino_id };
  if (row.status !== "pairing" || !row.pairing_code) return { status: row.status };

  const r = await fetch(
    `${row.cloud_url}/functions/v1/register-local-server?code=${row.pairing_code}`,
    { headers: cloudHeaders }
  );
  const j = await r.json().catch(() => ({}));
  await pool.query(`UPDATE public.cloud_connection SET last_polled_at = now() WHERE id = 1`);

  if (j.status === "approved" && j.casino_id && j.sync_secret) {
    await pool.query(
      `UPDATE public.cloud_connection
         SET status = 'connected', casino_id = $1, sync_secret = $2,
             connected_at = now(), pairing_code = NULL, pairing_expires_at = NULL,
             last_error = NULL
       WHERE id = 1`,
      [j.casino_id, j.sync_secret]
    );
    return { status: "connected", casino_id: j.casino_id };
  }
  if (j.status === "rejected" || j.status === "expired") {
    await pool.query(
      `UPDATE public.cloud_connection
         SET status = 'disconnected', pairing_code = NULL, pairing_expires_at = NULL,
             last_error = $1
       WHERE id = 1`,
      [j.status]
    );
    return { status: j.status };
  }
  return { status: j.status || "pairing" };
}

async function wait(seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const r = await pollOnce();
    if (r.status === "connected") return r;
    if (r.status === "rejected" || r.status === "expired") return r;
    await new Promise((res) => setTimeout(res, 5000));
  }
  return { status: "timeout" };
}

async function triggerSync() {
  const row = await getRow();
  if (!row || row.status !== "connected") throw new Error("Not connected to Cloud");
  const r = await fetch(`${row.cloud_url}/functions/v1/initial-sync-trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": row.sync_secret,
      "x-casino-id": row.casino_id,
    },
    body: JSON.stringify({ casino_id: row.casino_id }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`initial-sync-trigger ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return { ok: true, job: j.job ?? null };
}

const cmd = process.argv[2];
const arg = process.argv[3];

(async () => {
  try {
    if (cmd === "start") {
      const cloudUrl = (arg || ENV_CLOUD_URL || "").replace(/\/$/, "");
      if (!/^https?:\/\//.test(cloudUrl)) throw new Error("usage: start <cloud_url>");
      const r = await start(cloudUrl);
      console.log(JSON.stringify(r));
      process.exit(0);
    }
    if (cmd === "poll") {
      const r = await pollOnce();
      console.log(JSON.stringify(r));
      if (r.status === "connected") process.exit(0);
      if (r.status === "rejected" || r.status === "expired") process.exit(3);
      process.exit(2);
    }
    if (cmd === "wait") {
      const secs = parseInt(arg || "900", 10);
      const r = await wait(secs);
      console.log(JSON.stringify(r));
      process.exit(r.status === "connected" ? 0 : (r.status === "timeout" ? 4 : 3));
    }
    if (cmd === "sync") {
      const r = await triggerSync();
      console.log(JSON.stringify(r));
      process.exit(0);
    }
    if (cmd === "status") {
      const row = await getRow();
      console.log(JSON.stringify(row));
      process.exit(0);
    }
    console.error("usage: pair-cli.js {start <cloud_url>|poll|wait [seconds]|sync|status}");
    process.exit(1);
  } catch (e) {
    console.error(`ERROR: ${e?.message || e}`);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
})();
