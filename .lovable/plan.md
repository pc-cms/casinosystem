# Plan: One-shot installer with baked snapshot + auto-peer + verified mirror

## Goal
After running `curl … | sudo bash`, a fresh local server must:
1. Boot Postgres with **real data** from a baked snapshot (no Cloud edge call required for cold start).
2. **Auto-register** itself as a peer with Cloud (no Admin UI clicks).
3. Begin **bi-directional sync** with Cloud within 60s and prove it with a measurable round-trip test.
4. Surface Exchange Log on a **dedicated page**, with only a **10-row preview** on the Admin Peers tab.

---

## Part 1 — Variant B: Baked snapshot as default seed

### 1.1 Snapshot artifact pipeline
- New edge function `cloud-snapshot-build`: streams a full `pg_dump`-style export (using existing `cloud-seed-export` logic) into Supabase Storage bucket `installer-snapshots/latest.sql.zst`.
- Manually invocable today; later wired to GitHub Action on each release.
- Stores companion `latest.meta.json` (timestamp, schema_version, row counts per table).

### 1.2 Installer changes (`deploy/install.sh` + `public/install`)
- New step **6.6 — Seed from snapshot**:
  - Download `https://casinosystem.app/snapshots/latest.sql.zst` (proxied to Storage public URL).
  - `zstd -d | psql` into Postgres on first install only (guarded by marker file `/var/lib/postgresql/.seeded`).
  - Fallback to live `cloud-seed-export` if snapshot URL unreachable (current behavior preserved).
- Flag `--no-seed` keeps the current empty-DB behavior for testing.

### 1.3 Updater changes (`deploy/update.sh`)
- Never re-seeds — only schema repair. Already correct, just document it.

---

## Part 2 — Auto-peer registration (zero-click pairing)

### 2.1 Pre-shared bootstrap secret
- Already exists: `SYNC_SECRET` in `.env` written by installer.
- Add `CLOUD_URL=https://rpehngjvwcnipvkouluu.supabase.co` and `CLOUD_CASINO_SLUG=<city>-cloud` to `.env` template — installer asks once, stores forever.

### 2.2 Self-pair on first start
- New step in `deploy/sync/index.js` boot sequence: if `peer_links` table has 0 rows AND `CLOUD_URL` is set, call `peer-mesh/pair` with `SYNC_SECRET`, `CASINO_ID`, `CASINO_SLUG`, host URL.
- `peer-mesh` edge function:
  - Validates `SYNC_SECRET` matches a row in `peer_bootstrap_tokens` table (new) OR matches the global `PEER_BOOTSTRAP_SECRET` env.
  - Creates reciprocal rows in `peer_links` on both sides (Cloud → Local, Local → Cloud).
  - Returns Cloud peer descriptor for local to store.
- Installer prints **one** bootstrap token line that the operator pastes into `.env` once (or we make it fully zero-config by reusing `SYNC_SECRET` as the bootstrap).

### 2.3 Heartbeat & retry
- `cms-sync` already heartbeats every 30s. Confirm it pairs-then-heartbeats on cold start (currently only heartbeats if peer exists).

---

## Part 3 — Real mirror verification (not just UI)

### 3.1 New RPC `sync_roundtrip_probe(probe_id uuid)`
- Inserts a row into `sync_probes` table (id, origin_casino, sent_at).
- Cloud peer-mesh `/probe` endpoint forwards the probe back to origin via normal sync path.
- When the row re-appears at origin with `received_at` set, round-trip is proven.

### 3.2 Health check enhancement (`LocalServerWizard`)
- Add **"Mirror round-trip"** stage:
  - Sends probe → waits up to 90s → reports actual latency ms.
  - Green = full bi-directional sync works. Red = breaks down which leg failed (push/pull/inbox apply).

### 3.3 CLI fallback `deploy/sync/verify.js`
- `docker compose exec cms-sync node /app/verify.js` → same probe from shell, exit code 0/1. For ops without UI.

---

## Part 4 — Exchange Log relocation

### 4.1 New dedicated page `/admin/sync-log`
- Full table view with filters (peer, event type, date range), pagination, CSV export.
- Routed under `Admin → Sync Log` sidebar entry.

### 4.2 Admin → Peers panel
- Replace embedded `SyncExchangeLog` with compact **Recent Activity** card:
  - Last 10 events only, no filters.
  - "View all →" link to `/admin/sync-log`.
- Keeps the Peers tab focused on peer config + the round-trip probe button.

---

## Technical details

**New files:**
- `supabase/functions/cloud-snapshot-build/index.ts`
- `supabase/functions/cloud-snapshot-build/index.ts` companion meta writer
- `src/pages/admin/SyncLogPage.tsx`
- `src/components/admin/RecentExchangeActivity.tsx` (10-row compact)
- `deploy/sync/verify.js`
- Migration: `sync_probes` table + `sync_roundtrip_probe` RPC + `peer_bootstrap_tokens` table (RLS: service-role only).

**Modified files:**
- `deploy/install.sh` — step 6.6 snapshot seed
- `deploy/update.sh` — document no-reseed
- `deploy/sync/index.js` — auto-pair on cold start
- `supabase/functions/peer-mesh/index.ts` — `/pair` and `/probe` endpoints
- `src/components/admin/LocalServerWizard.tsx` — round-trip stage
- `src/components/admin/PeerLinksPanel.tsx` — embed RecentExchangeActivity
- `src/pages/Admin.tsx` — register `/admin/sync-log` route
- `src/components/layout/AppSidebar.tsx` — Sync Log link

**Migration (1 file):**
```sql
CREATE TABLE public.sync_probes (...);
CREATE TABLE public.peer_bootstrap_tokens (...);
CREATE FUNCTION public.sync_roundtrip_probe(...) ...;
-- RLS: service_role only
```

**Version bump:** `package.json` → 1.3.47 (backend changes).

---

## Order of execution
1. Migration (sync_probes, peer_bootstrap_tokens, RPC)
2. Edge functions (`cloud-snapshot-build`, `peer-mesh` updates)
3. Build & upload first snapshot to Storage
4. Installer + sync auto-pair changes
5. Frontend: SyncLogPage + RecentExchangeActivity + LocalServerWizard probe stage
6. Update memory file `mem://architecture/sync-engine-impl` with auto-pair + probe contract.

---

## Out of scope (ask before doing)
- GitHub Action to rebuild snapshot on every release — added as TODO, run manually for now.
- Multi-region peer mesh (>2 nodes) — works but untested at 3+ locations.
