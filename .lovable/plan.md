## Sprint B — Freeze & Archive modes + Cutover primitives

Sprint A foundation is live (bidir/push-only `sync_role`, Premier-hub fan-out). Next step prepares the primitives needed for the zero-downtime Arusha cutover.

### 1. New `replication_mode` values

Extend `node_modes.mode` enum-style check to support:

- `cloud_primary` — current default (Cloud writes, locals replica)
- `local_primary` — local node writes, Cloud is read-only mirror
- `cloud_freeze` — **new**: Cloud rejects ALL operational writes (drain window during cutover); bidir tables (players/blacklist) still flow
- `cloud_archive` — **new**: Cloud is permanent read-only archive (post-cutover, 30-day retention)

Update `_enforce_replication_mode` trigger to honor the two new states.

### 2. `cutover_sessions` table

Tracks each cutover attempt with full audit:

```text
id, casino_id, initiated_by, started_at, completed_at,
state ('seeding'|'catching_up'|'freezing'|'draining'|'promoting'|'dns_swap'|'done'|'rolled_back'),
source_node_id, target_node_id,
seed_rows, delta_rows, drain_ms,
rollback_window_until, notes
```

RLS: `super_admin` only.

### 3. RPCs

- `cutover_begin(casino_id, target_node_id)` → creates session, validates target reachable.
- `cutover_set_state(session_id, new_state)` → state-machine transitions only.
- `cutover_freeze_cloud(casino_id)` → sets `node_modes.mode='cloud_freeze'`, returns outbox lag.
- `cutover_promote_local(casino_id)` → sets local `node_modes.mode='local_primary'` + Cloud to `cloud_archive`.
- `cutover_rollback(session_id)` → reverts to `cloud_primary` within 1h window.

### 4. Sync engine updates

`deploy/sync/index.js` + `api.js`:

- Respect `cloud_freeze` on push: locals keep pushing (drain), but server-side trigger blocks operational writes from any source except the drain.
- Surface `cutover_state` in `/peer/handshake` response so peers can show it in UI.

### 5. UI (Premier · `super_admin` only)

New page `src/pages/admin/CutoverWizardPage.tsx`:

```text
Step 1: Pick casino + target node
Step 2: Seed (calls cloud-seed-export) — progress bar
Step 3: Catch-up — live outbox lag counter (must hit 0)
Step 4: Freeze Cloud — confirm dialog
Step 5: Drain (auto, 5-20s) — shows remaining outbox
Step 6: Promote local + DNS swap instructions
Step 7: Done — 1h rollback button visible
```

No changes to operational modules. Existing `ClonePromotePanel` / `MirrorCutoverPanel` stay untouched this sprint (will be removed in Sprint E).

### 6. Version bump

`package.json` → `1.3.119` after migration.

---

### Technical notes

- Trigger logic for `cloud_freeze`: same `_enforce_replication_mode` check, but instead of "is this node the replica?" it asks "is mode in (`cloud_freeze`,`cloud_archive`) AND is this Cloud AND is table operational (not bidir_global)?".
- `bidir_global` writes (players, blacklist, tags, notes) are NEVER blocked by freeze/archive — they're the network's shared identity layer.
- Rollback works by flipping `node_modes` back; outbox cursors on both sides resume naturally because no operational writes happened on the promoted local yet during the 1h window... unless they did, in which case rollback is disabled and the wizard says so explicitly.
- DNS swap is manual (Cloudflare API call shown as `curl` snippet) — automating it requires an API token we don't want to store server-side.

### Out of scope (later sprints)

- Sprint C: Execute Arusha pilot using this wizard.
- Sprint D: Mwanza/Dodoma/Mbeya rollout.
- Sprint E: Strip Cloud operational write UI, enable Cloudflare Access.
- Sprint F: LAN HA `ClonePromotePanel`.
