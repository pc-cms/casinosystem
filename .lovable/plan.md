## Цель

Минимальный UX установки on-prem сервера:
1. Админ копирует **один tarball** на флешку → втыкает в Ubuntu-сервер → запускает **одну команду**.
2. Установщик показывает 8-значный pairing-код.
3. Super-admin аппрувит сервер в облачной админке (выбирает casino из списка).
4. Сервер автоматически получает credentials, тянет **все данные** этого казино из Cloud, собирает frontend локально из тех же исходников, что в облаке.

Никаких ручных вводов CASINO_ID, SYNC_SECRET, JWT, GitHub-токенов.

## Поток (что увидит админ)

### На dev-машине (или CI) — один раз
```bash
./deploy/build-installer.sh
# → создаёт deploy/dist/casino-system-installer-<git-sha>.tar.gz (~80 MB)
#   внутри: исходники (src/, supabase/migrations/, package.json, deploy/)
#   + INSTALL.txt с инструкцией на 3 строки
```

### На флешке
```
USB:/
├── casino-system-installer-1a2b3c4.tar.gz
└── INSTALL.txt          ← 3 строки инструкции
```

`INSTALL.txt`:
```
1. sudo mkdir -p /opt/casino-system && sudo tar -xzf /media/*/casino-system-installer-*.tar.gz -C /opt/casino-system
2. cd /opt/casino-system
3. sudo ./deploy/install.sh
```

### На Ubuntu 24.04 сервере
```bash
sudo ./deploy/install.sh
```

Мастер (4 коротких вопроса):
```
1/4  Название локации : Premier Arusha
1/4  Slug             : arusha    (auto)
1/4  IP               : 192.168.1.100  (autodetect, Enter — принять)
1/4  Домен            : arusha.local   (auto: <slug>.local)

2/4  Регистрирую сервер в Cloud...

     ┌────────────────────────────────────┐
     │  PAIRING CODE                      │
     │                                    │
     │      K7M2 — 9Q4X                   │
     │                                    │
     │  Откройте в облачной админке:      │
     │  premier.casinosystem.app/admin    │
     │  → Network → Pending Servers       │
     │                                    │
     │  Жду аппрува... ⠋                  │
     └────────────────────────────────────┘

3/4  ✓ Аппрув от admin@example.com
     ✓ Привязан к казино: Premier Arusha
     ✓ Загружаю данные (1.2 GB)... 87%
     ✓ Импорт завершён за 3 мин 12 сек

4/4  ✓ Собираю frontend из исходников (4 мин)
     ✓ Запускаю стек
     ✓ Установлен systemd-сервис

  → https://arusha.local
```

### В облачной админке
Super-admin → **Admin → Network → Pending Servers**:
- Список запросов с pairing-кодом, IP, hostname, версией Ubuntu, RAM
- Dropdown **«Привязать к казино»** (список casinos)
- Кнопки **Approve** / **Reject**
- Realtime-обновления

После Approve → install.sh на сервере (он polling-ом ждёт) автоматически продолжает.

## Что меняется

### A. Cloud DB (миграция)
```sql
CREATE TABLE pending_server_registrations (
  id uuid PK DEFAULT gen_random_uuid(),
  pairing_code text UNIQUE NOT NULL,        -- "K7M29Q4X"
  server_name text NOT NULL,
  server_ip text,
  hostname text,
  system_info jsonb,                         -- ubuntu/ram/disk/docker
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired','consumed')),
  approved_casino_id uuid REFERENCES casinos(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  seed_token text,                           -- одноразовый JWT для cloud-seed-export
  seed_token_expires_at timestamptz,
  sync_secret text,                          -- генерится при approve
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 minutes',
  consumed_at timestamptz
);
-- RLS: super_admin SELECT/UPDATE; INSERT через edge (service_role)
```

`local_servers` — без изменений.

### B. Edge function `register-local-server` (новая)
- `POST /` (anon) — регистрация, возвращает `{pairing_code, expires_at}`
- `GET /?code=XXXX` (anon) — polling, возвращает `{status}` или `{status:approved, casino_id, sync_secret, seed_token, anon_key, supabase_url}`
- `POST /approve` (super_admin JWT) — генерит sync_secret + seed_token (HS256, kind=seed, exp=24h), создаёт `local_servers` row, ставит status=approved
- `POST /reject` (super_admin JWT)
- Rate limit: 10 регистраций/IP/час; pairing_code в base32 без 0/O/1/I

### C. `cloud-seed-export` правки
- Принять `x-seed-token` (JWT) как альтернативу `x-service-key`; verify HS256 + claim `kind=seed`
- Поддержать `?days=all` — без фильтра по дате (полная история)
- Keyset pagination по `id` для крупных таблиц (`transactions`, `casino_visits`)
- После успешного экспорта — `pending_server_registrations.status='consumed'`

### D. Admin UI
| Файл | Что |
|---|---|
| `src/hooks/use-pending-servers.ts` | Realtime-хук на `pending_server_registrations` |
| `src/components/admin/PendingServersPanel.tsx` | Список + Approve/Reject |
| `src/components/admin/NetworkHealthPanel.tsx` | Добавить tab «Pending Servers» с бейджом-счётчиком |

### E. `deploy/build-installer.sh` (новый)
```bash
#!/usr/bin/env bash
# Собирает tarball для флешки.
SHA=$(git rev-parse --short HEAD)
OUT="deploy/dist/casino-system-installer-${SHA}.tar.gz"
mkdir -p deploy/dist
tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=deploy/dist \
    -czf "$OUT" \
    package.json package-lock.json bun.lockb tsconfig*.json vite.config.ts \
    index.html postcss.config.js tailwind.config.ts components.json \
    src/ public/ supabase/migrations/ deploy/
echo "✓ $OUT"
echo "Скопируйте этот файл + deploy/INSTALL.txt на флешку."
```

### F. `deploy/INSTALL.txt` (новый, для флешки)
3-строчная инструкция — копируется в корень флешки рядом с tarball.

### G. `deploy/install.sh` — переработка
**Удаляю:** ввод `CASINO_ID`, `SYNC_SECRET`, `GITHUB_OWNER`, service-role key; шаг 1.5 «GitHub release»; pull из GHCR.

**Добавляю:**
- Проверка Ubuntu 22.04+ (24.04 LTS поддерживается)
- Только 4 вопроса: name / slug / ip / domain
- POST в `register-local-server` → получение pairing-кода
- ASCII-бокс с кодом + spinner
- Polling каждые 5 сек до `status=approved`
- Запись `.env` с полученными credentials
- Старт postgres → import seed (`days=all` через `seed-import.js` с `x-seed-token`)
- Локальная сборка: `docker compose build cms-frontend` (3-5 мин)
- `docker compose up -d`
- systemd unit
- Поддержка `--rebuild`, `--reset` (заново начать pairing)

### H. `deploy/docker-compose.yml`
- Убрать `version: "3.9"`
- `cms-frontend`: заменить `image: ghcr.io/...` на `build: { context: .., dockerfile: deploy/Dockerfile.frontend, args: { VITE_BUILD_VERSION } }` + `image: cms-frontend:${FRONTEND_VERSION:-local}`
- `cms-updater`: `profiles: ["with-updater"]` (отключён по умолчанию)

### I. `deploy/env.template`
Удалить: `GITHUB_*`, `FRONTEND_VERSION`, `CASINO_ID`, `SYNC_SECRET` (заполняются автоматом). Оставить: `LOCAL_DOMAIN`, `LOCAL_IP`, `LOCATION_NAME`, `LOCATION_SLUG`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (Cloud).

### J. `deploy/README.md` — полностью переписать
Разделы:
1. **Системные требования** — Ubuntu 24.04 LTS, 4 ГБ RAM, 50 ГБ SSD, интернет на момент установки
2. **Подготовка флешки** — `./deploy/build-installer.sh` → копировать на USB
3. **Установка на сервере** — 3 команды из `INSTALL.txt`
4. **Аппрув в облачной админке** — путь до Pending Servers, скриншот-описание
5. **Установка CA на клиентские устройства** (без изменений)
6. **DNS** (без изменений)
7. **Управление** (`systemctl`, `docker compose`, `--rebuild`)
8. **Обновление** — `scp` нового tarball + `sudo ./install.sh --rebuild`
9. **Бэкап / восстановление**
10. **Troubleshooting** — pairing-код истёк (30 мин), polling завис, build > 10 мин

## Файлы (создать / изменить / удалить)

| Действие | Файл |
|---|---|
| Создать | `supabase/migrations/<ts>_pending_server_registrations.sql` |
| Создать | `supabase/functions/register-local-server/index.ts` |
| Создать | `src/hooks/use-pending-servers.ts` |
| Создать | `src/components/admin/PendingServersPanel.tsx` |
| Создать | `deploy/build-installer.sh` |
| Создать | `deploy/INSTALL.txt` |
| Изменить | `supabase/functions/cloud-seed-export/index.ts` (x-seed-token + days=all) |
| Изменить | `src/components/admin/NetworkHealthPanel.tsx` (новый tab) |
| Изменить | `deploy/install.sh` (полная переработка) |
| Изменить | `deploy/docker-compose.yml` (build вместо image) |
| Изменить | `deploy/env.template` (упростить) |
| Изменить | `deploy/README.md` (переписать под новый flow) |

## Безопасность
- Pairing code: 8 символов base32, TTL 30 мин, одноразовый
- Seed token: HS256 JWT, claim `{kind:"seed", casino_id, exp:+24h}`, проверка в edge
- Approve требует super_admin JWT; sync_secret генерится в БД
- Rate-limit на регистрацию по IP

## Что НЕ меняется
- `cms-sync`, `cms-updater` логика
- Схема БД остальных таблиц
- Существующие потребители `cloud-seed-export` (старый `x-service-key` продолжает работать)
- RLS, роли, авторизация в приложении

## Порядок реализации (если план одобрен)
1. Миграция `pending_server_registrations`
2. Edge function `register-local-server` + правки `cloud-seed-export`
3. Admin UI (`PendingServersPanel`)
4. `deploy/install.sh`, `docker-compose.yml`, `env.template`
5. `build-installer.sh`, `INSTALL.txt`, `README.md`
6. Smoke test: `docker compose -f deploy/docker-compose.yml config`
7. Bump `package.json` version (backend changes)