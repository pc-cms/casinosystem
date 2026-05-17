# План: рабочая схема репликации (Primary + Replicas) с диагностикой

## Топология (внутри одного казино)

Жёсткая роль **Primary** на одну ноду. Остальные — **Replicas** (read-mostly зеркала). Cloud — всегда Replica, плюс точка доступа для удалённых пользователей.

```text
            ┌──────────────────┐
            │   Cloud (Replica)│  ← удалённый доступ, бэкап
            └────────┬─────────┘
                     │ peer-mesh (HMAC)
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────┐          ┌───────▼──────┐
│ Local A      │ ◄──────► │ Local B      │
│ PRIMARY      │  mesh    │ REPLICA      │
└──────────────┘          └──────────────┘
       ▲                         ▲
   браузеры LAN              (только чтение/бэкап,
   пишут СЮДА                 пишут только если
                              явно promote)
```

Правила:
- Кассир/пит/ресепшн **всегда пишет в локальный Primary**. UI определяет Primary по `casino_servers.role='primary'` (новое поле) и subdomain → server map.
- Если Primary упал — Admin вручную делает **Promote Backup → Primary** (1 кнопка + пароль менеджера). Авто-failover не делаем (риск split-brain).
- Cloud никогда не становится Primary автоматически; промоут только из админки супер-админом.
- Mesh симметричный: каждая нода толкает свой outbox в каждого пира и тянет с каждого. Конфликты = last-write-wins по `updated_at` (уже работает в `peer_apply_change`).
- 2 локальных без Cloud — работает (peer-mesh между ними по LAN). 2 локальных + Cloud — Cloud третий пир в той же сетке, но всегда Replica.

## Что ломает текущую схему (даже на пустых БД)

1. `sync/index.js heartbeatLoop` спамит `sync_exchange_logs` каждые 30с → лог нечитаем.
2. `apply_changes` молча дропает строки с неизвестными колонками/FK → "17k pulled, 0 visible".
3. Курсор двигается даже через rejected rows → потерянные изменения не переотправляются.
4. `verify.js` пишет в `sync_probes`, но `peer_apply_change` не реэмитит → echo не работает, "ничего за минуту" не диагностируется.
5. Нет единого "здоров/болен" по пиру — статус разбросан.

## Скоуп v1.3.49

### A. БД (одна миграция)

- `sync_peer_health` — по строке на peer_link: heartbeat, last push/pull/apply ok, lag, outbox depth, schema_version local/remote, state (`ok|degraded|broken|pairing|schema_mismatch|snapshot_required`), last_error.
- `sync_apply_errors` — каждая отброшенная строка: `table`, `pk`, `payload_hash`, `error_code`, `error_text`, `source_outbox_id`, `peer_link_id`, `ts`, `resolved_at`.
- `sync_probe_events` — round-trip: `id`, `direction`, `created_at`, `sent_at`, `ack_at`, `status`, `peer_link_id`, `latency_ms`.
- `sync_snapshot_state` — `casino_id`, `snapshot_id`, `imported_at`, `table_counts jsonb`, `checksum`, `source`.
- `casino_servers.role` enum `primary|replica` + uniq index `(casino_id) where role='primary'`.
- RPC: `sync_promote_server(server_id, manager_password)`, `sync_record_apply_error(...)`, `sync_record_probe(...)`, `sync_record_health(...)`.
- RLS: super_admin/manager read; service_role write.

### B. Sync runtime (`deploy/sync/`)

- `index.js`: убрать heartbeat-запись в `sync_exchange_logs`, писать в `sync_peer_health` (UPSERT, без истории).
- Apply loop: per-row try/catch → `accepted|skipped|rejected`, rejected → `sync_apply_errors`, **курсор двигается только до последней accepted/skipped**. Если N rejected подряд → state=`schema_mismatch`, остановка пулла этого пира.
- Probe loop: каждые 60с генерит probe-row на своей стороне → outbox → второй пир видит и шлёт `/probe/ack`. Запись в `sync_probe_events`.
- Logging: в `sync_exchange_logs` только реальные события (push с N>0, pull с N>0, ошибки, snapshot, pairing, promote, probe-результат). "Empty tick" не пишем.

### C. Edge `peer-mesh`

- Новые роуты: `POST /probe/start`, `POST /probe/ack`, `POST /health/report`, `GET /health/:peer_link_id`.
- `/push` возвращает структурный JSON: `{accepted, skipped, rejected: [{outbox_id, error_code}]}`.
- Heartbeat больше не пишет в exchange log; обновляет `sync_peer_health`.

### D. CLI `cms-status` (Ubuntu, full set)

`/usr/local/bin/cms-status` (Node-скрипт в `deploy/cli/`, симлинк из install.sh):

- `cms-status` — версия, контейнеры, Postgres, snapshot, pairing, outbox depth, последние 5 ошибок apply, last probe.
- `cms-status mirror` — таблица по всем пирам: state, lag, last_push/pull_ok, schema_version.
- `cms-status logs [N]` — хвост `sync_exchange_logs` (по умолчанию 20), фильтр по направлению.
- `cms-status probe <peer>` — синхронный round-trip с выводом latency.
- `cms-status repair pairing|snapshot|errors` — вызывает локальные RPC.
- `cms-status restart sync|api|all` — `docker compose restart`.
- `cms-status pull-cmd` — читает push-command из Cloud (`POST /node/commands/pop`) и исполняет один из whitelisted: `restart_sync`, `repair_pairing`, `retry_errors`, `rebuild_snapshot`, `promote_self`. Запускается systemd timer каждую минуту. Без SSH.

### E. Admin UI чистка + новый Mirror Health

Удаляем:
- старый `PeerLinksPanel` ручной pairing (host/secret/casino_id) — pair.sh делает всё.
- `BuildSnapshotButton` (snapshot собирается по cron + при install).
- `LocalServerWizard` (legacy поток).
- Heartbeat-строки в Exchange Log — переезжают в `sync_peer_health`.

Оставляем/чиним:
- `Admin → Servers` (новая страница): список нод казино с ролью (Primary/Replica), state, lag, schema version. Кнопки: **Promote to Primary** (manager password), **Rebuild Snapshot**, **Re-pair**, **Retry Failed Rows**, **Run Probe**.
- `Admin → Exchange Log` (переименовать в Mirror Activity): только осмысленные события, последние 50, фильтр по пиру/направлению/типу.
- `Admin → Apply Errors` (новый таб): таблица rejected rows, кнопка Retry / Mark Resolved.

### F. install.sh / pair.sh

- `pair.sh` — без изменений, уже zero-touch.
- `install.sh` шаг 6.5 — после seed-import пишет `sync_snapshot_state`.
- Новый шаг: установка `cms-status` + systemd timer для `pull-cmd`.
- В Docker compose добавить `CMS_NODE_ROLE` (primary|replica) из `.env`, читается UI через runtime-config.json.

### G. Версия

`package.json` → 1.3.49 (backend changes).

## Технические детали

- Outbox payload неизменно сериализован JSONB; apply сравнивает `schema_version` (md5 по `information_schema.columns` ключевых таблиц) и до accept'а отбрасывает строки с unknown column в `sync_apply_errors` (state=schema_mismatch), не молча.
- Probe round-trip ≤ 5с считаем `ok`, 5–30с `degraded`, >30с или нет ack 3 раза подряд → `broken`.
- Promote: транзакция `UPDATE casino_servers SET role='replica' WHERE casino_id=$1; UPDATE … SET role='primary' WHERE id=$2;` + аудит запись. UI всех клиентов казино перечитывает `casino_servers` через realtime и перенаправляет writes.
- Push-cmd безопасность: команды подписаны HMAC(`SYNC_SECRET`), TTL 5 мин, nonce, whitelist действий.

## Чего НЕ делаем сейчас

- SSH/Tailscale — отдельная задача.
- Авто-failover.
- Логическая репликация Postgres (на Lovable Cloud недоступна).
- Multi-master с CRDT.

## После имплементации — приёмка

1. `pair.sh` на чистом Local → видим snapshot_imported в `sync_snapshot_state`, peer_health=ok.
2. Создаём игрока в Cloud → за ≤60с появляется в Local; `sync_probe_events` показывает round-trip < 5с.
3. Ломаем колонку (добавляем на Cloud, нет на Local) → запись в `sync_apply_errors`, state=`schema_mismatch`, в UI красный бейдж + кнопка repair.
4. `cms-status mirror` показывает корректную таблицу при выключенном фронте.
5. Promote Replica → Primary за 1 клик; writes идут на новый Primary.
