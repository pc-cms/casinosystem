# Full Offline Shift — что строим

Цель: при пропаже интернета на 5–60 минут смена продолжается без «динозавра» и без потери данных. Все действия кассы / Pit / Reception либо выполняются локально, либо встают в очередь и применяются после восстановления связи, **включая Close Shift и Manager password**.

## Почему сейчас падает (диагноз)

1. **«Динозавр»** = браузер не получил `/index.html`. SW либо не зарегистрирован (открыли как обычную вкладку, не PWA), либо precache не содержит этот маршрут. После hard-refresh во время outage страница умирает.
2. **Lazy-чанки** (`React.lazy` на 60+ страницах) кэшируются только когда хоть раз были загружены онлайн. Любая первая навигация во время outage = ChunkLoadError → `installChunkRecovery` делает reload → «динозавр».
3. **`useEffectiveBusinessDate`** дергает RPC `get_current_business_date` на каждом монтировании. Без сети — бесконечный спиннер на всех экранах кассы/pit, даже если данные есть в IndexedDB.
4. **Manager password** = edge function `verify-manager` → offline = невозможно подтвердить ни override, ни Close Shift, ни Close Business Day.
5. **Close Shift, Open Visit, Chip Count, Cash Count** идут прямыми вызовами Supabase (не через `offlineMutation`) → во время outage просто крутят спиннер и валятся по таймауту, а данные кассира уходят в /dev/null.
6. **React Query persister хранит кэш, но `staleTime: 2 min`** + `refetchOnReconnect: true` → при возврате связи запускается шторм рефетчей, который роняет UI на слабых каналах.

## План

### M1. SW, который выживает offline-навигацию

- `vite.config.ts`: добавить **все lazy-чанки** в `globPatterns` (уже стоит `**/*.{js,css,...}` — проверить, что `manualChunks` не выкидывает route-chunks из precache), включить `navigationPreload`, и для `request.mode === "navigate"` поменять `NetworkFirst` с `networkTimeoutSeconds: 3` на **`NetworkFirst` с фолбэком на `/index.html` из precache** (сейчас фолбэк не сработает, если SW не нашёл URL в кэше — поправим через `navigateFallback` + явный handler).
- В `pwa-register.ts` добавить **проактивный `registration.update()` при `online`** и **prefetch всех известных route-chunks** через манифест `__VITE_PRELOAD__` сразу после первого успешного логина (один раз в сутки).
- Добавить badge «App not installed — install for offline» в шапке (Sidebar) если `display-mode: browser`. Сильно снижает шанс «динозавра», т.к. установленная PWA имеет более надёжный SW lifecycle.
- Гарантия: после первого онлайн-входа все маршруты, попавшие в роутер, отдаются offline.

### M2. Источник правды для business date без сети

- `useEffectiveBusinessDate`: после первого успешного ответа писать `business_date` + `closed_at` в `localStorage` (`cms.businessDate.cache`).
- Если RPC падает (`!navigator.onLine` или fetch error) — возвращать кэш + локальный fallback `getBusinessDate()` (он уже считает rollover 11:00 EAT клиентски). Никаких бесконечных спиннеров.
- На баннер «Offline» вешать пометку `business date from local cache` чтобы оператор видел источник.

### M3. Read-cache всех справочников при логине

В `usePrefetchCriticalData` догружать (если ещё не в кэше React Query / IDB):
- `gaming_tables`, `chip_denoms`, `chip_locations`, `profiles` (своё казино), `dealers`, `players` (только активные за 7 дней + blacklist), `user_roles`, `wallets`, текущий `shifts` + `cash_counts` + `chip_counts` за business day, `expense_categories`, `currencies`.

С `staleTime: Infinity` для справочников и `staleTime: 30s` для оперативных. После outage первая страница уже отрисована из IDB, без сетки.

### M4. Все мутации через `offlineMutation`

Аудит и обёртка прямых `supabase.from(...).insert/update`:
- **Cage**: `cage_transactions` (buy-in, cash-out, expense, transfer, collection), `bank_checks`, `add_float`, `cancel`.
- **Pit**: `visits`, `player_sessions`, `player_position_history`, `chip_adjustments`, `table_tracker`.
- **Reception**: `players` update (контакты, фото), `card_assignments`.
- **Tables**: `chip_counts` (snapshot), `gaming_tables.closing_result`, `table_lifecycle`.
- **Attendance/Rota**: bulk paste, ячейки.

Каждая обёртка добавляет в payload `client_op_id` (uuid v4 на устройстве) и `client_ts` (EAT). Server-side trigger делает idempotent-upsert по `(client_op_id)` → исключает дубликаты после ретраев.

### M5. Manager password offline

- При успешном онлайн-вводе manager-пароля сохранять `bcrypt(password)` + `manager_user_id` + `expires_at = now + 12h` в IndexedDB (encrypted by webcrypto + device key из `localStorage`).
- В `ManagerOverrideDialog`: если offline → `bcrypt.compare` локально против кэшированного хэша. Доступ выдаётся только тем менеджерам, которые **за последние 12 ч** хотя бы раз подтверждали пароль на этом устройстве.
- Каждое offline-подтверждение пишется в `manager_overrides` (через очередь) с флагом `verified_offline = true`. После онлайна edge-function `verify-manager` пере-валидирует и при несовпадении помечает событие `disputed`.

### M6. Close Shift offline

- Текущий `CloseShiftPage` собирает: chip count, cash count, bank, mobile, miss → один `UPDATE shifts` + insert `cash_counts` seed.
- Делаем то же через очередь:
  - `chip_counts` insert (snapshot, attempt N)
  - `cash_counts` insert (closing seed)
  - `shifts` update с `client_op_id`, `closing_state = 'pending_sync'`
  - `activity_logs` insert (`SHIFT_CLOSE_ATTEMPT` + `SHIFT_CLOSED_OFFLINE`)
- В UI закрытие проходит, показывается значок `Pending sync · awaiting server validation`. Новая смена открывается тут же (открытие смены тоже идёт в очередь с зависимостью «после close-shift синка»).
- DB-триггер на `shifts` валидирует баланс **только при синке** и, если суммы не сходятся, помечает строку `requires_review = true` + создаёт `activity_logs.SHIFT_OFFLINE_DISCREPANCY` для менеджера. Никаких «тихих» откатов как в инциденте с Даниярaem.

### M7. Сеть-индикатор и UX

- Жирный баннер сверху на всю ширину при offline (красный) и при «syncing N pending» (янтарный) с кнопкой «View queue».
- Страница `/admin/sync-queue` (для manager/super_admin): список pending, failed_permanently, retry-кнопка, удаление с подтверждением (только super_admin).
- Toast «Saved offline — will sync» уже есть, оставляем.

### M8. Защита от refetch-шторма

- `App.tsx`: `refetchOnReconnect: 'always' → false` для тяжёлых query keys (`players`, `visits`, `cage_transactions`). Делаем ручной staggered refetch внутри `sync-engine` после успешного drain очереди (по 3 запроса в секунду).
- `staleTime` справочников = `Infinity`, инвалидация только по realtime-событию или явному pull-to-refresh.

### M9. Тесты + проверки

- Cypress / Playwright сценарий: логин → выключить network (`page.context().setOffline(true)`) → перейти на /cage → buy-in → close shift → включить network → проверить, что в БД ровно один `cage_transactions` и одна закрытая смена.
- Ручной чек-лист в `docs/OFFLINE-CHECKLIST.md` для тестирования каждой роли при выключенном Wi-Fi.

## Технические детали

```text
Layer                  | Online              | Offline (new)
-----------------------+---------------------+---------------------------------
HTML / route chunks    | network             | SW precache (all chunks warmed)
Reference data         | Supabase + cache    | React Query IDB cache
Business date          | RPC                 | localStorage cache + EAT calc
Reads (live)           | Supabase            | last cached snapshot + banner
Writes                 | direct supabase     | offline-queue (IDB) + dedupe key
Manager password       | edge fn             | local bcrypt hash (12h TTL)
Close shift            | direct UPDATE       | queued ops, server validates on sync
Sync trigger           | manual              | online + visibility + 30s timer
```

Версия пакета поднимется автоматически (migrations + SW изменения).

## Риски

- **Расхождение Close Shift при синке**: смягчается флагом `requires_review` + `SHIFT_OFFLINE_DISCREPANCY` в логах — finance/manager увидят и решат через `business-days` редактор. Без авто-перезаписи.
- **Двойные операции**: убираются `client_op_id` + uniq-индекс.
- **Offline manager password**: 12-часовое окно может быть использовано уволенным менеджером, если устройство не разлогинено. Можно ужать до 4 ч и привязать к `user_casino_access` revoke (но revoke тоже нужен онлайн). Это compromise, который должен подтвердить владелец.

## Объём

Большой: ~25 файлов, 3 миграции (idempotency unique-индексы, `shifts.closing_state`, `shifts.requires_review`), новый раздел `/admin/sync-queue`, SW переработка, edge-function `verify-manager` бэк-валидация. Рекомендую дробить на 3 PR-эквивалента: **M1+M2+M3** (читалка не падает), **M4+M7+M8** (запись + UX), **M5+M6+M9** (manager + close-shift + тесты).
