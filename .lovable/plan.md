# Аудит закрытия дня и триггеров — результаты + план фиксов

Полный аудит сделан. **Сама архитектура закрытия дня работает корректно** (manual close, auto-close cron 11:00 EAT, lock через `system_locks`, snapshot в одной транзакции, `trg_set_business_date` на новых записях — всё ок). Но миграция 07:00 EAT не дочистила 4 места, где остались старые часы (5/11) или UTC-дата вместо EAT.

## Что нужно поправить

### 🔴 P1 — Snapshot бьёт `player_stats` по UTC-дате (критично)
**Файл:** новая миграция (исправление `build_business_day_snapshot`)
**Проблема:** в `build_business_day_snapshot` бакет `player_stats` использует `s.started_at::date` (UTC), а `cash_counts` — `c.created_at::date` (UTC). Все остальные бакеты уже переведены на `business_date_of()`.
**Последствие:** сессия, открытая в 06:30 EAT (= 03:30 UTC) попадает не в тот snapshot. Это и есть источник расхождения с Player Statistics, который ты подозревал.
**Фикс:** заменить `s.started_at::date = _business_date` → `business_date_of(s.started_at) = _business_date`, аналогично для `cash_counts` и `expenses` fallback (`COALESCE(e.business_date, business_date_of(e.created_at))`).

### 🟠 P2 — `ReprintShiftDialog` печатает не ту дату
**Файл:** `src/components/cage/ReprintShiftDialog.tsx:36`
**Проблема:** локальная `businessDateForEAT()` использует `eatHour < 11`. Печать смены, открытой в 09:00 EAT, покажет вчерашнюю дату, а БД считает сегодняшнюю.
**Фикс:** `< 11` → `< 7`.

### 🟡 P3 — `BreaklistGrid` овернайт-окно
**Файл:** `src/components/pit/BreaklistGrid.tsx:65`
**Проблема:** `h >= 18 || h < 5` — определяет «активная ночная смена». После сдвига роллвера на 07:00 окно должно быть `h < 7`, иначе с 05:00 до 07:00 EAT грид думает, что смена уже закончилась, хотя бизнес-день ещё открыт.
**Фикс:** `h < 5` → `h < 7`. (Подтверди, если намерение было другим — это UI-замок брейклиста.)

### 🟡 P4 — Устаревший комментарий
**Файл:** `src/hooks/use-incidents.ts:41`
**Проблема:** комментарий ссылается на старое правило 11:00. Только текст, поведение корректно.
**Фикс:** обновить комментарий на 07:00.

## Что НЕ трогаем (проверено и корректно)

- `business_date_of`, `get_current_business_date` — ✅ обе на 07:00 EAT.
- `close_business_day` — ✅ lock, snapshot, `reset_operational_dashboards` в одной транзакции, авторизация (manager/pit для manual, definer для cron).
- Cron `auto-close-business-day` (`5 * * * *` с guard `_eat_hour < 11`, целит на `_yesterday`) — ✅ никогда не закроет открытый день.
- `trg_set_business_date` на transactions/expenses/chip_transfers/incidents — ✅ использует `get_current_business_date()`.
- Все frontend `businessDayHourUTC(...)` вызовы — ✅ только 7 и 7+24.
- `close_open_sessions_5am` — ✅ окно 05:00–10:59 EAT, безопасно (double-stop защищён NULL-guard'ом).

## Версия
Bump `package.json` → `1.3.213` (DB-изменение + UI).

## План действий
1. Миграция: переписать `build_business_day_snapshot` (player_stats, cash_counts, expenses fallback → `business_date_of`).
2. Правка `ReprintShiftDialog.tsx`, `BreaklistGrid.tsx`, `use-incidents.ts`.
3. Bump версии.
4. Проверка: открыть PlayerStatistics и Closings за тот же бизнес-день — суммы должны сойтись.

**Примечание:** ретроактивно старые `business_day_closures.snapshot` не пересчитываем (как и в прошлый раз) — выравнивание начнёт работать со следующих закрытий.
