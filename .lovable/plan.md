# Compact Slots Shift Report

Target file: `src/components/cage-slots/SlotsShiftReportBody.tsx` (used both inline in Cage Slots · History expansion and on the dedicated report page).

## Changes

**1. Remove redundant fields in "Balance Calculation"**
- Drop `Slots Result (= System Result)` — it duplicates System Result by definition.
- Keep: Closing Cash, + Expenses, − Ace Fill, + Collection, + LG Out, − LG In, = Cash Desk Result, System Result, − Cards Miss, = Shift Balance.

**2. Tighten layout density**
- `Field` component: reduce label to `text-[9px]` with `mt-0`, value to `text-xs` (instead of `text-sm`); emphasized stays `text-sm font-bold` (not `text-base`).
- Balance Calculation grid: switch from `grid-cols-2 gap-3` to `grid-cols-3 gap-x-4 gap-y-1.5` so 9 fields fit in 3 columns × 3 rows instead of a long 2-column list.
- Plastic Cards grid stays 4 columns but with `gap-2` and the smaller Field sizes.
- Inventory tables: row padding tightened (`py-0.5`) and section spacing tightened.
- Outer wrap: keep `compact` prop behavior but reduce default `space-y-4` → `space-y-3`; compact mode → `space-y-1.5`.
- PageSection inner padding is controlled by the layout primitive — leave untouched; we only reduce internal grids/text sizes.

**3. Cashless table**
- Reduce row height (`py-0.5` instead of `py-1`), header `py-1`. Keep all columns (they carry real data).

No formula / calculation changes. No other files touched.
