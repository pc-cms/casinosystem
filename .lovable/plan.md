
# Unify Cashless and Transfers (Expenses-style)

## Goal

One **Cashless** page and one **Transfers** page in the sidebar — both with a `Live / Slots / All` source filter, exactly like Expenses. Cashier roles get their scope auto-locked (cashier → Live, cashier_slots → Slots); managers see All by default.

No more parallel surfaces: drop the inline "Cashless" and "Transfers" sections inside Cage / Cage Slots and the duplicate `Slots Cashless` / `Slots Transfers` menu items I just added.

## Current state

- **Cashless** — `cashless_transactions` is already a single table. `/cashless` page exists (Live-only today). Slots cashless is entered inside `ActiveSlotsShiftView` (Cashless section); Live cashless is entered inside `ActiveShiftView`.
- **Transfers** — two tables: `cage_transfers` (Live) + `cage_slots_transfers` (Slots), two forms (`TransfersForm`, `SlotsTransfersForm`), embedded in their respective active-shift views. No standalone page.
- Sidebar (after the previous turn) has `Cage Slots`, `Slots Cashless`, `Slots Transfers` — the latter two will be removed.

## Target layout

Sidebar (CASHIER section):
```
Cage View                (managers)
Cage Live Game           (cashier)
Cage Slots               (cashier_slots)
Closings                 (managers)
Bank                     (managers)
Cashless                 (cashier, cashier_slots, managers)   ← unified
Transfers                (cashier, cashier_slots, managers)   ← new unified
Expenses
Reports
Tips & Bonuses
```

Both `Cage Live Game` and `Cage Slots` become single-screen surfaces (no inline Cashless/Transfers tabs). Their dashboards and Manual Entry stay.

## Implementation

### 1. Cashless — extend `/cashless` with source filter
- Add `source: "all" | "live_game" | "slots"` filter chip in `PageHeader` (same UX as Expenses).
- `useCashless` already reads the whole table by date — add optional `source` arg that filters by which shift column is set (`shift_id` vs `cage_slots_shift_id`) or by a `source` column if present (verify in hook).
- New-entry form: source selector (locked for cashier roles, free for managers). On submit, attach to the active shift of the chosen source (`useActiveShift` / `useActiveCageSlotsShift`).
- Role defaults mirror Expenses: cashier → live_game locked, cashier_slots → slots locked, managers → all.

### 2. Transfers — new `/transfers` page
- New `src/pages/Transfers.tsx` + route.
- Same shell as Expenses/Cashless: header, source filter (`Live / Slots / All`), table of historical transfers, inline new-row form.
- Reads union of `cage_transfers` + `cage_slots_transfers` via a new combined hook `useTransfers({ business_date, source })` that queries both tables and tags rows with `source`.
- Write path picks the right table + RPC by selected source; reuses the existing transfer-type configs (`add_float`, `collection`, `slots_in/out`, `lg_in/out` for slots).
- Refactor `TransfersForm` / `SlotsTransfersForm` internals into a single shared `<TransferEntryForm source={…} shiftId={…} />` component.

### 3. Drop in-page nav from Cage Slots
- In `ActiveSlotsShiftView`: delete the `activeSection` routing (Cage / Cashless / Transfers) added previously. Keep only the Cage block + Manual Entry panel.
- Delete the `cashless`/`transfers` route paths under `/cage-slots/*` from `App.tsx`.
- Same cleanup in `ActiveShiftView` (Live cage): remove the embedded Transfers + Cashless sections, leaving just the Cage workspace.

### 4. Sidebar
- Remove `Slots Cashless` and `Slots Transfers` items.
- Add roles `cashier_slots` to existing `/cashless` item.
- Add new `/transfers` item visible to `cashier`, `cashier_slots`, `manager`, `floor_manager`, `finance_manager`, `super_admin`.

### 5. Route-module map
- Map `/transfers` → a new `transfers` module key, or reuse `cage` / `cage_slots` (TBD — simplest: dedicated `transfers` module so it can be permissioned independently).

## Out of scope

- DB schema changes. We keep two transfer tables and union them in the UI; merging them is a bigger migration left for later.
- Reports/closings — they keep reading their own per-shift transfers as today.

## Open question

Should the unified **Transfers** page also let a manager retrospectively switch a transfer's source after the fact? Default plan = no, transfers stay immutable (matches project rule). Confirm if you want otherwise.
