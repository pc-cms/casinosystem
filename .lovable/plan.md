
## Вводные (зафиксированы)

- Пилот — **MWZ** (Mwanza on-prem железо), новый поддомен `mwz.casinosystem.app`.
- Существующие `arusha/mwanza/dodoma/mbeya.casinosystem.app` — **не трогаем**, остаются Cloud.
- NS-делегация `casinosystem.app` на Cloudflare — **OK** (вы подтвердили).
- Cloudflare-аккаунт — **уже есть**.
- Tailscale — **пропускаем**. Единственный канал Lovable↔сервер = **Cloudflare Tunnel** (HTTPS).
- MWZ-железо готово, есть SSH для одной команды.

## Опыт оператора (всё, что физически делает человек)

### Один раз в терминале
```bash
curl -fsSL https://casinosystem.app/install | sudo bash -s -- --slug=mwz
```
Скрипт ставит docker, cloudflared, поднимает контейнеры, печатает URL вида `http://192.168.x.x:8088/setup` + 8-значный pairing-код. Дальше — **ноль вопросов в терминале**.

### Браузер, 3 экрана визарда (≈3 мин)

**Экран 1 — Pairing.** Логин super_admin → выпадающий список локаций → «Mwanza» → **Approve**. (Это уже работает сегодня в `Admin → Network → Pending`, только под новым slug `mwz`.)

**Экран 2 — Public domain (Cloudflare Tunnel).** «Domain: `mwz.casinosystem.app`». Одна кнопка **Connect via Cloudflare**. Открывается `cloudflared tunnel login` во всплывающем окне → ваш CF-аккаунт → Authorize. Под капотом визард создаёт tunnel, DNS-запись `mwz.casinosystem.app → <tunnel>.cfargotunnel.com`, systemd unit `cloudflared.service`. Через ~30 сек экран зеленеет: `mwz.casinosystem.app → online`.

**Экран 3 — Done.** Зелёные галки: Postgres, Sync, Cloud pairing, Public domain. Кнопка **Open casino** ведёт на `https://mwz.casinosystem.app`.

Никакого ручного редактирования `.env`, `docker-compose.yml`, `cloudflared/config.yml`.

## Что Lovable получает после визарда

Единый Cloud-side edge function `node-control(slug, action, payload)` подписывает HMAC и проксирует через `https://mwz.casinosystem.app/api/admin/*`:

| Action | Что делает |
|---|---|
| `status` | версия фронта/sync, длина outbox, аптайм |
| `query` | read-only SQL (тимаут 10s, `SET TRANSACTION READ ONLY`) — для дебага данных |
| `migrate` | накатить SQL-миграцию идемпотентно, лог в `schema_migrations_local` |
| `update` | дёрнуть локальный cms-updater сразу (без ожидания 5-мин polling) |
| `restart` | `docker compose restart <service>` через sync-контейнер |

Я **никогда** не вижу HMAC-секрет — он хранится только в Cloud (`onprem_channels.hmac_secret_hash`) и подписывает запросы за меня. Slug в каждом запросе валидируется на Cloud-стороне — я физически не могу гонять SQL не в тот сервер.

Если Cloudflare Tunnel умер (редко, но бывает) — клиенты в LAN продолжают работать через `nginx` напрямую, PWA — оффлайн. Я в этот момент теряю только удалённый доступ; ничего в казино не ломается.

## Цикл разработки и обновлений (как живём дальше)

1. Я меняю код в Lovable → коммит в `pc-cms/casinosystem`.
2. CI (`release-onprem.yml`, уже есть) собирает релиз: tarball исходников + копирует `supabase/migrations/*.sql` → `deploy/postgres/migrations/`.
3. На сервере **cms-updater** (уже есть, memory: «Auto-Updater») раз в 5 мин опрашивает GitHub Releases. С `AUTO_APPLY=true` (по умолчанию для пилота): сам качает, применяет миграции, перезапускает контейнеры, делает rollback при провале health-check.
4. Для срочных hotfix-ов — `node-control(slug:'mwz', action:'update')`. Апдейт прилетает за минуту, не ждём polling.
5. Если совсем сломалось — я смотрю `node-control(action:'query', ...)` логи `sync_log`/`schema_migrations_local`, фикс, новый релиз, polling/`update` подтягивает.

**Оператор в нормальном режиме не открывает терминал.** В `Admin → Server` есть кнопки «Check for updates / Restart services», статус, версия — всё.

## Cloudflare: пошаговая инструкция (один раз, ~15 мин)

1. `dash.cloudflare.com` (ваш существующий аккаунт) → **Add a site** → `casinosystem.app` → Free plan.
2. Cloudflare покажет 2 nameserver'а (типа `xena.ns.cloudflare.com`).
3. У регистратора `casinosystem.app` поменять NS на эти два. Существующие A/CNAME (`arusha/mwanza/dodoma/mbeya/premier/www/@`) Cloudflare **импортирует автоматически** — Cloud-инстансы продолжат работать без простоя. Сверить импорт глазами в Cloudflare DNS перед сменой NS.
4. Cloudflare → **Zero Trust** → создать team-name (бесплатно) → **Networks → Tunnels** — просто открыть раздел (создавать ничего руками не надо).
5. Готово. Дальше всё делает визард на Шаге 2.

Бэкап-вариант, если NS-перенос вдруг отложится: subzone `onprem.casinosystem.app` отдельной NS-делегацией → домены станут `mwz.onprem.casinosystem.app`. В коде уже учтено флагом `CASINO_TUNNEL_PARENT`.

## Почему я уверен на 1000%, что это правильная схема

1. **Cloudflare Tunnel — стандарт 2026** для доступа к серверу за NAT/CGNAT: без открытых портов, без статических IP, бесплатно (~50 GB/мес ≫ нашего трафика), HTTPS-сертификат и его ротация автоматические.
2. **Падение туннеля ≠ падение казино.** LAN-клиенты ходят на локальный `nginx` по IP — это уже сделано. Туннель нужен только мне + для push в Cloud.
3. **cms-updater уже работает** — не изобретаем велосипед, добавляем только один endpoint для мгновенного апдейта.
4. **Cloud остаётся source of truth для схемы.** Текущий workflow миграций не ломается, добавляется только канал доставки на on-prem.
5. **HMAC + slug-валидация** = я не могу случайно отправить SQL не в тот сервер.
6. **Откатываемость одной командой.** `sudo casino-update --unregister-channel` сносит tunnel + запись в Cloud → сервер возвращается к «обычной on-prem инсталляции без удалёнки».
7. Соответствует существующему правилу из memory: «On-prem deployment ALWAYS via `curl … | sudo bash -s -- <flags>`. НИКОГДА не давать ручные docker/psql-команды».

## Технические детали (для меня)

**Frontend (`src/lib/casino-context.tsx`, `runtime-config.ts`, `App.tsx`)**
- Распознавать slug `mwz` → canonical `mwanza` (как `aru→arusha` потом).
- Новый роут `/setup` (рендерится только если `localMode && !runtime.paired`). 3-шаговый wizard через существующий `WizardShell`.
- `public/manifest-mwz.json` (копия `manifest-mwanza.json` с именем «Premier Mwanza Local»).
- `VersionIndicator`: суффикс `· local-mwz`.

**Cloud migration**
```sql
create table public.onprem_channels (
  id uuid primary key default gen_random_uuid(),
  casino_id uuid not null references casinos(id),
  slug text not null unique,
  tunnel_hostname text not null,           -- mwz.casinosystem.app
  cf_tunnel_id text,                       -- UUID туннеля в CF
  hmac_secret_hash text not null,          -- bcrypt
  last_seen_at timestamptz,
  version text,
  outbox_lag int,
  status text default 'pending',           -- pending|online|offline|disabled
  created_at timestamptz default now()
);
alter table public.onprem_channels enable row level security;
create policy "super_admin manages channels" on public.onprem_channels
  for all using (has_role(auth.uid(),'super_admin'));
```
+ edge functions:
- `register-onprem-channel` (визард → Cloud, обмен pairing-кода на HMAC)
- `node-control` (Lovable/Admin → Cloud → подписывает → HTTPS в tunnel)

**cms-sync (`deploy/sync/api.js`)** — новые endpoints под HMAC:
- `POST /api/admin/migrate` — идемпотентно через `schema_migrations_local(version, hash, applied_at)`.
- `POST /api/admin/query` — read-only транзакция, тимаут 10 s.
- `POST /api/admin/update` — дёргает cms-updater.
- `POST /api/admin/restart` — `docker compose restart <svc>`.
- `GET  /api/admin/status` — версия, outbox lag, peers.
- Подпись: `X-Signature: hex(hmac_sha256(secret, ts + "." + body))`, окно 60 с, nonce от replay.

**install.sh / public/install.sh** — новые флаги (неинтерактивно, для визарда):
- `--slug=mwz` — пропускает TTY-вопросы.
- `--setup-wizard` — поднимает `/setup` HTTP-сервер на :8088 вместо CLI-флоу.
- `--cf-tunnel-init` — `cloudflared tunnel login` (через визард) + создание tunnel + DNS + systemd. Вызывается визардом.
- `--register-channel` — POST в `register-onprem-channel`, сохраняет HMAC локально (chmod 600 root).
- `--unregister-channel` — обратная операция, rollback.

**Cloud secret** (попрошу через `add_secret` на этапе 2):
- `ONPREM_REGISTER_SECRET` — bootstrap-секрет для первичной регистрации канала.

## Этапы (каждый откатываем по одному)

1. **Frontend**: распознавание `mwz` slug + PWA manifest + skeleton роута `/setup` (косметика, безопасно).
2. **Cloud**: миграция `onprem_channels` + edge function `register-onprem-channel` + secret `ONPREM_REGISTER_SECRET`.
3. **cms-sync**: `/api/admin/*` endpoints с HMAC + `schema_migrations_local`.
4. **install.sh**: флаги `--slug`, `--setup-wizard`, `--cf-tunnel-init`, `--register-channel`, `--unregister-channel`.
5. **Wizard `/setup`** — 3 экрана собираем в едином потоке (использует существующие компоненты).
6. **Edge function `node-control`** + панель `Admin → Network → On-Prem Channels` (статус, ручной update/restart, rollback).
7. **Пилот на MWZ.** Smoke-тесты: status / query / migrate (no-op) / update (no-op) / open `https://mwz.casinosystem.app`.
8. **Стабилизация 1–2 недели**, после чего тем же путём поднимем `aru/dod/mbi`.

## Что от вас понадобится во время реализации

- На этапе 2 — нажать **Allow** на запрос `ONPREM_REGISTER_SECRET` (я сгенерирую значение).
- На этапе 7 — выполнить одну команду на MWZ-сервере и пройти 3 экрана визарда, авторизовавшись в Cloudflare во всплывающем окне.
- На этапе 7 — короткая обратная связь по smoke-тестам (что работает, что нет).
