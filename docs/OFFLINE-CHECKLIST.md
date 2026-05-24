# Offline Resilience — Manual Test Checklist

Run this against a staging or local on-prem build before shipping any offline-related
change. Pair it with the automated smoke tests in `e2e/offline.spec.ts`.

## Setup
- Use Chrome DevTools → Network → "Offline" toggle (or `nmcli` / pull the Wi-Fi cable
  on an on-prem device) to simulate outage.
- Open DevTools → Application → IndexedDB → `cms-offline-queue` → `pending_actions`
  to inspect the queue directly.

## Per-role scenarios

### Cashier
1. Open `/cage`, ensure you're on an open shift.
2. Toggle **Offline**.
3. Record an IN transaction (Player, Table, Amount, Chips → "IN").
   - Expected: button releases within ≤10s, toast says "Saved offline — will sync".
   - Expected: row appears in IndexedDB queue, status `pending`.
4. Record an OUT transaction. Same expectations.
5. Open Cash Check tab, run a Check. Expected: queued, not lost.
6. Press "Close Shift" with manager password (must have been entered online
   in the last 12h on this device).
   - Expected: shift closes with `closed_offline: true`, `requires_review: true`.
   - Expected: new shift opens immediately, queued behind the close.
7. Toggle **Online**. Watch `/admin/sync-queue`:
   - Expected: queue drains in order, no duplicate IN/OUT rows in the database.

### Pit
1. Open `/pit`.
2. Offline → seat a player at a table, change average bet, leave seat.
   - Expected: optimistic UI, queue entries created.
3. Online → entries sync, no duplicates.

### Reception
1. Open `/reception`.
2. Offline → check in a known player.
   - Expected: visit appears in today's list, queued.
3. Offline → take/update a photo.
   - Expected: photo deferred (queued or saved locally), no spinner lock.

### Manager Password Offline
1. Online → trigger a manager-override action (e.g. cancel transaction).
   Enter password successfully.
2. Offline → trigger another override action.
   - Expected: dialog accepts the same password locally, logs
     `auth_method: password_offline`.
3. Online → background re-validation runs. If password rotated meanwhile,
   override is flagged `disputed` in `manager_overrides`.

## Anti-regression checks

- "Dinosaur" page must NEVER appear during a 5-15 minute outage on:
  `/cage`, `/pit`, `/reception`, `/breaklist`, `/players`, `/dashboard`,
  `/cage/close-shift`.
- React Query must NOT issue a refetch storm on reconnect. In DevTools →
  Network, after toggling back online, requests should arrive staggered
  (~4 per second), not in a single burst.
- `OfflineBanner` must always render at the top while offline OR while the
  queue has ≥1 pending action. Color: red = offline, amber = syncing.
- Manager + Super Admin can open `/admin/sync-queue` and see all pending
  actions. Super Admin can delete; Manager can only retry.

## Recovery from a bad sync

If a queued action fails with a permanent error (e.g. RLS denial),
`/admin/sync-queue` shows it as `permanently_failed`. Super Admin can
delete it; the operator must redo the action manually online.
