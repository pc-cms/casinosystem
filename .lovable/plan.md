
# Autonomous Peer Mesh — Final Architecture

## The model (locked)

```text
            ┌──────────────┐         ┌──────────────┐
            │   LOCAL A    │ ◀─────▶ │   LOCAL B    │   ← mutual peer sync
            │  (Arusha)    │         │  (Mwanza)    │     no hub, no hierarchy
            │              │         │              │
            │ Full stack:  │         │ Full stack:  │
            │ Postgres +   │         │ Postgres +   │
            │ GoTrue +     │         │ GoTrue +     │
            │ PostgREST +  │         │ PostgREST +  │
            │ Storage +    │         │ Storage +    │
            │ Realtime +   │         │ Realtime +   │
            │ cms-sync     │         │ cms-sync     │
            └──────┬───────┘         └──────┬───────┘
                   │                        │
                   └───────────┬────────────┘
                               │  optional
                        ┌──────▼──────┐
                        │    CLOUD    │   ← just another peer
                        │  (optional) │     same protocol, no special role
                        └─────────────┘
```

**Axioms:**
1. **Every node is self-sufficient.** Installer ships a complete Supabase stack + frontend + DB schema. Disconnect ethernet — works for years.
2. **All peers are equal.** No primary, no replica. Cloud has zero special privileges.
3. **Casino-scoped writes.** Each node only writes rows where `casino_id = <own casino>`. Reading other casinos' rows is allowed (read-only mirror via sync).
4. **Conflict-free by design** for casino-scoped tables (no two nodes write same row).
5. **Global tables (Global Player Base, Blacklist, Categories)** use **last-write-wins by `updated_at` timestamp** on conflict.
6. **Failover = network-layer (VRRP/keepalived).** Two paired nodes share a virtual IP; if A dies, B takes the IP and frontends keep working without code changes.

---

## Installer (`install.sh` — what user runs once)

Single command on a fresh Ubuntu box:
```bash
curl -sSL https://get.casinosystem.app | bash -s -- --casino-name="Mwanza" --admin-email="admin@local"
```

What it does:
1. Installs Docker + docker-compose.
2. Pulls `docker-compose.yml` from GitHub Release.
3. Pulls images: `supabase/postgres`, `supabase/gotrue`, `supabase/postgrest`, `supabase/storage-api`, `supabase/realtime`, `ghcr.io/.../cms-frontend`, `cms-sync`, `cms-monitor`, `cms-updater`, `nginx`.
4. Generates random JWT secret, DB password, sync secret. Writes `.env`.
5. Loads `schema-X.Y.Z.sql` (data-empty, structure from CI dump of Arusha Cloud — that's our golden master).
6. Creates `admin@local` user via GoTrue Admin API with the password user provided.
7. Creates one casino row with the name from `--casino-name`.
8. Starts everything. Prints local URL (`http://<host-ip>`) and admin credentials.

**No Cloud connection required.** Installer can run on a laptop in a Faraday cage.

---

## Local Supabase stack (what runs in docker-compose)

```yaml
services:
  postgres:        # supabase/postgres:15 (has all extensions)
  gotrue:          # supabase/gotrue (own users, own JWT)
  postgrest:       # supabase/postgrest (REST API)
  storage:         # supabase/storage-api (files on local disk)
  realtime:        # supabase/realtime (websockets)
  kong:            # gateway: one URL → routes to all of above
  cms-frontend:    # React app, reads runtime-config.json
  cms-sync:        # mutual peer replication daemon
  cms-monitor:     # health endpoint /api/monitor/health
  cms-updater:     # polls GitHub Releases, pulls new images
  nginx:           # public entry, serves frontend + proxies /supabase/
  backup:          # nightly pg_dump to /var/backups
```

Frontend's `runtime-config.json` → `{ supabaseUrl: "http://<host>/supabase/", localMode: true, casinoId: "..." }`.

**Every node runs identical stack.** Cloud is the same Docker stack just hosted at `casinosystem.app`. No "Cloud-only" code paths.

---

## Peer pairing (`peer_links` table — on every node)

```sql
peer_links (
  id uuid pk,
  peer_url text,              -- 'http://192.168.1.50' or 'https://casinosystem.app'
  peer_node_id uuid,          -- their node_id (mutual handshake)
  display_name text,          -- 'Mwanza' / 'Cloud'
  sync_secret text,           -- shared secret, 32 bytes hex
  status text,                -- 'pending_outbound' | 'pending_inbound' | 'active' | 'paused'
  last_seen_at timestamptz,
  last_pull_cursor bigint,    -- last outbox seq pulled from peer
  last_push_cursor bigint,    -- last outbox seq pushed to peer
  created_at timestamptz
)
```

**Pairing flow (symmetric handshake):**
1. On node A: Admin → Network → **Add Peer** → enters peer URL `http://192.168.1.50`.
2. A calls `POST <peer_url>/peer/handshake` with `{my_node_id, my_name, my_pubkey}`.
3. B receives, creates `peer_links` row in `pending_inbound`. Shows in B's Admin → Network → Pending.
4. B's admin clicks **Approve** → B's side becomes `active`, B calls back `POST <a_url>/peer/handshake/confirm` with shared secret.
5. Both sides now `active`. Sync starts immediately.

**No primary/replica question is ever asked.** Both nodes already have their own data — they just start mirroring each other.

**"Clean pending" button** in Admin → Network deletes any `pending_*` row older than 1 hour or rejected.

---

## Sync protocol (`cms-sync` daemon, identical on every node)

```text
every 5s for each active peer:
  PUSH:  POST <peer>/peer/push  body={rows after last_push_cursor}
  PULL:  GET  <peer>/peer/pull?since=<last_pull_cursor>
  HEARTBEAT: implicit (both calls update last_seen_at on success)
```

Auth: HMAC(sync_secret, body) header. No JWT shenanigans.

**Rules enforced on receiver:**
- Operational tables (shifts, transactions, etc.): only accept rows where `casino_id ∈ {peer's owned casinos}`. Rejects others (data isolation invariant).
- Global tables (players, blacklist, categories): accept any row. If existing row's `updated_at > incoming.updated_at` → ignore (LWW). Else upsert.
- Loop prevention: each row carries `origin_node_id`. Don't echo back to origin.

Outbox already exists in `02-sync-outbox.sql`. Reuse, don't rebuild.

---

## Failover (VRRP/keepalived)

Documented in `deploy/HA-SETUP.md`. Outside the app:
- Two paired nodes on same LAN get `keepalived` installed.
- Virtual IP `192.168.1.100` floats between them.
- Frontends always talk to `192.168.1.100`. If A dies, B answers.
- Sync ensures B already has all of A's data within seconds of A's last write.
- App-side: zero changes. Just document the network setup.

We **do not build VRRP into the app.** It's a 50-line keepalived config the network admin sets up.

---

## Cloud's role

**Cloud is identical to a local node, just public.** Run the same docker-compose on a VPS, give it a domain, register it as a peer from any local node.

Cloud gets:
- Mirror of all paired casinos' data (for cross-casino reporting on `premier.casinosystem.app`).
- Nothing special. If Cloud dies, locals don't care.
- "Connect to Cloud" button in local Admin → Network is just `Add Peer` with URL pre-filled to `https://casinosystem.app`.

---

## What we delete

- `register-local-server`, `initial-sync-trigger` edge functions.
- `local_servers`, `pending_server_registrations` tables.
- Last session's `peer_links` migration (re-create with new shape).
- All "Cloud-as-hub" assumptions in `cloud-seed-export`, `pull-changes`, `push-data`.

---

## What we keep

- `sync_outbox` schema + triggers (already proven).
- `cms-sync` Node.js daemon (rewritten to be symmetric).
- `cms-monitor` health endpoint.
- `cms-updater` GitHub Releases poller.
- GitHub Actions schema dump (M0 from last session).
- Local PWA manifests + nginx config.

---

## Build order (small, testable increments)

### Phase 1 — Local stack (largest, must come first)
- **P1.1** Rewrite `deploy/docker-compose.yml` with full Supabase stack (postgres, gotrue, postgrest, storage, realtime, kong).
- **P1.2** Update `deploy/install.sh` to accept `--casino-name` + `--admin-email`, seed admin via GoTrue Admin API.
- **P1.3** Update `deploy/postgres/init/` — schema dump goes to `00-schema.sql`, drop the GoTrue/storage init (handled by their containers).
- **P1.4** Frontend `runtime-config.json` patching at container start (already exists in `frontend-entrypoint.sh`, just verify it works with kong URL).
- **P1.5** Smoke test: install on fresh box, login as admin, create a casino, write a shift. **No internet at any point.**

### Phase 2 — Peer pairing
- **P2.1** Migration: drop old `local_servers`/`pending_server_registrations`/`peer_links`. Create fresh `peer_links` table on **public schema** (deployed everywhere, including Cloud).
- **P2.2** Node-side HTTP endpoints in `cms-sync`: `POST /peer/handshake`, `POST /peer/handshake/confirm`, `POST /peer/push`, `GET /peer/pull`, `GET /peer/health`. HMAC-signed.
- **P2.3** UI: `src/components/admin/PeerLinksPanel.tsx` with **Add Peer** form, list of peers (status, last_seen, push/pull cursors), **Approve / Reject / Pause / Delete** actions, **Clear Stale** button.
- **P2.4** Bidirectional smoke test: 2 boxes on LAN, pair them, write on A → appears on B within 10s, write on B → appears on A.

### Phase 3 — Conflict & global-table rules
- **P3.1** Receiver-side validation in `cms-sync`: enforce `casino_id` whitelist per peer, enforce LWW for global tables (deterministic list: `players`, `blacklist_entries`, `global_categories`, `player_intel_logs`).
- **P3.2** Add `origin_node_id` + `updated_at` columns where missing on global tables.
- **P3.3** Test: edit same player on A and B within 1s → newer `updated_at` wins, both nodes converge.

### Phase 4 — Health monitor (local + cross)
- **P4.1** `cms-monitor` already exposes `/api/monitor/health` — wire it through nginx so it's reachable as `<peer>/health`.
- **P4.2** UI: `LocalHealthCard` (own `/health`) + `PeerHealthCard` per peer (fetched from peer URL). Lives in Admin → Network.

### Phase 5 — Updater + versions
- **P5.1** `cms-updater` polls GitHub Releases (already exists). Verify works offline (graceful no-op when no internet).
- **P5.2** UI: Admin → Network → **Versions** — dropdown of last 5 releases (cached locally if no internet). Pin / auto-update toggle per node.

### Phase 6 — Docs + HA recipe
- **P6.1** `deploy/HA-SETUP.md` — keepalived config example for VRRP virtual IP.
- **P6.2** `deploy/MIGRATION-v2.md` — how to move existing Arusha test box to new stack (backup → wipe → install → restore).
- **P6.3** Update memory: `mem://architecture/multi-casino-topology` + new `mem://architecture/peer-mesh`.

---

## Risks & answers

| Risk | Mitigation |
|------|------------|
| **Schema drift between nodes on different versions.** | Each push includes `schema_version`. Mismatch → sync paused with clear UI error. User must update via `cms-updater` before resuming. |
| **Global table LWW loses an edit.** | All changes go to immutable audit log (existing logging architecture). Lost write is recoverable from log if needed. |
| **Bidirectional sync echo loop.** | `origin_node_id` per row; never push back to origin. Proven pattern. |
| **GoTrue users diverge between nodes.** | `auth.users` is added to sync via custom outbox trigger (treated as global LWW table). Admin creates user on A → appears on B in seconds. Password hash syncs as-is. |
| **Install on a box without internet.** | Provide offline bundle: `casino-system-vX.Y.Z-offline.tar.gz` with all Docker images pre-pulled. `install.sh --offline ./bundle.tar.gz`. |
| **Two nodes start with same casino_id by accident.** | Pairing handshake rejects if peer claims a `casino_id` we already own. Forces admin to pick distinct casinos at install. |

---

## Why this is correct now

- Matches your mental model: **fully autonomous nodes, optional peers, Cloud is not special**.
- No phantom abstractions (no primary/replica, no hub/spoke).
- Failover is solved by **proven network tech (VRRP)**, not custom JavaScript.
- Each phase is independently shippable and testable.
- Phase 1 alone gives you a working offline installer — even if we never build phases 2–6, you have a usable product.

---

## Next step after approval

Start with **Phase 1** (local stack rewrite). Phase 2+ ships once P1.5 smoke test passes on a fresh box.
