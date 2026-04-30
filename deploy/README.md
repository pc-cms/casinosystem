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

## Что будет реализовано позднее

| Этап | Что |
|---|---|
| **C** | Реальный двусторонний sync: `cms-sync` слушает WAL Postgres и пушит в облачную edge function `push-data`, плюс новая `pull-changes` функция тянет обновления из облака |
| **D** | Авто-обновления: `cms-updater` раз в час чекает GitHub Releases (через `install.sh --check-update`) и подтягивает новый образ. Откат за 30 секунд через `FRONTEND_VERSION=vX-1` |
| **E** | Полная инструкция для IT-админа казино: kiosk-режим для Surveillance, мониторинг, удалённый VPN-доступ |

## Безопасность

- Postgres слушает только `127.0.0.1` — никогда наружу
- HTTPS с self-signed CA обязателен (PWA требует TLS)
- `sync_secret` уникален на казино, валидируется в облачном `push-data`
- JWT срок 10 лет — auth полностью отделён от Cloud (Cloud-пароли реплицируются в Local на этапе C)
- При установке проверяется связь с Cloud и существование `CASINO_ID` в реестре
