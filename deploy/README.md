# Casino System — On-Premises (Pairing Edition)

Installs a fully self-contained backend for one casino on Ubuntu 22.04 / 24.04
LTS. No GitHub tokens, no manual JWTs, no CASINO_ID lookups — the server is
**paired** with Cloud through a one-time 8-character code that a super_admin
approves in the admin panel.

---

## 1. System requirements

- Ubuntu Server **22.04 LTS** or **24.04 LTS** (clean install OK)
- 4 GB RAM, 50 GB SSD, x86_64
- Internet access at install time (to fetch base images and casino data)
- Root / sudo

---

## 2. Build the installer (on dev machine, once)

```bash
./deploy/build-installer.sh
# → deploy/dist/casino-system-installer-<sha>.tar.gz   (~80 MB)
# → deploy/dist/INSTALL.txt                            (3-line guide)
```

Copy **both files** to the root of a USB stick.

---

## 3. Install on the server (3 commands)

Plug in the USB, then on the server:

```bash
sudo mkdir -p /opt/casino-system
sudo tar -xzf /media/*/casino-system-installer-*.tar.gz -C /opt/casino-system
cd /opt/casino-system
sudo ./deploy/install.sh
```

The installer will ask 4 short questions:

```
  Название локации: Premier Arusha
  Slug:             arusha          (auto-suggested)
  Локальный IP:     192.168.1.100   (auto-detected)
  Домен в LAN:      arusha.local    (auto: <slug>.local)
```

Then it shows an **8-character pairing code** and starts polling Cloud.

---

## 4. Approve in Cloud admin

Open the Cloud admin panel (e.g. `premier.casinosystem.app`) as super_admin:

```
Admin → Network → Pending Server Registrations
```

Find the row with your pairing code, pick the casino from the dropdown, click
**Approve**. Within 5–10 seconds the server will:

1. Receive sync_secret and a one-time seed token
2. Stream the **full** casino history into the local Postgres
3. Build `cms-frontend` locally from the bundled sources (3–7 minutes)
4. Start the Docker stack, install the systemd service

Final output:

```
✓ Установка завершена!
  📍 Premier Arusha (slug: arusha)
  🌐 URL:  https://arusha.local
```

---

## 5. Post-install (per device)

| Step | Why |
|---|---|
| Copy `certs/ca.crt` to each Windows/Android/iOS device → install as Trusted Root | Removes browser TLS warning |
| Add DNS entry on the casino router: `<LOCAL_IP> <LOCAL_DOMAIN>` | So all clients resolve `arusha.local` |
| Open `https://<LOCAL_DOMAIN>` → Chrome → Install app | Installs the PWA |

---

## 6. Day-to-day operations

```bash
docker compose ps                     # status
docker compose logs -f                # follow logs
systemctl restart casino-system       # full restart
sudo ./deploy/install.sh --rebuild    # rebuild frontend after a code update
sudo ./deploy/install.sh --reset      # forget pairing, start over
```

### Updating to a new code version

1. On the dev machine: `./deploy/build-installer.sh` → new tarball
2. `scp` the tarball to the server
3. `sudo tar -xzf casino-system-installer-*.tar.gz -C /opt/casino-system && sudo /opt/casino-system/deploy/install.sh --rebuild`

The pairing is preserved — only the frontend is rebuilt from new sources.

---

## 7. Backup & restore

See `ARCHIVE-RESTORE.md`. Backups go to `backup_data` volume; with
`BACKUP_OFFSITE=cloud` they are also pushed to Cloud Storage via the
`upload-backup` edge function.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| **"Pairing-код истёк"** | Codes expire in 30 min. Run `--reset`. |
| **`docker compose build` дольше 10 мин** | Ожидаемо при первом запуске на слабом железе. Кэш npm ускорит повторные сборки. |
| **Polling висит "?????"** | Cloud вернул нестандартный статус — проверьте логи `register-local-server` в админке Cloud. |
| **Seed RC≠0** | Нет связи с Cloud, или seed-token истёк (24ч). `--reset` и заново. |
| **Frontend не отвечает** | `docker compose logs cms-frontend` — обычно проблема в build-args или JWT. |

---

## 9. Architecture

```text
                 USB-flash
                ─────────────
   dev machine ──tarball──▶  Ubuntu server (Premier Arusha)
                                │
                                ├─ install.sh
                                │     ├─ pairing code → Cloud
                                │     ├─ wait approve  ← super_admin
                                │     ├─ seed-import   ← cloud-seed-export (days=all)
                                │     └─ docker compose build + up -d
                                │
                                ▼
                            postgres ─ cms-sync ─ Cloud
                            postgrest    ▲
                            gotrue       │
                            realtime     │
                            storage      │
                            cms-frontend │
                            nginx (TLS)  │
                                         │
                                  LAN clients
                                  https://arusha.local
```

Optional auto-updater (disabled by default):
```bash
docker compose --profile with-updater up -d
```
