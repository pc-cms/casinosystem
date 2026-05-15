## Цель

Полностью автоматическая установка локального сервера. Pairing с Cloud — из локальной админки кнопкой, а не из CLI.

## Новый flow

```text
1. sudo ./deploy/install.sh
   → ставит всё автоматически (DHCP IP, casino.local, super_admin admin/admin)
   → НЕ задаёт вопросов, НЕ требует --pair
   → результат: рабочий локальный сервер с пустой БД

2. Админ: https://casino.local → login admin@admin.local / admin

3. Admin → Network появляется новая секция "Cloud Connection":
   ┌─ Status: Not connected ──────────────────┐
   │ [Configure Local Server]  [Connect to Cloud] │
   └──────────────────────────────────────────┘

4. Жмёт "Connect to Cloud":
   - вводит Cloud URL (default: https://casinosystem.app)
   - локальный сервер вызывает Cloud edge fn → получает pairing-code
   - в UI показывается код XXXX-XXXX + статус "Waiting for approval…"

5. Cloud admin (на casinosystem.app) → Admin → Network → Pending:
   - видит заявку с кодом, IP, hostname
   - выбирает casino из dropdown → Approve
   
6. Локальный UI автоматически (polling) видит approved:
   - status → "Connected to casinosystem.app, casino: <name>"
   - сохраняет CASINO_ID + SYNC_SECRET в локальную БД

7. После connect появляется кнопка "Sync Data from Cloud":
   - запускает initial-sync-trigger
   - показывает прогресс (tables/rows/%)
```

## Что меняется

### `deploy/install.sh`
- Убрать флаги `--pair`, всю секцию pairing'а из CLI
- Установка строго неинтерактивная: DHCP IP, `casino.local`, super_admin `admin@admin.local`/`admin`
- Финальное сообщение: «Открой https://casino.local, войди admin/admin, в Admin → Network нажми Connect to Cloud»

### Новая таблица `cloud_connection` (локальная БД)
Одна строка на сервер:
- `cloud_url`, `pairing_code`, `pairing_expires_at`
- `status`: `disconnected | pairing | connected`
- `casino_id`, `sync_secret`, `connected_at`

### Новый локальный edge endpoint (либо через cms-sync REST)
Локальный сервер должен иметь HTTP endpoint для админки:
- `POST /cloud/start-pairing { cloud_url }` — вызывает Cloud register-local-server, сохраняет pairing_code
- `GET /cloud/pairing-status` — polling Cloud, при approved сохраняет casino_id+sync_secret
- `POST /cloud/disconnect` — очищает запись
- `POST /cloud/initial-sync` — запускает локальный sync с Cloud

Решение: добавим эти endpoints в существующий `deploy/sync` сервис (он уже работает с Cloud).

### Новый UI компонент `src/components/admin/CloudConnectionPanel.tsx`
Только когда `runtime-config.json.mode === "local"`:
- карточка статуса
- кнопки: Configure / Connect to Cloud / Disconnect / Sync Data
- диалог с pairing-кодом и countdown 30 мин
- автоматический polling каждые 5с
- после connect — кнопка Initial Sync с прогрессом

Размещаем сверху `NetworkHealthPanel` на странице Admin.

### Cloud-сторона (без изменений по большей части)
- `register-local-server` edge fn уже работает (POST → код, GET → polling, POST /approve)
- `PendingServersPanel` уже есть в Cloud-админке
- `initial-sync-trigger` уже есть

Только убрать упоминания `seed_token` (уже сделано).

## Технические детали

- Локальный sync-сервис слушает на внутреннем порту, проксируется через nginx как `/api/cloud/*` с проверкой что юзер super_admin (через локальный gotrue JWT).
- pairing_code хранится локально, чтобы при перезагрузке UI восстановить статус.
- При успешном approve `cloud_url`, `casino_id`, `sync_secret` пишутся в локальную таблицу + опционально в `.env` для cms-sync (через перезапуск контейнера или hot-reload).
- DHCP IP: install.sh уже использует `hostname -I`, оставляем как есть.

## Файлы

**Новые:**
- `src/components/admin/CloudConnectionPanel.tsx`
- `src/hooks/use-cloud-connection.ts`
- `supabase/migrations/<ts>_cloud_connection.sql` (для on-prem БД, через postgres/migrations)
- `deploy/sync/cloud-pairing.js` (новые HTTP routes)

**Изменения:**
- `deploy/install.sh` — убрать `--pair`, упростить
- `deploy/sync/index.js` — подключить cloud-pairing routes
- `deploy/nginx/conf.d/casino.conf` — проксировать `/api/cloud/*` → cms-sync
- `src/pages/Admin.tsx` — добавить CloudConnectionPanel в local mode
- `package.json` — bump version

## Порядок реализации

1. Упростить `install.sh` (убрать pair flow)
2. Локальная миграция `cloud_connection` table
3. Endpoints в `deploy/sync`
4. UI panel + hook
5. Тест end-to-end локально

## Открытый вопрос

«Configure Local Server» — что под этим имеется в виду? Думаю, это редактирование имени казино/IP/домена (то, что раньше было в install.sh). Подтверди — добавлять её в этом раунде или отложить?
