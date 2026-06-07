# Phase 2 — Office shell + Day Closings rebuild (UI-only)

No DB migrations in this phase. Reuses existing `fin_day_closing` columns (`tables_result`, `slots_result`, `notes`) for now.

## 1. Office tab shell

New page `src/pages/office/OfficePage.tsx`:

- `PageShell` + `PageHeader` (title "Office") + `Tabs` with fixed order:
  ```text
  Safe · Day Closings · Money Change · Wallets · Other Incomes · Rates
  ```
- Each tab renders the existing page component inline (not nested routes — single page, tab state in URL `?tab=safe|day-closings|money-change|wallets|other-incomes|rates`).
- Tabs map to:
  - Safe → `FinancesSafePage`
  - Day Closings → new `DayClosingsTab` (see §2)
  - Money Change → `FinMoneyChangePage` (existing — Intercasino transfers already live inside)
  - Wallets → `FinWalletsPage`
  - Other Incomes → new `OtherIncomesTab` — placeholder section, "Coming soon" copy, no DB
  - Rates → new `RatesTab` — placeholder section, "Coming soon" copy, no DB
- Route registered in `src/App.tsx` as `/office` with `?tab=` query param. Legacy routes `/finances/safe`, `/finances/day-closing`, `/finances/money-change`, `/finances/wallets` keep working AND redirect to `/office?tab=…` via `<Navigate>` wrappers.

## 2. Sidebar collapse

`src/components/AppSidebar.tsx` (or wherever Finance group lives):
- Remove individual Safe / Day Closing / Money Change / Wallets entries.
- Replace with single "Office" entry → `/office`.
- Budget / Monthly Report / other Finance items stay as-is for now (Phase 3+).

## 3. Day Closings tab — manual row table

Rebuild `FinancesDayClosingPage` → `DayClosingsTab` inside Office (old route redirects).

Layout: one big table, one row per business date (last 30 days descending, "Load more" pager).

Columns:
```text
Date · Tables (input) · Slots (input) · Comment · [OK]
```

- `Tables` and `Slots` are editable `<input type="number">` (no spinners thanks to Phase 1). Below each input, a small muted-grey caption shows the auto-computed value:
  - Tables auto = `useShiftsTablesResultForDate(date)` (existing hook, sum of `shifts.tables_result`)
  - Slots auto = sum of `cage_slots_shifts.system_shift_result` for the date (new tiny hook `useSlotsAutoForDate(date)` that queries `cage_slots_shifts` filtered by `business_date`)
- On first load (no existing row), input pre-fills with the auto value; user may overwrite.
- `Comment` = single-line text input (writes to existing `notes` column).
- `[OK]` button = save + lock the row (calls existing `useUpsertDayClosing` then `useLockDayClosing`).
- Locked rows render read-only with grey background; Manager Access toggle reveals an "Unlock" affordance (existing override pattern).
- Variance reconciliation panel from the old page is dropped from the row view (the auto-caption already exposes deviation visually). Keep variance-comment logic only when OK is pressed and |entered − cage actual| > 1 — show inline confirm dialog requiring a 3+ char comment.

Removed from current page: separate Reconciliation panel, Income Lines section, CashDenomInput per line, Recent closings table (replaced by the main row grid).

## 4. Files

- **New**:
  - `src/pages/office/OfficePage.tsx`
  - `src/pages/office/DayClosingsTab.tsx`
  - `src/pages/office/OtherIncomesTab.tsx` (placeholder)
  - `src/pages/office/RatesTab.tsx` (placeholder)
- **Edited**:
  - `src/App.tsx` — add `/office` route + legacy redirects
  - `src/components/AppSidebar.tsx` — collapse Finance entries
  - `src/hooks/use-fin.ts` — add `useSlotsAutoForDate` (read-only)
- **Untouched**: `FinancesSafePage`, `FinMoneyChangePage`, `FinWalletsPage` — mounted as-is inside tabs. Old `FinancesDayClosingPage.tsx` deleted after route swap.

## 5. Out of scope (Phase 2)

- No new DB tables (Rates / Budget Lock land in Phase 3).
- Other Incomes and Rates tabs are placeholders.
- No changes to Cage shift Rates field yet.
- No Budget / Monthly Report rebuild yet.

## Technical notes

- Tab state via `useSearchParams` (`tab` key) so deep links keep working.
- Variance threshold = 1 TZS (same as current page). Confirm dialog uses existing `ResponsiveDialog`.
- Slots auto query: `supabase.from('cage_slots_shifts').select('system_shift_result').eq('business_date', date).eq('casino_id', activeCasinoId)`.
- Version bump: patch `package.json` (sidebar + route changes only, no backend — bump kept conservative).
