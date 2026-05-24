
# Tips & Bonuses, Suspend code, HR Warnings inbox

Three independent changes.

---

## 1. Sidebar — `Tips & Bonuses` (single entry with 5 tabs)

Visible to: `manager`, `floor_manager`, `super_admin`, `surveillance`, `finance_manager`.
Hidden for: `cashier`, `reception`, `hr`, `pit`.
Cashier keeps the existing "Tips" buttons in the cage header — entry flow does not change.

Remove from sidebar (replaced by tabs inside the new page):
- `Weekly Bonus` (`/weekly-bonus`)
- `Monthly Tips` (`/monthly-tips`)
- `Poker Tips` (`/reports/poker-tips`)
- `Floor Tips` (`/reports/floor-tips`)

New route: `/tips-and-bonuses` with shadcn `Tabs`:

| Tab | Source / behavior |
|---|---|
| Weekly Bonus | Reuses existing `WeeklyBonus` page body unchanged (week navigator stays). |
| Monthly Tips | Reuses existing `MonthlyTips` page body unchanged (16→15 period navigator). |
| Live Game Tips | Read-only list of `transactions.type = 'tips_live'`. Columns: **Date · Time · Amount · chip breakdown by denomination**. Grouped by day with day subtotal; period total at top. Period selector = month (1–end of month). |
| Floor Tips | List of `transactions.type = 'tips_floor'`, grouped by business day. Each day expands to per-recipient lines (uses `tips_recipient_employee_id`) like Player Statistics day groups. Month selector. |
| Club Poker Tips | List of `transactions.type = 'tips_poker'` — one row per day with day total; period total. Month selector. |

Old routes (`/weekly-bonus`, `/monthly-tips`, `/reports/poker-tips`, `/reports/floor-tips`) redirect to `/tips-and-bonuses?tab=<id>` so external links/bookmarks still work.

---

## 2. Suspend (SP) in Break List & Attendance

New attendance code `SP` everywhere `A`/`S`/`L` are accepted:

- Database/value layer
  - Add `SP` to attendance string parser (`parseValue`) and normalizer (`normalizeAttInput`) in **WeeklyBonus**, **MonthlyTips**, **AttendanceMonthly**, **BreaklistGrid**, plus `useDealerAttendance`/`useSetDealerAttendance` consumers.
  - SP = 0 hours, treated identically to `A` in all calculations (payroll, attendance auto-fill, bonus pool eligibility) — purely a separate marker for HR tracking.
- Break List grid (`BreaklistGrid`)
  - When a dealer's attendance for the day is `SP`, the entire row disappears from the grid for that day (same as Absent currently — verify and align).
  - Clicking a dealer's name (or new dropdown) lets pit set `A` / `S` / `L` / **SP**. Selecting `S`, `L`, or `SP` opens a small inline hint popover: textarea + OK; clicking again re-opens with prior text for editing.
- Attendance Monthly + Weekly/Monthly Tips grids
  - Display `SP` in a **bright red ("toxic")** style (new `text-red-500 font-bold` class added next to existing `A` styling).
  - Cell editor accepts `SP`.

---

## 3. HR Warnings inbox

New table `staff_warnings`:
- `id`, `casino_id`, `employee_id`, `business_date`, `kind` (`absent` | `suspend` | `sick` | `late`), `comment text`, `created_by`, `created_at`, `updated_at`.
- Unique `(casino_id, employee_id, business_date, kind)` so re-toggling updates the same row.
- RLS: read for `hr`, `manager`, `floor_manager`, `super_admin`, `finance_manager`; insert/update for `pit`, `manager`, `floor_manager`, `super_admin`, `hr`.

DB trigger on `dealer_attendance` (and floor staff attendance table):
- When raw_value becomes `A`/`SP`/`S`/`L` → upsert `staff_warnings` row (comment stays whatever HR/pit entered via hint, default empty for `A`).
- When value cleared/changed to working hours → delete corresponding warning row.

Sidebar (HR section): new entry **Warnings** at `/hr/warnings` — visible to `hr`, `manager`, `super_admin`.

Page `/hr/warnings`:
- Month carousel (reuse `MonthCarousel`).
- Table grouped by day: Date · Time · Employee (name + dept) · Kind badge (color-coded: SP red, A red-muted, S amber, L orange) · Comment (inline-editable for HR).
- Filter chips: kind, department.
- Comments edited here also sync back to the attendance hint.

---

## Technical details

### Files touched
- **Sidebar**: `src/components/layout/AppSidebar.tsx` — remove 4 entries, add `Tips & Bonuses` + `Warnings`.
- **Routes**: `src/App.tsx` — add `/tips-and-bonuses`, `/hr/warnings`, plus redirects for old routes.
- **New pages**:
  - `src/pages/TipsAndBonuses.tsx` (tab host, lazy-loads existing components).
  - `src/pages/tips/LiveGameTipsTab.tsx`, `FloorTipsTab.tsx`, `ClubPokerTipsTab.tsx` (Floor/Poker tabs mostly wrap existing `FloorTipsReport`/`PokerTipsReport` content).
  - `src/pages/hr/Warnings.tsx`.
- **Hooks**: extend `use-tips.ts` with `useTipsByRange` chip-breakdown helper; new `use-staff-warnings.ts`.
- **Attendance parsers**: WeeklyBonus, MonthlyTips, AttendanceMonthly, BreaklistGrid — add `SP`.
- **Breaklist hint popover**: new small component reused for `S`/`L`/`SP`.

### Migrations
1. `create table public.staff_warnings` + RLS + indexes + unique constraint.
2. Trigger function `tg_sync_staff_warnings()` on `dealer_attendance` (and equivalent for floor staff attendance, if separate table).
3. Update `dealer_attendance` value CHECK (if present) to allow `SP`.
4. Update `role_module_defaults`: remove `weekly_bonus`, `monthly_tips`, `reports_poker_tips`, `reports_floor_tips` for affected roles; insert `tips_and_bonuses` for manager/floor_manager/super_admin/surveillance/finance_manager; insert `hr_warnings` for hr/manager/super_admin.

### Out of scope
- Cashier tip entry UI (untouched).
- Payroll logic — SP behaves identically to A, no recalculations needed.
- Mobile drawer styling beyond default `Tabs` responsiveness.

### Risks / verifications
- Need to confirm whether floor-staff attendance lives in same `dealer_attendance` table or a separate one before writing the warnings trigger.
- Old bookmarks: redirects keep working but module-permissions table must keep legacy keys or we add a runtime alias in `route-module-map`.
