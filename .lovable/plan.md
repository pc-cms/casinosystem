## Goal

On the **Player Tracker** page (`/player-statistics`), the `Bet` column dot should open a popover where Pit/Manager can **manually enter** AR / BJ / Poker average bets per player. The popover auto-flips above/below the row based on available space. Remove the duplicate `PlayerDailyAvgBetTable` block at the bottom of the **Tables Tracking** page (`/tables`) since it does the same job.

## Scope

### 1. `src/pages/PlayerStatistics.tsx` — `AvgBetPopover`
- Replace the current read-only popover with an editable one.
- Always render the popover trigger (also when current display is `·`/0) so the row stays clickable.
- Inside the popover: three labeled rows (AR / BJ / Poker), each with a compact numeric `Input` (space-formatted, integer, empty = clear value).
- "Save" button (and Enter key) commits via existing `useSetPlayerDailyAvgBet` mutation; "Cancel" / outside-click discards. Only fields that changed are written; an empty field clears that group (`value: null`).
- Auto-flip: use Radix `PopoverContent` with `side="bottom"` + `sideOffset` + `avoidCollisions` (default behavior already flips), and `collisionPadding={8}`. Keep width ~`w-56`, `align="end"`.
- Gate edit by role: only when `canEdit` (Pit / Manager / Floor Manager — same rule as today's `PlayerDailyAvgBetTable`). Read-only viewers still see the breakdown but no inputs.
- Multi-day period (`!isSingleDay`): keep current read-only behavior, no editor.
- Trigger styling: dot stays `·` when no data; show summary number otherwise. Hover hint "Click to edit AR / BJ / Poker".

### 2. `src/pages/PlayerStatistics.tsx` — wire `canEdit`
- Compute `canEdit = isSingleDay && (isPit || isManager || isFloorManager) && !isReadOnly`, mirroring `Tables.tsx`'s rule. Pass into `AvgBetPopover`.
- After mutation success, react-query invalidation on `player_daily_avg_bets` is already in `useSetPlayerDailyAvgBet`; no extra wiring.

### 3. `src/pages/Tables.tsx` — remove duplicate block
- Delete the `<PlayerDailyAvgBetTable ... />` render and its import. Visits + players data fetched only for that table can stay (still used elsewhere) — no other changes.
- Keep the seated-player chips at the top of each table card (unchanged).

### 4. Cleanup
- `src/components/pit/PlayerDailyAvgBetTable.tsx` becomes unused. Delete the file to avoid drift.

## Out of scope
- No DB migrations. `player_daily_avg_bets` schema, RLS, and the existing `useSetPlayerDailyAvgBet` RPC stay as-is.
- No changes to Tables Tracking card layout, KPIs, or `TableSeatingDialog`.
- No changes to the `Table Check` page (`/table-tracker`).

## Technical notes
- Use existing `Popover`, `PopoverContent`, `PopoverTrigger` from `@/components/ui/popover` (Radix). `avoidCollisions` defaults to `true` → flips automatically when bottom space is tight. Add `collisionPadding={8}` for safety on small viewports.
- Parse via `parseInt(value.replace(/\s/g,""), 10)`; format via `formatNumberSpaces`. Empty/zero → save `null` to clear.
- Mobile (< 640 px): popover keeps `w-56`, inputs `h-9`, tap-friendly.
