
## Cash Check Viewer

Add a read-only preview of any previously recorded Cash Check from the Cage page, showing the full denomination snapshot exactly as it was entered (chips + all currencies + banks + mobile), with empty currency sections collapsed.

### Behaviour

- In `ActiveShiftView` → "Previous (N)" panel, every row becomes clickable (cursor-pointer, hover state). Clicking opens a `ResponsiveDialog` with the full snapshot of that check.
- Cashier role: list shows only the active shift's checks (current behaviour, unchanged).
- Manager / Pit / Surveillance / Finance / Super Admin roles: a small date picker appears above the Previous list. Default = today's business day. They can step through past business days; the list reloads from `cash_checks` filtered by `casino_id` + business date range, joined with `cage_shifts` so each row shows shift label (e.g. "Day · Cashier name · 14:32").
- Empty currencies (all denoms = 0 AND any cash field = 0) render as a collapsed `<details>` row with the section title and `· empty` muted text. User can expand to verify zeros.
- Non-empty sections render the full denomination grid in read-only mode (reusing `CashDenomInput` / `ChipDenomInput` with `disabled` prop, or a thin `CashCountReadOnly` view component if disabled prop missing).
- Footer of dialog shows totals from `denominations.totals`: Counted, Expected, Diff (color-coded), and timestamp + cashier name.

### Files to add / change

- `src/components/cage/CashCheckViewerDialog.tsx` (new) — wraps the snapshot in `ResponsiveDialog`, renders chips + 4 currency cash blocks + banks + mobile in collapsible sections, hides/collapses empty ones.
- `src/components/cage/CashDenomInput.tsx`, `src/components/ChipDenomInput.tsx` — accept optional `readOnly` / `disabled` prop to render values without inputs (or fall back to a small inline read-only renderer in the new dialog).
- `src/components/cage/ActiveShiftView.tsx`:
  - Make Previous rows clickable → opens viewer with selected `cash_check`.
  - For non-cashier roles: render a date picker + a query (`useCashChecksByDate(date)`) that fetches all checks of that business day for the casino. Cashier path unchanged.
- `src/hooks/useCashChecks.ts` (or co-located) — add `useCashChecksByBusinessDate(date)` hook gated by role; uses `useEffectiveBusinessDate()` defaults.

### Roles

- View dialog: all Cage-visible roles (cashier, manager, pit, surveillance, reception, hr, finance, super_admin).
- Date browsing of past days: manager, pit, surveillance, finance, super_admin (cashier stays bound to their shift).

### Out of scope

- No edits, no deletes (immutable data rule).
- No new DB migrations — `cash_checks.denominations` JSONB already holds the full snapshot.
- No separate page; lives entirely inside the Cage surface.
