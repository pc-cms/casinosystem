
## Monthly Finance Report (replaces Annual Analytics)

Recreates the Excel report (`10 JC Expenses report`) inside the app. Same structure: Incomes header → 6 expense groups → totals/USD conversion footer. FM gets per-casino views (Arusha / Mwanza / Dodoma) plus a consolidated "Network" view that sums all three. Categories expand inline to show every underlying expense row.

### Route & access

- Sidebar: rename `Finances → Annual Analytics` to `Finances → Monthly Report`.
- Route: replace `/finances/annual-analytics` with `/finances/monthly-report` (page file `FinancesMonthlyReportPage.tsx`; delete `FinancesAnnualAnalyticsPage.tsx`).
- Visible to `super_admin`, `admin`, `finance_manager`, `manager`, `owner`. Network tab visible only on `premier` subdomain (uses existing `isSummaryMode` rule).

### Page header (top controls)

- Month picker (default = current month).
- YTD toggle: "Month" / "Year-to-date" — when YTD on, all columns aggregate Jan 1 → end of selected month, and the "per month" planned column is replaced by "per period (× N months)".
- Casino tabs: `Arusha | Mwanza | Dodoma | Network` (Network only on premier).
- Export → XLSX button (reuses `src/lib/excel-export.ts`, mirrors current layout so user gets the same file back).
- Currency rate field (TZS per USD), default from `cage_slots_exchange_rates` latest, editable; used for USD conversions in the report only.

### Top "Incomes" panel (compact card)

Pulled from existing data, scoped by the selected casino (or summed for Network):
- Live Game = SUM(`shifts.tables_result`) for the period.
- Slots = SUM(`cage_slots_shifts` net result) for the period.
- Other Incomes = SUM(`expenses` where category group = `Income / Collection / CAPEX / Transfers` and category marked `is_income=true`).
- Total in TZS = sum.

### Main table (one per group, 6 groups)

Columns (Month mode):

```
Category | Plan / YEAR TZS | Plan / YEAR USD | Plan / MONTH TZS | Plan / MONTH USD | | Actual TZS | Actual USD | % | | Remaining TZS | Remaining USD | %
```

- Plan numbers come from `fin_budget` (annual + computed monthly = annual/12).
- Actual = SUM(`expenses.amount_tzs` and `.amount` per currency) for the month, scoped to the casino, filtered to that `fin_category_id`, excluding voided.
- % = Actual / Plan_month. Remaining = Plan − Actual. Negative remaining styled with `cms-amount-negative`, ≥0 with `cms-amount-positive` (matches existing financial color rule).
- Group totals row (bold) at the bottom of each group, like the Excel.
- Grand totals block at the very bottom: `TOTAL`, `TOTAL IN TZS`, `TOTAL IN USD`, plus `Revenue in USD = Incomes USD − Expenses USD`, `Collection in USD`, `Balance in USD` — matching Excel rows 70–80.

### Expandable category rows

Each category row is clickable (chevron icon). Expand reveals an inline child row spanning all columns, rendering a sub-`DataTable`:

```
Date (DD/MM/YYYY) | Wallet | Description | Amount (native ccy) | TZS | USD
```

- Source: `expenses` rows for `fin_category_id` in the selected month + casino, ordered by `business_date`.
- Footer of the sub-table shows count and sum (TZS and USD).
- Voided rows hidden by default; small toggle "Show voided" at table top scope.
- Empty state: "No expenses recorded".

Only one category expanded at a time per group (accordion behavior using existing `@radix-ui/react-collapsible`).

### Network tab (premier only)

- Same layout, but every value = SUM across the 3 casinos.
- Each cell additionally shows a tiny per-casino split tooltip (A · M · D) on hover.
- Expanded category sub-rows include a `Casino` column (3-letter code) and are sorted by date.

### Data layer

New hook `src/hooks/use-fin-monthly-report.ts` exposes:
- `useMonthlyReport({ year, month, ytd, casinoId | "network" })` returning `{ incomes, groups:[{group_name, categories:[{id,name, plan_year_tzs, plan_year_usd, plan_month_tzs, plan_month_usd, actual_tzs, actual_usd, expenses:[…]}]}], totals }`.
- Single batched fetch: `fin_categories`, `fin_budget` (for year), `expenses` (period+casino filter), incomes from `shifts` + `cage_slots_shifts`.
- Network mode runs the same queries without casino filter (only on premier).

No DB migration required — the data model already exists.

### Files

- Add: `src/pages/finances/FinancesMonthlyReportPage.tsx`, `src/components/finances/MonthlyReportTable.tsx`, `src/components/finances/MonthlyReportRow.tsx` (expandable), `src/components/finances/MonthlyReportIncomes.tsx`, `src/hooks/use-fin-monthly-report.ts`.
- Edit: `src/App.tsx` (route swap), `src/lib/route-prefetch.ts`, `src/components/layout/AppSidebar.tsx` (rename label + icon → `FileSpreadsheet`).
- Delete: `src/pages/finances/FinancesAnnualAnalyticsPage.tsx`.

### Out of scope (not in this plan)

- No changes to budget editing, Expenses page CRUD, or wallet/cage logic.
- USD/TZS exchange persistence — rate is just a viewer input; not stored.
- PDF export (XLSX only, on request).
