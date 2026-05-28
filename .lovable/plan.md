## Goal

Make Cage Slots **opening cards** behave like Live Game opening chips:

1. **Carry over** — when a new slots shift is opened, the *opening card count* is pre-filled from the **closing card count** of the previous slots shift (currently the field defaults to 0 / requires manual entry).
2. **Mid-shift edit** — manager can correct the *opening card count* on an already-open slots shift, with manager override + audit log (analog of `EditOpeningChipsDialog`).

No DB schema changes, no business-logic recalc changes — `cards_miss`, `slots_result`, `shift_balance` already derive from `opening_card_count`, so editing the value automatically flows through.

---

## Changes

### 1. Carry-over of opening cards (open-shift flow)

**`src/hooks/use-cage-slots.ts` — `useOpenSlotsShift`**
- Before insert, fetch the most recent previous slots shift for the casino (status `closed`/`approved`/`ready_for_review`) and read its `cage_slots_cards.closing_card_count`.
- Expose it as part of the query (or fetch directly in the screen). Cleanest: add a new hook `useLastClosedSlotsCards()` returning `{ closing_card_count, card_deposit_value_tzs }` from the most recent prior slots shift.

**`src/components/cage-slots/OpenSlotsShiftScreen.tsx`**
- Use `useLastClosedSlotsCards()`; on first load, if `openingCards === 0` and a previous closing count exists, set `openingCards` to that value (one-shot, guarded by a `prefilled` flag — mirrors the existing FX-rates prefill pattern).
- Show a small hint under the cards input: `Carried from previous shift closing: N` (only when prefilled).

### 2. Manager edit of opening cards during shift

**New file `src/components/cage-slots/EditOpeningCardsDialog.tsx`** — direct analog of `src/components/cage/EditOpeningChipsDialog.tsx`:
- Props: `shift: Tables<"cage_slots_shifts">`, `open`, `onClose`.
- Gated by `ManagerOverrideDialog` (`actionType: "SLOTS_OPENING_CARDS_EDIT_REQUESTED"`).
- After unlock: shows old value, NumberInput for new value, Δ chip, required Reason textarea.
- On save:
  - `update cage_slots_cards set opening_card_count = :new where cage_slots_shift_id = :shift.id`
  - `logAction(casinoId, "edit", "SLOTS_OPENING_CARDS_EDITED", { shift_id, manager_id, reason, old, new, delta })`
  - Invalidate `["cage-slots-cards", shift.id]` and `["cage-slots-active-shift"]`.

**`src/components/cage-slots/ActiveSlotsShiftView.tsx`**
- In the section that displays opening cards (header strip / opening summary), add a small `Pencil` button visible only to `manager / super_admin / managerOverride.active` that opens `EditOpeningCardsDialog`.
- Mirror existing Live Game placement (small ghost icon button next to the opening-cards value).

### 3. Version bump

Bump `package.json` patch (auto-version policy for backend-touching change: new hook query + RPC-equivalent UPDATE on `cage_slots_cards` + audit log).

---

## Out of scope

- No changes to closing logic, balance formula, or card pricing.
- No schema migrations — `cage_slots_cards.opening_card_count` and `closing_card_count` already exist.
- No edits to cash/bank/mobile carry-over (already handled by existing seed snapshot).

## Verification

- Open a new slots shift after a previously-closed one → opening cards field arrives pre-filled with previous shift's closing count; hint visible.
- During an open shift, manager clicks Pencil → enters override → changes count → reason → save. UI immediately reflects new value; `cards_miss` / `shift_balance` recompute. Audit row appears in Logs with `SLOTS_OPENING_CARDS_EDITED`.
- Non-manager cashier does not see the Pencil button.
