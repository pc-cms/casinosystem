
## Цель

Сбросить накопленную сложность вокруг локального сервера и pairing. Сделать так, чтобы:

1. Локальный сервер ставился полностью офлайн с пустой, но корректной БД.
2. Pairing был один и тот же для cloud↔local и local↔local.
3. На каждом подключении админ явно выбирал, кто primary.
4. Health Monitor работал всегда, даже без интернета.
5. В админке был чистый список версий и кнопка push.
6. На время первичной синхронизации primary показывал баннер "идёт sync".

Транспорт оставляем текущий: `sync_outbox` + edge function `pull-changes`. Чиним вокруг него, не переписываем.

---

## 1. Schema-only образ Postgres

```text
GitHub Actions (release-onprem.yml)
  └─ pg_dump --schema-only --no-owner --no-privileges
       FROM Cloud Postgres
       → deploy/postgres/init/00-schema.sql   (артефакт релиза)
  └─ docker build deploy/postgres
       COPY 00-schema.sql /docker-entrypoint-initdb.d/
```

- Дамп берётся с прод-Cloud один раз на релиз, кладётся в образ.
- На локалке Postgres при первом старте автоматически создаёт все таблицы / функции / триггеры / RLS — идентично Cloud, без данных.
- Seed только одной записи: `auth.users` admin + `user_roles(super_admin)` + дефолтные `casinos` пустые. Пароль `Welcome6407!`.
- Никакого `cloud-seed-export` на этом этапе — пустая БД работает сразу.

Файлы:
- `.github/workflows/release-onprem.yml` — шаг "Dump Cloud schema"
- `deploy/postgres/init/00-schema.sql` — артефакт (в .gitignore, генерится в CI)
- `deploy/postgres/init/10-bootstrap-admin.sql` — admin + роль + минимум casino
- удалить старые init-скрипты, которые конфликтуют

## 2. Универсальный pairing

Одна сущность `peer_links` (на каждом узле своя локальная), одна форма, один протокол.

```text
[Local UI]  → POST {target_url}/peer/register {name, fingerprint}
            ← {pairing_code, expires_at}
[Target UI] Admin → Network → Pending Peers
            кнопки: Approve as PRIMARY · Approve as REPLICA · Reject
[Local]     poll  {target_url}/peer/status?code=...
            ← {status, role_assigned, sync_secret, casino_id}
[Local]     сохраняет в peer_links, флипает локальный runtime
```

- `target_url` вводится при pairing: либо `https://casinosystem.app`, либо `https://192.168.x.x` соседнего локального.
- Edge function на Cloud и Node-сервис на локалке выставляют **одинаковый** REST: `/peer/register`, `/peer/status`, `/peer/approve`, `/peer/clear`.
- Безопасность сейчас — простой `sync_secret` (32 байта), без сложных подписей. Усложним позже.
- Кнопка **"Очистить неудачные/висящие pairing"** на обеих сторонах: один RPC `clear_stale_peer_requests()` удаляет всё кроме `pending` за последние 30 мин.

Файлы:
- `supabase/functions/peer-register/index.ts`, `peer-status/index.ts`, `peer-approve/index.ts` (новые, заменяют `register-local-server`, `initial-sync-trigger`)
- `deploy/sync/peer-api.js` — те же эндпоинты на локалке
- `src/components/admin/PeerPairingPanel.tsx` — единая форма pairing
- `src/components/admin/PendingPeersPanel.tsx` — список заявок + Approve as PRIMARY/REPLICA + Clear button
- Миграция: `peer_links { id, target_url, role, sync_secret, casino_id, is_primary, paired_at, last_seen_at, last_error }`. Старые `local_servers`, `pending_server_registrations` мягко мигрируются в `peer_links`.

## 3. Primary/replica и первичный seed

- На approve админ нажимает либо **Approve as PRIMARY (мои данные → к нему)**, либо **Approve as REPLICA (его данные → ко мне)**.
- Если выбрана `PRIMARY` — на этом узле включается флаг "SYNCING", фронт показывает блокирующий баннер: "Синхронизация в процессе, сервер недоступен ≈3-5 мин". Cashier/Pit нельзя писать.
- В это время `pull-changes` гонит дамп таблиц на replica батчами по 1000 строк (используется существующий `cloud-seed-export` → переименовать в `peer-seed-export`, работает и для cloud, и для local).
- По завершению — баннер снимается, начинается обычный двунаправленный outbox-sync.

Компоненты:
- `src/components/SyncLockBanner.tsx` — full-screen overlay при `peer_links.sync_status='seeding'`
- Хук `useSyncLock()` подписывается на realtime и блочит мутации.

## 4. Health Monitor — всегда локально

- Уже есть `deploy/monitor/index.js`. Цель: подключить его UI в `Admin → Health` без проверки `localMode`.
- Карточка показывает: CPU, RAM, диск, uptime, статус контейнеров, размер БД, последний backup.
- После pairing появляется вторая карточка "Peer health" — данные тянутся из `/peer/health` соседа.

Файлы:
- `src/components/admin/LocalHealthPanel.tsx` — данные с `/api/monitor/health`
- `src/components/admin/PeerHealthPanel.tsx` — данные с `{peer.target_url}/peer/health`
- `deploy/monitor/index.js` — добавить эндпоинт `/peer/health` (тот же набор метрик)

## 5. Админка версий

- GitHub Releases API → `Admin → Network → Versions` показывает последние 5 релизов с тегом, датой, changelog.
- Для каждого peer-сервера показывается **текущая версия** (берётся из `/peer/health.version`).
- Кнопка **Push version X to peer Y** кладёт запись в `update_commands` (уже есть). `cms-updater` на локали забирает и обновляется.
- Никакого ручного ввода версии — только выбор из списка релизов.

Файлы:
- `src/components/admin/VersionsPanel.tsx` (новый, заменяет `ServerPushUpdateDialog`)
- `supabase/functions/list-releases/index.ts` — прокси к `api.github.com/repos/.../releases?per_page=5`

## 6. Бейдж "LOCAL"

- Бейдж рендерится исключительно по факту `runtime-config.json.localMode === true`, который проставляет `frontend-entrypoint.sh` на локалке.
- Если `RUNTIME_SUPABASE_URL` указывает на `*.supabase.co` или пуст — entrypoint падает с ошибкой (уже реализовано, оставляем).

## 7. Что выпиливаем

- `register-local-server`, `initial-sync-trigger` (заменены `peer-*`).
- `PendingServersPanel` в текущем виде (заменён `PendingPeersPanel`).
- `pair.sh` упрощается: только проверка контейнеров + вывод адреса админки. Сам pairing полностью через UI.
- Старые `pending_server_registrations`, `local_servers` — мягкая миграция данных в `peer_links`, потом DROP в следующем релизе.

---

## Технические детали

### Новые таблицы

```sql
create table peer_links (
  id uuid primary key default gen_random_uuid(),
  target_url text not null,            -- куда мы запарились
  display_name text not null,
  role text not null check (role in ('cloud','local')),
  is_primary boolean not null,
  sync_secret text not null,
  casino_id uuid,
  sync_status text not null default 'idle'
    check (sync_status in ('idle','seeding','active','error')),
  last_seen_at timestamptz,
  last_error text,
  created_at timestamptz default now()
);
```

Та же таблица создаётся и на Cloud, и на локали (через общий schema-only dump).

### Edge functions

`peer-register`, `peer-status`, `peer-approve`, `peer-health`, `peer-seed-export`, `list-releases`. Все с `verify_jwt = false`, авторизация по `x-sync-secret` или по сессии админа.

### Очерёдность задач

```text
M0  Schema dump pipeline + пустой образ Postgres + admin seed
M1  Таблица peer_links + миграция данных из local_servers
M2  Edge: peer-register / peer-status / peer-approve / peer-health
M3  UI: PeerPairingPanel + PendingPeersPanel + кнопка Clear stale
M4  Seeding flow: SyncLockBanner + peer-seed-export
M5  LocalHealthPanel + PeerHealthPanel
M6  VersionsPanel + list-releases + push через update_commands
M7  Удаление старого register-local-server / PendingServersPanel / упрощение pair.sh
```

Каждый шаг — отдельный commit, после M4 уже можно тестить установку.

---

## Открытые вопросы (могу решить по умолчанию)

1. **Имя локального сервера** при pairing — берём из hostname или просим вводить вручную в форме? *По умолчанию: ручной ввод + предзаполнено hostname.*
2. **TLS между локалями** — сейчас nginx внутри docker генерит self-signed. Для local↔local pairing будем принимать самоподписанные сертификаты (insecure flag в node-клиенте). *По умолчанию: да, принимать.*
3. **Хранение GitHub PAT** для `list-releases` — секрет в Lovable Cloud. *По умолчанию: добавлю `GITHUB_RELEASES_TOKEN` через add_secret, если репо приватный; если публичный — без токена.*

Если возражений нет — нажимай Approve, начну с M0+M1.
