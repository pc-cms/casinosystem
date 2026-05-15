## Цель

Перестроить флоу установки on-prem сервера: ставим **полностью пустую** систему (схема + super_admin), а данные тянем из клауда **после** approve через кнопку «Initial Sync» в админке.

---

## 1. Installer (`deploy/install.sh`) — упростить

**Удалить полностью:**
- Шаг 6.5 «Импорт данных в Postgres» (вызов `cloud-seed-export` + `seed-import.js`).
- Логику `SEED_TOKEN` / `seed-data/seed.json` / preflight psql из seed-контейнера.
- `reset_postgres_volume` оставить, но вызывать только при `--wipe` или `--reset`.

**Добавить:**
- Флаг `--wipe` — полное обнуление: останавливает все контейнеры, удаляет **все** volumes (`postgres_data`, `storage`, `cms-*`, `deploy_*`), удаляет `.env`, `data/`, `runtime-config.json`. Затем продолжает обычную установку с нуля.
- Шаг «Создать super_admin» — спрашивает email + пароль (с подтверждением), вызывает SQL внутри postgres-контейнера: создаёт user в `auth.users` через `gotrue` admin API + строку в `user_roles` (role=`super_admin`). Если email уже есть — пропускает.
- После старта стека и применения миграций → `register-local-server` (pairing flow остаётся как есть, но **без seed_token**).
- Финальное сообщение: «Сервер зарегистрирован. Войдите в облачную админку → Network → Pending servers → Approve → Initial Sync».

**Что меняется в install.sh:**
- `INSTALLER_VERSION` → `1.1.0` (мажор: новая схема установки)
- Убрать `wait_for_postgres` (двойная проверка), оставить только `wait_for_postgres_ready` (pg_isready)
- Убрать обработку `SEED_PSQL_OUT`

---

## 2. Pairing edge function (`register-local-server`) — убрать seed_token

- Убрать `makeSeedToken()` и поле `seed_token` из ответов `GET ?code=` и из upsert в `pending_server_registrations`.
- Миграция: `pending_server_registrations` — оставить колонки `seed_token`, `seed_token_expires_at` (для совместимости), просто перестать писать.

---

## 3. Initial Sync — кнопка в админке

**Новая edge function `initial-sync-trigger`:**
- POST, требует super_admin JWT.
- Body: `{ local_server_id }`.
- Проверяет что сервер `is_online=true` (есть свежий heartbeat ≤ 5 мин).
- Создаёт строку в новой таблице `initial_sync_jobs` (status=`pending`, casino_id, server_id, requested_by, started_at).
- Возвращает `{ job_id, status }`.

**Новая таблица `initial_sync_jobs`:**
- `id uuid pk`, `casino_id uuid`, `local_server_id uuid`, `status text` (pending/running/done/failed), `tables_total int`, `tables_done int`, `rows_total bigint`, `rows_done bigint`, `error text`, `requested_by uuid`, `started_at`, `finished_at`.
- RLS: super_admin читает всё, локальный сервер (через service_role на стороне cms-sync) — свои.

**Логика на стороне локального `cms-sync` (`deploy/sync/index.js`):**
- Каждые 10 сек поллит свой `initial_sync_jobs` через `pull-changes` или прямой select.
- Если есть `pending` job для своего casino_id → status=`running`, начинает full snapshot pull всех whitelisted таблиц (тот же список что в `pull-changes`), батчами по 500 строк, использует существующий applying-GUC чтобы не зациклиться.
- Обновляет `tables_done`/`rows_done` каждый батч.
- На finish → status=`done`. Ошибка → `failed` + error.

**UI — новая кнопка в `src/components/admin/PendingServersPanel.tsx` (или в `NetworkHealthPanel`):**
- На карточке approved-сервера: кнопка **«Initial Sync»** (variant=`default`).
- При клике → подтверждение «Это перезальёт все данные с облака. Продолжить?» → вызов edge function.
- Показывает прогресс (`tables_done / tables_total`, `rows_done / rows_total`) с polling каждые 3 сек пока `status === 'running'`.
- Disabled если сервер offline.
- Кнопка «Re-sync» доступна всегда (для повторного запуска), не только сразу после approve.

---

## 4. Cleanup

- Удалить `deploy/postgres/seed-import.js` и `deploy/postgres/seed-data/`.
- Edge function `cloud-seed-export` — оставить (используется как backup/manual экспорт), пометить deprecated в комментарии шапки.
- `package.json` → bump до `1.1.0`.

---

## 5. Технические детали

**SQL для super_admin** (через psql в postgres-контейнере, gotrue admin API недоступен пока он не запущен → используем прямой insert в `auth.users` с bcrypt-хешем; bcrypt считаем через `node -e "require('bcryptjs').hashSync(...)"` уже доступный в seed-image, либо через `crypt()` из pgcrypto):

```sql
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, ...)
VALUES (gen_random_uuid(), $email, crypt($pass, gen_salt('bf')), now(), ...);
INSERT INTO user_roles (user_id, role) VALUES (..., 'super_admin');
```

**Sync whitelist:** все таблицы кроме `auth.*`, `storage.*`, `realtime.*`, `pending_server_registrations`, `local_servers`, `initial_sync_jobs`, `cms_sync_outbox/inbox`. Список — копия из `pull-changes/index.ts`.

**Идемпотентность:** все insert идут с `onConflict: 'id' ignoreDuplicates: false` (upsert), чтобы повторный sync был безопасен.

---

## Порядок миграций

1. Migration: создать `initial_sync_jobs` + RLS.
2. Edge function `initial-sync-trigger` — deploy.
3. Edge function `register-local-server` — убрать seed_token.
4. `deploy/sync/index.js` — добавить job poller.
5. `deploy/install.sh` — переписать (убрать seed step, добавить --wipe, добавить super_admin creation).
6. UI — кнопка Initial Sync в PendingServersPanel.
7. Удалить `deploy/postgres/seed-import.js` + `seed-data/`.
8. Bump version → `1.1.0`.

---

## После релиза пользователь делает:

```bash
sudo casino-update --wipe
# вводит email + пароль для super_admin
# вводит pairing code в облачной админке
# жмёт Approve → жмёт Initial Sync → ждёт прогресс
```
