## Goal

1. Привести ВСЕ таблицы в `/reports` к единому виду (DataTable v2 + MoneyCell).
2. В Slots-вкладке убрать «Opened» и оставить только время закрытия (HH:mm).
3. Перенести оставшуюся функциональность из Closings в Reports и удалить `/closings`.

## New Reports tab layout

Текущие вкладки + 2 новые из Closings:

`Daily diff · Total · Shifts · Live Game · Slots · Tables · Players · Groups · Expenses · Cashless · Miss Chips`

- **Total** (новая, из Closings → Total): per-business-day rollup (Drop Tables, Tables Result, Drop Slots inline-edit, Slots Result, Expenses, Total Results). Использует общий пикер диапазона (а не помесячно). Inline-редактирование Drop Slots доступно только `super_admin / manager / floor_manager / finance_manager`.
- **Shifts** остаётся как есть (KPI + Balance reconciliation).
- **Live Game** (новая, из Closings → Live): список закрытых смен в диапазоне пикера с колонками Opened / Closed / Cash / Miss / Tables / Balance + кнопка **Print** (`ReprintShiftDialog`).
- **Slots**: убираем колонку **Opened** полностью; в **Closed** показываем только время `HH:mm` (без даты — бизнес-день уже виден в первой колонке).

Вкладка **Tables** структурно не меняется (`TableResultsPage embedded`), только косметически выравнивается под общий стиль (без переделки внутренностей).

## Table styling — DataTable v2 везде

Мигрируем нативные `<table>` на `DataTable / DTHead / DTBody / DTRow / DTHeader / DTCell` + `MoneyCell` (как уже сделано в `SlotsHistoryReport`). Сохраняем существующую sort-логику (`useSorted`), но рендерим её через `DTHeader` с `onClick` + стрелкой (как в Slots).

Применяем к:
- `DailyReport` (Daily diff)
- `ShiftReport` (Shifts) — KPI-плитки сверху не трогаем
- Новый `LiveGameReport`
- Новый `TotalReport`
- `PlayerReport` (Players)
- `GroupReport` (Groups)

`Slots`, `Expenses`, `Cashless`, `Miss Chips` уже не наши локальные таблицы — оставляем как есть (`embedded` режим, своя разметка).

## Closings retirement

- Удалить файл `src/pages/ClosingsPage.tsx`.
- Удалить из `src/App.tsx` lazy-import и `Route path="/closings"`.
- Редиректы:
  - `/closings` → `/reports?tab=total`
  - `/closings?tab=live` → `/reports?tab=live`
  - `/closings?tab=slots` → `/reports?tab=slots`
  - `/closings?tab=expenses` → `/reports?tab=expenses`
  - `/cage/closings` → `/reports?tab=live` (уже редирект сейчас)
  - `/cage-slots/report/:id` → `/reports?tab=slots`
- В `AppSidebar.tsx` убрать пункт `Closings` (строка 69) и удалить `/closings` из `EXACT_NAV_PATHS` (строка 196).
- Комментарий в `ReprintShiftDialog.tsx` поправить (`/cage/closings` → `/reports?tab=live`).
- Логика `ExpensesDayReport`/`PrintPortal` для печати в Expenses-вкладке Closings сейчас НЕ переносится — печать дневного отчёта по расходам уже доступна в самой `Expenses`-странице (embedded). Если потеряем какую-то печать — она вернётся отдельной задачей.

## Technical notes

- `LiveGameReport` использует тот же запрос, что Closings → Live (`shifts` where `status='closed'`, `closed_at` в диапазоне `from..to` через `businessDayHourUTC(_,7)`), плюс `ReprintShiftDialog` для печати.
- `TotalReport` использует тот же мульти-fetch (live shifts, slots shifts, expenses, drop transactions) и тот же `useMutation` для `manual_drop_slots`. Диапазон берётся из общего пикера, не помесячно.
- Колонка Closed в Slots: формат `HH:mm` от `s.closed_at` в Africa/Dar_es_Salaam.
- Никаких изменений БД, RPC, edge functions — чисто фронт. Версию package.json не бампим.

## Out of scope

- Внутренности `TableResultsPage`, `Expenses`, `MissChips`, `Cashless`, `SlotsHistoryReport` (кроме указанной правки колонок времени).
- Расчёты, RPC, RLS, миграции.
- Печать дневных Expenses из Closings.
