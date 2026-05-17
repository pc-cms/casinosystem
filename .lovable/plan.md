# Universal Installer (cms-installer)

Один скрипт, один curl. Никаких `CASINO=mwanza` в командной строке, никаких отдельных `pair.sh` / `update.sh` / `install.sh`. Всё через интерактивное меню.

## Точка входа

```
curl -fsSL https://casinosystem.app/cms | sudo bash
```

Алиас на `public/cms-installer.sh`. Старые URL (`/install.sh`, `/pair.sh`, `/update.sh`) остаются как тонкие враппepы для обратной совместимости — внутри вызывают `cms-installer` с предзаполненным режимом.

## Главное меню

После запуска скрипт показывает состояние машины (есть/нет установка, версия, режим, sync-статус) и меню:

```
Casino Management System — Installer v2

Detected: arusha-local, v1.3.51, Cloud-connected, mirror=ok, replica

  1) Install              — set up a new server
  2) Update               — upgrade code/containers, keep DB
  3) Wipe & Reinstall     — destroy DB + reinstall (asks again)
  4) Status / Diagnostics — version, sync, peers, logs

  q) Quit

Choose [1-4]:
```

Меню — единственный способ запустить любое действие. Никаких флагов. Любая деструктивная операция спрашивает подтверждение фразой `WIPE`.

## Режим 1 — Install

Подрежим:

```
  a) Cloud-connected   — sync with cloud, pick existing casino
  b) Standalone offline — no cloud, optional snapshot restore
```

### 1a — Cloud-connected (универсальный для Arusha / Mwanza / Dodoma / Mbeya)

1. `docker compose up -d` (Postgres + frontend + cms-sync + cms-updater).
2. Скрипт делает запрос к Cloud edge-функции `installer-list-casinos` (новая, public, возвращает `[{slug, display_name, subdomain, active}]` — только активные).
3. Показывает нумерованный список:
   ```
   Available casinos in cloud:
     1) Arusha   (arusha.casinosystem.app)
     2) Mwanza   (mwanza.casinosystem.app)
     3) Dodoma   (dodoma.casinosystem.app)
     4) Mbeya    (mbeya.casinosystem.app)
   Pick [1-4]:
   ```
4. Пользователь выбирает номер → `CASINO_SLUG` сохраняется в `/etc/cms/server.env`.
5. Спрашивает Pair Token (одноразовый, генерится в Cloud Admin → Servers → "Add Server").
6. Прогон `cloud-seed-export` → стрим в локальный Postgres → ждём `mirror=ok` (polling каждые 5с, прогресс-бар).
7. Cloud остаётся primary. Локальный — replica. Конец установки.
8. В UI Admin → Servers пользователь сам нажимает **Promote to Primary** когда хочет.

Этот сценарий покрывает оба исходных кейса (Arusha с полным сидом, Mwanza с почти пустым) — разница только в объёме данных, логика одна.

### 1b — Standalone offline

1. `docker compose up -d`.
2. Спрашивает: пустая БД или snapshot?
3. Если snapshot — спрашивает источник: `local file path` или `URL`. Скачивает/читает, `pg_restore` в локальный Postgres.
4. Создаётся локальный super_admin. Sync выключен (`CMS_SYNC_ENABLED=false`).
5. Casino slug либо берётся из snapshot, либо запрашивается вручную (только в этом режиме допустим ручной ввод).

## Режим 2 — Update

1. `cms-updater` pull последнего тега из GitHub Releases.
2. `docker compose pull && up -d`.
3. БД не трогается. Миграции применяются автоматически (idempotent).
4. Версия в `/etc/cms/version` обновляется.

## Режим 3 — Wipe & Reinstall

1. Требует ввод `WIPE` в верхнем регистре.
2. `docker compose down -v` (удаляет volume Postgres).
3. Удаляет `/etc/cms/server.env` и pair-token.
4. Возвращается в меню Install (1a или 1b).

## Режим 4 — Status / Diagnostics

Печатает:
- Версия фронтенда + БД миграций
- Режим (cloud / standalone), casino slug
- Sync: cursor, outbox lag, последний обмен, peers
- Контейнеры (docker ps)
- Последние 50 строк логов cms-sync

Только чтение, ничего не меняет.

## Bootstrap super_admin — local-only

Подтверждённое решение:

- При **любой** установке создаётся локальный super_admin `admin@local` с паролем из `/etc/cms/server.env` (генерится случайно при первой установке, показывается один раз).
- Этот пользователь **никогда** не реплицируется в Cloud. Триггер `cms_sync_outbox` исключает `auth.users` где `email LIKE '%@local'` и связанные `user_roles`.
- При Cloud-connected установке Cloud-овский super_admin приходит через seed и работает параллельно.
- Если интернет упал — `admin@local` всегда доступен на `http://<server>.local`.
- При promotion to Primary локальный super_admin остаётся, Cloud-овский продолжает работать (они независимы).

## Что нужно построить

### Новое
- `public/cms-installer.sh` — единый интерактивный скрипт (меню, цвета, подтверждения, polling).
- Edge function `installer-list-casinos` — публичный список активных казино (slug, display_name, subdomain).
- Edge function `installer-issue-pair-token` уже существует как часть `peer-mesh` — переиспользуем.
- Кнопка **Add Server** в `ServersPanel.tsx` — генерит pair-token, копируется в буфер, показывается команда `curl ... | sudo bash`.

### Изменения
- `public/install.sh`, `public/pair.sh`, `public/update.sh` → тонкие враппepы, делают `exec curl .../cms` с переменной `CMS_PREFILL_MODE=install|pair|update` (только для backward compat; новые пользователи всегда видят меню).
- `deploy/install.sh` → удаляется (логика переезжает в `cms-installer.sh`, который работает как из curl, так и локально).
- Sync outbox trigger → добавить exclusion для `@local` super_admin.
- `ServersPanel.tsx` → блокировка кнопки **Promote to Primary** пока `mirror_status != 'ok'` (уже обсуждалось, добавим в этом же подходе).

### Удаляется
- Логика `SKIP_SEED` и явный `Reset Cloud Data` flow из `pair.sh` — в новом скрипте Reset Cloud — это отдельная кнопка в Cloud Admin, не часть установщика. Standalone-режим заменяет необходимость в SKIP_SEED.

## Безопасность

- Pair-token одноразовый, TTL 1 час, привязан к выбранному casino_slug на стороне Cloud. Невозможно ошибиться казино — токен валиден только для одного.
- `WIPE` подтверждение исключает случайный выбор пункта 3.
- Локальный super_admin пароль показывается один раз при первой установке + сохраняется в `/etc/cms/server.env` (root-only, 0600).
- Список казино публичный (slug + display_name + subdomain), без чувствительных данных.

## Документация

Один файл `deploy/INSTALL.md`:

```
# Установка
curl -fsSL https://casinosystem.app/cms | sudo bash
# Дальше следуй меню.
```

Всё. Никаких 25 шагов.
