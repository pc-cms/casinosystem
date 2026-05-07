
# Close Shift → Close Business Day: full two-stage flow

## Goal

Cashier and Manager work the cage close in two distinct screens. Manager password is **always** required (regardless of Manager Access toggle). Only after the shift is closed by the manager does the **Close Business Day** button become active and perform the full DB rebaseline.

## Current state (verified)

- `CloseShiftDialog` already has a 2-step internal flow (entry → manager review → password), but it lives inside one route as nested dialogs.
- `useCloseShift` calls `compute_shift_close` then `UPDATE shifts SET status='closed'` — manager password is requested by the dialog UI, not enforced server-side beyond what `ManagerOverrideDialog` does.
- `CloseBusinessDayButton` is already disabled while `useActiveShift` returns a row — good. It calls 2-arg `close_business_day` which **does not rebaseline chips**. This is the bug.
- `rebaseline_chips_from_closing_snapshot` exists but is buggy (touches `chip_baseline`, runs from wrong place) and unused by the UI.

## What to build

### 1. UI: split Close Shift into two routes

- **Route A — `/cage/close-shift` (Cashier entry).** Existing `CloseShiftPage`, but render only the **entry blocks** (Tables result, Chips per denom, Cash + Mobile + Bank, Notes, Balance preview).
  - Footer: `Cancel` (→ `/cage`) and `Continue to Manager Review` (→ `/cage/close-shift/review`).
  - Pass entered state via `sessionStorage` keyed by `shift.id` (survives reload, cleared on success/cancel).
- **Route B — `/cage/close-shift/review` (Manager review).** New page.
  - Read state from sessionStorage; if missing, redirect back to A.
  - Show the manager-review summary: per-currency totals (hide rows where total = 0), Chips, Mobile, Bank, Result Table, Miss Total, Expenses, Opening, Cash Desk Balance with surplus/shortage badge.
  - Two buttons: `Back to Edit` (returns to A, state preserved) and `Confirm & Enter Manager Password` (always, even if Manager Access is on).
  - On password verified → call `useCloseShift.mutateAsync(...)`, clear sessionStorage, navigate to `/cage`.
- Replace the existing in-page nested-dialog flow inside `CloseShiftDialog` with the two routes. Keep `CloseShiftDialog`'s helpers/calculations but extract the rendering into two page components.
- Remove the `Manager Access` shortcut for skipping the password — always use `ManagerOverrideDialog` for the final confirm.

### 2. Hide empty currencies in review

In Route B, iterate `CURRENCIES` and only render the currency row if `cashSum(cashCounts[c]) > 0`. Same for `bank` and `mobile` providers (skip zeroes). Chips/Result Table/Miss are always shown.

### 3. Cancel & re-edit

Both routes have `Cancel`. From A: clears sessionStorage and goes to `/cage`. From B: `Back to Edit` keeps state and returns to A so cashier can fix figures.

### 4. Close Business Day activation

`CloseBusinessDayButton` already disables while `activeShift` exists. Keep that. After manager closes the shift (`shifts.status='closed'`), `useActiveShift` invalidates → button enables automatically. Tooltip text already explains the gate.

### 5. DB: real rebaseline at shift close (not at day close)

- **Drop** `rebaseline_chips_from_closing_snapshot` and any call sites inside the buggy 3-arg `close_business_day`.
- **Create** `apply_cage_shift_closing(_shift_id uuid)`:
  - Reads `shifts.closing_count->'chips'` (qty per denom).
  - Updates `chip_baseline` rows for the cashier location (`location_type='cashier' AND location_id IS NULL`) per denom — this is the cashier's float, which legitimately rolls over.
  - **Never touches** per-table `chip_baseline` rows.
  - Recalculates `chip_initial_baseline` per denom = sum across all locations (cashier + tables), so next-day Initial Baseline reflects the new cashier float.
- **Trigger** `AFTER UPDATE OF status ON shifts WHEN OLD.status<>'closed' AND NEW.status='closed'` → `apply_cage_shift_closing(NEW.id)`. Fires exactly once at manager confirmation.
- **Recreate clean 3-arg `close_business_day(_casino_id, _method, _force_close_cycles)`**: roles → `list_open_cycles_for_day` → `system_locks` → `finalize_open_cycles_for_close` → `build_business_day_snapshot` → INSERT closure → `populate_table_daily_results_for_day`. **No chip rebaseline here** (already done at shift close).
- **Drop** old 2-arg `close_business_day`.
- Fix `D` (LEAST in `get_current_business_date`) and `F` (scope-check `_casino_id`) in the same migration.

### 6. Hook update

`useCloseBusinessDay` → call 3-arg with `_force_close_cycles: false`; on `has_open_cycles` response surface a toast listing them.

### 7. Version bump

`package.json` 1.0.112 → 1.0.113.

## Files

| File | Change |
|---|---|
| `src/pages/cage/CloseShiftPage.tsx` | Becomes Route A (entry only); persist state to sessionStorage. |
| `src/pages/cage/CloseShiftReviewPage.tsx` | NEW — Route B (manager review + password). |
| `src/components/cage/CloseShiftDialog.tsx` | Split: extract entry & review JSX into the two pages; delete file or keep as shared subcomponents. |
| `src/App.tsx` | Add `/cage/close-shift/review` route. |
| `src/hooks/use-shift.ts` | Unchanged signature; still used by Route B. |
| `src/hooks/use-business-day-closure.ts` | Pass `_force_close_cycles: false`; surface `has_open_cycles`. |
| `src/components/pit/CloseBusinessDayButton.tsx` | No structural change (already gated by `activeShift`). |
| `supabase/migrations/*` | Drop `rebaseline_chips_from_closing_snapshot` + old 2-arg `close_business_day`; create `apply_cage_shift_closing` + trigger + clean 3-arg `close_business_day`; fix `get_current_business_date` LEAST and `_casino_id` scope. |
| `package.json` | 1.0.113. |

## Confirmations needed before I start

1. Route B should be a **real page** (not a modal), correct? Easier to "cancel and go back" cleanly.
2. After cashier clicks `Continue to Manager Review`, the cashier's data is still **editable** if manager presses `Back to Edit` — confirm OK. (Nothing is written to DB until manager password succeeds.)
3. Manager password is **always** required, even if Manager Access toggle is active — confirm.
