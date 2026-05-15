/**
 * cms-sync — local HTTP API for Cloud connection management.
 * Mounted by index.js as a small Node http server on port 8787.
 *
 * Reachable from the local frontend through nginx as `/api/cloud/*`.
 *
 * All routes require the caller to be a super_admin of the local server:
 * the local PostgREST JWT (Bearer) is verified against gotrue and the user's
 * role is checked in public.user_roles.
 *
 * Routes:
 *   GET  /cloud/status                       → current cloud_connection row
 *   POST /cloud/start-pairing { cloud_url }  → register on Cloud, store pairing_code
 *   POST /cloud/poll-pairing                 → check Cloud for approval
 *   POST /cloud/disconnect                   → wipe the cloud_connection row
 *   POST /cloud/initial-sync                 → ask Cloud to enqueue initial-sync job
 */
import http from "node:http";

const GOTRUE_URL = process.env.GOTRUE_URL || "http://gotrue:9999";

export function startApi({ pool, getCreds, setCreds }) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      // Auth (skip for OPTIONS)
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.statusCode = 204;
        return res.end();
      }

      const auth = req.headers["authorization"] || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      if (!token) return send(res, 401, { error: "missing token" });

      const userId = await verifySuperAdmin(pool, token);
      if (!userId) return send(res, 403, { error: "super_admin required" });

      const url = new URL(req.url, "http://x");
      const body = await readBody(req);

      if (req.method === "GET" && url.pathname === "/cloud/status") {
        const row = await getRow(pool);
        return send(res, 200, { connection: row });
      }

      if (req.method === "POST" && url.pathname === "/cloud/start-pairing") {
        const cloud_url = String(body.cloud_url || "").replace(/\/$/, "");
        if (!/^https?:\/\//.test(cloud_url)) return send(res, 400, { error: "invalid cloud_url" });
        const r = await startPairing(pool, cloud_url);
        return send(res, 200, r);
      }

      if (req.method === "POST" && url.pathname === "/cloud/poll-pairing") {
        const r = await pollPairing(pool, setCreds);
        return send(res, 200, r);
      }

      if (req.method === "POST" && url.pathname === "/cloud/disconnect") {
        await disconnect(pool, setCreds);
        return send(res, 200, { ok: true });
      }

      if (req.method === "POST" && url.pathname === "/cloud/initial-sync") {
        const r = await triggerInitialSync(getCreds());
        return send(res, 200, r);
      }

      return send(res, 404, { error: "unknown route" });
    } catch (e) {
      return send(res, 500, { error: String(e?.message || e) });
    }
  });
  server.listen(8787, "0.0.0.0", () => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), lvl: "info", msg: "api.listen", port: 8787 }));
  });
  return server;
}

const send = (res, code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };

function readBody(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); } });
  });
}

async function verifySuperAdmin(pool, token) {
  // 1) ask gotrue who this is
  let userId = null;
  try {
    const r = await fetch(`${GOTRUE_URL}/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    userId = j?.id;
  } catch { return null; }
  if (!userId) return null;
  // 2) verify role
  const { rows } = await pool.query(
    `SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'super_admin' LIMIT 1`,
    [userId]
  );
  return rows.length ? userId : null;
}

async function getRow(pool) {
  const { rows } = await pool.query(`SELECT * FROM public.cloud_connection WHERE id = 1`);
  return rows[0] || null;
}

const CLOUD_ANON_KEY = process.env.CLOUD_ANON_KEY ||
  // Fallback to the published anon key — installer also writes it to env.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZWhuZ2p2d2NuaXB2a291bHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTcwMjAsImV4cCI6MjA5MDI3MzAyMH0.KTJEJRCYpNjj51H28x3pYFLvfMz5qtRjxnUFw3Hnwr0";

async function getCloudHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: CLOUD_ANON_KEY,
    Authorization: `Bearer ${CLOUD_ANON_KEY}`,
  };
}

async function startPairing(pool, cloud_url) {
  const os = await import("node:os");
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
  const r = await fetch(`${cloud_url}/functions/v1/register-local-server`, {
    method: "POST",
    headers: await getCloudHeaders(),
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.pairing_code) {
    throw new Error(`Cloud register failed: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  }
  await pool.query(
    `UPDATE public.cloud_connection
       SET cloud_url = $1, status = 'pairing', pairing_id = $2, pairing_code = $3,
           pairing_expires_at = $4, casino_id = NULL, sync_secret = NULL,
           connected_at = NULL, last_polled_at = now(), last_error = NULL
     WHERE id = 1`,
    [cloud_url, j.id, j.pairing_code, j.expires_at]
  );
  return { pairing_code: j.pairing_code, expires_at: j.expires_at };
}

async function pollPairing(pool, setCreds) {
  const row = await getRow(pool);
  if (!row || row.status !== "pairing" || !row.pairing_code) {
    return { status: row?.status || "disconnected" };
  }
  const r = await fetch(
    `${row.cloud_url}/functions/v1/register-local-server?code=${row.pairing_code}`,
    { headers: await getCloudHeaders() }
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
    setCreds({ cloudUrl: row.cloud_url, casinoId: j.casino_id, syncSecret: j.sync_secret });
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

async function disconnect(pool, setCreds) {
  await pool.query(
    `UPDATE public.cloud_connection
       SET status = 'disconnected', cloud_url = NULL, pairing_id = NULL,
           pairing_code = NULL, pairing_expires_at = NULL, casino_id = NULL,
           sync_secret = NULL, connected_at = NULL, last_error = NULL
     WHERE id = 1`
  );
  setCreds(null);
}

async function triggerInitialSync(creds) {
  if (!creds?.cloudUrl || !creds?.casinoId || !creds?.syncSecret) {
    throw new Error("Not connected to Cloud");
  }
  const r = await fetch(`${creds.cloudUrl}/functions/v1/initial-sync-trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": creds.syncSecret,
      "x-casino-id": creds.casinoId,
    },
    body: JSON.stringify({ casino_id: creds.casinoId }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`initial-sync-trigger ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return { ok: true, job: j.job ?? null };
}
