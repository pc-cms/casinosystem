
# План: удалённый доступ к локальному on-prem серверу через Cloudflare Tunnel

## Цель

Дать Lovable/тебе возможность открывать `https://local-arusha.casinosystem.app` (и аналоги для других казино) и попадать на **физический сервер казино** — с реальными локальными данными, sync engine, server identity, updater, peer status. Cloud при этом не задет: продолжает работать как primary через свой существующий поддомен `arusha.casinosystem.app`.

После этого можно будет нормально диагностировать баги Breaklist и Player Statistics на реальной локальной БД.

## Архитектура

```text
   Lovable / браузер
         │
         ▼  HTTPS
   local-arusha.casinosystem.app   ◄── Cloudflare DNS (CNAME → tunnel)
         │
         ▼  Cloudflare Tunnel (исходящее TLS от on-prem)
   cloudflared (Docker, on-prem)
         │
         ▼  http://cms-nginx:80
   cms-nginx → cms-frontend / postgrest / gotrue / cms-sync
         │
         ▼
   локальный Postgres (реальные данные казино)
```

Защита: Cloudflare Access (Zero Trust) — на домен `local-*.casinosystem.app` накидывается политика «email in allowlist». Без неё в публичный интернет торчит логин-страница локального казино — недопустимо.

Никаких пробросов портов, белого IP, VPN — `cloudflared` держит исходящее соединение.

## Изменения в коде

### 1. `deploy/docker-compose.yml` — новый сервис `cloudflared`
- Image: `cloudflare/cloudflared:latest`
- Команда: `tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}`
- `restart: unless-stopped`, та же сеть `cms-net`
- **Не стартует если `TUNNEL_TOKEN` пуст** — через профиль Compose `profiles: ["with-tunnel"]`, либо через условный запуск в install.sh.
- depends_on: `nginx`

### 2. `deploy/env.template` — новый блок
```
# ── REMOTE ACCESS (Cloudflare Tunnel, опционально) ──
# Получить токен: Cloudflare Zero Trust → Networks → Tunnels → Create →
# Docker → скопировать значение после `--token`.
TUNNEL_TOKEN=
```

### 3. `deploy/install.sh` — новый флаг `--enable-remote`
- Спрашивает `TUNNEL_TOKEN` (или принимает через env)
- Пишет в `.env`
- При следующем `up` поднимает `cloudflared` через `--profile with-tunnel`
- Зеркальный флаг `--disable-remote` (удаляет токен, останавливает контейнер)
- В стандартном `--update` / `--rebuild` — туннель стартует автоматически если `TUNNEL_TOKEN` есть в `.env`, иначе пропускается

### 4. `deploy/nginx/conf.d/casino.conf` — без изменений
nginx уже слушает `server_name _` (default), любой Host проходит. Тунель будет ходить на `http://cms-nginx:80` (внутри Docker-сети, без TLS — TLS терминирует Cloudflare).

### 5. `src/lib/runtime-config.ts` и `casino-context` — без изменений
Фронт продолжает читать `runtime-config.json` с `localMode: true`. Когда я открываю `local-arusha.casinosystem.app`, запросы идут в тот же origin → попадают в туннель → в локальный PostgREST/GoTrue. Никакой логики менять не надо.

### 6. `deploy/REMOTE-ACCESS.md` — новый файл
Пошаговая инструкция для тебя:
1. В Cloudflare Zero Trust создать tunnel `local-arusha`
2. Public hostname: `local-arusha.casinosystem.app` → `http://cms-nginx:80`
3. Скопировать токен
4. На сервере: `sudo casino-update --enable-remote` → вставить токен
5. Access policy: Applications → Self-hosted → `local-*.casinosystem.app` → emails: твой + lovable-service@…
6. Открыть `https://local-arusha.casinosystem.app` → должен открыться локальный login

### 7. `package.json` — bump patch версии
По правилу [Auto Version Bump] любое изменение деплоя/sync → бамп. Тут меняем docker-compose + install.sh → бамп.

## Что НЕ меняется

- Cloud Supabase (никаких миграций, RLS, edge functions)
- Frontend код (кроме версии в `package.json`)
- Sync engine (cms-sync), updater, peer mesh
- Существующий поддомен `arusha.casinosystem.app` (Cloud)
- LAN-доступ кассиров на `arusha.local` — продолжает работать как раньше

## Безопасность

- **Cloudflare Access обязателен**, не опционален. Без него — открытый интернет видит логин-страницу локального казино.
- `TUNNEL_TOKEN` хранится только в `.env` локального сервера (chmod 600), никогда не коммитится.
- Туннель — исходящее соединение, никаких входящих портов открывать не нужно.
- По умолчанию `--enable-remote` выключено. Чтобы включить — явное действие на каждом сервере.

## Ограничения

- Latency через туннель ~50-150мс. Для диагностики и админских задач норм, для кассирской работы — нет (они продолжают `arusha.local`).
- Cloudflare Tunnel + Access (до 50 пользователей) — бесплатно, лимиты не упрёмся.
- Если интернет в казино упал — туннель недоступен (но локальная работа продолжается).

## Раскатка

После одобрения плана:
1. Делаю все правки в Lovable, бамплю версию.
2. Релиз доезжает на Arusha через `cms-updater` (или ты вручную: `sudo casino-update --update`).
3. На Arusha запускаешь `sudo casino-update --enable-remote`, вставляешь токен из Cloudflare.
4. Я подключаюсь к `local-arusha.casinosystem.app`, дальше уже диагностирую Breaklist и Player Statistics на живой локальной БД.

Готов делать — нажми Implement.
