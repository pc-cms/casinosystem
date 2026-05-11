# Canonical Cash Desk Formula Integration

## Formula (single source of truth)

```
Cash Desk Result = (ClosingCash − OpeningCash)
                 + Expenses
                 + Collection
                 − AddFloat
                 + SlotsOut
                 − SlotsIn
                 + Miss                       (signed: counted − opening)

Shift Balance    = Cash Desk Result − TableResult        (must = 0)
```

Verified on May 5, 6, 7, 8, 9, 10 — all closed shifts with complete data converge to **0**. Historical gaps (02/05, 04/05) remain as-is — they're missing closing cash, not formula bugs.

---

## 1. Database (migration)

**New RPC `compute_shift_balance(_shift_id uuid)`** — returns JSONB with all 9 components plus `cash_desk_result` and `shift_balance`. Pulls:
- `opening_cash` / `closing_cash` from `shifts.opening_float.totals` (totals.total_tzs − totals.chips_tzs)
- `expenses` — sum of `expenses` rows for shift
- `add_float`, `collection`, `slots_in`, `slots_out` — sum of `cage_transfers` by `transfer_type`
- `miss` — `shifts.miss_total` (signed)
- `tables_result` — `shifts.tables_result`

**New columns on `shifts`:**
- `cash_desk_result bigint` — canonical cash side
- `balance bigint` — `cash_desk_result − tables_result`

**Trigger `shifts_recompute_balance`** — `BEFORE UPDATE` on `shifts`: when `status` changes to `closed` OR any of the inputs change, recomputes both columns from RPC.

**Backfill** — one-time `UPDATE` on all closed shifts to populate new columns.

**`cage_transfers.transfer_type` enum** — already declared in TS as `collection`; verify the DB CHECK/enum allows it. Add it if missing.

## 2. Frontend

**New `src/lib/cage-balance.ts`** — pure-TS port of the same formula for live preview during Close Shift. Single export `computeShiftBalance(inputs) → { cashDeskResult, shiftBalance, components }`.

**`src/components/cage/CageHelpers.ts`** — replace `cashDeskBalance()` (currently uses old `(closing − opening) − resultTable − external + expenses` model) with thin wrapper around `cage-balance.ts`. Remove "openingChips inside closing" assumption — Miss is now its own term.

**`src/pages/cage/CloseShiftPage.tsx`** — pass all 9 components to dialog instead of pre-aggregated `expectedCash`.

**`src/components/cage/CloseShiftDialog.tsx`** — Step 2 review card shows:
- Cash Desk Result (computed live)
- Shift Balance (red if `≠ 0`, doesn't block submit)
- Collapsible 9-line breakdown (ΔCash, Expenses, Collection, AddFloat, SlotsOut, SlotsIn, Miss, TableResult, Balance)

**`src/pages/cage/CageClosingsPage.tsx`** — read `shifts.cash_desk_result` and `shifts.balance` directly. Remove inline math. Tooltip on Balance shows the 9-component breakdown via the same RPC.

**`src/components/cage/TransfersForm.tsx`** + **`use-cage-transfers.ts`** — `collection` already wired in TS; just confirm DB accepts it after migration.

## 3. Out of scope (untouched)
- `tables_result` chip math — already canonical
- `miss_total` calculation — already correct (signed)
- Inter-casino transfers, slots cage in/out semantics
- Business-day close, Reports, Daily Review

## 4. Verification after deploy
- Open Cage Closings — every closed May shift shows `Balance = 0` for fully-entered days, non-zero with red badge for data gaps (02/05, 04/05).
- Open Close Shift on the live shift — Step 2 shows live Cash Desk Result + Balance updating as cashier counts.
- Insert a Collection cage transfer — verify it deducts from Cash Desk Result.

## 5. Auto version bump
Patch-bump `package.json` (backend change: migration + trigger + RPC).
