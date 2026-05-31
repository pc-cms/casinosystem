# Closings Hub + Expenses Restructure

Большая работа в 5 блоков. Выполним последовательно, начнём с фундамента (БД и категории), затем UI.

## 1. Backend: категории, office expenses, scope

### 1.1 Категории Expenses (per-casino)
- Новая таблица `public.expense_categories`:
  - `id`, `casino_id`, `code` (slug), `label`, `scope` enum (`live_game` | `slots` | `office` | `any`), `active`, `sort_order`, `created_at`
  - UNIQUE (casino_id, code)
  - GRANT + RLS: read для всех ролей казино, write только manager/finance/super_admin
- Backfill — для каждого казино заполнить дефолтным набором из текущего хардкод-списка (`src/lib/expense-categories.ts` если есть, иначе из enum в таблице `expenses`).
- Хук `useExpenseCategories(scope)` — фильтрует по `scope IN (запрошенный, 'any')`.

### 1.2 Office expenses
- В таблице `expenses` добавить колонку `source` text default `'live_game'` с CHECK (`live_game`,`slots`,`office`).
- Backfill: всё, что `cage_slots_shift_id IS NOT NULL` → `slots`; всё остальное → `live_game` (office пока нет).
- Триггер на INSERT office expense:
  - Списывает с wallet `MAIN_CASH` через тот же путь, что collections (Финансовый ledger).
  - НЕ требует approval (`approved=true` авто).
  - НЕ привязан к `shift_id` / `cage_slots_shift_id` — не попадает в `cash_result` smen.
- RPC `create_office_expense(category, amount, description, created_by)` — manager only.

### 1.3 Версия
Авто-bump patch в `package.json` (правило memory).

## 2. Closings Hub (новый `/closings` с 4 вкладками)

Переименуем `CageClosingsPage` → `ClosingsHubPage` на маршруте `/closings` (старый `/cage/closings` → redirect).

```text
┌─ Closings ────────────────────────────────────────┐
│ [Total] [Live Game] [Slots] [Expenses]            │
│ Месячный пикер (общий для всех вкладок)           │
└───────────────────────────────────────────────────┘
```

- **Total** — таблица по бизнес-дням: Date · Live Cash · Live Tables · Live Balance · Slots Win · Slots Balance · Total Expenses · Net. Клик по строке = drill в детали дня.
- **Live Game** — текущая логика `CageClosingsPage` (по сменам Live), кнопка Print открывает `ReprintShiftDialog`. Manager Reopen остаётся.
- **Slots** — аналогичная таблица по слот-сменам (`cage_slots_shifts`), кнопка Print открывает существующий `SlotsConsolidatedReport` в портретном А4.
- **Expenses** — список расходов за выбранный день (date picker внутри вкладки). Колонки: Time · Source (Live/Slots/Office, badge) · Category · Amount · Description · Player · Created By · Approved. Сортировки/фильтры по source + category. Кнопка Print → одна таблица в А4 портрет.

### Удаление дублей кнопок
- В `ActiveShiftView`, `ActiveSlotsShiftView`, `Cage history`, `CageSlotsHistoryView`, `CageSlotsReport`-странице — убрать кнопки Print/Reprint (печать только из Closings).
- Сами компоненты репортов (`ShiftClosingReport`, `SlotsConsolidatedReport`, `ReprintShiftDialog`) остаются — переиспользуем из Closings.

## 3. Переименования + навигация

| Текущее | Новое |
|---|---|
| `Cage` (sidebar) | `Cage Live Game` |
| `Slots Expenses` (`/cage-slots/expenses`) | `Expenses Slots` |
| `Expenses` (manager, `/expenses`) | `Expenses Live Game` (на этой же странице) + новая `Daily Expenses` |
| `Expenses Approvals` | без изменений |
| `Cage Closings` (`/cage/closings`) | `Closings` (`/closings`) |

- `src/lib/modules.ts`: обновить labels, добавить ключи `closings_hub`, `expenses_office`, `expense_categories_admin`.
- `src/lib/route-module-map.ts`: смапить `/closings` → `closings_hub`.
- Sidebar (`AppLayout` / nav config) — переименовать пункты, добавить `Closings` в группу Operations.

## 4. CCTV (Cage View) — Checks Live Game + Checks Slots

В `src/pages/cage/CageViewPage.tsx` сейчас read-only Cage. Добавляем 2 новые секции/таба:
- **Checks Live Game** — то же что Total в Closings, но read-only (без Reopen). Показывает таблицу Live смен + кнопку Print отчёта.
- **Checks Slots** — то же для слот-смен.

Все таблицы выровнять по стилю (одинаковые заголовки/паддинги/моноширинный шрифт) — общий компонент `<ClosingsTable role="cctv|manager" kind="live|slots|total|expenses" />` чтобы DRY.

Доступ: роль `surveillance` получает permission на новые модули `cctv_checks_live`, `cctv_checks_slots`.

## 5. Manager → Daily Expenses

Текущая `src/pages/Expenses.tsx` (manager) переименовывается в **Expenses Live Game** (фильтр source=live). Новая страница **Daily Expenses** на `/expenses/daily`:
- Date picker (любой бизнес-день).
- Таблица всех расходов за день (Live + Slots + Office), source badge, фильтры/сортировка, печать (тот же layout что Closings → Expenses tab).
- Кнопка "+ Add Office Expense" (manager only) → диалог: category (из `expense_categories` scope=office|any), amount, description. Создаёт через `create_office_expense` RPC, без approval, списывается с MAIN_CASH.
- Office-расходы видны здесь, но **НЕ** появляются в Expenses Live Game / Expenses Slots.

## 6. Admin → Casino Settings → Expense Categories

В `Admin.tsx` добавить таб/секцию **Expense Categories**:
- Таблица per-casino: code · label · scope · active · sort_order.
- CRUD: Add / Edit / Toggle active. (Удаление soft через `active=false`.)
- Доступно: manager/finance/super_admin.

## Технические детали

- **DB миграции** одной транзакцией: `expense_categories` (таблица + GRANT + RLS + seed), ALTER `expenses ADD COLUMN source` + backfill, триггер office-expense → MAIN_CASH ledger, RPC `create_office_expense`.
- **Хуки**: `useClosingsLive(month)`, `useClosingsSlots(month)`, `useClosingsTotal(month)`, `useDailyExpenses(date)`, `useExpenseCategories(scope, casinoId)`, `useCreateOfficeExpense()`.
- **Общие компоненты**: `ClosingsTable`, `PrintExpensesReport` (А4 портрет в стиле существующих отчётов: моноширинный, table border-collapse, signatures внизу).
- **Удалить/redirect**: `/cage/closings` → `/closings`, `/cage-slots/report` остаётся как технический route но кнопка скрыта.
- **Сохранение совместимости**: existing `expenses.cage_type` остаётся, новый `source` — primary. Хук `useExpenses` обновится фильтровать по `source` для разделения Live/Slots/Office.

## Порядок имплементации (4 шага)

1. **Миграция БД**: `expense_categories` (+seed), `expenses.source` (+backfill), office-expense trigger + RPC.
2. **Closings Hub**: `/closings` с 4 вкладками + удаление дублей Print во всех других местах + перенаправление `/cage/closings`.
3. **CCTV Checks Live/Slots** в Cage View + переименования в sidebar/modules.
4. **Daily Expenses + Office expenses UI** + Admin → Expense Categories editor.

Каждый шаг — отдельный коммит/проверка перед следующим.