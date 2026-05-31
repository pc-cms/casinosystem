# Унификация Expenses в одну страницу

## Что есть сейчас (3 дубля)

| Страница | Файл | Кому показывается |
|---|---|---|
| `/expenses` | `Expenses.tsx` (488 строк, фильтры + история + draft-форма) | cashier (live), super_admin |
| `/expenses/daily` | `DailyExpensesPage.tsx` (223 стр.) | super_admin, manager, floor_manager, finance_manager |
| `/cage-slots/expenses` | `SlotsExpenses.tsx` (274 стр.) | cashier_slots, super_admin |

В БД у `expenses` уже есть колонка `source ∈ ('live_game','slots','office')` (миграция `20260531122526`) — backfill сделан. Категории общие.

## Решение

`/expenses` (которая нравится) становится **единственной**. Добавляем фильтр **Source** (`All / Live Game / Slots / Office`) рядом с существующими (Category / Target / Status / Search). Поведение по ролям:

| Роль | Видит | Может создавать |
|---|---|---|
| `super_admin`, `manager`, `floor_manager`, `finance_manager` | Все источники, фильтр Source доступен | Любой источник + любая категория (office создаётся без shift, авто-approve через триггер) |
| `cashier` (live game) | Только `source='live_game'` (фильтр залочен) | `live_game` в активную смену |
| `cashier_slots` | Только `source='slots'` (фильтр залочен) | `slots` в активную смену |

Draft-форма остаётся, но при создании автоматически проставляет `source` по контексту (роль + активная смена).

## Изменения файлов

**1. `src/pages/Expenses.tsx`**
- Добавить state `source: 'all'|'live_game'|'slots'|'office'`.
- Добавить `<Select>` Source в блок фильтров (рядом с Category).
- Передать в `useExpenseAnalytics` (см. п.3).
- В query (`useExpenses`) пробросить фильтр по `source`, чтобы не тянуть лишнее.
- Для не-менеджеров: source залочен на их роль, селектор скрыт.
- В draft-форме определить `source` автоматически (cashier→live_game, cashier_slots→slots, manager без активной смены→office).
- Бейдж source рядом с категорией в строке истории.

**2. `src/hooks/use-expenses-analytics.ts`**
- Добавить `source?: 'all'|'live_game'|'slots'|'office'` в `ExpenseFilters` и фильтрацию.
- Добавить `bySource` агрегат в результат (для будущей сводки, опционально).

**3. `src/hooks/use-casino-data.ts` (useExpenses / useCreateExpense)**
- В `useCreateExpense` передавать `source` в insert (если приходит). Если не передан — оставлять DEFAULT триггеру.
- Тип Expense расширить на `source`.

**4. Роутинг — `src/App.tsx`**
- `/expenses/daily` → `<Navigate to="/expenses" replace />`.
- `/cage-slots/expenses` → `<Navigate to="/expenses" replace />`.

**5. Сайдбар — `src/components/layout/AppSidebar.tsx`**
- Убрать пункты "Daily Expenses" (`/expenses/daily`) и "Expenses" для `cashier_slots` (`/cage-slots/expenses`).
- Оставить один пункт **Expenses → `/expenses`** для всех ролей с доступом (cashier, cashier_slots, manager, floor_manager, finance_manager, super_admin).
- Обновить `EXACT_NAV_PATHS`.

**6. RoleGuard** — добавить `/expenses` в видимость для `cashier_slots`, `manager`, `floor_manager`, `finance_manager` (если ещё нет).

**7. Dashboard** — `StatCard "Daily Expenses"` сменить `href` на `/expenses` + предзаполнить `?source=all&from=today&to=today` (через query param). Опционально: добавить чтение query params в `Expenses.tsx`.

**8. Удалить файлы**
- `src/pages/DailyExpensesPage.tsx`
- `src/pages/SlotsExpenses.tsx`
- Соответствующие импорты в `App.tsx`.

## Что НЕ трогаем
- `expenses_office_before_insert` / `_after_insert` триггеры — уже корректно проставляют approved/wallet для office.
- `/expenses/approvals` — отдельная страница согласования, оставляем.
- Существующие данные — `source` уже забэкфиллен.

## Версия
Только UI/роутинг — без миграций. Версию **не бампим**.

## Открытый вопрос
Подтверди удаление `DailyExpensesPage.tsx` и `SlotsExpenses.tsx`. Если хочешь временно оставить файлы (на случай отката) — сделаю только redirect, файлы не трогаю. По умолчанию **удаляю**.
