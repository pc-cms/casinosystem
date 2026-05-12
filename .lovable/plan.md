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

---

# STAFF MASTER MIGRATION

> Saved for later. Casino is live — do NOT implement until user gives the green light.
> Цель: единый реестр персонала в `employees` (Staff Master); старые `dealers`/`staff_members` остаются shadow-таблицами и зеркалируются триггерами, чтобы Pit Rota / Breaklist / Floor Rota / Attendance продолжали работать без изменений.

## 0. Текущее состояние (проблемы)

| Таблица | Назначение | Кол-во | Используется в |
|---|---|---|---|
| `dealers` | Live Game. `category` (trainee/dealer/inspector/expert/pit_boss), `is_pit_boss`, `salary numeric` | 29 | `pit_rota`, `dealer_attendance`, `breaklist`, `breaklist_logs`, `weekly_bonus_entries` |
| `staff_members` | Floor/Security/Office. `department` enum, `salary numeric`. Категорий НЕТ | 40 | `staff_rota`, `staff_attendance` |
| `employees` | HR/Payroll-мастер. `position TEXT`, `department TEXT`, `basic_salary BIGINT` | 40 | `payroll_entries`, `employee_bank_accounts` |

Проблемы текущего бэкфилла:
- 40 строк `employees` имеют department из enum строкой, но `position` пустой.
- 29 дилеров **не импортированы** в employees вообще.
- `category` дилера и `is_pit_boss` нигде не сохранены в employees.
- Нет полей `contract_start/end`, `is_active`, `staff_group`, разделения Live vs не-Live.

## 1. Расширение схемы `employees`

```sql
ALTER TABLE public.employees
  ADD COLUMN dealer_id        uuid REFERENCES public.dealers(id) ON DELETE SET NULL,
  ADD COLUMN staff_group      text NOT NULL DEFAULT 'floor'
    CHECK (staff_group IN ('live','floor','security','office')),
  ADD COLUMN dealer_category  dealer_category,
  ADD COLUMN is_pit_boss      boolean NOT NULL DEFAULT false,
  ADD COLUMN contract_start   date,
  ADD COLUMN contract_end     date,
  ADD COLUMN onboarding_date  date,
  ADD COLUMN is_active        boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX employees_dealer_id_uniq
  ON public.employees(dealer_id) WHERE dealer_id IS NOT NULL;
CREATE UNIQUE INDEX employees_staff_member_id_uniq
  ON public.employees(staff_member_id) WHERE staff_member_id IS NOT NULL;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_category_only_live
  CHECK ((staff_group = 'live') OR (dealer_category IS NULL AND is_pit_boss = false));

CREATE INDEX idx_employees_group ON public.employees(casino_id, staff_group);
```

Соответствие группа ↔ источник:

| group | Источник | Категория | Шифты Rota |
|---|---|---|---|
| `live` | dealers | dealer_category + is_pit_boss | M/N/E/L |
| `floor` | staff_members (cashier, bartender, hostess, waiter, cleaner, reception) | — | D/N/L/E/O |
| `security` | staff_members (security) | — | D/M/N/G/L/E/O |
| `office` | staff_members (it, hr, driver) | — | D/N/L/E/O |

## 2. Очистка плохого бэкфилла + правильный импорт

```sql
-- Перезаписать 40 строк employees правильными данными из staff_members
UPDATE public.employees e
SET staff_group = CASE
      WHEN sm.department = 'security' THEN 'security'
      WHEN sm.department IN ('it','hr','driver') THEN 'office'
      ELSE 'floor' END,
    department = sm.department::text,
    position   = '',
    contract_start = sm.contract_start,
    contract_end   = sm.contract_end,
    onboarding_date= sm.onboarding_date,
    is_active      = sm.is_active,
    basic_salary   = GREATEST(0, ROUND(COALESCE(sm.salary, 0))::bigint),
    photo_url      = sm.photo_url,
    full_name      = sm.name
FROM public.staff_members sm
WHERE e.staff_member_id = sm.id;

-- Импортировать все 29 дилеров
INSERT INTO public.employees (
  casino_id, dealer_id, full_name, staff_group, department, position,
  dealer_category, is_pit_boss, basic_salary,
  contract_start, contract_end, onboarding_date,
  photo_url, is_active, payroll_status)
SELECT d.casino_id, d.id, d.name, 'live', 'live_game',
       CASE WHEN d.is_pit_boss THEN 'Pit Boss' ELSE INITCAP(d.category::text) END,
       d.category, d.is_pit_boss,
       GREATEST(0, ROUND(COALESCE(d.salary, 0))::bigint),
       d.contract_start, d.contract_end, d.onboarding_date,
       d.photo_url, d.is_active,
       CASE WHEN d.is_active THEN 'active' ELSE 'inactive' END
FROM public.dealers d
WHERE NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.dealer_id = d.id);
```

Итог: `employees` = 69 строк, каждая привязана либо к `dealers`, либо к `staff_members`.

## 3. Двунаправленные триггеры зеркалирования

Anti-loop guard через session GUC `app.staff_sync`. Триггеры `SECURITY DEFINER`:
- **employees → dealers / staff_members** (BEFORE INSERT/UPDATE) — при `staff_group='live'` создаёт/обновляет строку в `dealers`; иначе в `staff_members`. Перетаскивание группы Live↔Floor разрешено (одна shadow-привязка обнуляется).
- **dealers UPDATE → employees** — обновляет name/category/is_pit_boss/salary/contracts/photo/is_active.
- **staff_members UPDATE → employees** — обновляет name/department/salary/contracts/photo/is_active.
- **dealers/staff_members AFTER INSERT → employees** — автосоздание employee, если кто-то добавил человека через старые формы (страховка).

См. полные тела функций в обсуждении плана v2 (5 триггеров, 4 функции).

## 4. UI: Staff Master с табами и редактированием

`/staff/master` — одна страница, общий FilterBar сверху, табы переключают набор колонок для тех же 69 человек:

```
Header: [+ Add Employee] [Group: All|Live|Floor|Security|Office]
        [Department ▾] [Search] [Status: Active|Inactive]
Tabs: [Roster] [Onboarding & Contracts] [Payroll Profile] [Current Position]
DataTable + кнопка ✏️ в каждой строке
```

| Таб | Колонки |
|---|---|
| Roster (default) | Photo · Name · Group · Department · Position/Category · Status · ✏️ |
| Onboarding & Contracts | Photo · Name · Group · Onboarding · Contract Start · End · Days Left · Years · ✏️ |
| Payroll Profile | Photo · Name · Basic Salary · Bank · Account # · NSSF · Tax ID · GEPF · ✏️ |
| Current Position | Photo · Name · Group · сегодня/завтра shift · последний attendance · текущий стол (Live) · ✏️ |

### Универсальный EmployeeEditorDialog
Условные секции:
- **Identity**: Photo, Full Name *, Status, **Group** (radio: Live/Floor/Security/Office).
- **Position**: для `Live` — `Dealer Category` + checkbox `Is Pit Boss`. Для `Floor`/`Office` — `Department` select по списку группы + free-text Position. Для `Security` — department залочен.
- **Contracts**: Onboarding, Contract Start, Contract End, Employment Date.
- **Payroll**: Basic Salary, NSSF, Tax ID, GEPF, Bank Name/Code/Branch/Account.

Сохранение через `useUpsertEmployee` → триггер БД зеркалит в `dealers`/`staff_members` → Pit Rota / Breaklist обновляются автоматически.

## 5. Sidebar: скрываем, не удаляем

`src/components/layout/AppSidebar.tsx`:
- Закомментировать `Live Game` и `Floor Staff` HR-пункты.
- URL `/pit?tab=employee` и `/staff?tab=employee` остаются доступны напрямую — это страховочная сетка.
- Добавить `hr` в roles для virtual `__attendance__` и `__rota__` (PIT-секция), чтобы HR попадал в эти грид'ы без отдельных кнопок.

`Pit.tsx`, `Staff.tsx`, `EmployeeList`, `use-staff.ts`, `use-dealers.ts` — НЕ трогаем. Удалим в Phase B.

## 6. RLS

`employees` уже разрешает HR/Finance/SuperAdmin. Триггерные функции `SECURITY DEFINER` пропускают правки в `dealers`/`staff_members` без прямых прав. Существующие политики на shadow-таблицах остаются.

## 7. Порядок выкатки

1. **Миграция БД** одной транзакцией: ALTER + UPDATE 40 + INSERT 29 + 4 функции + 5 триггеров. Bump `package.json` patch.
2. **Verify (read-only):** `count(*)=69`, распределение по `staff_group`, тест-правка зарплаты в employees → видна в dealers.
3. **Деплой UI:** Staff Master с табами и editor; AppSidebar с закомментированными HR-кнопками.
4. **Smoke на проде:** Break List, Pit Rota, Floor Rota, Attendance — те же люди и значения. Add/Edit Live + Floor через Staff Master → появляются в соответствующих гридах.
5. **Откат при проблеме:**
```sql
ALTER TABLE employees     DISABLE TRIGGER trg_employees_sync;
ALTER TABLE dealers       DISABLE TRIGGER trg_dealers_sync;
ALTER TABLE staff_members DISABLE TRIGGER trg_staff_members_sync;
```
   Раскомментировать HR-кнопки в сайдбаре. Shadow-таблицы нетронуты.

## 8. Phase B (через 2–4 недели стабильной работы — отдельная задача)

- Удалить таб Employee из `Pit.tsx` и `Staff.tsx`, удалить `EmployeeList`.
- Перевести FK: `pit_rota.dealer_id`→`employee_id`, аналогично `dealer_attendance`, `breaklist`, `breaklist_logs`, `weekly_bonus_entries`, `staff_rota`, `staff_attendance`.
- Удалить shadow-таблицы `dealers`/`staff_members` и все sync-триггеры.
- Тогда `employees` становится единственным реестром.

## Файлы

**Миграция:** ALTER + cleanup + import + 4 функции + 5 триггеров + version bump.

**Frontend:**
- `src/hooks/use-payroll.ts` — расширить `Employee` (`staff_group`, `dealer_category`, `is_pit_boss`, `contract_start/end`, `onboarding_date`, `is_active`); параметр `group` в `useEmployees`; новые поля в `useUpsertEmployee`.
- `src/pages/StaffMaster.tsx` — Tabs + FilterBar + универсальный EmployeeEditorDialog с условными секциями + ✏️ inline edit.
- `src/components/layout/AppSidebar.tsx` — закомментировать HR Live Game/Floor Staff; добавить `hr` в virtual Attendance/Rota.

**Memory:** добавить `mem://features/unified-staff-master` с заметкой про двунаправленные триггеры и Phase B-план.

## Открытый вопрос

Для Live в колонке Position в Roster показывать `dealer_category` (badge) либо free-text `position`. Предпочтение: показывать категорию badge'ом, отдельный free-text для Live не давать (избегаем рассинхрона).
