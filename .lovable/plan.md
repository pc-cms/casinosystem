# Plan: Full Local ↔ Cloud Sync — 3 Cases

## Цель

Сделать так, чтобы:
- **Кейс 1 (Mwanza)**: локальный заполнен → пейринг с Cloud → Cloud получает полную копию (бекап + удалённый доступ Fin/CCTV). Дальше работают оба, изменения идут в обе стороны.
- **Кейс 2 (Arusha)**: локальный пустой/тестовый → пейринг с уже заполненным Cloud → wipe локалки → полная заливка Cloud→Local. Дальше работают оба, двусторонний sync. CCTV/директор продолжают работать через `arusha.casinosystem.app`.
- **Кейс 3**: кнопка push-update уже работает — оставляем как есть, только убираем мелкие шероховатости.

## Что уже есть и работает

| Кусок | Статус |
|---|---|
| `peer-mesh` (Cloud-side endpoint) + `cms-sync` (local worker) — двусторонний HMAC-sync через outbox | ✅ работает |
| `peer_apply_change` RPC с защитой от петель (origin_node_id) | ✅ |
| `cloud-seed-export` edge function — стрим NDJSON **Cloud→Local** | ✅, `?days=all` поддерживается |
| `cms-updater` full-stack apply (frontend + миграции + sync) с push-кнопкой и rollback | ✅, по ответу пользователя — **трогать не надо** |
| Pairing UI (`ServerIdentityPanel`, pair-cli.js) | ✅ |
| Seed defaults на свежей локалке (роли, столы, wallets, chip colors) | ✅ |

## Что нужно построить

### Блок A — Initial bulk push **Local → Cloud** (для Кейса 1)

Сейчас `cms-sync` push-ит только строки из `sync_outbox`, а исторические данные туда не попадают. Нужно один раз при пейринге залить всё.

**A1. Новый RPC `sync.seed_outbox_from_existing(casino_id, since_iso DEFAULT NULL)`**
- Внутри Postgres: для каждой таблицы из whitelist (тот же список, что в `cloud-seed-export`) делает `INSERT INTO sync_outbox (...) SELECT ... FROM <table> WHERE casino_id=$1` с `op='INSERT'`, `origin_node_id=<self>`, `changed_at=COALESCE(updated_at, created_at, now())`.
- Идемпотентный: использует `ON CONFLICT DO NOTHING` на уникальном ключе `(casino_id, table_name, pk_hash)` в новой служебной таблице `sync.seed_marker`, чтобы повторный вызов не дублировал outbox.
- Возвращает counts по таблицам.

**A2. CLI команда `pair-cli.js seed-push`**
- Вызывает RPC, ждёт пока `cms-sync` обычным циклом протолкнёт всё в Cloud, выводит прогресс по `last_push_cursor` против `MAX(id)` в `sync_outbox`.

**A3. UI checkbox в pairing dialog** (`ServerIdentityPanel`)
- Чекбокс **"Upload existing local data to Cloud (full mirror)"**, по умолчанию **включён** для Кейса 1.
- После approve на Cloud → автоматически дёргает `seed-push`.
- Прогресс-бар "Uploaded X / Y rows".

---

### Блок B — Wipe-and-replace clone **Cloud → Local** (для Кейса 2)

**B1. Кнопка "Clone from Cloud" в `ServerIdentityPanel`**
- Видна только super_admin, только если статус peer = `active`.
- Жёлтый confirm-диалог: "This will DELETE all local data for casino `<name>` and replace it with the Cloud copy. Local users will be logged out. Casino downtime ~3–5 minutes."
- Требует ввести имя казино для подтверждения (как при удалении репы в GitHub).

**B2. Backend endpoint `cms-sync` `/api/node/clone-from-cloud`**
- Auth: super_admin JWT.
- Шаги:
  1. `compose pause cms-sync` (чтобы outbox не дрейфовал во время операции).
  2. `BEGIN; TRUNCATE <data tables> WHERE casino_id=$1 RESTART IDENTITY CASCADE;` — список тот же, что в `cloud-seed-export.TABLES` со scope=`full`. Конфиг/seed-таблицы (role_module_defaults и т.д.) НЕ трогаем.
  3. Сбрасываем `sync.outbox` для этого casino_id и обнуляем `peer_links.last_pull_cursor=0`, `last_push_cursor = (SELECT MAX(id) FROM sync_outbox)` (чтобы НЕ пушить обратно свежезалитое).
  4. Стримим `cloud-seed-export?casino_id=...&days=all` через `x-sync-secret`, импортируем NDJSON прямо в БД c `set_config('sync.applying','on',true)` → триггеры не пишут в outbox.
  5. `COMMIT; compose unpause cms-sync`.
- Возвращает counts.
- Идемпотентность: на любой ошибке — `ROLLBACK`, локалка остаётся как была.

**B3. UI прогресс** — реюзаем существующий компонент initial-sync progress.

---

### Блок C — Двусторонний sync после initial (общий для Кейсов 1 и 2)

Сейчас peer-mesh уже двусторонний, **но**:
- `sync_outbox.TABLES` в `02-sync-outbox.sql` (local) и в Cloud-миграции должны **совпадать ровно** со списком таблиц в `cloud-seed-export`. Сейчас в outbox нет `gaming_tables`, `chip_color_settings`, `financial_wallets`, `chip_initial_baseline`, `chip_baseline`, `chip_inventory`, `budget_*`, `dealers`, `staff_members`, `player_cards`, `player_groups`, `group_members`, `daily_summaries`, `cash_counts`, `cash_count_snapshots`, `cashless_transactions`, `bank_checks`, `cctv_observations`, `chip_transfers`, `player_position_history`, `inter_casino_transfers`, `table_tracker`, `table_daily_results`, `user_casino_access`, `user_module_permissions`, `business_day_closures`. **Добавить.**
- В Cloud повторить тот же `sync.attach(...)` для тех же таблиц (миграция).

**C1. Миграция: расширить outbox-whitelist** на полный список таблиц (Cloud + local init script одинаково).

**C2. Cloud-side: убедиться что `peer_apply_change` принимает все эти таблицы** (там сейчас allowlist) и что RLS не блокирует service-role upsert.

---

### Блок D — Roles/Auth для удалённого Cloud-доступа

Когда локалка стала источником истины (Кейс 1) или зеркало живёт параллельно (Кейс 2):
- Fin Director / CCTV логинятся в Cloud `mwanza.casinosystem.app` обычным паролем.
- Их `user_casino_access` и `profiles` синкаются через outbox из локалки.
- Никакой специальной логики не нужно — главное, чтобы `user_casino_access` попал в outbox (см. C1).

---

### Блок E — Mini-fixes для Кейса 3 (push-update)

По ответу пользователя — механизм достаточен. Делаем только:
- Убедиться, что в `ServerPushUpdateDialog` показывается **current_version каждого сервера** (через `useLocalUpdaterStatus` агрегатно), чтобы super_admin видел кто на чём.
- Добавить колонку "Last seen" в `PeerLinksPanel`, если её нет.

(Не реализовывать, если уже есть.)

---

## Технические детали и риски

### Конфликт UUID при двустороннем sync
- Все наши PK — `gen_random_uuid()`, коллизии практически нулевые. `peer_apply_change` использует `INSERT ... ON CONFLICT (id) DO UPDATE` → последняя запись побеждает (last-write-wins по `changed_at`).
- В Кейсе 1 на момент initial push Cloud пустой → конфликтов нет.
- В Кейсе 2 после wipe локалка пустая → конфликтов нет.

### Скорость initial push (Кейс 1)
- Аруша ~9 месяцев данных ~оценочно 200–500 тыс. строк. При batch=200 и tick=5s это ~3–10 минут — приемлемо для downtime, который пользователь явно разрешил ("3 минуты ок").
- Можно временно поднять `SYNC_BATCH_SIZE=2000` через ENV-флаг "initial sync mode".

### Безопасность wipe (Кейс 2)
- TRUNCATE только таблиц со `scope=full` для конкретного `casino_id` — глобальные справочники (currencies, role_module_defaults) не трогаем.
- Транзакция + pause cms-sync → если что-то падает, локалка не остаётся в полу-состоянии.
- Auto-backup pg_dump перед wipe в `/cms-root/backups/pre-clone-<ts>.sql.gz` (там уже есть cms-backup, переиспользуем).

### Что НЕ делаем
- Не делаем merge-режим — пользователь явно выбрал wipe+replace.
- Не делаем read-only Cloud — оба активны.
- Не трогаем cms-updater (push-кнопка работает).

## Файлы для изменения

```
deploy/postgres/init/02-sync-outbox.sql         — расширить whitelist таблиц
supabase/migrations/<new>.sql                   — sync.seed_outbox_from_existing RPC + extend allowlist
deploy/sync/pair-cli.js                         — команды seed-push, clone-from-cloud
deploy/sync/api.js                              — POST /api/node/clone-from-cloud, /api/node/seed-push
src/components/admin/ServerIdentityPanel.tsx    — чекбокс "Upload existing", кнопка "Clone from Cloud", прогресс
src/hooks/use-server-identity.ts                — новые мутации
supabase/functions/peer-mesh/index.ts           — убедиться allowlist таблиц расширен
package.json                                    — bump patch
mem://features/* (sync engine impl)             — обновить
```

## Порядок выполнения

1. Миграция Cloud + init script: расширить outbox whitelist.
2. RPC `sync.seed_outbox_from_existing` + pair-cli `seed-push`.
3. UI чекбокс для Кейса 1.
4. `cms-sync` endpoint `/clone-from-cloud` + UI кнопка для Кейса 2.
5. Smoke-тест обоих кейсов на тестовой Mwanza локалке.

После approve — выкатываем как **один** релиз (cms-updater подхватит миграции и пересборку sync-контейнера автоматически по push-кнопке).

