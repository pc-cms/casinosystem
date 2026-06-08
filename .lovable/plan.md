## Problems

1. **Radius too big** — `--radius: 12px` makes tiles look like detached pills, dark "corner gaps" leak through (the card sits on dark page bg).
2. **Dotted zero** — currently JetBrains Mono, whose `0` has a dot.
3. **Tile-per-metric in Closing Preview** — 5 tiny tiles per row force numbers like `1 160 000` to wrap into 2 lines (`1 160` / `000`).
4. **Dashboard tables row** — 4 game-type tiles × `col=2` + Total × `col=2` = 10 of 12 columns → blank gap on the right.

---

## 1. Border radius

Drop the global token from **12px → 8px** (matches the tighter dense look the user wants).

```css
/* src/index.css */
--radius: 0.5rem;  /* 8px — was 0.75rem */
```

This automatically tightens `rounded-lg` (8), `rounded-md` (6), `rounded-sm` (4) everywhere.

---

## 2. Mono font — pick one (need user choice)

Current: **JetBrains Mono** — `0` has a center dot.

Three candidates with a clean (no-dot, no-slash) zero, all on Google Fonts:

| Font | Zero | Feel |
|---|---|---|
| **Geist Mono** | plain oval | modern, neutral, Vercel-style — closest to current weight |
| **IBM Plex Mono** | plain oval | corporate, slightly warmer |
| **DM Mono** | plain round | softer, lighter weight, more editorial |

I'll ask the user via `ask_questions` which one to swap to, then replace the `@import` and `--font-mono` token in one shot.

---

## 3. Closing Preview — merge tiles into grouped panels

Stop using 5 separate `<BigTile>` boxes. Render each section as **one bordered panel with inline rows**, so each number gets the full panel width and stays on one line.

Target layout for the modal:

```text
┌─ Cash on Hand (Closing) ─────────────────────────────────┐
│  TZS Cash            291 000                              │
│  Foreign Cash              0                              │
│  Banks                     0                              │
│  Mobile Money       +869 000                              │
│  ──────────────────────────                               │
│  Total Closing      1 160 000   ← bold, accent row        │
└───────────────────────────────────────────────────────────┘

┌─ Shift Result ───────────────────────────────────────────┐
│  Opening Cash       1 000 000                             │
│  Closing Cash       1 160 000                             │
│  System Result     +1 150 000                             │
│  Cash Desk Result  +1 160 000                             │
│  Cards Miss           +10 000                             │
└───────────────────────────────────────────────────────────┘

┌─ SHIFT BALANCE ──────────────────────────── 0 ───────────┐
└───────────────────────────────────────────────────────────┘

┌──────────────┬───────────────────────┬───────────────────┐
│ Cashless I/O │ Cashless Final        │ Cards Open · Close│
│ 869 000 / 0  │ 0                     │ 33 · 31           │
└──────────────┴───────────────────────┴───────────────────┘
```

Concretely, in `src/components/cage-slots/ActiveSlotsShiftView.tsx` (lines ~963-1018):

- Replace the two `grid grid-cols-5` blocks with a `<GroupedPanel>` (one `cms-panel` per section) that renders metric rows:
  - Label on the left (`text-xs uppercase muted`)
  - Value on the right (`font-mono tabular-nums text-xl/2xl`, `whitespace-nowrap`)
  - Total row visually emphasized (bold + border-t)
- Also widen the modal: `max-w-2xl` → `max-w-3xl` (gives Total Closing Cash plenty of room even at the widest value).
- Remove `min-h-[88px]` tile padding — list rows are denser and cleaner.
- Keep the bottom 3-up footer (`Cashless I/O`, `Cashless Final`, `Cards Open · Close`) since those are short.

Same treatment will be applied to the equivalent Live Game closing preview in `src/components/cage/CloseShiftDialog.tsx` (BlockTotal grid at line 444-457 and the KPI tile grid at 506-517) for consistency.

---

## 4. Dashboard tables row stretches full width

In `src/pages/Dashboard.tsx` (line ~273-307), the BentoGrid runs 12 cols at xl but only fills 10 (4 game tiles × 2 + total × 2).

Fix: compute a dynamic span so the row always reaches 12.

```ts
const tileCount = Object.keys(gameTypeTotals).length;  // e.g. 4
// Reserve 4 cols for Total Casino; split the remaining 8 across game tiles
const gameCol = Math.max(2, Math.floor(8 / Math.max(1, tileCount)));  // 4→2, 2→4, 1→8
const totalCol = 12 - gameCol * tileCount;                            // remainder
```

Pass `col={gameCol}` to each game tile and `col={totalCol}` to "Total Casino". With 4 game types this yields 2+2+2+2+4 = 12, no gap.

---

## Question for the user before I start

Which mono font should I swap to? (Geist Mono / IBM Plex Mono / DM Mono — all have a clean no-dot zero.)
