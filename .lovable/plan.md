## Reports → Daily diff: fixes

Strictly limited to the Daily diff table. No other formulas, closings, or aggregations are touched.

### 1. Remove columns
From both the KPI strip and the table:
- `Drop (R)`
- `Cash In`
- `Hold % (R/D)`

### 2. New column order
```
Date | Result | Player Result | Miss Chips | Total Tips | Diff
```

### 3. Miss Chips sign — read from the same source as the Miss Chips page
The Miss Chips report reads `shifts.closing_count->>'chip_miss_total'` and displays it correctly. The Daily diff currently reads `shifts.miss_total`, which is stored with the opposite sign.

Fix: in the `compute_daily_diff` RPC, replace
`SUM(sh.miss_total)`  →  `SUM((sh.closing_count->>'chip_miss_total')::bigint)`

Nothing else about miss handling, storage, or other reports changes.

### 4. Total Tips (new column)
Source: `transactions` rows with `type IN ('tips_live','tips_poker','tips_floor')`, `cancelled_at IS NULL`, summed per `business_date`. Amounts are stored positive; used with `+` sign.

Added as `tips bigint` in the RPC return.

### 5. Diff formula
```
Diff = Result + Player Result − Miss Chips + Tips
```
(Miss in the Miss Chips page sign convention — surplus positive, shortage negative.)

### Files touched
1. **Migration** — replace `public.compute_daily_diff`:
   - Returns: `business_date, result, miss, player_result, tips, diff`.
   - `miss` from `closing_count->>'chip_miss_total'`.
   - `tips` from tips_* transactions per `business_date`.
   - `diff = result + player_result − miss + tips`.
2. **`src/pages/Reports.tsx`** — `DailyReport` block only: drop removed fields, add `tips`, update KPI strip, headers, cells, totals and the comment block. Bump `package.json` patch.

### Out of scope
- The `ShiftsDailyReport` table at the top of the Daily tab.
- Any other report, formula, closing logic, or stored field.
