# Full Replication Foundation + Cutover Gate

Один релиз, который превращает локальный сервер в **полную копию Cloud 1:1** и даёт защищённую кнопку **Promote local to Primary** в premier admin.

---

## Цели

1. **100% реплика** — локальный сервер содержит абсолютно все данные казино (а не последние 90 дней). Никаких "выборок таблиц".
2. **REPLICA mode** — локальный работает в read-only до момента cutover'а. Пользователи логинятся, но писать нельзя.
3. **Parity Gate** — premier admin показывает per-casino "готов к промоушену / не готов" с реальной сверкой строк.
4. **Promote button** — одна кнопка переводит казино с Cloud-primary на Local-primary только при 100% parity.
5. **Rollback** — обратная кнопка Demote, тот же gate.

---

## Что меняется

### 1. Table Registry (`supabase/functions/_shared/replication-registry.ts`)
Единый список **всех** таблиц казино в FK-safe порядке:
- **single**: `casinos`
- **full** (полностью, без days-limit): конфиг + игроки + сотрудники + все операционные таблицы
- **global** (network-wide справочники): currencies, app_settings, role_module_defaults
- **cloud_only** (никогда не реплицируется на local): system audit, premier-only

Используется в `cloud-seed-export`, `mirror-parity`, `peer-mesh`.

### 2. `cloud-seed-export` — убрать 90-day limit
- Параметр `days` остаётся для legacy, но `?mode=full` (новый default из install.sh) выгружает **всю историю**.
- Источник таблиц = registry, не хардкод массива.

### 3. `mirror-parity` — реальная сверка
Сейчас параметры hardcoded. Переписать так:
- Принимает `casino_id`.
- Для каждой таблицы registry: `count(*)` + `max(updated_at)` + `xor of id hashes` (быстро, без скачивания строк).
- Возвращает `{ table, cloud_count, local_count, match: bool, lag_seconds }`.
- Кнопка Promote разблокирована только если **все таблицы match=true** + lag<2s + outbox=0 + нет открытого business day.

### 4. Node identity & mode
Новая таблица `node_modes`:
```
casino_id uuid PK
mode text  -- 'cloud_primary' | 'local_primary'
promoted_at timestamptz
promoted_by uuid
```
- Default = `cloud_primary`.
- Local server читает свой mode из этой таблицы (через cms-sync pull). Если `local_primary` И это его casino → выходит из REPLICA в PRIMARY.
- Cloud RLS: если `mode='local_primary'`, INSERT/UPDATE/DELETE на операционные таблицы этого казино блокируются (только sync inbox может писать).

### 5. REPLICA mode на локалке
- `useReadonlyMode()` расширяется: дополнительно блокирует если `node_modes.mode != local_primary` И мы на local node.
- Visual badge "REPLICA · syncing from Cloud" в шапке.

### 6. Promote/Demote RPC
```sql
promote_to_local_primary(p_casino_id uuid) returns jsonb
demote_to_cloud_primary(p_casino_id uuid) returns jsonb
```
- Проверяет parity gate server-side (вызывает `mirror-parity` логику инлайн).
- Атомарно: freeze writes → drain outbox → final check → flip mode.
- Только `super_admin`.

### 7. UI — premier admin → новая вкладка "Replication & Cutover"
Заменяет/дополняет `MirrorCutoverPanel`. Для каждого казино:
- Status: `cloud_primary` / `local_primary` / `transitioning`
- Local server: `online · lag 0.4s · outbox 0`
- Parity: зелёный 100% или список таблиц с дельтой
- Кнопка **Promote to Local Primary** (disabled пока не зелёное всё)
- Кнопка **Demote to Cloud Primary** (для отката)
- Audit log промоушенов внизу

### 8. install.sh bootstrap mode
Шаг 6.5 (cloud-seed) уже есть — переключить на `mode=full`, убрать 90-day. После импорта local стартует в REPLICA mode автоматически (запись в `node_modes` не делается, поэтому остаётся cloud_primary, локалка просто read-only до решения админа).

---

## Технические детали

**Параллельные данные между Cloud и Local после промоушена:**
- Cloud-only зоны (finance wallets, role_module_defaults, user_module_permissions, FM-операции): Cloud остаётся primary даже после промоушена. Local подтягивает через cms-sync inbox.
- Operational зоны (shifts, transactions, cage, tables, players, business_days...): после промоушена local primary, Cloud получает через outbox.
- Эта разделённость уже отражена в правиле "Cloud never writes to casino operational tables" (memory).

**Parity hash:** для скорости используем `md5(string_agg(id::text, ',' ORDER BY id))` per table, не построчное сравнение.

**Audit:** все промоушены/демоушены пишутся в `system_audit_log` с ролью, временем, parity snapshot.

**Без HA-pair** — это следующий релиз, как договорились.

---

## Файлы

**New:**
- `supabase/functions/_shared/replication-registry.ts` — единый список таблиц
- `supabase/functions/replication-parity/index.ts` — заменяет mirror-parity или дополняет
- `supabase/functions/replication-promote/index.ts` — promote/demote RPC wrapper
- `src/components/admin/ReplicationCutoverPanel.tsx` — новый UI
- `src/hooks/use-replication-status.ts`

**Modified:**
- `supabase/functions/cloud-seed-export/index.ts` — registry-driven, `mode=full`
- `supabase/functions/mirror-parity/index.ts` — registry-driven, real row-level hash
- `deploy/install.sh` — `mode=full` в cloud-seed call
- `src/hooks/use-readonly-mode.ts` — учитывать node_modes
- `src/pages/Admin.tsx` — добавить вкладку Replication
- DB migration: `node_modes` table + `promote_to_local_primary` + `demote_to_cloud_primary` RPC + RLS triggers на операционные таблицы

---

## Объём

Релиз большой: ~12 файлов, 1 миграция, 2 edge functions, 1 новая admin-панель. Версия патчится автоматически.

После approve — сразу пишу миграцию, дожидаюсь твоего "ok" на неё, потом код параллельно.
