#!/usr/bin/env node
/**
 * verify.js — CLI round-trip mirror probe.
 *
 * Usage (inside cms-sync container):
 *   node /app/verify.js              # send probe + wait up to 90s
 *
 * Exit codes:
 *   0  round-trip OK
 *   1  no echo back within timeout
 *   2  no Cloud peer or DB error
 *
 * Mechanism:
 *   1. INSERT into public.sync_probes (origin = this node, status='sent').
 *   2. cms-sync push picks up the row via sync_outbox trigger → Cloud receives it.
 *   3. Cloud peer-mesh /probe stamps echoed_at and emits back into sync_outbox.
 *   4. cms-sync pull applies the update → local row receives received_back_at.
 *   5. We poll for received_back_at every 2s.
 */
import pg from "pg";
import crypto from "node:crypto";

const { LOCAL_DB_URL } = process.env;
if (!LOCAL_DB_URL) { console.error("missing LOCAL_DB_URL"); process.exit(2); }

const pool = new pg.Pool({ connectionString: LOCAL_DB_URL, max: 2 });
const TIMEOUT_MS = 90_000;
const POLL_MS = 2_000;

async function main() {
  const { rows: idRows } = await pool.query(
    `SELECT node_id, display_name FROM public.node_identity WHERE id = true`
  );
  if (!idRows.length) { console.error("no node_identity row"); process.exit(2); }
  const { node_id, display_name } = idRows[0];

  const { rows: peers } = await pool.query(
    `SELECT id, display_name FROM public.peer_links WHERE status='active' AND peer_node_id IS NOT NULL`
  );
  if (peers.length === 0) { console.error("no active peers"); process.exit(2); }

  const probeId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO public.sync_probes (id, origin_casino_id, origin_slug, status)
     VALUES ($1, $2::uuid, $3, 'sent')`,
    [probeId,
      "00000000-0000-0000-0000-0000000000ca",
      display_name || "local"]
  );
  console.log(JSON.stringify({ event: "probe.sent", probe_id: probeId, node: display_name, peers: peers.map(p => p.display_name) }));

  const t0 = Date.now();
  while (Date.now() - t0 < TIMEOUT_MS) {
    const { rows } = await pool.query(
      `SELECT status, echoed_at, received_back_at, latency_ms FROM public.sync_probes WHERE id = $1`,
      [probeId]
    );
    const r = rows[0];
    if (r?.received_back_at) {
      console.log(JSON.stringify({ event: "probe.ok", probe_id: probeId, latency_ms: r.latency_ms, echoed_at: r.echoed_at, received_back_at: r.received_back_at }));
      await pool.end();
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  console.error(JSON.stringify({ event: "probe.timeout", probe_id: probeId, waited_ms: TIMEOUT_MS }));
  await pool.end();
  process.exit(1);
}

main().catch((e) => { console.error(JSON.stringify({ event: "probe.crash", err: String(e?.message ?? e) })); process.exit(2); });
