# Casino System — On-Premises Deployment

Локальная установка для одного казино на Ubuntu Desktop / Server 22.04+.

## Архитектура (этап A — фундамент)

```
┌──────────────────────────────────────────────┐
│  Ubuntu 22.04 — один сервер на казино        │
│  ┌────────────────────────────────────────┐  │
│  │ Docker Compose stack                   │  │
│  │   • postgres   (БД, schema из Cloud)   │  │
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
       ▲ HTTPS (LAN)
       │
   Кассы / Pit / Cage / Reception (PWA)
```

## Системные требования

| Компонент | Минимум | Рекомендуется |
|---|---|---|
| ОС | Ubuntu Desktop/Server 22.04 | Ubuntu 22.04 LTS |
| CPU | 2 ядра | 4 ядра |
| RAM | 4 GB | 8 GB |
| SSD | 50 GB | 250 GB SSD |
| Сеть | Ethernet 1 Гбит | Ethernet + Wi-Fi для устройств |

## Установка (этап A)

### Шаг 1. Получите параметры у Premier admin
- `CASINO_ID` (UUID казино из таблицы `casinos`)
- `CASINO_SLUG` (`arusha`, `dodoma`, `mbeya`, `mwanza`)
- `SYNC_SECRET` (выдаётся при регистрации `local_servers`)

### Шаг 2. Скопируйте deploy/ на сервер
```bash
scp -r deploy/ user@arusha-server:/opt/casino-system/
ssh user@arusha-server
cd /opt/casino-system
```

### Шаг 3. Заполните .env
```bash
sudo cp env.template .env
sudo nano .env
# Заполните: CASINO_ID, CASINO_SLUG, LOCAL_DOMAIN, SYNC_SECRET
```

`LOCAL_DOMAIN` — например `arusha.local`. Должен совпадать с тем, что вы будете прописывать в `/etc/hosts` на клиентских устройствах (или в DNS роутера).

### Шаг 4. Запустите installer
```bash
sudo ./install.sh
```

Скрипт автоматически:
- Установит Docker (если нет)
- Сгенерирует все JWT-ключи и пароль БД
- Создаст self-signed CA + серверный сертификат для `arusha.local`
- Применит миграции БД из `supabase/migrations/`
- Поднимет docker compose stack
- Установит systemd сервис `casino-system.service` (автозапуск при ребуте)

### Шаг 5. Установите CA на клиентские устройства

Файл `deploy/certs/ca.crt` нужно установить как **доверенный корневой сертификат** на каждом устройстве, которое будет открывать `https://arusha.local`. Без этого PWA не установится.

| Платформа | Куда |
|---|---|
| Windows  | `certmgr.msc` → Trusted Root Certification Authorities → Import |
| macOS    | Keychain Access → System → Certificates → drag&drop → Always Trust |
| Android  | Settings → Security → Encryption → Install certificate → CA certificate |
| iOS      | AirDrop файла → Settings → General → VPN & Device Management → установить → затем Certificate Trust Settings → Enable Full Trust |
| Ubuntu   | `sudo cp ca.crt /usr/local/share/ca-certificates/casino-ca.crt && sudo update-ca-certificates` |

### Шаг 6. Настройте локальный DNS

**Вариант A** (простой) — `/etc/hosts` на каждом устройстве:
```
192.168.1.100  arusha.local
```

**Вариант B** (правильный) — A-запись в DHCP/DNS роутера: `arusha.local → 192.168.1.100`

## Управление

| Команда | Действие |
|---|---|
| `sudo systemctl status casino-system`  | Статус |
| `sudo systemctl restart casino-system` | Перезапуск |
| `docker compose ps`                    | Что работает |
| `docker compose logs -f cms-frontend`  | Логи фронта |
| `docker compose logs -f postgres`      | Логи БД |
| `docker compose exec postgres psql -U postgres` | psql shell |

## Бэкап БД

```bash
docker compose exec -T postgres pg_dump -U postgres -Fc postgres > backup-$(date +%F).dump
```

Восстановление:
```bash
docker compose exec -T postgres pg_restore -U postgres -d postgres -c < backup-2026-04-30.dump
```

## Что будет реализовано позднее

| Этап | Что |
|---|---|
| **B** | Сборка `cms-frontend` Docker-образа из исходников (`Dockerfile.frontend`), отдельные локальные PWA-манифесты с оранжевой иконкой |
| **C** | Реальный двусторонний sync: `cms-sync` слушает WAL Postgres и пушит в облачную edge function `push-data`, плюс новая `pull-changes` функция тянет обновления из облака |
| **D** | Авто-обновления: GitHub Actions собирают Docker-образ при каждом push в `main`, `cms-updater` раз в час чекает GitHub Releases и подтягивает новый образ. Откат за 30 секунд через `docker compose up cms-frontend:vX-1` |
| **E** | Полная инструкция для IT-админа казино: установка CA на каждом устройстве, настройка kiosk-режима для Surveillance, мониторинг |

## Безопасность

- Postgres слушает только `127.0.0.1` — никогда наружу
- HTTPS с self-signed CA обязателен (PWA требует TLS)
- `sync_secret` уникален на казино, валидируется в облачном `push-data`
- JWT срок 10 лет — для удобства локальной работы (auth полностью отделён от Cloud)
- Локальные пароли пользователей реплицируются однонаправленно из Cloud → Local при следующих этапах
