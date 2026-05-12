# Universal Header — Global Sortable/Filterable Tables

> Saved for later. Casino is live — do NOT implement until user gives the green light.

## Goal

Один универсальный механизм сортировки, фильтрации, видимости колонок, экспорта и сохранённых видов для ВСЕХ табличных страниц системы. Никаких локальных «своих» сортов в каждом компоненте — всё через общий API.

## Architecture

### 1. Core: `DataTableV2` (новый компонент, рядом со старым `DataTable`)

Файл: `src/components/ui/data-table-v2.tsx` + хук `src/hooks/use-table-state.ts`.

API через декларативные колонки:

```ts
type ColumnDef<Row> = {
  id: string;                 // ключ для state/URL/storage
  header: string;             // подпись + label в FilterBar
  accessor: (r: Row) => unknown;        // значение для сортировки/фильтра
  cell?: (r: Row) => ReactNode;         // кастомный рендер
  align?: "left"|"right"|"center";
  numeric?: boolean;          // моно-шрифт + правое выравнивание
  sortable?: boolean;         // default true
  filter?:
    | { kind: "text" }
    | { kind: "select", options?: () => Array<{value:string,label:string}> }
    | { kind: "multiselect", options?: () => ... }
    | { kind: "number-range" }
    | { kind: "date-range" };
  hidden?: boolean;
  sticky?: boolean;
  exportValue?: (r: Row) => string | number;
};
```

Использование:

```tsx
<DataTableV2
  tableId="payroll.entries"
  rows={entries}
  columns={cols}
  rowKey={(r) => r.id}
  onRowClick={...}
  totalsRow={(rows) => ({ basic_salary: sum(...), net_salary: sum(...) })}
/>
```

Внутри:
- **FilterBar сверху** (через существующий `FilterBar`): поиск, per-column фильтры (Select/Input/DateRangePresets), кнопки `Columns`, `Export ▾`, `Views ▾`, `Reset`.
- **Таблица** sticky thead, клик по th — сортировка (▲/▼, shift-click = вторичная), `sticky` колонка `position: sticky; left: 0`.
- **Totals row** в `<tfoot>`.
- Empty state «No rows match filters».

### 2. State: `useTableState(tableId, columns)`

Возвращает `{ filters, sort, hidden, view, derivedRows, setFilter, setSort, toggleColumn, ... }`.

Persistence (и URL, и localStorage):
- **URL query params** (текущая сессия): `?t.payroll.entries.sort=net_salary:desc&t.payroll.entries.f.bank=CRDB`. Префикс `t.<tableId>.` → не пересекается между таблицами на одной странице.
- **localStorage** `cms.table.<tableId>.default` — последний набор применяется при заходе если URL пуст. `Reset to default` чистит URL.
- **Saved views** `cms.table.<tableId>.views = [{name, state}]`. Меню `Views ▾` со списком + «Save current as…», «Manage…».

### 3. Engine — чистые функции в `src/lib/table-engine.ts`
- `applyFilters(rows, columns, filters)`
- `applySort(rows, columns, sort)`
- Стабильный sort, undefined/null в конец, числа через `accessor`, даты через `Date.parse`.
- Глобальный поиск идёт по всем `text`-колонкам или с явным `searchable: true`.

### 4. Export — `src/lib/table-export.ts`
- `exportTableCsv(rows, columns, filename)` — `exportValue ?? accessor`, сырые числа, даты ISO.
- `exportTableXlsx(rows, columns, filename)` — через `src/lib/excel-export.ts`.
- Экспортируется отфильтрованный + отсортированный срез, только видимые колонки.

### 5. Sticky первая колонка + горизонтальный скролл
Обёртка `overflow-x-auto`, у sticky-колонки `sticky left-0 bg-card z-[1]` + теневой градиент справа.

## Rollout plan

### Phase A — Payroll & HR (главное по запросу)
- `src/pages/payroll/PayrollPeriodPage.tsx` — фильтры department/bank/status, сорт, totals row остаётся.
- `src/pages/Payroll.tsx` — список периодов (status, year, sort).
- `src/pages/StaffMaster.tsx` — мастер-лист (department, role, active, bank, has_account).

### Phase B — Финансы и журналы
- `src/pages/Logs.tsx`, `src/pages/Expenses.tsx`, `src/pages/Cashless.tsx`, `src/pages/MissChips.tsx`, `src/pages/Reports.tsx`,
- `src/pages/cage/CageClosingsPage.tsx`, `src/components/cage/CageHistoryView.tsx`, `src/components/cage/ChipMovementReport.tsx`,
- `src/components/finance/FinanceExpenses.tsx`, `src/components/finance/InterCasinoTransfers.tsx`, `src/components/finance/BudgetPlanning.tsx`,
- `src/components/bank-checks/BankChecksTable.tsx`, `src/components/bank-checks/ShiftSummaryTable.tsx`.

### Phase C — Игроки и админка
- `src/pages/Guests.tsx`, `src/pages/Blacklist.tsx`, `src/pages/PlayerStatistics.tsx`, `src/pages/WeeklyBonus.tsx`, `src/pages/Incidents.tsx`, `src/pages/Groups.tsx`, `src/pages/ImportReports.tsx`, `src/pages/BankChecks.tsx`,
- `src/components/admin/users/UsersTab.tsx`, `src/components/admin/FloatManagement.tsx`, `src/components/admin/NetworkHealthPanel.tsx`, `src/components/admin/TableManagement.tsx`,
- `src/components/player/PlayerVisitsBreakdown.tsx`, `src/components/player/PlayerChipAdjustmentsLog.tsx`, `src/components/player/PlayerChipTransfersLog.tsx`,
- `src/components/business-days/SnapshotTable.tsx`, `src/components/business-days/ReportPanels.tsx`.

### NOT migrated (спец-гриды и печатные отчёты)
Pit BreaklistGrid, TableTracker, TableResults grid, ChipCountPanel, CloseTableWizard, CloseShiftDialog grids, ChipEmissionDialog, TransfersForm, ActiveShiftView, Dashboard виджеты, ShiftClosingReport / PrintPortal, CashCountGrid.

## Memory updates (после внедрения)
- Дополнить `mem://design/system-rules`: «Все list-таблицы используют `DataTableV2` с `tableId`».
- Создать `mem://design/data-table-v2` с API и списком исключений.

## Versioning
Чистое frontend-изменение → patch-bump НЕ требуется (skip per "purely cosmetic UI tweaks" rule).

## Safety / Rollout strategy (важно: казино работает 24/7)
1. Имплементируем `DataTableV2` рядом со старым `DataTable` — никаких breaking changes.
2. Phase A в нерабочее окно (≈ 06:00–10:00 EAT, после auto-close дня).
3. Phase B и C — отдельными сессиями, по одной странице за раз с проверкой в preview перед публикацией.
4. Старый `DataTable` НЕ удаляем до полной миграции всех страниц.
