# Plan: подключение GitHub + миграция данных на локальный сервер

## Текущее состояние (проверено)

- **Git remote `origin`** → `lovable.code.storage/8c2793b0-…git` (внутренний Lovable storage). Это нормально, но не GitHub.
- **GitHub remote отсутствует.** Поэтому:
  - `release-onprem.yml` workflow существует, но никогда не запускается.
  - В `ghcr.io/<owner>/cms-frontend` нет ни одного образа.
  - `cms-updater` после старта будет вечно писать `fetch_releases.fail` / `pull.fail` — обновляться не с чего.
  - `install.sh` упадёт на `docker compose pull cms-frontend` (образа нет).
- **Миграция данных** при первой установке локального сервера сейчас **не работает**: `install.sh` создаёт только пустую схему из `supabase/migrations/`. Edge-function `pull-changes` отдаёт операционные таблицы, но НЕ конфиг (employees, gaming_tables, currencies, casino_settings, roles, chip_colors и т.д.).

## Что нужно сделать (3 этапа)

### Этап 1 — Подключить GitHub (делает пользователь, ~3 минуты)

Без этого ничего из остального не имеет смысла.

1. В Lovable: **Connectors → GitHub → Connect project** → авторизовать Lovable GitHub App.
2. Выбрать аккаунт/организацию, нажать **Create Repository** (имя, например, `casino-system`).
3. После создания репозитория: **Settings → Actions → General**:
   - Workflow permissions = **Read and write permissions**
   - **Allow GitHub Actions to create and approve PRs** = on
4. Сообщить мне `GITHUB_OWNER` (owner или org name) и `GITHUB_REPO` (имя репо).

После этого Lovable начнёт двусторонне синхронизировать код с GitHub автоматически, а `release-onprem.yml` запустится на ближайшем push в `main`.

### Этап 2 — Выпустить первый релиз v0.1.0 (делаю я после Этапа 1)

1. Обновить `deploy/env.template`: подставить реальные `GITHUB_OWNER` / `GITHUB_REPO` дефолтами (или оставить пустыми с комментом).
2. Обновить `deploy/README.md` инструкцией: «как создать GitHub Personal Access Token (`read:packages`) для приватного pull из ghcr.io», если репо приватное. Если публичное — токен не нужен.
3. Создать тег `v0.1.0` (через `git tag` в Lovable нельзя, поэтому пользователь делает это в GitHub UI: **Releases → Draft a new release → Choose a tag → v0.1.0 → Publish**). Workflow соберёт образ `ghcr.io/<owner>/cms-frontend:0.1.0` и `:latest` + создаст Release с `migrations-0.1.0.tar.gz`.
4. Проверить что образ виден: `ghcr.io/<owner>/cms-frontend:0.1.0`. Если репо приватное — сделать пакет публичным (Packages → cms-frontend → Settings → Change visibility → Public), чтобы `docker pull` работал без логина.

### Этап 3 — «Seed from Cloud» в install.sh (делаю я)

Цель: при первой установке локального сервера админ вводит данные доступа к Cloud + `casino_id`, и скрипт переносит ВСЕ данные этого казино локально.

#### 3.1. Новая edge-function `cloud-seed-export`
- Вход: `x-service-key` (service_role JWT) + `casino_id` в query.
- Выход: NDJSON-стрим — построчно `{table, row}` для всего, что относится к этому casino_id:
  - **Конфиг (полные таблицы):** `currencies`, `casinos` (только эта строка), `casino_settings`, `gaming_tables`, `chip_colors`, `chip_denominations`, `roles`, `app_modules`, `module_permissions`, `global_categories`, `wallets`, `employees`, `users` + `user_casino_access` + `user_roles` (только относящиеся к этому казино), `players` + `player_cards` (только этого казино).
  - **Операционные данные за последние 90 дней:** `transactions`, `visits`, `breaklist_entries`, `rota_entries`, `cage_shifts`, `chip_count_snapshots`, `table_tracker`, `business_day_closures`, `expenses`, `wallet_ledger`, `cash_count_*`, `bank_checks`, `cctv_observations`, `chip_transfers`, `position_history`.
  - **Storage**: фото сотрудников и документы игроков выгружаем отдельно через signed URLs (этап 3.3).
- Использует `verify_jwt = false` + явная проверка service_role через `supabase.auth.admin.getUser`.

#### 3.2. Расширение `install.sh` — интерактивный шаг 7.5 «Seed from Cloud»
```bash
read -p "Migrate existing data from Cloud? [Y/n] " seed
if [[ "$seed" != "n" ]]; then
  read -p "Cloud Supabase URL: " CLOUD_URL
  read -sp "Service-role key: " CLOUD_KEY
  read -p "Casino ID (UUID): " CASINO_ID

  curl -fsSL "$CLOUD_URL/functions/v1/cloud-seed-export?casino_id=$CASINO_ID" \
    -H "x-service-key: $CLOUD_KEY" \
    | docker compose exec -T postgres node /seed/import.js
fi
```
- `deploy/postgres/seed-import.js` — потоковый NDJSON → `INSERT … ON CONFLICT DO NOTHING` через `pg`. Идёт в порядке зависимостей (FK).
- Запускается ДО старта `cms-sync`, чтобы не было гонок с outbox.

#### 3.3. Storage seeding
- Та же edge-function вторым проходом отдаёт список путей в Storage + signed URL для каждого.
- `install.sh` качает их параллельно (xargs -P 8) и кладёт в локальный `minio` (если используется) или в файловый volume `/storage`.

#### 3.4. После seed
- Прописать в локальную таблицу `sync_state` cursor = `now()`, чтобы `cms-sync` подтягивал ТОЛЬКО изменения после момента seed (не дублировал то, что уже залили).
- Записать в `casino_settings` флаг `seeded_from_cloud_at = now()` для аудита.

## Что остаётся БЕЗ изменений

- `cms-sync` (outbox/inbox loop) — работает как сейчас, после seed просто продолжает с `since=now()`.
- `cms-updater` — после Этапа 2 начнёт находить релизы и обновляться (`AUTO_APPLY=true` или ручной push через Network admin → `update_commands`).
- Frontend, схема БД, миграции — не трогаем.

## Порядок выполнения

| Шаг | Кто | Зависит от |
|----|----|-----------|
| 1. Connect GitHub в Lovable | пользователь | — |
| 2. Сообщить мне owner/repo | пользователь | 1 |
| 3. Обновить env.template + README | я | 2 |
| 4. Создать tag v0.1.0 в GitHub | пользователь | 3 |
| 5. Дождаться зелёного workflow + проверить ghcr.io | пользователь + я | 4 |
| 6. Edge-function `cloud-seed-export` | я | — (можно параллельно с 1-5) |
| 7. `seed-import.js` + правка install.sh | я | 6 |
| 8. Тест: чистая Ubuntu VM → `install.sh` → данные на месте | пользователь | 5+7 |

## Технические детали (для разработчика)

- **Размер дампа.** Для одного казино за 90 дней транзакций обычно <50 МБ NDJSON. NDJSON-стрим избегает буферизации в RAM и edge-function timeout (60s по умолчанию — увеличим до 400s в `supabase/config.toml`).
- **FK-порядок импорта:** casinos → currencies → roles/users → user_casino_access → employees → gaming_tables → chip_* → players → player_cards → транзакционные таблицы.
- **Идемпотентность:** все INSERT с `ON CONFLICT (id) DO NOTHING`. Можно перезапускать seed безопасно.
- **Безопасность service-role key:** ключ вводится в TTY, никогда не пишется в файл. Если админ закроет терминал — придётся ввести заново (не страшно, шаг идемпотентный).
- **Откат:** если seed упал на середине — `docker compose down -v` сносит volume и можно начать заново.

## Что обновится в памяти после выполнения

- `mem://architecture/sync-engine-impl` — добавить раздел «initial seed».
- `mem://architecture/self-hosted-deployment` — упомянуть шаг seed в install.sh.
- Новый файл `mem://architecture/cloud-seed-export` с описанием edge-function и порядка таблиц.
