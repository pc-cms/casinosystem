# Implementation Plan — Steps 2-4

Backend (Step 1) уже выполнен: `expense_categories`, `expenses.source`, office-триггеры, RPC `create_office_expense`.

## Step 2 — Closings Hub `/closings`

Новая страница с 4 вкладками. Старые `/cage/closings` и `/cage-slots/report` редиректят на неё.

- **Total** — таблица по бизнес-дням: Live Cash / Live Tables / Live Balance / Slots Win / Slots Balance / Expenses / Net. Источник: `daily_summaries` + агрегаты `expenses` по `business_date`. Drill-down кликом → переход на нужную вкладку с выбранным днём.
- **Live Game** — список Live-смен (как сейчас в `CageHistoryView`). Кнопка **Print** открывает `ReprintShiftDialog` (A4 portrait, как сделали ранее).
- **Slots** — список `cage_slots_shifts`. Кнопка **Print** открывает `SlotsConsolidatedReport` (A4 portrait).
- **Expenses** — date-picker (бизнес-день), таблица: Time / Source (Live/Slots/Office) / Category / Amount / Description / Player / Approved. Фильтры по source, сортировки. Кнопка **Print** → новый компонент `PrintExpensesReport` (A4 portrait, шапка с датой и итогами по source).

Убираем кнопки Print/Reprint из:
- `ActiveShiftView` (после закрытия)
- `ActiveSlotsShiftView`
- `CageHistoryView` (Live history)
- `CageSlotsHistoryView`
- `CageSlotsReport` page

Печать только из `/closings`.

## Step 3 — Renaming и навигация

- Sidebar: `Cage` → **Cage Live Game**; `Slots Expenses` → **Expenses Slots**; manager `Expenses` → **Expenses Live Game**; добавить **Daily Expenses** (`/expenses/daily`); добавить **Closings** (`/closings`).
- `src/lib/modules.ts` + `src/lib/route-module-map.ts`: переименовать labels, добавить новые ModuleKeys `closings` и `daily_expenses` с правильным role-маппингом (Closings: cashier+manager+finance+pit+surveillance read; Daily Expenses: manager+finance).
- Старые routes `/cage/closings`, `/cage-slots/report` → `<Navigate to="/closings?tab=..." />`.

## Step 4 — Daily Expenses + Admin Categories

**`/expenses/daily`** (manager-only):
- Date-picker, таблица всех расходов за день (Live/Slots/Office), фильтры/сортировки.
- Кнопка **+ Add Office Expense** (только manager/finance) → диалог: category select (из `expense_categories` scope `office`/`any`), amount, description. Submit → RPC `create_office_expense`. Деньги уходят с MAIN_CASH автоматически (DB-trigger).
- Office-расходы видны ТОЛЬКО здесь и в `/closings` (Expenses tab). НЕ показываются в Live Game / Slots expenses-listах.

**Admin → Casino Settings → Expense Categories**:
- Новая секция в `Admin.tsx` (или `CasinoSettingsTab`). CRUD-таблица per-casino: `code`, `label`, `scope` (live_game/slots/office/any), `active`, `sort_order`.
- Доступ: manager, finance_manager, super_admin. Delete только super_admin (RLS уже это даёт).

**Хуки** (новые в `src/hooks/`):
- `use-expense-categories.ts` — list/create/update/delete + фильтр по scope.
- `use-closings-total.ts` — агрегат по business_date.
- `use-daily-expenses.ts` — все расходы дня с фильтром по source.
- `use-create-office-expense.ts` — обёртка над RPC.

**Изменения в `use-expenses.ts`**: добавить фильтр `.neq('source', 'office')` в `useExpenses` чтобы office-расходы не появлялись в Live/Slots экранах. `useSlotsExpenses` — то же.

## Технические детали

- Печатные отчёты в Closings — A4 portrait, единый стиль (шапка казино + дата + таблица + подпись). Reuse существующих `PrintFrame` помощников.
- `daily_summaries` уже содержит cash_result/tables_result по shift; для Total-вкладки агрегируем по `business_date`.
- Версия `package.json` — bump до `1.3.202` (backend triggers + UI).

## Порядок коммитов

1. Хуки + новые helpers.
2. `/closings` страница + 4 вкладки + `PrintExpensesReport`.
3. Renaming в `modules.ts` / `route-module-map.ts` / sidebar + redirects.
4. `/expenses/daily` страница + Add Office Expense диалог.
5. Admin → Expense Categories CRUD.
6. Удаление Print/Reprint кнопок из старых мест.
