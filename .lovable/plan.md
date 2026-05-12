
## Goal

Add a full TZA-compliant Payroll module and a new universal **Staff master** page for HR. Existing Rota/Attendance pages stay untouched. Payroll is visible only to **HR**, **Finance Manager** and **Super Admin**. Periods are immutable after Manager Approve.

## Scope by role

| Role | New Staff master | Payroll | Bank/Tax exports |
|---|---|---|---|
| HR | Full edit (master data, photos, salary, bank, NSSF/PAYE) | Edit monthly entries + **HR Approve** | — |
| Finance Manager | Read-only, multi-casino on `premier` | Review + **Manager Approve** + Unlock requests | All exports |
| Super Admin | Full | Full + can unlock locked period (audit) + edit tax tables/rates | All |
| All others (manager, pit, cashier, reception, surveillance, hr-no, floor_manager) | Hidden — they keep old Rota/Attendance only | Module hidden completely | — |

## Information architecture

```
Sidebar (HR/Finance/SuperAdmin only)
├── Staff (NEW universal master)        /staff/master
└── Payroll                              /payroll
    ├── Periods list                    /payroll
    └── Period detail (month)           /payroll/:periodId
        ├── Tab: Employee Payroll       (default — the big editable grid)
        ├── Tab: Taxes                  (NSSF, PAYE, SDL, WCF cards + per-employee table)
        ├── Tab: Salary Slips           (per-employee preview)
        └── Footer action bar:
            • [HR Approve]   (HR)
            • [Manager Approve] (Finance) — only after HR Approve
            • After both approvals (period LOCKED):
                [Export Bank CSV ▾]  [Export Salary Slips PDF]
                [Export NSSF .csv] [Export PAYE .csv] [Export SDL .csv] [Export WCF .csv]
                [Export Journal .csv]
```

The existing `/staff` (rota/attendance/employee tabs for Pit/Manager) stays as-is. The new master is a separate route owned by HR.

## Database

New tables (all `casino_id`-scoped, RLS by role; Finance Manager + Super Admin bypass casino filter):

- `employees` — master record (replaces `staff_members` for HR purposes; old table kept and linked via `staff_member_id` so Rota/Attendance keep working). Fields: full_name, position, department, employment_date, photo_url, nssf_number, tax_id, gepf_number, basic_salary (bigint TZS), payroll_status, plus FK to `staff_members.id` (nullable, for legacy mapping).
- `employee_bank_accounts` — account_number, bank_code, branch_code, bank_name, is_primary.
- `payroll_periods` — casino_id, year, month, status (`draft` → `hr_approved` → `locked`), hr_approved_by/at, manager_approved_by/at, locked_at, unlocked_by/at (audit only).
- `payroll_entries` — period_id, employee_id, snapshot of name/position/basic_salary/account at creation, plus all editable inputs (public_holiday_worked, hrs_worked, night_days, off_days, od_hrs, cash_shortage, salary_advances, missing_days, gepf_loan), plus all computed columns (gross, gepf_10, nssf_10, taxable_pay, paye, deductions_for_missing_days, net_salary). Computed values written by **DB trigger** on every UPDATE (server-side authoritative — fits "Server-Side Financial Computation" core rule).
- `tax_brackets` — versioned (`effective_from`), TRA PAYE progressive scale; editable only by super_admin.
- `payroll_settings` — per-casino constants (NSSF %, WCF %, SDL %, GEPF %, hours-per-month divisor 195, night-hours-per-day 10, night-allowance %), versioned; super_admin only.
- `payroll_audit_log` — immutable trail of every change/approval/unlock.
- Storage bucket `employee-photos` (private, RLS).

Key DB rules:
- Trigger blocks any UPDATE on `payroll_entries` when parent period status = `locked` (raise exception). HR Approve also locks editing for HR; only Finance can revert HR Approve before Manager Approve.
- "Duplicate from previous month" RPC: clones employees + master snapshots, zeroes hours/deductions.
- All TZS amounts as `bigint`. Display via existing `cms-amount-positive/negative` tokens and SPACE separators.

## Calculation engine (in DB trigger, mirrors Excel exactly)

```
public_holiday_earned   = basic_salary / 195 * public_holiday_worked * hrs_worked
night_allowance_hours   = 10 * night_days
night_allowance         = basic_salary / 195 * 0.05 * night_allowance_hours
gross_salary            = basic_salary + public_holiday_earned + night_allowance + off_days_total
gepf_10                 = gross_salary * 0.10
nssf_10                 = gross_salary * 0.10
taxable_pay             = gross_salary - gepf_10 - nssf_10
paye                    = TRA progressive bracket lookup(taxable_pay, effective_brackets)
deductions_missing_days = basic_salary / working_days * missing_days
net_salary              = gross_salary - gepf_10 - nssf_10 - paye
                          - cash_shortage - salary_advances
                          - deductions_missing_days - gepf_loan
```

Employer-side (for tax reports, not deducted from employee): `nssf_employer = gross*0.10`, `wcf = gross*0.01`, `sdl = gross*0.035`.

## UI components

- `/staff/master` — `DataTable` (one row per employee), inline `InlineEditor` for HR, photo upload via existing `PhotoCapture`, filter by department, "Add Employee" `ResponsiveDialog`.
- `/payroll` — list of periods grouped by year, status chips, "New month" + "Duplicate previous" buttons.
- `/payroll/:periodId` — `PageShell` + `PageHeader` showing month + status + approval state. Big grid uses `DataTable` with monospaced numeric columns and dot placeholders (per core rules). Editable cells lock visually after each approval stage.
- All wrappers per Design System Rules: `PageShell + PageHeader + PageSection + DataTable + ResponsiveDialog`. English-only.

## Exports

- **Bank CSV** — generic format, configurable per bank. Default columns from BANK1 sheet: `ID, NAME, ACCOUNT NUMBER, AMOUNT, BANK, BRANCH, DESCRIPTION` (description = `"<MONTH> SALARY <YEAR>"`). User will provide CRDB-specific format later — ship a pluggable formatter (`bank_export_formats` table or hardcoded registry, easy to extend).
- **Salary slips** — server-side generated PDF (one slip per employee, matches SALARY SLIPS sheet layout: name, payroll no., basic, regular, overtime, holiday, night, gross, NSSF, PAYE, advances, other, NET).
- **NSSF / PAYE / SDL / WCF** — XLSX via existing `lib/excel-export.ts`.
- **Journal** — XLSX with Dr/Cr per Excel JOURNAL sheet.

All export buttons appear ONLY when `period.status = 'locked'` (both approvals done).

## Approval flow

```
draft  ──[HR Approve, HR only]──►  hr_approved
                                   │
                                   ├─[Manager Approve, Finance]──► locked  (exports unlock)
                                   │
                                   └─[Reject back to draft, Finance]──► draft  (audit logged)

locked ──[Unlock, Super Admin only, requires reason]──► hr_approved  (audit logged)
```

## Permissions matrix wiring

- Add module keys: `staff_master`, `payroll`. Wire into `role_module_defaults` for `hr`, `finance_manager`, `super_admin` only.
- Sidebar entries gated by `useMyModulePermissions` (existing matrix system from previous work).
- Routes added to `route-module-map.ts`: `/staff/master` → `staff_master`, `/payroll`, `/payroll/:id` → `payroll`.
- `RoleGuard` already uses matrix → no extra changes.

## Out of scope (this iteration)

- CRDB-specific bank CSV format (user will send template; pluggable formatter ready).
- Multi-currency payroll (TZS only).
- Loans module beyond a single `gepf_loan` deduction line.
- Time-tracking integration with existing attendance grid (HR enters hours manually for now; can be linked in a follow-up).

## Files to create/edit (high level)

- DB migrations: tables above + RLS + triggers + RPCs (`duplicate_payroll_period`, `approve_payroll_hr`, `approve_payroll_manager`, `unlock_payroll_period`).
- `src/lib/route-module-map.ts` — add new routes.
- `src/lib/modules.ts` + matrix defaults — add `staff_master`, `payroll`.
- `src/hooks/use-payroll.ts`, `src/hooks/use-employees.ts`.
- `src/pages/StaffMaster.tsx` — new HR master page.
- `src/pages/Payroll.tsx`, `src/pages/payroll/PayrollPeriodPage.tsx`.
- `src/components/payroll/*` — `PayrollGrid`, `TaxesPanel`, `SalarySlipsPanel`, `ApprovalBar`, `BankExportDialog`, `EmployeeEditorDialog`.
- `src/components/staff-master/*` — table, photo cell, bank-info inline editor.
- `src/lib/payroll-exports.ts` — bank CSV / NSSF / PAYE / SDL / WCF / Journal builders.
- Storage bucket migration for `employee-photos`.

## Versioning

Backend changes → auto-bump `package.json` patch on each migration batch (per core rule).

