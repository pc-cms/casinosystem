
# Архитектура self-hosted развёртывания и обновлений

## 1. Целевая топология

Принцип: **Offline-first зеркало**. Локальный сервер — главный источник правды для своего казино. Облако (`arusha.casinosystem.app`) — это реплика для удалённого доступа, Premier/CCTV, Finance Manager и Super Admin.

```text
                  ┌─────────────────────────────┐
                  │   Lovable Cloud (Supabase)  │
                  │   *.casinosystem.app        │
                  │   Premier / Finance / HR    │
                  └──────────▲──────────────────┘
                             │ HTTPS push/pull
            ┌────────────────┼─────────────────┐
            │                │                 │
   ┌────────┴──────┐ ┌───────┴──────┐ ┌────────┴──────┐
   │ ARUSHA local  │ │ DODOMA local │ │ MBEYA local   │
   │ Ubuntu Server │ │ Ubuntu       │ │ Ubuntu        │
   │ Docker stack  │ │ Docker       │ │ Docker        │
   │ arusha.local  │ │ dodoma.local │ │ mbeya.local   │
   └───┬───────────┘ └──────────────┘ └───────────────┘
       │ LAN (Wi-Fi / Ethernet)
   ┌───▼─────────────────────────────────┐
   │ Cashier / Pit / Cage / Reception    │
   │ PWA "Casino System Local — Arusha"  │
   └─────────────────────────────────────┘
```

Каждое казино = независимый Docker-стек. Cloud остаётся как агрегатор и удалённый доступ.

---

## 2. Стек локального сервера (Ubuntu Desktop 22.04)

Один Docker Compose поднимает всё:

| Сервис | Назначение |
|---|---|
| `postgres` | Локальная Postgres 15 (зеркало схемы Cloud) |
| `postgrest` | REST API на порту 3000 (заменяет Supabase JS API) |
| `gotrue` | Auth (логины, JWT — те же email/пароли что в облаке) |
| `realtime` | Supabase Realtime для live-обновлений в LAN |
| `storage-api` | Локальное хранилище фото игроков и документов |
| `imgproxy` | Ресайз изображений |
| `nginx` | TLS-термination, отдаёт статику фронта, проксирует API |
| `cms-frontend` | Готовый билд React (volume с актуальной версией) |
| `cms-sync` | Node-сервис: двусторонний sync с Cloud (push-data + pull-data) |
| `cms-updater` | Cron-сервис: раз в час чекает GitHub Releases и тянет обновление |
| `watchtower` | Авто-обновление образов БД/Postgrest (security patches) |

**Важно про Ubuntu Desktop 22**: GUI оставляем (нужно для Surveillance/CCTV), но сервер должен запускаться как `systemd`-сервис, не зависящий от логина пользователя в графику. Браузер для Surveillance запускается в kiosk-режиме (Chromium `--app=https://arusha.local`).

---

## 3. Способ доставки обновлений: GitHub Actions → локальный pull

### Pipeline

```text
1. Lovable редактор → push в main (через GitHub integration)
2. GitHub Actions:
   a) npm ci && npm run build (готовый dist/)
   b) сборка Docker-образа cms-frontend:vX.Y.Z
   c) пуш в GitHub Container Registry (ghcr.io/<org>/cms-frontend)
   d) создание GitHub Release с changelog + sha256
3. Локальный cms-updater (раз в час):
   a) GET https://api.github.com/repos/.../releases/latest
   b) сравнивает с текущей установленной версией
   c) если новее — docker pull, docker compose up -d --no-deps cms-frontend
   d) запускает pending миграции БД (см. п. 4)
   e) шлёт уведомление администратору (email/Telegram)
4. PWA на устройствах: SW автоматически подхватывает новый билд
   (механизм chunk-recovery + manual "Force Update" уже сделан)
```

### Почему именно GitHub Releases (а не raw git pull)

- **Атомарность**: одна версия = один Docker-образ. Не бывает "недокачанных" обновлений
- **Откат за 30 секунд**: `docker compose up cms-frontend:vX.Y.Z-1`
- **Подпись**: sha256 проверяется перед установкой — защита от MITM
- **Без git на проде**: меньше зависимостей, нет необходимости в SSH-ключах

### GitHub нужен?

Да, но только как **транспорт артефактов и реестр версий**. Никто на локальном сервере не делает `git pull`. Только `docker pull ghcr.io/...`. На Lovable стороне GitHub уже подключён (есть в memory).

---

## 4. Миграции БД

Каждое обновление может содержать миграции схемы. Логика:

```text
cms-updater при старте:
  1. Получает версию миграций из meta-таблицы schema_migrations
  2. Скачивает /migrations/*.sql из Release
  3. Применяет только не применённые
  4. Если миграция падает — откатывает контейнер фронта на старую версию
```

Миграции **должны быть идемпотентными** и **обратимыми** (или хотя бы не ломать старую версию фронта на час, пока админ не среагирует).

Используем те же `supabase/migrations/*.sql`, что уже есть в репо — они подходят и для self-hosted Postgres.

---

## 5. Двусторонняя синхронизация Local ↔ Cloud

### Push (Local → Cloud) — уже частично реализован
Функция `push-data` готова. Расширяем `cms-sync` сервис:

- Слушает Postgres `LISTEN/NOTIFY` или WAL через `wal2json`
- Пакует изменения в батчи по 50 записей или раз в 5 секунд (что раньше)
- Отправляет в `push-data` с `sync_secret`
- При ошибке — кладёт в `outbox` таблицу, ретрай с экспоненциальным backoff (уже есть паттерн)

### Pull (Cloud → Local) — нужно добавить
Новая edge function `pull-changes`:

- Принимает `last_sync_at` от локального сервера
- Возвращает изменения из Cloud, которые касаются этого казино + global (players network-wide, blacklist, employees-cross-casino)
- `cms-sync` применяет изменения через UPSERT с разрешением конфликтов **last-write-wins по `updated_at`** для большинства таблиц, и **manual review** для финансовых

### Что НЕ синкается
- `cash_counts`, `chip_snapshots`, `wallet_transactions` — only push (локальное → облако), Cloud не имеет права писать обратно
- `activity_logs` — only push
- `auth.users` — однонаправленно из Cloud (центральный источник логинов)

---

## 6. PWA: две отдельные

Создаём вторую PWA-конфигурацию для локального доступа:

| | Cloud PWA | Local PWA |
|---|---|---|
| Имя | "Casino System — Arusha" | "Casino System Local — Arusha" |
| start_url | `https://arusha.casinosystem.app` | `https://arusha.local` |
| Иконка | синяя (текущая) | оранжевая (визуально отличаем) |
| Service Worker | есть | есть |
| Manifest | `manifest-arusha.json` (есть) | `manifest-arusha-local.json` (новый) |

Локальная PWA генерируется тем же билдом, но с другим manifest и подменой `VITE_SUPABASE_URL` на `https://arusha.local/api` через `cms-frontend` Dockerfile entrypoint (паттерн уже описан в memory: dynamic patching).

### TLS для arusha.local
Локальный домен требует SSL чтобы PWA устанавливалась. Решение:
- Self-signed CA генерируется при первой установке (`install.sh`)
- CA-сертификат экспортируется на флешку → импортируется в систему/браузер на каждом устройстве (одноразово)
- Альтернатива: купить публичный домен `arusha-local.casinosystem.app` с DNS A-записью на приватный IP `192.168.x.x` + Let's Encrypt DNS-01 challenge. Работает, но требует внешнего DNS

**Рекомендую self-signed CA** — полностью офлайн, никаких внешних зависимостей.

---

## 7. Что физически нужно создать в репо

### Новые файлы
```text
deploy/
├── install.sh                      # bootstrap: docker, compose, CA, env
├── docker-compose.yml              # вся стопка
├── Dockerfile.frontend             # multistage: build → nginx static
├── Dockerfile.sync                 # cms-sync (Node)
├── Dockerfile.updater              # cms-updater (Node + cron)
├── nginx/
│   ├── nginx.conf
│   └── generate-ca.sh
├── env.template                    # CASINO_ID, SYNC_SECRET, GH_TOKEN, ...
├── systemd/
│   └── casino-system.service
└── README.md                       # инструкция для IT-админа казино

.github/workflows/
└── release-onprem.yml              # сборка Docker + GitHub Release

src/lib/
└── runtime-config.ts               # читает /config.json (подменяется в Docker entrypoint)

public/
└── manifest-arusha-local.json      # + по одному на каждое казино
└── manifest-dodoma-local.json
└── manifest-mbeya-local.json
└── manifest-mwanza-local.json

supabase/functions/
└── pull-changes/index.ts           # новая edge function для Local-pull
```

### Доработки существующих
- `src/lib/casino-config.ts` (или аналог): научить читать `runtime-config.ts` для local-режима
- `src/lib/supabase/client.ts`: НЕ ТРОГАЕМ (запрещено), вместо этого Docker entrypoint подменяет `.env`-built-in значения через sed по уникальному маркеру в JS-бандле
- Memory: обновить `architecture/self-hosted-deployment` и `architecture/sync-engine` под фактическую реализацию

---

## 8. Безопасность

- `sync_secret` уникален на казино, хранится в `local_servers.sync_secret` (Cloud) и в `.env` (Local). Ротация через CLI-команду
- GitHub Container Registry — приватный, локальный сервер использует deploy-token (read-only, на одну организацию)
- Self-signed CA имеет срок действия 10 лет, приватный ключ остаётся только на локальном сервере
- Postgres локально слушает только `127.0.0.1` + Docker network, наружу не выставляется
- HTTPS внутри LAN обязателен (PWA не работает без TLS)
- Auth: те же логины из Cloud, но JWT валидируется локальным GoTrue. Пароли реплицируются однонаправленно из Cloud → Local при pull

---

## 9. Порядок реализации (рекомендую разбить на этапы)

1. **Этап A (фундамент)**: `docker-compose.yml`, `install.sh`, локальный Postgres + Postgrest + GoTrue + Nginx + self-signed CA. Цель: открыть `https://arusha.local` и увидеть рабочий логин на пустой БД
2. **Этап B (фронт)**: `Dockerfile.frontend` с runtime-подменой URL, `manifest-*-local.json`, проверить установку PWA
3. **Этап C (sync)**: `cms-sync` + edge function `pull-changes`, начальная заливка данных из Cloud в Local (bootstrap snapshot)
4. **Этап D (обновления)**: `release-onprem.yml`, `cms-updater`, тест полного цикла: коммит в Lovable → через час обновился локальный сервер
5. **Этап E (доки)**: `deploy/README.md` с пошаговым гайдом для IT-админа, видео-инструкция установки CA на Windows/Android/iOS

Каждый этап — отдельный prompt для меня, чтобы не делать одну гигантскую правку.

---

## 10. Ответы на исходные вопросы — кратко

| Вопрос | Ответ |
|---|---|
| ОС локального сервера | Ubuntu Desktop 22.04 LTS (как просили), но сервисы — через systemd, не зависят от GUI |
| Git нужен? | Только в Lovable→GitHub. На локальном сервере — НЕТ, только `docker pull` из ghcr.io |
| Формат обновления | Docker-образ + GitHub Release с sha256 и changelog |
| Как заливаются | GH Actions собирает → ghcr.io → cms-updater на сервере раз в час pull |
| Sync с arusha.casinosystem.app | Двусторонний: push-data (есть) + pull-changes (новая edge function) |
| PWA отдельная для local | Да, отдельный manifest, оранжевая иконка для визуального отличия |
| Что делать если интернета нет вообще | install.sh поддерживает offline-bootstrap из tar-архива (Этап A) |

После одобрения начну с **Этапа A** (фундамент Docker-стека) — это разблокирует тестирование локального запуска. Остальные этапы — отдельными итерациями.
