## Goal

1. Make existing expenses visible in Monthly Report (backfill 45 rows).
2. Restore the original cashier expense form (the one in `src/pages/Expenses.tsx`) as the single, better UI — kill the inferior "new" variant if it exists in finance pages.
3. Cashiers see a small per-casino category list; Managers see the full `fin_categories` (including income).
4. Admin gets an editor to configure per-casino cashier categories.

## What to build

### 1. DB — categories + aliases (migration)

- Create `public.expense_categories` (per-casino):
  ```
  id, casino_id, code, label, scope ('live_game'|'slots'|'office'|'any'),
  active, sort_order, fin_category_id (nullable — default mapping to a fin row)
  ```
  + GRANT to authenticated/service_role + RLS by casino_id.
- Seed default rows per existing casino: `food`, `alcohol`, `bar_charge`, `taxi`, `other` for scope=`live_game` and `slots`.
- Map each seeded row's `fin_category_id` to the agreed defaults:
  - food → "Food for Customers & Staff"
  - alcohol → "Bar"
  - bar_charge → "Bar"
  - taxi → "Transport for Staff"
  - other → "Other Variable Expenses"
  - (hotel/flight/pos_comp not seeded — only used by backfill)
- Populate `fin_category_aliases` with the same mapping (per-casino) so future inserts auto-resolve.
- Add a `BEFORE INSERT/UPDATE` trigger on `expenses`: if `fin_category_id IS NULL`, look up via `expense_categories(casino_id, category_code)` first, then `fin_category_aliases(category)`. Never overwrite an explicit value.
- One-shot `UPDATE expenses` to backfill all NULL `fin_category_id` rows using the mapping above (covers food/alcohol/bar_charge/taxi/other and also flight/hotel/pos_comp).

### 2. Admin → Expense Categories (new page)

- New `src/pages/admin/AdminExpenseCategoriesPage.tsx` (linked from Admin sidebar).
- Table of `expense_categories` for the current casino with columns: Scope · Code · Label · Linked fin category · Active · Sort.
- Add / Edit / Toggle active. Code is immutable after creation. Manager / super_admin only.
- The `fin_category_id` is selected from a `fin_categories` dropdown grouped by group_name.

### 3. Cashier UI — restore the good form

- Confirm `/expenses` keeps routing to `src/pages/Expenses.tsx` via `ExpensesRouter` (already true).
- Delete or hide any newly added "finance-style" expense form that replaced it. (Check `FinancesExpensesPage` was just a ledger viewer — leave it as a read-only ledger.)
- In `Expenses.tsx`:
  - Cashier role → category dropdown reads from `useExpenseCategories(source)` (per-casino rows, scope=`live_game`/`slots`). Falls back to the existing `FALLBACK_CATS` if the casino has no rows yet.
  - Manager / super_admin → an additional **"Fin category"** select that lists the FULL `fin_categories` (62 rows, grouped, including income). Picking it sets `fin_category_id` explicitly on insert; the basic category code becomes `other` if the manager skipped the operational code.
  - Office source: same per-casino list (scope=`office`), unchanged behavior.

### 4. Wiring

- `useCreateExpense` / `useCreateSlotsExpense` / `create_office_expense` RPC: accept optional `fin_category_id` and pass it through (DB trigger still fills it if absent).
- `useExpenseCategories` hook already exists — just point Admin CRUD at the new table.

## Out of scope

- No visual redesign of `Expenses.tsx` (it's already the preferred UI).
- No changes to Monthly Report rendering — once `fin_category_id` is set, rows will appear automatically.
- No new enum values; legacy `expense_category` enum stays as is.

## Validation

- `psql` check after migration: `SELECT COUNT(*) FROM expenses WHERE fin_category_id IS NULL AND business_date >= date_trunc('month', now())` → 0.
- Open Monthly Report and confirm the 45 rows are now bucketed into Bar / Food for Customers & Staff / Transport for Staff / Other Variable Expenses.
- Login as cashier → only per-casino codes in the dropdown.
- Login as manager → both per-casino codes AND full fin_categories picker.
