# Remote Access via Cloudflare Tunnel

Позволяет открывать локальный on-prem сервер казино из интернета по адресу вида
`https://local-<slug>.casinosystem.app` (например `local-arusha.casinosystem.app`)
для удалённой диагностики и администрирования Lovable-агентом.

**Cloud-инстанс при этом не задет** — он продолжает работать как primary через
свой существующий поддомен (`arusha.casinosystem.app` и т.п.). Кассиры в зале
продолжают ходить на `arusha.local` по LAN — туннель их трафик не трогает.

---

## Архитектура

```text
   Lovable / браузер
         │  HTTPS
         ▼
   local-arusha.casinosystem.app   ◄── Cloudflare DNS (CNAME → tunnel)
         │
         ▼  Cloudflare Tunnel (исходящее TLS от on-prem, без открытых портов)
   cms-cloudflared (Docker, on-prem)
         │
         ▼  http://nginx:80
   cms-nginx → cms-frontend / postgrest / gotrue / cms-sync
         │
         ▼
   локальный Postgres (реальные данные казино)
```

---

## Шаг 1 — Создать туннель в Cloudflare

1. Открыть [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/) →
   **Networks → Tunnels → Create a tunnel**.
2. Выбрать **Cloudflared**, имя: `local-<slug>` (например `local-arusha`).
3. На шаге **Install and run a connector** выбрать **Docker** —
   скопировать **только значение токена** (длинная строка после `--token`).
   Сам Docker-команд запускать не надо, мы используем наш контейнер.
4. На шаге **Route Traffic → Public Hostname**:
   - Subdomain: `local-<slug>`
   - Domain: `casinosystem.app`
   - Type: `HTTP`
   - URL: `nginx:80`
5. Сохранить — Cloudflare автоматически создаст CNAME запись.

---

## Шаг 2 — Включить Cloudflare Access (ОБЯЗАТЕЛЬНО)

Без этого шага в публичный интернет торчит логин-страница локального казино.

1. **Access → Applications → Add an application → Self-hosted**.
2. Application domain:
   - Subdomain: `local-<slug>` (или `local-*` чтобы покрыть все казино)
   - Domain: `casinosystem.app`
3. Policy:
   - Name: `Lovable + admins`
   - Action: `Allow`
   - Include → Emails: `your@email.com`, `<lovable-service-email>`
4. Save.

После этого открытие `local-arusha.casinosystem.app` сначала покажет страницу
авторизации Cloudflare (email magic link), и только потом — локальный login казино.

---

## Шаг 3 — Включить туннель на сервере казино

На самом сервере казино под root:

```bash
sudo casino-update --enable-remote
```

Скрипт спросит токен из Шага 1, сохранит в `/opt/casino-system/deploy/.env`
и поднимет контейнер `cms-cloudflared`.

Проверка:

```bash
sudo docker logs --tail=30 cms-cloudflared
# Должно быть: "Registered tunnel connection" 4 раза (4 edge POP).
```

---

## Отключение

```bash
sudo casino-update --disable-remote
```

Контейнер `cms-cloudflared` останавливается и удаляется, `TUNNEL_TOKEN`
очищается из `.env`. DNS-запись и Access policy остаются в Cloudflare —
если включить туннель снова с тем же токеном, всё подхватится.

---

## Безопасность

- `TUNNEL_TOKEN` хранится только в `.env` локального сервера (`chmod 600`),
  никогда не коммитится в git.
- Cloudflare Tunnel — **исходящее** соединение, входящих портов открывать
  не нужно. NAT, firewall, белый IP не требуются.
- Cloudflare Access — **обязателен**. Без policy любой с URL получает доступ
  к логин-форме казино.
- Если интернет в казино упал, туннель недоступен — но локальная работа
  через `<slug>.local` продолжается без сбоев.

---

## Стоимость

Cloudflare Tunnel + Access (до 50 пользователей в team plan) — бесплатно.

---

## Troubleshooting

**`cms-cloudflared` рестартится в цикле** — токен невалидный или с лишними
пробелами. Перепроверь, что скопировал ровно значение после `--token` (без
самой команды `docker run ...`).

**Открывается, но падает 502** — `nginx` контейнер не запущен или туннель
указывает не на тот URL. В Cloudflare dashboard убедись, что public hostname
указывает именно на `nginx:80` (HTTP, без https).

**Открывается, но логин не работает (CORS / cookies)** — фронт читает
`runtime-config.json` с локального origin и обращается к тому же origin.
Если cookies/CORS ругаются, проверь что `nginx/conf.d/casino.conf` слушает
`server_name _` (по умолчанию так и есть).
