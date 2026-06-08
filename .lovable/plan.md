# Player Tracking bet popover + Table Tracker cleanup

## 1. Player Tracking — single "Bet" column with popover

File: `src/components/pit/PlayerDailyAvgBetTable.tsx`

- Replace the three columns **AR / BJ / Poker** with one column **Bet**.
- Cell content: compact 3-line display `AR · BJ · Poker` (each value or `·`), monospaced, right-aligned. Click anywhere on the cell (when `canEdit`) opens a popover.
- Popover ("BetPicker"):
  - Header: player name + card.
  - Three labeled rows (AR / BJ / Poker) each with a numeric input pre-filled with current value.
  - `Save` button (and Enter) commits all three via `useSetPlayerDailyAvgBet` (one mutation per changed group). `Esc` / click-outside closes.
  - Auto-flip: measure trigger rect vs viewport; if `spaceBelow < popoverHeight && spaceAbove > spaceBelow` → render above (same pattern as `CellPicker.tsx`).
  - Width ~240px, fits mobile (current viewport 506px).
- Totals row: collapse three total cells into one "Bet" cell that shows `AR n · BJ n · Poker n` averages.
- Sort: replace `ar/bj/poker` sort keys with a single `bet` sort by sum of the three (skip-null aware), kept as one header click.
- Fix BJ save bug as a by-product: the new popover writes each group via the same hook with an explicit `group` constant, removing whatever per-column mis-wiring exists today.

No DB/hook changes. `useSetPlayerDailyAvgBet({ playerId, businessDate, group, value })` already handles per-group upserts.

## 2. Table Tracker page — keep only the chip/hot-seat map

File: `src/pages/TableTracker.tsx`

- Remove the Numbers/Chips mode toggle (both embedded and full).
- Remove the entire numbers grid table, totals row, slot constants, keyboard nav helpers, and the per-table analytics chart `PageSection`.
- Render `<ChipCountPanel date={date} />` as the sole content (wrapped in `PageShell` + `PageHeader` when not embedded; bare `<div>` when embedded inside Pit).
- Keep date navigation + manager read-only logic for `ChipCountPanel` unchanged.
- Header subtitle becomes "Count chips on tables · save snapshot".
- Imports cleaned: drop `Input`, `Hash`, `Coins`, `useTableTracker`, `useSetTableTrackerValue`, `useGamingTables`, currency helpers, `TableAnalyticsChart`.

No route changes; `/table-tracker` and the Pit embedded tab keep working.

## Out of scope

- DB schema and `player_daily_avg_bets` hook signatures.
- `TableAnalyticsChart` component itself (just unused on this page; still available elsewhere if needed).
- Any other consumer of `useTableTracker` (Dashboard, ChipCountPanel, CloseTableWizard) — untouched.

## Open question

Should the popover keep a "Clear" action that wipes all three values for the player on that day, or only the per-row inputs (leave blank → null)? Default plan: blank input → null per row, no separate Clear button.
