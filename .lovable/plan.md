# Plan — Clone Arusha (Cloud → Local), per Case 2

Goal: get a local on-prem server that is an exact mirror of `arusha.casinosystem.app`, with both sides staying in bidirectional sync afterwards. CCTV / Fin-director keep using the Cloud URL; floor users switch to `arusha.local`.

## Step-by-step

### 1. Install the local server (fresh box)
```
sudo mkdir -p /opt/casino-system
sudo tar -xzf /media/*/casino-system-installer-*.tar.gz -C /opt/casino-system
cd /opt/casino-system
sudo ./deploy/install.sh
```
Answer the 4 questions: name = `Arusha`, slug = `arusha`, LAN IP, LAN domain (`arusha.local`). The installer brings up Postgres + cms-sync + cms-frontend with seed-only data (tables/slots empty, no employees, no players).

### 2. Pair with Cloud
- Installer prints an 8-char pairing code.
- super_admin opens `https://premier.casinosystem.app` → Admin → Network → Pending Server Registrations.
- Picks casino **Arusha**, clicks Approve.
- Installer auto-detects approval; cms-sync writes `cloud_connection` row, status = `connected`.

After this point the peer mesh is live, but the local DB is still empty seed data.

### 3. Open the local admin panel
Browse `https://arusha.local` (or LAN IP), log in as super_admin → Admin → **Server Identity** panel: verify the casino is bound (slug `arusha`, casino_id present).

### 4. Run the Clone
Same Admin page → **Full Mirror Sync** panel → **Clone from Cloud** (red button).
- Confirm dialog requires typing `Arusha`.
- Backend (`/api/node/clone-from-cloud`) does, inside one txn-per-table with `sync.applying='on'`:
  1. `TRUNCATE` all casino-scoped business tables for `casino_id = arusha`.
  2. `sync_reset_outbox(casino_id, advance_cursors=true)` — clears any pending outbox, advances peer cursors so we don't re-push the wipe.
  3. Streams `cloud-seed-export?casino_id=…&days=all` from Cloud, applies row-by-row.
- Progress shown live (current table, row counts).
- Expected duration: 3–5 min for typical Arusha volume.

**Recommended downtime window:** ask Arusha cashier/pit to pause writes for ~3 min while clone runs, to guarantee the Cloud snapshot is consistent. (Reads can continue.)

### 5. Verify
After status = `done`:
- Spot-check on `arusha.local`: gaming tables list, recent shifts, last 3 days of expenses, employee count, player count match Cloud.
- Open Admin → **Peers**: `last_pull_cursor` and `last_push_cursor` both advancing.
- Make a tiny write on Cloud (rename a chip color note) → appears on Local within ~5 s. Make a write on Local → appears on Cloud.

### 6. Switch traffic
- Floor staff PWAs: reinstall from `https://arusha.local/install` (or just change bookmark). LAN-fast, offline-resilient.
- CCTV + Finance Director keep using `https://arusha.casinosystem.app` — no change.
- Both URLs now serve the same data; writes on either side replicate.

## Rollback
If clone fails mid-way, the backend transaction rolls back per-table. If the result is unusable: re-run **Clone from Cloud** — it's idempotent (TRUNCATE + replace). Worst case, `pg_dump` snapshot taken automatically before wipe is in `/opt/casino-system/backups/pre-clone-<ts>.sql.gz`.

## What this plan does NOT change
- No code changes — all the machinery (`SyncMirrorPanel`, `/api/node/clone-from-cloud`, `sync_seed_from_existing`, `sync_reset_outbox`, extended `sync_attach` whitelist) was already shipped in v1.3.27.
- This plan is operational: run the installer, pair, click Clone, verify. If during verification we find a missing table in the whitelist or a bug in the clone endpoint, that becomes a follow-up fix in a new version.

## Decision point before I proceed
Confirm one of:
- **A) Just run it now** — I'll walk through the 6 steps live against `arusha.casinosystem.app` and report each step's result.
- **B) Dry-run first** — I add a `--dry-run` flag to `/api/node/clone-from-cloud` that streams + counts but doesn't TRUNCATE, so we see exact row counts per table before committing. ~30 min of code work, then run for real.

Default if you say "go": **A**.
