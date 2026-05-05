## Tables Page — New Tile Layout

Apply to every table card on `/tables` (both AR/BJ and Poker columns).

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ● P2  Texas Holdem        DROP R          RESULT       [OPEN]    │
│                           TZS 2 010 000   −170 000               │
├──────────────────────────────────────────────────────────────────┤
│  ┌────┐  ┌────┐                                                  │
│  │ 📷 │  │ 📷 │     ← player photo (round avatar, ~40px)         │
│  └────┘  └────┘                                                  │
│  Hassan R.  Adil P.   ← name under photo                         │
│   10 000     10 000   ← avg bet, space-separated                 │
└──────────────────────────────────────────────────────────────────┘
```

### Header row (single line, 4 zones)

1. **Left** — status dot + table name + game type (existing).
2. **Drop** — label `DROP` (small, muted) above `formatCurrency(dropR)` (mono, bold).
3. **Result** — label `RESULT` above signed value, colored `cms-amount-positive` / `cms-amount-negative`.
4. **Right** — `OPEN` / `CLOSED` badge; `Open Table` button stays for closed tables.

The "X seated" badge and the duplicate closing-result badge are removed (info now lives in the header zones / player block).

### Player block (replaces the current inline pills)

For each seated player, render a vertical mini-card:
- **Photo** — 40×40 rounded avatar from `players.photo_url`; fallback to `CategoryBadge` initials circle when missing.
- **Name** — `First L.` (truncate, max ~80px).
- **Avg bet** — `formatNumberSpaces(avgBet)` (e.g. `10 000`), mono, muted.

Players laid out as `flex flex-wrap gap-3 px-4 py-3`. When no one is seated, the block is hidden (no empty space).

The existing bottom 3-column grid (Drop R / blank / Result) is removed — that data moves into the header.

### Files

- `src/pages/Tables.tsx` — rewrite `renderTableCard` (lines ~388–461).
- `src/components/pit/SeatedPlayerChip.tsx` — add an optional `photoUrl` prop and a new `vertical` (or `card`) variant rendering photo-on-top, name + bet below. Keep existing horizontal variant for the seating dialog so nothing else breaks.
- `src/pages/Tables.tsx` `seatedByTable` builder — also pass `photo_url` from `players` into each `SeatedPlayer` (extend the `SeatedPlayer` interface with optional `photo_url`).

### Notes

- Avg bet is already stored as a number; format with the existing `formatNumberSpaces` helper (already used in the chip).
- No backend changes; `photo_url` is already on `players`.
- Click on a tile keeps opening the seating dialog; clicking a player photo does nothing extra (stops propagation reserved for future profile preview).
