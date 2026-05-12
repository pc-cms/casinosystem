## Fix Miss Chips sign in printed Shift Closing Report

**Problem:** In `ShiftClosingReport.tsx` (page 1 of cage print), the "Miss Chips" summary row shows the value as a plain positive number (e.g. `5 000`). On page 2 (`ChipMovementReport.tsx`) the same Miss total is rendered with the `signed` flag, so it correctly shows as `-5 000`. The two pages disagree.

**Fix (display-only, frontend):**

In `src/components/cage/ShiftClosingReport.tsx`:

1. Extend `SummaryRow` with an optional `negative?: boolean` prop. When `negative` is true and `value > 0`, render as `-{formatted}` (zero stays `0`).
2. Use it for the Miss Chips row:
   ```
   <SummaryRow label="Miss Chips" value={missTotal} bold negative />
   ```

No other rows are changed. No business logic / balance math touched — `missTotal` is already subtracted in `balance` upstream; this is purely a presentation fix so the number on page 1 matches the signed Miss table on page 2.

**Files touched:** `src/components/cage/ShiftClosingReport.tsx` only.