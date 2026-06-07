
# Global Finance & Office Redesign

## 1. Kill number-input spinners everywhere

Browser up/down arrows on `<input type="number">` are noise. We hide them globally.

- `src/index.css`: add a global rule
  ```css
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type="number"] { -moz-appearance: textfield; }
  ```
- Replace year `<input type="number">` pickers with a `Select` dropdown (current year ±5). Affects at minimum:
  - `FinancesBudgetPage.tsx`
  - Monthly Report year picker
  - Monthly Tips / Weekly Bonus year inputs
  - Any other "year" number input found by grep.

## 2. Office: one page, tabbed shell

New route `/office` rendered as `PageShell + Tabs`. Single sidebar entry "Office". Tab order (locked):

```text
Safe · Day Closings · Money Change · Wallets · Other Incomes · Rates
```

- Each existing page (`FinancesSafePage`, `FinDayClosingPage`, `FinMoneyChangePage`, `FinWalletsPage`, new OtherIncomes, new Rates) is mounted as a tab via React Router nested routes so deep links keep working.
- Sidebar: collapse the old "Finances/Office" entries into one "Office" link; legacy URLs redirect to the matching tab.
- Intercasino transfers stays as a row INSIDE Money Change (already its existing home — confirm and don't duplicate).

## 3. Day Closings — manual table

Redesigned `/office/day-closings`:

- One row per business date, columns:
  `Date · Tables (manual) · Slots (manual) · Comment · OK`
- Below each manual input, in muted grey text, the auto-computed value (`shifts.tables_result` sum for the day; `cage_slots_shifts.system_shift_result` sum). The auto value pre-fills the input on first open; user may overwrite. Trailing grey hint shows the original auto number so deviation is visible.
- "OK" button locks the row (writes to `fin_day_closing` with `closed_at`/`closed_by`); locked rows render read-only with a small unlock affordance for Finance Director.
- Comment is free text, stored on the same row.
- Manager Access required to edit a locked row (uses existing override).

## 4. Monthly Expenses — reuse Expenses look

Throw out the current standalone Monthly Expenses layout. Build on top of the regular Expenses page:

- Same header chrome (filters, search, totals row) as `/expenses`.
- Default filter = current month; month-switcher in header.
- Category dropdown in the create/edit row exposes the FULL new `fin_categories` tree (main + sub), not the old `expense_categories`.
- Existing rows show category as `Main → Sub` chip; an inline dropdown lets Finance reassign category in place (writes `fin_category_id`, audit log entry).

## 5. Budget — single tab with Plan / Actual / Difference

Rebuild `/office/budget` as one grid; drop separate "Budget vs Actual" page.

Per category row, per month, render THREE sub-columns:
```text
| Plan | Actual (grey, auto) | Δ |
```
- `Plan`: editable, manual.
- `Actual`: auto from `expenses` aggregated per (casino, category, month, currency), rendered in muted grey, read-only.
- `Δ`: `Actual − Plan`, colored `cms-amount-positive` / `cms-amount-negative`.
- Currency: NO conversion. For categories that have entries in BOTH TZS and USD, render TWO stacked rows per month (TZS row + USD row). For single-currency categories, one row. The category meta now stores `currencies: ['TZS'] | ['USD'] | ['TZS','USD']` derived from existing budget rows.
- Month-close lock: each month has a "Close month" button (Finance Director) → writes `fin_budget_lock` (new table, `casino_id, year, month, locked_at, locked_by`). Locked cells become non-editable.
- Year selector = dropdown (per §1).

(Sub-tabs Prediction / Actual / Difference rejected — collapsed into one grid per user's "одна вкладка" instruction; the three sub-columns ARE the three views.)

## 6. Rates — per-casino daily FX

New tab `/office/rates`, new table `fin_daily_rates`:
```text
casino_id · business_date · currency · rate_to_tzs · set_at · set_by
PK (casino_id, business_date, currency)
```
- Office Rates tab: grid of dates × currencies (USD, EUR, GBP, KES). Editable from Office only.
- On Cage shift open: Rates input is REMOVED. Cage reads today's row from `fin_daily_rates` (per-casino). If missing, cashier gets a blocking banner "Office must set today's rates" — no fallback to manual entry.
- All expense / cashless / transfer writes resolve rate via `fin_daily_rates(casino_id, business_date, currency)` — different days legitimately have different rates.
- Backfill migration: seed `fin_daily_rates` from the most recent `cage_slots_exchange_rates` per casino so nothing breaks on day-1.

## 7. Monthly Report rebuild

Page `/finances/monthly-report` becomes a fully inline editor.

- Header sizing fix: `Month` cell == `Year` cell width (both use the same `w-32` Select). Year cell currently wider — equalize.
- Single flat table (no split per group). Columns:
  ```text
  Main category | Sub category | Plan Year | Plan Month | Actual | Δ | (expand)
  ```
  - `Main`/`Sub` are inline-editable: rename in place, drag to reparent, "+" to add new sub. Writes through `fin_categories`.
  - `Plan Year` / `Plan Month` pulled from `fin_budget` (read-only here; edit in Budget tab).
  - `Actual` aggregated from `expenses` for the selected month.
  - Δ colored.
  - Two currency columns per metric (TZS, USD) — no conversion.
- Inline category reassign on expense rows: when a row is expanded, each expense gets a small "Move to…" dropdown that writes `fin_category_id` (same as §4).
- Expanded expense row shows: `Date · Description · Wallet · Amount TZS · Amount USD · Cash Desk · Move-to`.  
  Rename current ambiguous `amount` header to `Amount TZS` / `Amount USD` (two columns; USD only filled if entry was USD).
- Larger numeric font on totals: bump `text-[11px]` → `text-sm tabular-nums font-mono`.

## 8. Out of scope (explicit)

- Don't touch Cage shift business logic beyond removing the manual Rates field and switching the read source to `fin_daily_rates`.
- Don't touch player / pit / POS modules.
- Don't touch landing page or design system tokens.

## Technical notes

- **New tables**
  - `fin_daily_rates (casino_id, business_date, currency, rate_to_tzs, set_at, set_by)` + GRANTs + RLS (read: authenticated same casino; write: finance_director, super_admin).
  - `fin_budget_lock (casino_id, year, month, locked_at, locked_by)` + GRANTs + RLS.
- **Altered**
  - `fin_day_closing`: add `tables_manual bigint`, `slots_manual bigint`, `comment text`, `closed_at`, `closed_by`.
  - `expenses`: no schema change; we already have `fin_category_id`. Add audit row on inline reassign (already covered by `fin_audit_log`).
- **New routes / pages**
  - `src/pages/office/OfficePage.tsx` (tab shell)
  - `src/pages/office/RatesTab.tsx`
  - `src/pages/office/OtherIncomesTab.tsx` (extracted from current finance page)
  - Refactor `FinDayClosingPage`, `FinancesBudgetPage`, `FinancesMonthlyReportPage` to new specs.
- **Hooks**
  - `use-fin-daily-rates.ts` (CRUD)
  - `use-fin-budget-lock.ts`
  - Update `use-fin.ts` to expose Plan/Actual/Δ shape.
- **Sidebar / routing**
  - Collapse Office links to one entry; legacy `/finances/*` URLs redirect to the corresponding `/office/<tab>` path.
- **Version bump**: patch `package.json` (backend changes present).

## Open questions deferred to build time

None blocking — answers already locked from the clarifying questions.
