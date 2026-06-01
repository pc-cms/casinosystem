# Ревизия матрицы модулей и истории Cashless

## Проблема пользователя
Floor manager имеет в `role_module_defaults` `cashless` и `expenses` с `day_horizon='all'`, но на страницах Cashless и Expenses нельзя выбрать прошлый день:
- **Cashless** жёстко грузится только за текущий business date — нет date picker'а вообще.
- **Expenses** имеет from/to, но по умолчанию today/today (не реальное ограничение).
- Само поле `day_horizon` в матрице сейчас НЕ применяется на этих страницах — это декоративное поле.

Плюс в `MODULES` есть устаревшие/дубли и нет нескольких реальных модулей.

## Часть 1 — Cashless: добавить выбор даты
В `src/pages/Cashless.tsx`:
- Добавить state `viewDate` (по умолчанию = текущий businessDate).
- Кнопки «◀ / ▶ / Today» + `<input type="date">` в шапке (как в Expenses).
- `useCashless(viewDate)` — история показывается за выбранный день.
- Создание новых записей всё равно идёт с `business_date = businessDate` (текущий открытый день).
- Заголовок секции истории показывает выбранную дату, "No cashless transactions" вместо "today".

## Часть 2 — Чистка `src/lib/modules.ts`

### Удалить (устаревшие/нерабочие)
- `cage_closings` — помечен legacy, маршрут уже маппится на `closings`.
- `staff` — помечен legacy.
- `pitbook` — функционал убран, страницы нет в навигации, остался только маршрут.
- `business_days` — недавно убрали кнопку и функционал.
- `weekly_bonus`, `monthly_tips` — заменены на единый `tips_and_bonuses` (маршруты уже маппятся на него).

### Добавить (отсутствуют, но есть реальные страницы)
- `tables_analytics` — `/tables/analytics` (есть в БД, нет в TS-каталоге).
- `cancelled_transactions` — `/cage/cancelled` (если используется).
- `cage_slots_report` — `/cage-slots/report`.
- `cage_slots_expenses` — отдельная гранулярность для расходов слотов.
- `payroll_settings`, `payroll_bank_export` — sub-страницы payroll.
- `pos_*` модули (waiter/bar/manager/reports/inventory/menu/charges) — сейчас POS вообще не управляется матрицей.

### Переименовать для ясности
- `cage` → label "Cage Live Game (Cashier)" (writable surface).
- `cage_view` → label "Cage History (Read-only)".
- `staff_*` → "Floor Staff *" (уже частично сделано).

## Часть 3 — `role_module_defaults` миграция
Удалить из БД строки на удалённые модули (`cage_closings`, `staff`, `pitbook`, `business_days`, `weekly_bonus`, `monthly_tips`) для всех ролей.

Для **floor_manager** оставить `cashless=all`, `expenses=all` (уже так) — теперь это реально заработает после Части 1.

Добавить дефолты для новых модулей (`tables_analytics`, `cancelled_transactions`, `cage_slots_report`, …) по ролям manager/floor_manager/finance_manager/super_admin.

## Часть 4 — Синхронизация
- Обновить `src/lib/route-module-map.ts`: убрать ссылки на удалённые ключи, добавить новые маршруты.
- Обновить `src/test/access-matrix.test.ts`: `FLOOR_MANAGER_ALLOWED` пересобрать под новый набор.
- Поднять patch-версию `package.json` (изменения в БД).

## Файлы
- `src/pages/Cashless.tsx` — date picker.
- `src/lib/modules.ts` — чистка + новые модули.
- `src/lib/route-module-map.ts` — синхронизация.
- `src/test/access-matrix.test.ts` — обновление контракта.
- `supabase/migrations/*` — DELETE/INSERT в `role_module_defaults`.
- `package.json` — version bump.

## Не входит в этот план
- Реальное применение `day_horizon` как auto-filter на всех страницах (большая работа, отдельный заход).
- Удаление кода страниц Pitbook/BusinessDays/WeeklyBonus/MonthlyTips — оставляем как dead code до отдельной задачи.

Подтверди — и я выполню всё одним заходом. Если хочешь сузить (например, только Часть 1 + Часть 3 по floor_manager), скажи.
