# Make Arusha local server visible & ready to promote

Three small, independent fixes to close the gap between "pairing works" and "I can click Promote to Primary in Cloud admin".

## 1. Auto-register local server in `casino_servers` on pairing

**Problem:** After successful pair, Cloud's *Servers (Primary/Replica)* panel stays empty — so the **Promote to Primary** button never appears, even though sync is healthy.

**Fix:** In `supabase/functions/peer-mesh/index.ts`, inside the **approve-pairing** handler (the one that consumes the pairing code and creates the symmetric peer rows), add an idempotent insert:

```sql
INSERT INTO casino_servers (casino_id, node_id, display_name, local_url, role)
VALUES ($casino_id, $local_node_id, $local_display_name, $local_url, 'replica')
ON CONFLICT (node_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      local_url    = EXCLUDED.local_url;
```

Cloud is **not** inserted as a row — Cloud is the implicit primary until a replica is promoted. After the local box pairs, the Cloud admin will show:

```
[Crown] Local Server   https://192.168.1.94   [primary?]  ← no, [replica]
                                                          [Promote to Primary]
```

## 2. Promote flow stays simple (no Cloud-side changes)

Per your decision: when you click **Promote to Primary** on `arusha.casinosystem.app/admin`:
- Local row flips `role = 'primary'`.
- Cloud stays a peer in the mesh, keeps mirroring both directions.
- No read-only lockdown on Cloud, no subdomain redirect — clients on `arusha.casinosystem.app` keep writing to Cloud, and the mesh propagates to local within ~5 s. Clients on `https://192.168.1.94` write to local directly.
- This means the existing `sync_promote_server` RPC + the `PROMOTE` confirmation prompt we already added are enough. **No code change needed for promote itself.**

## 3. Remove "Reset Cloud Data" from Cloud admin

The big red **Reset Cloud Data** button on `arusha.casinosystem.app/admin → Peers` is dangerous and no longer needed (the new installer never asks for `SKIP_SEED`). Remove the entire block from `src/components/admin/PeersPanel.tsx` (or whichever file renders it — will locate during implementation).

Also remove the `sync_reset_outbox`-driven UI helpers if they're only used by that button.

## 4. Server Identity "Not configured" badge

No code change — you just haven't pressed **Save & restart** yet on the local box. After you do:
- Slug: `local` → `arusha`
- Display name: `Local Casino` → `Arusha Cloud`
- Badge: `Not configured` → green/configured
- cms-frontend restarts (~30 s)

I'll leave a note in the form's helper text reminding users to pick the matching casino from the dropdown before saving (the dropdown already shows real casinos from Cloud).

## Technical details

**Files touched:**
- `supabase/functions/peer-mesh/index.ts` — add `casino_servers` upsert in pair-approve path. Reads local node_id, display_name, local_url from the pairing payload (already sent by `cms-sync` during pair).
- `src/components/admin/PeersPanel.tsx` (or `ResetCloudDataCard.tsx` if extracted) — delete the Reset Cloud Data card.
- `package.json` — patch bump (backend change → auto bump rule).

**No DB migration needed** — `casino_servers` table already exists with the right columns.

**What won't change:**
- The pairing UX (PAIRING CODE + Pick casino + Approve) stays identical.
- `cms-sync` on the local box doesn't need any change.
- The installer doesn't need any change — pairing already happens in the Cloud-connected install flow.

## Verification after deploy

1. On the local box admin (192.168.1.94) → press **Save & restart** on Server Identity → wait 30 s → badge turns green.
2. On `arusha.casinosystem.app/admin → Peers` → *Servers (Primary/Replica)* panel now shows **Local Server** with a **Promote to Primary** button.
3. Reset Cloud Data card is gone.
4. Click Promote → type `PROMOTE` → Local Server gets the crown, Cloud stays in the peer list as replica, sync keeps running.
