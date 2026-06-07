## Goal
Do **not** delete any routes. Hide the AM-only entries (6 promo/cashback/lottery reports + AM Budget, AM Performance, FM Top-ups, Promo Codes, Promo Grants, Lotteries, Shop Catalog, Shop Orders, KYC) and the new `Monthly Expenses` (`/finances/expenses`) from Manager Taras by routing them through the Permission Matrix instead of hard-coded role lists.

Right now most of those items have no entry in `route-module-map.ts`, so `AppSidebar` falls through to the legacy `item.roles` whitelist (which includes `manager`) and the items show up for Taras. The matrix has zero rows for any `Club` module beyond `kyc_reviews`, so the user correctly observed that there is no Club block to toggle.

## Changes

### 1. `src/lib/modules.ts` — extend the catalog
Add a new `"Club"` value to `ModuleDef.group` and `MODULE_GROUPS`, and add these module keys (they already exist as ad-hoc strings — promote them to first-class entries so the matrix renders them):

Club / Promo admin
- `promo_codes` — Promo Codes
- `promo_grants` — Promo Grants
- `lotteries` — Lotteries
- `shop_catalog` — Shop Catalog
- `shop_orders` — Shop Orders
- `am_budget` — My AM Budget
- `am_performance` — AM Performance
- `fm_topups` — FM Top-ups
- (`kyc_reviews` already exists — move into the Club group)

Club / Promo reports
- `report_promo_issuance` — Report · Issuance
- `report_promo_redemptions` — Report · Redemptions
- `report_promo_expiry` — Report · Expiry
- `report_promo_codes` — Report · Codes
- `report_cashback` — Report · Cashback
- `report_lottery_sales` — Report · Lottery Sales
- `report_am_budget` — Report · AM Budget

### 2. `src/lib/route-module-map.ts` — map the report routes
Add:
```
/reports/promo-issuance    → report_promo_issuance
/reports/promo-redemptions → report_promo_redemptions
/reports/promo-expiry      → report_promo_expiry
/reports/promo-codes       → report_promo_codes
/reports/cashback          → report_cashback
/reports/lottery-sales     → report_lottery_sales
/reports/am-budget         → report_am_budget
/admin/fm-topups           → fm_topups   (override the current 'admin' fallback)
```

### 3. Database migration — seed `role_module_defaults`
`super_admin` is bypassed in code, so no rows needed. `manager` gets **nothing** for these keys (Taras stops seeing them). Hide new `/finances/expenses` for `manager` too by removing the existing `manager → finance_payments` default row.

```
-- ACCOUNT MANAGER: full Club + report access (view+write for admin, view for reports)
account_manager: promo_codes, promo_grants, lotteries, shop_catalog, shop_orders,
                 am_budget, am_performance, kyc_reviews   (view+write)
                 report_promo_issuance, report_promo_redemptions, report_promo_expiry,
                 report_promo_codes, report_cashback, report_lottery_sales,
                 report_am_budget                        (view only)

-- FINANCE MANAGER: oversight on Club + Top-ups; all reports
finance_manager: promo_codes, promo_grants, lotteries, shop_catalog, shop_orders,
                 kyc_reviews, fm_topups, report_am_budget   (view+write)
                 am_budget, am_performance,
                 report_promo_issuance, report_promo_redemptions, report_promo_expiry,
                 report_promo_codes, report_cashback, report_lottery_sales  (view)

-- MANAGER: explicit DELETE of finance_payments default
DELETE FROM role_module_defaults
 WHERE role = 'manager' AND module_key = 'finance_payments';
```

No new tables, no RLS changes — only `role_module_defaults` upserts and one delete. Auto version-bump applies.

### 4. (No code changes required) sidebar gating
`AppSidebar` already calls `moduleKeyForRoute()` → `allowedModules.has(mk)`. Once steps 1–3 land:
- Manager Taras: matrix has no rows for the Club/AM/report keys → items hidden.
- `/finances/expenses` hidden for manager (legacy `/expenses` keeps the `expenses` module which manager still has).
- Account Manager: sees the full Club block as before.
- Super-admin: unchanged (bypass).
- The Permission Matrix UI (`PermissionMatrix.tsx` / `RoleDefaultsEditor.tsx`) automatically renders the new `Club` group from `MODULES`, so the user can toggle per-role / per-user.

## Out of scope
- Routes, page files, and `item.roles` in `NAV_ITEMS` stay as-is (deep-links and AM users keep working).
- No backend/RPC/RLS changes beyond the seed migration.
- No UI design changes.

## Verification
1. Log in as Manager Taras → sidebar no longer shows `Monthly Expenses`, `Report · Issuance/Redemptions/Expiry/Codes/Cashback/Lottery Sales`, `Promo Codes/Grants`, `Lotteries`, `Shop Catalog/Orders`, `KYC`, `AM Budget/Performance`, `FM Top-ups`.
2. Log in as Account Manager → all Club items still visible.
3. Open `Admin → Users → Permissions` → new `Club` group appears with all keys; per-role and per-user toggles work.