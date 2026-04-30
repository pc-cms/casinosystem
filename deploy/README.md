# Casino System — On-Premises Deployment

Универсальный установщик для **любой** локации (Arusha, Dodoma, Mbeya, Mwanza, новые филиалы).
Один и тот же `deploy/` каталог — параметры локации задаются мастером при установке.

## Архитектура

```
┌──────────────────────────────────────────────┐
│  Ubuntu 22.04 — один сервер на казино        │
│  ┌────────────────────────────────────────┐  │
│  │ Docker Compose stack                   │  │
│  │   • postgres   (БД, схема из Cloud)    │  │
│  │   • postgrest  (REST API)              │  │
│  │   • gotrue     (auth)                  │  │
│  │   • realtime   (live updates)          │  │
│  │   • storage    (фото игроков)          │  │
│  │   • imgproxy   (resize)                │  │
│  │   • nginx      (TLS + статика фронта)  │  │
│  │   • cms-frontend  (React PWA)          │  │
│  │   • cms-sync      (заглушка → этап C)  │  │
│  │   • cms-updater   (заглушка → этап D)  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
       ▲ HTTPS (LAN, https://arusha.local)
       │
   Кассы / Pit / Cage / Reception / Surveillance (PWA)
```

## Системные требования

| Компонент | Минимум | Рекомендуется |
|---|---|---|
| ОС | Ubuntu Desktop/Server 22.04 | Ubuntu 22.04 LTS |
| CPU | 2 ядра | 4 ядра |
| RAM | 4 GB | 8 GB |
| SSD | 50 GB | 250 GB SSD |
| Сеть | Ethernet 1 Гбит | Ethernet + Wi-Fi для устройств |

## Установка

### Шаг 1. Получите параметры у Premier admin
- `CASINO_ID` (UUID локации из таблицы `casinos`)
- `SYNC_SECRET` (выдаётся при регистрации `local_servers`)

### Шаг 2. Скопируйте `deploy/` на сервер
```bash
scp -r deploy/ user@server:/opt/casino-system/
ssh user@server
cd /opt/casino-system
```

### Шаг 3. Запустите интерактивный мастер
```bash
sudo ./install.sh
```

Мастер задаст вопросы по очереди:

```
1/8  Проверка системы
  ✓ Ubuntu: 22.04
  ✓ Docker: 24.0.7

2/8  Настройка казино
  Название локации (Premier Arusha): _
  Slug (arusha): _
  Локальный IP сервера в сети казино [192.168.1.100]: _
  Локальный домен (arusha.local): _
  CASINO_ID (UUID, выдаёт Premier admin): _
  SYNC_SECRET: _

3/8  Проверка связи с Cloud
  ✓ Cloud доступен
  ✓ Локация найдена в Cloud: Premier Arusha (arusha)

4/8  Генерация криптографических ключей
  ✓ POSTGRES_PASSWORD сгенерирован
  ✓ JWT_SECRET сгенерирован
  ✓ ANON_KEY (JWT) сгенерирован
  ✓ SERVICE_ROLE_KEY (JWT) сгенерирован

5/8  TLS сертификаты
  ✓ CA создан: certs/ca.crt
  ✓ Сертификат для arusha.local (включает IP 192.168.1.100)

6/8  Миграции БД
  ✓ Скопировано 47 миграций

7/8  Проверка обновлений образа
  ✓ Версия актуальна: v1.4.2

8/8  Запуск Docker stack
  ✓ Postgres готов
  ✓ systemd unit установлен

  ✓ Установка завершена!
```

Скрипт сделает всё автоматически:
- Установит Docker (если нет)
- Сгенерирует JWT/ANON/SERVICE_ROLE
- **Проверит связь с Cloud и существование `CASINO_ID`**
- Создаст self-signed CA + сертификат для `LOCAL_DOMAIN` + `LOCAL_IP`
- **Проверит, нет ли свежей версии Docker-образа на GitHub** (если есть `GITHUB_TOKEN`)
- Применит миграции БД
- Поднимет docker compose stack
- Установит systemd `casino-system.service` (автозапуск)

### CLI-режим (для Ansible / автоматизации)

```bash
sudo ./install.sh \
  --slug arusha \
  --name "Premier Arusha" \
  --domain arusha.local \
  --ip 192.168.1.100 \
  --casino-id 11111111-2222-3333-4444-555555555555 \
  --sync-secret your-32-char-secret \
  --github-owner your-org
```

### Шаг 4. Установите CA на клиентские устройства

Файл `deploy/certs/ca.crt` — доверенный корневой сертификат. Без него PWA не установится.

| Платформа | Куда |
|---|---|
| Windows  | `certmgr.msc` → Trusted Root Certification Authorities → Import |
| macOS    | Keychain Access → System → Certificates → drag&drop → Always Trust |
| Android  | Settings → Security → Encryption → Install certificate → CA certificate |
| iOS      | AirDrop → Settings → General → VPN & Device Management → установить → Certificate Trust Settings → Enable Full Trust |
| Ubuntu   | `sudo cp ca.crt /usr/local/share/ca-certificates/casino-ca.crt && sudo update-ca-certificates` |

### Шаг 5. Настройте локальный DNS

**Вариант A** (простой) — `/etc/hosts` на каждом устройстве:
```
192.168.1.100  arusha.local
```

**Вариант B** (правильный) — A-запись в DHCP/DNS роутера: `arusha.local → 192.168.1.100`

## Управление

| Команда | Действие |
|---|---|
| `sudo systemctl status casino-system`     | Статус |
| `sudo systemctl restart casino-system`    | Перезапуск |
| `docker compose ps`                       | Что работает |
| `docker compose logs -f cms-frontend`     | Логи фронта |
| `docker compose logs -f postgres`         | Логи БД |
| `sudo ./install.sh --reconfigure`         | Изменить настройки локации |
| `sudo ./install.sh --check-update`        | Проверить наличие обновлений |
| `docker compose exec postgres psql -U postgres` | psql shell |

## Что специфично для локации

После запуска:

| Файл | Содержимое |
|---|---|
| `https://arusha.local/runtime-config.json` | `casinoId`, `casinoSlug`, `casinoName`, `localMode: true`, `version` |
| `https://arusha.local/manifest-local.json` | Динамически сгенерирован: `"name": "Premier Arusha LOCAL — Casino System"` |
| `https://arusha.local/icon-512-local.png`  | Золотой логотип на чёрном фоне (LAN-PWA) |

PWA, установленные через **облачный** домен (`arusha.casinosystem.app`), используют красную иконку (`/icon-512.png` на фоне `#A0000D`). Локальные через `arusha.local` — чёрную. Это позволяет визуально различать на главном экране устройства, в каком режиме сейчас работает приложение.

## Бэкап БД

```bash
docker compose exec -T postgres pg_dump -U postgres -Fc postgres > backup-$(date +%F).dump
```

Восстановление:
```bash
docker compose exec -T postgres pg_restore -U postgres -d postgres -c < backup-2026-04-30.dump
```

## Синхронизация с Cloud (этап C — реализовано)

`cms-sync` — Node-воркер, поднимается одним контейнером. Принцип: **outbox + idempotent inbox**.

**Local → Cloud (push):**
- Триггеры на ключевых таблицах (`transactions`, `shifts`, `cage_transfers`, `expenses`, `wallet_transactions`, `chip_*`, `casino_visits`, `players`, `breaklist`, `rota`, `activity_logs`, `daily_review`, `budget_*`, …) пишут каждое изменение в `sync.outbox` (см. `postgres/init/02-sync-outbox.sql`).
- Воркер каждые `SYNC_INTERVAL_MS` (по-умолчанию 5 с) забирает батч `SYNC_BATCH_SIZE` (200) и POST-ит в edge function `pull-changes` с заголовками `x-sync-secret` + `x-casino-id`.
- Cloud-функция валидирует пару `(casino_id, sync_secret)` против `local_servers`, делает upsert (с принудительной подменой `casino_id` на авторизованное), пишет в `sync_inbox_log` для идемпотентности.
- При ошибке — экспоненциальный backoff (5 с → 10 → 20 → 40 → max 60 с).

**Cloud → Local (pull):**
- В Cloud аналогичные триггеры пишут в `public.sync_outbox` (доступ только service_role).
- Воркер периодически GET-ит `pull-changes?since=<cursor>&limit=200` — отдаёт изменения для своего `casino_id` или `casino_id IS NULL` (глобальные: blacklist, global players, inter-casino transfers).
- Применяет в транзакции под GUC `SET LOCAL sync.applying='on'` — триггеры outbox это видят и **не** зацикливают изменения обратно.
- Курсор хранится в `sync.cloud_cursor`.

**Оффлайн-поведение:** если Cloud недоступен — outbox растёт, push молча копит. После восстановления связи — выгружается батчами в порядке `id ASC`. GC удаляет `sent_at < now() - 7 days`.

## Авто-обновление (этап D — реализовано)

`cms-updater` — Node-сервис с примонтированным `docker.sock` и каталогом `/compose`.

**Цикл (каждые `CHECK_INTERVAL_MINUTES`, по-умолчанию 60):**
1. `fetch https://api.github.com` — если интернета нет, тихо ждём следующий цикл.
2. `GET /repos/${OWNER}/${REPO}/releases/latest` (с `GITHUB_TOKEN` если задан).
3. Семантическое сравнение `tag_name` с `FRONTEND_VERSION` из `.env`.
4. Если новее → `docker pull ghcr.io/${owner}/cms-frontend:<latest>` (валидация наличия в registry).
5. **Если `AUTO_APPLY=true`:**
   - Сохраняет `PREVIOUS_VERSION = <current>` в `.env`.
   - Меняет `FRONTEND_VERSION = <latest>`.
   - `docker compose up -d cms-frontend nginx`.
   - Health-check `https://nginx/healthz` 30 секунд.
   - При фейле → автоматический rollback (`FRONTEND_VERSION = PREVIOUS_VERSION` + restart).
6. **Если `AUTO_APPLY=false`** (по-умолчанию, безопасный режим):
   - Только записывает `/compose/UPDATE_AVAILABLE` с метаданными.
   - Админ применяет вручную: `sudo ./install.sh --upgrade-to <version>`.

**Логи:** структурированный JSON в `/compose/updater.log` + stdout контейнера.

**Ручные команды:**
```bash
docker compose logs -f cms-updater                # смотреть live
cat updater.log | jq 'select(.lvl=="error")'     # все ошибки
cat UPDATE_AVAILABLE                              # есть ли ожидающее обновление
sudo ./install.sh --check-update                  # форсированная проверка
sudo ./install.sh --upgrade-to v1.4.2             # ручной апгрейд
```

## Что будет реализовано позднее

| Этап | Что |
|---|---|
| **E** | Полная инструкция для IT-админа казино: kiosk-режим для Surveillance, мониторинг, удалённый VPN-доступ |

## Безопасность

- Postgres слушает только `127.0.0.1` — никогда наружу
- HTTPS с self-signed CA обязателен (PWA требует TLS)
- `sync_secret` уникален на казино, валидируется в облачном `push-data`
- JWT срок 10 лет — auth полностью отделён от Cloud (Cloud-пароли реплицируются в Local на этапе C)
- При установке проверяется связь с Cloud и существование `CASINO_ID` в реестре
