
# Audit + фиксация Business Day across the system

## Что сейчас не так (audit findings)

**1. Три разных порога времени для одного и того же понятия:**
- `getBusinessDate()` (клиент, fallback): rollover в **13:00 EAT** (`shiftEndHour = 13`)
- `get_current_business_date()` (RPC, server, source of truth): rollover в **13:00 EAT** при first-run, иначе по `business_day_closures`
- `auto_close_forgotten_business_days()` (cron): срабатывает с **11:00 EAT**
- Новый `compute_*_drop_split` (per-day NEP reset): граница **05:00 EAT** (`(now AT TZ EAT) - 5h`)
- Старый `get_business_date_for_casino()` (DB trigger на `casino_visits`): по `casinos.shift_end` поле

→ Игрок зашедший в 04:30 утра и в 06:00 могут попасть в **разные** business days в зависимости от того, какая функция считала.

**2. 65 мест в коде используют `getBusinessDate()` напрямую** (часто как fallback `serverDate || getBusinessDate()`), что ведёт к расхождениям при:
- Loading state RPC (одна секунда — другой день)
- Offline режиме
- Несинхронизированных часах клиента

**3. Trigger `trg_set_visit_business_date`** на `casino_visits` использует **старый** `get_business_date_for_casino()` (по `casinos.shift_end`), а не unified `get_current_business_date()`. Visit, созданный при auto_close, может попасть не в тот day.

**4. Manual close (`useCloseBusinessDay`)** делает `qc.invalidateQueries()` — но это локально, в одной вкладке. Другие cashier/pit устройства узнают об этом только через 60s polling `useEffectiveBusinessDate`. В окне 0-60s они ещё работают на старом дне.

**5. Auto-close (cron каждый час в :05)** молча выполняется, никакого realtime broadcast — клиенты узнают через 60s polling. Никакого lock UI — пользователь может в момент пересчёта вписать transaction в "вчерашний" день.

**6. NEP-day boundary в новом `compute_*_drop_split`** жёстко hardcoded на 05:00 EAT, **не** запрашивает реальный `get_current_business_date()`. Если день закрыт вручную в 02:00 → новые транзакции после 02:00 всё равно попадают в "вчера" по NEP, хотя operationally это уже новый день.

## План фиксации

### 1. Единый порог времени = бизнес-день закрывается в 11:00 EAT (или вручную раньше)

Зафиксировать в системе **одно** правило:
- **Operational rollover** = `business_day_closures` (manual или auto). Нет closures → fallback **11:00 EAT** (не 13, не 5).
- Все функции и хелперы используют этот единый порог.

**Изменения:**
- `src/lib/business-day.ts`: `getBusinessDate(shiftEndHour = 11)` (было 13).
- `get_current_business_date(_casino_id)`: first-run fallback порог изменить на 11:00 EAT.
- Удалить старый `get_business_date_for_casino()` или сделать его обёрткой над `get_current_business_date()`.
- `trg_set_visit_business_date`: переключить на `get_current_business_date(NEW.casino_id)`.

### 2. NEP-day reset = тот же порог через `business_day_closures`

`compute_players_drop_split` и `compute_tables_drop_split` сейчас используют hardcoded 05:00 EAT. Заменить на:

```
day_of(ts) := COALESCE(
  -- если день уже закрыт: смотрим closures, считаем что транзакция принадлежит первому НЕзакрытому дню после её таймстампа
  ...,
  -- иначе fallback на ((ts AT TZ EAT) - interval '11 hours')::date
)
```

Pragmatic решение: считать `business_date` для каждой транзакции как **наименьший business_date >= ((ts AT TZ EAT) - 11h)::date, который ещё не закрыт перед ts**. Это синхронизирует NEP с реальным operational днём.

Альтернатива (проще, рекомендую): хранить `business_date` явно на `transactions` / `chip_transfers` / `player_chip_adjustments` как generated/triggered колонку, и группировать по ней. Это убирает зависимость от часовых вычислений в каждом RPC.

**Решение плана:** добавить триггер `BEFORE INSERT` на эти 3 таблицы, который пишет `business_date := get_current_business_date(NEW.casino_id)` в новую колонку. RPC группируют по этой колонке.

### 3. Lock-окно при rollover (1–2 мин)

Когда происходит close (manual или auto):

**Backend:**
- Добавить флаг `rollover_in_progress` (boolean) и `rollover_started_at` в `business_day_closures` или отдельную таблицу `system_locks`.
- `close_business_day()` в transaction:
  1. INSERT row в `system_locks(casino_id, locked_until = now()+interval '90 seconds', reason='rollover')`.
  2. Build snapshot, write closure.
  3. Trigger финализации (Floor→Miss уже есть, добавить недостающее ниже).
  4. Broadcast realtime event на канал `casino:{id}:rollover` с `{event: 'started'|'completed', business_date}`.
  5. Удалить lock или дождаться истечения.

**Что должно произойти при rollover (audit-подтверждённое):**
- ✅ Snapshot 7 секций (cash_counts, expenses, cashless, table_tracker, chip_snapshots, breaklist, player_stats) — **уже есть** в `build_business_day_snapshot`.
- ⚠️ **Перенос фишек**: Floor→Miss финализация — это `useTableLifecycle`/close shift, **не привязано** к business-day close. Нужно: при `close_business_day` принудительно закрыть все ещё открытые table shifts казино (или хотя бы предупредить).
- ⚠️ **Auto-fill attendance** "9h" для Pit/Staff — есть отдельный механизм (`Attendance Auto-fill` memory), gated by closures. Уже работает. ✅
- ⚠️ **Перенос rates** (player ratings/levels) — нужно проверить, есть ли nightly recompute. Сейчас не вижу такого процесса. Если рейтинги — derived, ок.
- ⚠️ **Обнуление dashboards** — сейчас только `qc.invalidateQueries()` локально. Добавить:
  - Realtime broadcast на `casino:{id}:business_day` каналy.
  - Глобальный listener в `App.tsx` / `auth-context`: при получении `rollover.completed` → `qc.invalidateQueries()` + сбросить `useEffectiveBusinessDate` cache.
- ⚠️ **Incidents** — currently filtered by `incident_date` (date column). Проверить, что новые incidents записываются с `business_date` (через `get_current_business_date`), а не `CURRENT_DATE`.
- ⚠️ **Expenses, cashless, transactions** — все имеют `business_date` колонку, но триггеры устанавливают её разными способами. Унифицировать через `get_current_business_date`.

**Frontend lock UI:**
- Hook `useRolloverLock()`: подписан на `system_locks` через realtime + polling.
- Когда `locked_until > now()`: показать full-screen overlay "Business day rollover in progress... ~Ns". Все мутации блокируются (`disabled` на кнопках Save/Submit).
- Снимается автоматически при истечении или при получении `rollover.completed`.

### 4. Унификация client-side: убрать прямые вызовы `getBusinessDate()`

Все 65 мест → переключить на `useEffectiveBusinessDate()` (единственный источник). Оставить `getBusinessDate()` только как **последний** offline fallback внутри самого `useEffectiveBusinessDate` (уже так).

Удалить паттерн `serverDate || getBusinessDate()` — заменить на `serverDate ?? null` + skeleton loading. Если RPC не ответил — UI ждёт, не показывает потенциально неверный день.

### 5. Audit-таблица проверок

Список фич, где должен использоваться unified business-day, и текущий статус:

| Surface | Сейчас | После плана |
|---|---|---|
| Cage active shift | mixed (server || client fallback) | server only + lock UI |
| Cage history | mixed | server only |
| Transactions insert | client `getBusinessDate()` | DB trigger `get_current_business_date(casino_id)` |
| Cashless insert | client `getBusinessDate()` | DB trigger |
| Expenses insert | mixed | DB trigger |
| Visits | DB trigger old fn | DB trigger unified fn |
| Incidents `incident_date` | client | DB trigger или server-passed |
| NEP per-day reset (Drop) | hardcoded 05:00 | использует `business_date` колонку транзакций |
| Table tracker | по `date` колонке | без изменений (уже day-bound) |
| Chip snapshots | по `date` колонке | без изменений |
| Breaklist | по `date` колонке | без изменений |
| Dashboard "today" | mixed | server only + realtime invalidation |
| Tables page "today" | mixed | server only |
| Player stats period | manual filter | без изменений (фильтр явный) |
| Auto-fill attendance | gated by closures | ✅ уже корректно |
| Floor → Miss финализация | при close shift | + при close_business_day для всех ещё открытых shifts |
| Rate переносы | n/a | подтвердить, что нет; либо trigger в close_business_day |

## Что строится в коде (high-level steps)

1. **Migration**: единый `get_current_business_date` (порог 11:00), новые колонки `business_date` на `transactions/chip_transfers/player_chip_adjustments`, BEFORE INSERT триггер на этих таблицах + `casino_visits` + `incidents`.
2. **Migration**: `compute_*_drop_split` группирует по `business_date` колонке, не по hardcoded 05:00 EAT.
3. **Migration**: таблица `system_locks` (casino_id, locked_until, reason). RLS: select для всех auth, insert/update только из RPC.
4. **Migration**: `close_business_day` теперь:
   - ставит lock на 90s,
   - закрывает все ещё открытые `table_shifts` казино (Floor→Miss финализация),
   - вызывает existing snapshot логику,
   - снимает lock.
5. **Migration**: ALTER PUBLICATION supabase_realtime ADD TABLE business_day_closures, system_locks.
6. **Frontend hook**: `useRolloverLock()` + global overlay в `App.tsx`.
7. **Frontend hook**: `useEffectiveBusinessDate` подписан на realtime `business_day_closures`, инвалидирует свой query при insert.
8. **Refactor**: все 65 мест с `getBusinessDate()` fallback → удалить fallback паттерн, показывать loader пока `useEffectiveBusinessDate` не ответил.
9. **Migration**: дропнуть/обернуть `get_business_date_for_casino()` чтобы ничто не использовало старый порог.
10. **Lib**: `getBusinessDate(shiftEndHour = 11)` — изменить дефолт. Оставить как helper для логов / редких offline случаев.
11. **Test**: добавить unit-тесты в `business-logic.test.ts` для пограничных времён (10:59, 11:00, 11:01, manual close в 02:00 и т.д.).
12. **Memory update**: `mem://features/business-day-logic` → зафиксировать единый порог 11:00 EAT, lock-окно, перечень фич.
13. **Version bump**: package.json patch (auto).

## Что НЕ ломаем

- Существующие `business_day_closures` записи и snapshots — формат не меняется.
- Auto-close cron (`5 * * * *`) — остаётся.
- Manager password gate на Close — остаётся.
- Role visibility / filter правила — без изменений.
- Player Drop формула (per-day NEP reset) — остаётся, но теперь привязана к реальному business day, не к 05:00.

## Открытые вопросы (отвечу defaults, скажи если иначе)

1. **Lock duration**: 90 секунд по умолчанию. ОК?
2. **Что делать с in-flight transactions** во время lock: блокируем UI, не отменяем уже отправленные. Insert в момент close попадёт в новый день (по `get_current_business_date`).
3. **Floor→Miss при close_business_day для открытых смен**: автоматически финализировать или **запретить close** пока есть открытые смены? Рекомендую второе — безопаснее, заставляет cashier/pit сначала закрыть смены вручную.
4. **Старые транзакции без `business_date` колонки**: backfill миграцией через `get_current_business_date` рассчитанный для их `created_at`.
