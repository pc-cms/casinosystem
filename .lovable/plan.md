## Goal

Three connected upgrades around Staff Master:
1. Full **Staff Master table** keeps Onboarding / Contract Start / Contract End columns (already added) and stays the single directory.
2. New **Monthly Attendance** page: one big grid (employees × days of month) showing hours per day, with month totals on the right, holiday columns highlighted, hours editable per cell.
3. **Payroll**: auto-includes every active employee from Staff Master and gets a **Refresh** button that recomputes the period from shifts/attendance/holidays.

English-only UI, design system wrappers, DD/MM/YYYY, space thousand separator, density tokens.

---

## 1. Database

### New table `attendance_holidays`
- `casino_id`, `date`, `name`, `multiplier numeric(3,2) default 1.50`, `created_by`, timestamps
- Unique (`casino_id`, `date`)
- RLS: HR / Manager / Super Admin write; everyone in casino reads

### New table `attendance_hours`
Stores per-cell hour overrides on top of the auto-derived 9h baseline.
- `casino_id`, `employee_id` (fk employees), `date`, `hours numeric(4,2)`, `note`, `recorded_by`, timestamps
- Unique (`casino_id`, `employee_id`, `date`)
- RLS: HR / Manager / Super Admin

### RPC `get_monthly_attendance(p_casino_id, p_month date)`
Returns one row per (employee × day) for the month with:
- `auto_hours` — from `staff_attendance` / `pit_attendance` (9h after closure) for the matching staff_member_id / dealer_id
- `manual_hours` — from `attendance_hours`
- `effective_hours` — manual ?? auto ?? 0
- `code` — D / N / L / E / O / H from rota
- `is_holiday`, `holiday_multiplier`

### RPC `recalc_payroll_period(p_period_id uuid)`
For the period's casino+date range:
- Ensure a `payroll_lines` row exists for every `employees` row with `payroll_status='active'` (insert missing)
- Sum `effective_hours` and `days_worked` from `get_monthly_attendance`
- Compute:
  - `regular_hours` = effective hours on non-holiday days
  - `holiday_hours` = effective hours on holiday days
  - `holiday_pay` = holiday_hours × hourly_rate × (avg multiplier)
  - `base_pay` = `basic_salary ÷ standard_days_in_month × days_worked` (standard = 30)
  - `overtime_hours` = effective − scheduled (>0 only)
  - `gross` = base_pay + holiday_pay + overtime_pay
- Updates `payroll_lines.last_calculated_at`. Idempotent. SECURITY DEFINER.

Auto-bump `package.json` patch.

---

## 2. Frontend

### `src/pages/StaffMaster.tsx` — keep as is
Current columns already cover Onboarding / Contract Start / Contract End — no change needed beyond bug fixes if any surface during build.

### New page `src/pages/Attendance.tsx`  (route `/attendance`)
- Header: month picker (← Nov 2026 →), "Mark Holiday" button (HR/Manager), Export CSV
- Single big grid via `DataTable`:
  - Sticky left: Photo · Name · Position (grouped Pit/Floor/Security/Office)
  - 28–31 day columns, header shows DD with weekday under; holiday days have amber background and a small ★ + multiplier badge
  - Cell shows hours number (mono); empty = `·`; click to edit (inline number input); colored by code (D=teal, N=indigo, L=amber, O=muted, H=amber-strong)
  - Right summary columns: Days, Hours, Leave, Holiday H, OT H
- "Mark Holiday" opens small dialog: date picker + name + multiplier (default 1.5)
- Read-only for non-HR/Manager
- New hook `src/hooks/use-attendance.ts` with `useMonthlyAttendance`, `useUpsertAttendanceHours`, `useHolidays`, `useUpsertHoliday`, `useDeleteHoliday`

### Sidebar
Add "Attendance" entry under HR section in `AppSidebar.tsx` (HR / Manager / Super Admin / Finance read-only).

### Payroll page (existing `src/pages/Payroll.tsx` / `PayrollPeriodPage.tsx`)
- Top toolbar: add primary **Refresh** button (HR/Manager/Finance/Super Admin)
- On click: call `recalc_payroll_period(period_id)` → toast "Updated N lines" → invalidate query
- Auto-list: when opening a period with zero lines, automatically call the same RPC once
- Show `last_calculated_at` next to header

### Module map / access matrix
- Add `attendance` module → HR/Manager/Super_admin write, Finance read
- Add to `role_module_defaults` and `docs/ACCESS-MATRIX.md`

---

## 3. Out of scope (keep behavior unchanged)
- Salary structure, deductions, NSSF/PAYE engine
- Rota grids stay sourced from `staff_rota` / pit rota
- Auto-fill 9h logic untouched (still gated by business_day_closures)

---

## Files

**New**
- `supabase/migrations/<ts>_attendance_payroll.sql`
- `src/pages/Attendance.tsx`
- `src/hooks/use-attendance.ts`

**Edited**
- `src/App.tsx` (route)
- `src/components/layout/AppSidebar.tsx`
- `src/pages/Payroll.tsx` and/or `src/pages/payroll/PayrollPeriodPage.tsx`
- `src/hooks/use-payroll.ts` (add `useRecalcPeriod`)
- `src/lib/route-module-map.ts`, `src/lib/modules.ts`
- `docs/ACCESS-MATRIX.md`
- `package.json` (patch bump)

Memory: add `mem://features/monthly-attendance` and `mem://features/payroll-refresh` after build.
