
# Fix Shift Closing Reports

## Goal

Correct field semantics in **Consolidating Cash Desk Report** (page 1), guarantee both reports print as 2 distinct A4 pages, and apply the same fixes in `ReprintShiftDialog`.

## Page 1 — Consolidating Cash Desk Report

Rename and recompute the per-table grid columns to match real semantics:

| Column | Source | Notes |
|---|---|---|
| **Table** | `gaming_tables.name` | unchanged |
| **Open** | sum of `chip_baseline` for that table (TZS value) | unchanged — already correct |
| **Fill** | `cage_transfers.amount` where `transfer_type='fill'` AND `table_id=t.id` | Chips IN to cash desk from this table |
| **Credit** | `cage_transfers.amount` where `transfer_type='credit'` AND `table_id=t.id` | Chips OUT from cash desk to this table |
| **Close** | sum of `gaming_tables.closing_chips` JSONB (final chip count before reset) | unchanged |
| **IN** *(renamed from Drop)* | sum of `cage_transfers.amount` where `transfer_type='fill'` AND `table_id=t.id` | All Cash IN at Cash Desk for this table during the shift. **Stop using `table_tracker`.** Header text: `IN`. |
| **Result** | `Close − Open` (i.e. `sum(closing_chips) − baseline`) | **Stop using `gaming_tables.closing_result`.** Recompute purely from Close − Baseline per row. Color: positive normal, negative shown with leading `-`. |

Total row recomputed accordingly (sum each column).

Note: `Fill` and `IN` will be identical numbers (both come from the same `cage_transfers fill` rows). That's intentional — the legacy form keeps both columns.

Remove the `table_tracker` query in `ShiftClosingReport.tsx` (no longer needed for the IN column).

## Page 2 — Chips Movement Report

No semantic changes. Already correct.

## Print: 2 separate A4 pages

Currently both reports render in the same dialog tree, with Chip report using `print:break-before-page`. Strengthen the split so each is exactly one A4 page:

1. In `src/index.css` `@media print`:
   - `#shift-print-area { page: A4; page-break-after: always; break-after: page; }`
   - `#chip-print-area { page: A4; page-break-before: always; break-before: page; }`
   - Add `@page { size: A4 portrait; margin: 10mm; }`
   - Both areas: `width: 100%; max-height: 277mm; overflow: hidden;` to prevent overflow into a 3rd page.
2. Tighten Page 1 vertical density (text-[10px] for table rows, smaller paddings) to fit comfortably on one A4 portrait page given the table list size.
3. Verify no stray margins on the parent `print:block` container leak between pages.

## Reprint dialog

Apply identical changes in `src/components/cage/ReprintShiftDialog.tsx` so reprinted closed shifts use the same corrected layout (it already imports `ShiftClosingReport` and `ChipMovementReport`, so changes propagate automatically — only verify the wrapper enforces the same page-break CSS).

## Files to edit

- `src/components/cage/ShiftClosingReport.tsx` — rename `Drop`→`IN`, switch IN to `cage_transfers fill`, recompute Result as `Close − Open`, drop `table_tracker` fetch.
- `src/index.css` — strengthen `@page` and per-area page-break rules.
- `src/components/cage/ReprintShiftDialog.tsx` — confirm wrapper CSS classes match and that no extra margins break pagination.

## Out of scope

- No DB changes, no backend changes (no version bump).
- No changes to Chips Movement Report content.
- No changes to Cash Flow Opener/Closer or summary panel logic.
