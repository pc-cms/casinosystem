# Migrating from v1.x (Cloud-as-hub) to v2.x (peer mesh)

v2.x removes the Cloud-as-hub pairing model (Cloud was a *primary*, locals were
*replicas*). Every node is now identical and connects to any number of peers.

## What changed

| Concept (v1)              | Replacement (v2)                          |
|---------------------------|-------------------------------------------|
| `cloud_connection` table  | `peer_links` (one row per peer)           |
| `local_servers` table     | gone — discover via `peer_links`          |
| `pairing-code` workflow   | `Admin → Peers → Add Peer` + shared secret|
| edge fn `pull-changes`    | edge fn `peer-mesh/pull`                  |
| edge fn `register-local-server`| edge fn `peer-mesh/handshake`        |
| edge fn `initial-sync-trigger` | gone — bootstrap from schema dump    |
| Frontend "Connect to Cloud" button | "Add Peer" on every node          |

## Migration steps

### A) Plain wipe-and-reinstall (recommended)

If your locals only contain replicated data from Cloud, the fastest path is:

1. **Back up everything just in case**
   ```bash
   sudo ./deploy/install.sh --backup        # dumps to /opt/cms-backups
   ```
2. **Wipe**
   ```bash
   sudo ./deploy/install.sh --wipe
   ```
3. **Install v2**
   ```bash
   sudo ./deploy/install.sh
   ```
4. Open `https://<local>` → log in as admin → **Admin → Peers** → Add Peer
   pointing at `https://<cloud or other local>`. Approve from the other side.
5. cms-sync will start mirroring within ~5 seconds.

### B) Preserve data (advanced)

If a local has data that does **not** live in Cloud (e.g. it was running
disconnected), preserve it across the upgrade:

1. Back up:
   ```bash
   docker compose exec postgres pg_dump -U postgres -d postgres \
     --schema=public --data-only \
     -t 'transactions' -t 'shifts' -t 'cage_transfers' \
     -t 'expenses' -t 'wallet_transactions' -t 'players' \
     > /opt/cms-backups/local-data.sql
   ```
2. `sudo ./deploy/install.sh --wipe` → `sudo ./deploy/install.sh`
3. Restore:
   ```bash
   cat /opt/cms-backups/local-data.sql | docker compose exec -T postgres \
     psql -U postgres -d postgres
   ```
4. Pair with peers as in (A).

## Verifying the new mesh

After pairing, both nodes should show each other in **Admin → Peers** with
status **Active** and the **Last Seen** timestamp updating every ~5 seconds.

If a peer stays in **Awaiting peer** for more than a minute:
- Check `docker compose logs cms-sync --tail=50` on both sides for handshake
  errors (signature mismatch = wrong shared secret).
- Use the **Clear Stale** button to remove stuck rows and try again.

## Rollback

v2 cannot be rolled back to v1 in-place (schema diverged). To go back:
1. Stop both nodes.
2. Restore the v1 backup taken before step A1.
3. Run the v1 installer from a tagged release.
