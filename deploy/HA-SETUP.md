# High Availability with VRRP (keepalived)

Each Casino System node is **fully self-contained**. To make two physical
machines look like one to the staff browsers, run **keepalived** so the LAN
sees a single virtual IP that floats to whichever node is up.

> This is **optional**. A single node is fine; HA only helps when you can
> tolerate zero downtime during reboots/upgrades.

## Topology

```text
                      ┌───────────────────────────┐
   browsers  ─────►   │  Virtual IP  192.168.1.50 │
                      └─────────┬─────────────────┘
                                │  (VRRP advert)
                ┌───────────────┴───────────────┐
                ▼                               ▼
   ┌──────────────────────┐         ┌──────────────────────┐
   │ Node A   192.168.1.51│◄──peer──►│ Node B   192.168.1.52│
   │ keepalived MASTER    │  mesh   │ keepalived BACKUP    │
   │ Casino System stack  │         │ Casino System stack  │
   └──────────────────────┘         └──────────────────────┘
```

Both nodes run the **full** stack (Postgres + GoTrue + PostgREST + cms-sync +
nginx). They are paired in Admin → Peers so data flows both ways every 5s.
When Node A goes down, keepalived on Node B claims the VIP within ~3 seconds
and browsers transparently failover.

## 1. Install keepalived

```bash
sudo apt-get install -y keepalived
```

## 2. Configure Node A (MASTER)

`/etc/keepalived/keepalived.conf`:

```conf
vrrp_script chk_nginx {
  script "/usr/bin/curl -fsS -o /dev/null https://localhost/health"
  interval 2
  weight   -20
}

vrrp_instance VI_CASINO {
  state            MASTER
  interface        eth0
  virtual_router_id 51
  priority         100
  advert_int       1
  authentication {
    auth_type PASS
    auth_pass change-me-shared-with-node-b
  }
  virtual_ipaddress {
    192.168.1.50/24
  }
  track_script { chk_nginx }
}
```

## 3. Configure Node B (BACKUP)

Identical, but:

```conf
  state    BACKUP
  priority 90
```

## 4. Start & verify

```bash
sudo systemctl enable --now keepalived
ip addr show eth0 | grep 192.168.1.50    # MASTER should hold the VIP
sudo systemctl stop docker                # simulate failure on Node A
# Node B's keepalived takes over within ~3 seconds
```

## Notes

- **Browsers** point at `https://192.168.1.50` (or a DNS name resolving to it).
- **No app changes required** — Casino System frontend uses relative URLs.
- **Data consistency**: the symmetric peer mesh is eventually consistent.
  A write made on Node A during a failover window may take up to ~5 seconds
  to propagate to Node B. For casino operations (shifts, transactions,
  chip counts) this is invisible.
- **Split-brain**: keepalived prevents both nodes from holding the VIP at the
  same time. If your switch loses VRRP traffic, both nodes may briefly hold
  the VIP — the peer mesh's LWW (last-write-wins on `updated_at`) reconciles
  conflicting writes on global rows automatically.
