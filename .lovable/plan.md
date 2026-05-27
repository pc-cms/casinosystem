## Goal

Use the **exact** Live Game Cash Desk formula in Cage Slots. Only operational difference: **System Result is entered manually** by the slots cashier (no chip derivation).

```text
ΔCash            = ClosingCash − OpeningCash
Cash Desk Result = ΔCash + Expenses + Collection − AddFloat
                 + LG_Out − LG_In + Cashless_Out − Cashless_In
Shift Balance    = Cash Desk Result − System Result − Cards Miss
```

No more "Expected / Counted / Adjustments / Difference" terminology — only the canonical: **ΔCash, Cash Desk Result, System Result, Cards Miss, Shift Balance**.

## Status

- DB migration: **already applied** (`compute_slots_shift_balance_from_row`, triggers, all existing shifts recalculated).
- Code changes below need build mode.

## Code changes

### 1. `src/lib/cage-balance.ts`
Rewrite `computeSlotsShiftBalance` to return canonical shape `{ deltaCash, cashDeskResult, cardsMiss, slotsResult, shiftBalance }` — drop `expected`/`counted`/`difference`/`balance`/`cardsMiss-as-secondary`. Formula = canonical above.

### 2. `src/components/cage-slots/ActiveSlotsShiftView.tsx`
Replace dashboard / preview / approve tiles to show canonical fields:
- **Opening Cash · Closing Cash · ΔCash**
- **Expenses, Collection, AddFloat, LG In/Out, Cashless In/Out** (compact strip)
- **Cash Desk Result** (= computed)
- **System Result** (manual input — already a NumberInput)
- **Cards Miss**
- **Shift Balance** (highlighted) with label `Cash Desk Result − System Result − Cards Miss`

Update `recordMidCheck` and `confirmSubmitForReview` snapshot payloads to write only canonical keys (`delta_cash`, `cash_desk_result`, `slots_result`, `cards_miss`, `shift_balance`). Drop `expected/counted/difference`.

### 3. `src/components/cage/CashCheckViewerDialog.tsx`
When `balanceMode="slots"`, replace the 3-tile strip (Count Cash / Adjustments / Balance) with the canonical Live-Game-style breakdown: **ΔCash, Cash Desk Result, System Result, Cards Miss, Shift Balance**. Read from `totals.cash_desk_result`, `totals.slots_result`, `totals.cards_miss`, `totals.shift_balance` (fallback to `totals.balance`).

### 4. `src/components/cage-slots/CageSlotsHistoryView.tsx`
Columns: **System** · **Cash Desk Result** · **Cards Miss** · **Balance** (drop "Count + Adj").

### 5. `src/pages/CageSlotsReport.tsx`
Balance Calculation block: list canonical rows only — Opening, Closing, ΔCash, Expenses, Collection, AddFloat, LG In/Out, Cashless In/Out, Cash Desk Result, System Result, Cards Miss, **Shift Balance**.

### 6. `package.json`
Patch bump (1.3.151 → 1.3.152) — backend change.
