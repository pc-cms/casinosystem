# Cashless in Check & Close (Live Game + Slots)

Mirror the Expenses pattern: cashier enters Cashless IN/OUT per provider directly inside the shift's Check / Close screens. Numbers from `/cashless` for the current business day appear as **gray placeholders** (suggestions). The cashier may accept (leave blank → use suggestion) or override with their own number — the entered value always wins.

## Scope confirmed

- **Both cashboxes:** Live Game (`cage_type='live_game'`) and Slots (`cage_type='slots'`).
- **Shift binding:** by `business_date + cage_type` — no schema change to `cashless_transactions`.
- **Suggestion source:** sum of `cashless_transactions` rows for the current business day, filtered by `cage_type` and grouped by `provider × direction`.
- **Override:** placeholder text in input; empty save = suggestion accepted; any number = manual override.

## Live Game — what to add

`src/components/cage/ActiveShiftView.tsx` does not yet have a cashless block. Add an IN/OUT providers grid identical in shape to the Slots one:

- 4 providers × 2 columns (IN, OUT): AirTel, M-Pesa, Tigo, Halotel.
- Values persisted on `shifts` row as `cashless_in_providers` / `cashless_out_providers` (JSONB). If columns don't exist for live shifts, reuse the same column names (Slots already has them) via a small additive migration that ensures both `live_game` and `slots` shifts have those JSONB columns nullable.
- Totals feed into the existing cash formula (currently no cashless term for Live Game): show as a read-only "Mobile Money (Cashless IN − OUT)" line; **do not** change the expected-cash formula in this first pass (kept out of scope to avoid balance regressions — confirm separately if you want it included).
- Print/Check report: include the per-provider IN values (matches the "report writes only IN" rule already used for tips).

## Slots — what changes

`src/components/cage-slots/ActiveSlotsShiftView.tsx` already has `CashlessProvidersBlock` for IN / OUT / FINAL. Only the placeholder layer is added — no structural changes, no behavior changes to balance math.

## Suggestion layer (shared)

New hook `useCashlessSuggestions(businessDate, cageType)`:

```ts
// returns { IN: Record<Provider, number>, OUT: Record<Provider, number> }
// reads cashless_transactions WHERE casino_id, business_date, cage_type
// aggregates amount by provider × direction
```

`CashlessProvidersBlock` gets an optional `suggestions?: Record<Provider, number>` prop:

- For each provider input where the stored value is `0` / empty, render the suggested number as the input's `placeholder` (already grayed via shadcn `Input`).
- A small "Apply all" ghost button per block fills empty fields with suggestions in one click (optional convenience, keeps manual control).
- On blur / save, the stored value is what the cashier typed; if untouched, it stays `0` — saved totals do not auto-include suggestions (cashier's choice must be explicit, matching the manual-entry philosophy).

## Files to touch

- `src/hooks/use-cashless.ts` — add `useCashlessSuggestions(date, cageType)` query.
- `src/components/cage-slots/CashlessProvidersBlock.tsx` — accept `suggestions` prop, render as placeholders, add "Apply suggestions" ghost button.
- `src/components/cage-slots/ActiveSlotsShiftView.tsx` — wire suggestions into the three existing blocks (IN, OUT, FINAL stays manual — no suggestion).
- `src/components/cage/ActiveShiftView.tsx` — add IN / OUT provider blocks (read & persist `cashless_in_providers` / `cashless_out_providers` on the live shift), wire suggestions.
- `src/pages/cage/CloseShiftPage.tsx` + `CloseShiftDialog` (live) — show the same blocks on close, persisted values used.
- Print report bodies (live + slots) — include per-provider IN values; OUT visible only on screen.

## Migration (additive, minimal)

If `shifts.cashless_in_providers` / `cashless_out_providers` are slots-only today, extend them to apply for both cage types (same nullable JSONB columns are reused — no new columns required). Verify with one `read_query` before writing the migration. Version bump per project rule.

## Out of scope (ask separately if needed)

- Including Cashless totals in Live Game **expected cash** formula (would change Balance math).
- Per-shift binding via `shift_id` on `cashless_transactions` (we agreed to use `business_date + cage_type`).
- Slots `cage_type` page filter on `/cashless` (currently the page is filtered to `live_game`; suggestions for Slots will read directly from DB by `cage_type='slots'`, page UI itself unchanged).
