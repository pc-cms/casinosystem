
# Куда мы зашли и почему «оно не универсальное»

Сейчас стек на самом деле почти весь правильный (Postgres + PostgREST + GoTrue + Realtime + Storage + Nginx + cms-sync + cms-updater + cms-monitor). Сломано не «много всего», а несколько ключевых точек, которые делают каждую установку штучной и хрупкой.

## 1. Главная проблема: фронтенд знает свой IP на этапе сборки

В `deploy/docker-compose.yml` фронт собирается с
`VITE_SUPABASE_URL: https://${LOCAL_IP}/api`.
Vite инлайнит это в бандл — значит:

- бандл валиден только для одного IP/домена;
- открыть тот же сервер по `https://arucms/` или `https://192.168.1.94/` нельзя без пересборки;
- `runtime-config.json` теряет смысл — клиент Supabase всё равно ходит по «зашитому» URL;
- именно из-за этого `runtime-config.json` показывает `casinoSlug=local` и админка пустая — фронт уже «прибит» к чужому конфигу.

Это и есть корень того, что «суперадмин без интерфейса».

## 2. Auth role = "" → 400 на каждом запросе

Логи Cloud показывают:
`DEPRECATION: GOTRUE_JWT_DEFAULT_GROUP_NAME not supported by Supabase's GoTrue`.
Наш фикс через эту переменную работает локально, но это deprecated путь. Надёжный путь — гарантировать `auth.users.role='authenticated'` и `aud='authenticated'` в БД (heal-скрипт уже есть в `install.sh`, надо его сделать обязательным шагом, а переменную убрать).

## 3. Установщик слишком «ручной»

`env.template` требует, чтобы пользователь сам ввёл `CASINO_SLUG`, `CASINO_NAME`, `LOCAL_DOMAIN`. Если он этого не сделал — бутстрап БД и runtime-config расходятся, и фронт показывает «Local Casino / local». Нужно: один вопрос мастера → одно имя → всё остальное генерируется.

## 4. Pairing разорван на три места

- `deploy/sync/pair-cli.js` — CLI внутри контейнера
- `cloud_connection` + `peer_links` — таблицы
- Admin → Peers UI — пустой, потому что админка не грузится (проблема #1)

То есть архитектурно peer-mesh готов (symmetric, HMAC, outbox/inbox, нет primary), но пользователь не может им воспользоваться, потому что не доходит до экрана.

---

# План: универсальный сервер за один шаг

## Этап A. Сделать фронт по-настоящему универсальным (главный фикс)

1. В `deploy/docker-compose.yml` для `cms-frontend` убрать `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` из build-args. Заменить на:
   - `VITE_SUPABASE_URL: /api`  (относительный путь — работает с любым хостом)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — оставить, но строго равной `ANON_KEY` из `.env` (это безопасно, ключ публичный).
2. В `src/integrations/supabase/client.ts` уже читается `import.meta.env.VITE_SUPABASE_URL`. После шага 1 при любом hostname (IP, `arucms`, `arusha.casinosystem.local`) клиент будет идти в свой же nginx по `/api`. Один билд — любая инсталляция.
3. `runtime-config.json` остаётся источником истины только для `casinoId/casinoSlug/casinoName/localMode`. Никаких `supabaseUrl` там быть не должно (или он игнорируется).
4. Убрать привязку nginx-сертификата к одному hostname: self-signed CA выпускает wildcard `*.local` + SAN со списком IP. Это уже частично есть в `install.sh` — надо просто добавить введённый `LOCAL_IP` в SAN и `*` как fallback.

Результат: один Docker image `cms-frontend:<version>`, который Cloud-сборка может публиковать в GHCR, и `install.sh` его просто **pull**-ит, а не собирает. Это убирает 90% «починили — снова сломалось».

## Этап B. Один honest установщик

Один интерактивный вопрос в `install.sh`:

```
Casino name (e.g. Arusha): _
```

Из ответа автоматически:
- `CASINO_SLUG = slugify(name)`  (arusha)
- `CASINO_NAME = name`
- `LOCAL_DOMAIN = ${slug}.cms.local`
- `LOCAL_IP    = $(hostname -I | awk '{print $1}')`
- `CASINO_ID   = gen_random_uuid()` (или placeholder, если pairing с Cloud потом)

После старта контейнеров — обязательный шаг:
```
docker exec cms-postgres psql -c "
  UPDATE public.casinos SET name=$1, slug=$2 WHERE id=$3;
  -- heal auth.users role='authenticated', aud='authenticated'
"
```

Убрать `GOTRUE_JWT_DEFAULT_GROUP_NAME` из compose. Heal-скрипт делает то же надёжнее.

## Этап C. Pairing как один экран

В Admin → Peers (`/admin/peers`) три кнопки:

1. **Connect to Cloud** — вызывает `pair-cli.js start`, показывает 6-значный код, опрашивает каждые 5с, по approve в Cloud → сохраняет `cloud_connection.status='connected'` и запускает initial seed.
2. **Connect to another casino** — вводишь URL соседа (`https://192.168.2.10`) и его 6-значный код (тот сгенерировал у себя). Симметричный HMAC handshake → строка в `peer_links` с обеих сторон.
3. **Standalone** — ничего не делать, работать только локально.

Никакого CLI для конечного юзера. CLI остаётся как fallback для саппорта.

## Этап D. Cloud как «ещё один peer»

В `cms-sync` Cloud уже трактуется как обычный peer (symmetric mesh). Надо лишь:
- в Cloud завести edge function `peer-handshake` (если ещё нет) — отвечает HMAC по тому же протоколу что и локальный `sync/api.js`;
- в Admin → Peers показывать Cloud отдельной строкой со статусом `connected/syncing/lagging`.

## Этап E. Проверка end-to-end

После реализации A+B+C ставим на чистую Ubuntu:
```
curl -fsSL https://casinosystem.app/install | sudo bash
# 1 вопрос: имя казино
# через 3 минуты: https://<IP>/ → логин → полная админка
# Admin → Peers → Connect to Cloud → 6-значный код в Cloud → connected
```

И тот же образ, без пересборки, должен открываться по `https://arucms/`, `https://192.168.1.94/`, `https://arusha.cms.local/`.

---

# Что ломается сейчас — короткий список

| # | Симптом | Причина | Где чинить |
|---|---|---|---|
| 1 | Пустая админка у superadmin | Бандл с чужим `VITE_SUPABASE_URL`, фронт ходит не туда | `docker-compose.yml` build-args |
| 2 | `role "" does not exist` 400 | GoTrue не выставляет role в JWT | Heal в `install.sh` + убрать deprecated env |
| 3 | `runtime-config.casinoSlug=local` | `.env` пустой, мастер не спрашивает | `install.sh` интерактив |
| 4 | Pairing недоступен из UI | `/admin/peers` не грузится (см. #1) | После #1 автоматически решится |
| 5 | Каждая установка = пересборка | Vite инлайн URL/key | Этап A |

---

# Технические детали (для разработчика)

- Файлы: `deploy/docker-compose.yml` (build-args), `deploy/install.sh` (wizard + DB heal), `deploy/nginx/conf.d/*.conf` (SAN cert), `src/integrations/supabase/client.ts` (убедиться что fallback на `/api`), `src/lib/casino-context.tsx` (читать только slug/id из runtime-config).
- Версия фронта публикуется в GHCR как `ghcr.io/<org>/cms-frontend:<semver>`. `install.sh --update` делает `docker pull` вместо `docker build`. Время апдейта падает с 8 минут до 30 секунд.
- Sync-протокол не трогаем — он уже симметричный и правильный.
- Cloud edge function `register-local-server` + `peer-handshake` остаются как есть, добавляем только UI-обвязку.

После твоего одобрения иду по этапам A → B → C → D → E.
