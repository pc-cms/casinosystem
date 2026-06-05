
# Finances — Full Rewrite Plan

## 1. Philosophy
- Всё финансовое **изолировано в пределах одного казино** (categories — глобальный справочник, всё остальное — `casino_id`-scoped).
- Finance Manager на `premier`-субдомене видит и анализирует все казино, но редактировать справочник может только Finance Manager + Super Admin.
- Manager может удалять записи (компенсирующая reversal-транзакция, баланс восстанавливается, оригинал soft-flagged `voided_at`).
- Audit log на всё: 1 год, видим Finance + Admins.

## 2. DROP / KEEP

**DROP (вместе с UI/хуками):**
`budget_items`, `budget_categories`, `budget_periods`, `budget_logs`, `financial_wallets`, `wallet_transactions`, `daily_summaries`, `inter_casino_transfers`, `expense_categories`. Все страницы `/finance/*` старые, хуки `useBudget*`, `useWallet*`, `useDailyReview*`.

**KEEP:**
`cash_counts`, `cash_count_snapshots` (Money Count), `collections` логика на новых wallets, income учёт; `am_budgets`, `am_budget_ledger` (AM-роль); `house_promo_fund/ledger` (Promo); `payroll_*`; `cage_slots_*`; `cage_slots_exchange_rates`; `expenses` — extend, не drop.

**EXTEND `expenses`:**
+ `wallet_id`, `currency`, `exchange_rate`, `amount_tzs`, `attachment_url`, `is_overrun bool`, `overrun_reason`, `overrun_approved_by`, `reversed_by`, `reversal_of`, `voided_at`, `voided_by`.

## 3. New Schema

```text
fin_categories      (global) id, group_code, parent_id, name, casino_visible_ids[]?, is_active, sort_order
fin_wallets         (per casino) id, casino_id, name, kind (cash|bank|safe|cage|external), currency, is_active
fin_wallet_tx       id, casino_id, wallet_id, kind (income|expense|change_in|change_out|transfer_in|transfer_out|reversal|adjustment),
                    amount, currency, fx_rate, amount_tzs, ref_table, ref_id, business_date, created_by, reversal_of
fin_day_closing     id, casino_id, business_date, tables_result (auto from shifts), slots_result (manual),
                    income_lines jsonb [{wallet_id,currency,amount,denominations jsonb}], notes, closed_by, locked_at
fin_money_change    id, casino_id, from_wallet, to_wallet, from_amount, from_ccy, to_amount, to_ccy, rate, manager_id, business_date
fin_budget          id, casino_id, year, month (1..12 + 0=annual), category_id, currency (TZS|USD),
                    planned_amount, overrun_limit_pct default 110, approved_by, approved_at, locked_at
fin_audit_log       id, casino_id, actor, action, entity_table, entity_id, before jsonb, after jsonb, created_at
fin_excel_imports   id, casino_id, filename, raw_data jsonb, mapping jsonb, status, imported_by, applied_at
```

Annual budget = SUM(12 месяцев). Override годового → дельта равномерно распределяется по оставшимся месяцам (RPC `fin_budget_set_annual`).

## 4. Categories (7 групп, ~80 items)

1. **Fixed Costs & Government Licences** — EGT & Novomatic (incl 18% VAT), DSTV, Casino Parking annual ×2, Front Advertisement, GB Gaming Licence, Fire Licence, Hall rent, Hall rent & debts, Hall rent & storage, House rent, Internet Casino, Internet Casino & Home, Internet Smile & Phones, Osha, Cosota, Annual audit & lawyer, KK Security, Service Levy 0.3%, Service Car.
2. **Monthly Variable Government Taxes** — Gaming Board 18%, SDL 4.5%, PAYE, GEPF 20%, NSSF 20%, WCF 0.5%.
3. **Other Variable Expenses** — Advertisement, Bar, Electricity, Food for customers & staff, Hall & House Reparation, Reparation Machines and Tables, Sanitary, Stationary, Konvertions, Missing money-Cashiers, Other VARIABLE, Water, Transport for Staff.
4. **Salary Expenses** — Staff Salary PAYROLL (auto from payroll closure), Cash in Hands & Bonuses, Expats Salary, CCTV Salary & accountant, Terminal benefits.
5. **Petrol Expenses** — Petrol for driver, Petrol for CARS, Petrol for CARS (Toyota), Petrol for CARS (Toyota) & generator.
6. **Additional Expenses** — Work permits and tickets, Service for AC, Service for AC (UPS), Lotary Expenses SLOTS & LIVE GAME.
7. **Income / Collection / CAPEX / Transfers** — Tables Income, Slots Income, External Income, Owner Injection, Bank Loan, Collection (owner withdrawal), CAPEX (equipment/renovation), Inter-Casino Transfer In/Out, Money Change.

Дубли (`Hall rent` / `… & debts` / `… & storage`, `Internet Casino` / `… & Home`, `Petrol CARS (Toyota)` / `… & generator`, `Service for AC` / `(UPS)`) — оставляем как **отдельные категории**. Все категории видны всем казино, выбираются по факту использования; бюджет per casino решает что заполнять.

## 5. Sidebar `Finances` (для finance_manager / manager / admin)

```
Finances
├─ Dashboard               (KPI: month income, expenses, net, MTD vs budget, top overruns)
├─ Day Closing             (per business date: tables auto, slots manual, income lines per wallet+denomination)
├─ Expenses                (CRUD; attachment; overrun guard 110%; soft-delete = reversal)
├─ Money Change            (cross-currency, cross-casino allowed; manager-only; no approval)
├─ Wallets                 (per-casino wallet list, balance live)
├─ Office Safe             (group view: cash by currency, bank, denominations; transfer to another casino's Office Safe)
├─ Budget                  (per month grid: planned per category × currency; annual auto-sum + override; lock)
├─ Budget vs Actual        (matrix month×category, drill-down)
├─ Annual Analytics        (Month×Category, Budget vs Actual, Income vs Expense vs Net line, YoY, cross-casino on premier)
├─ Excel Import            (upload → AI-assisted column mapping preview → user confirms → apply)
└─ Audit Log               (1-year retention; pg_cron purge; filterable)
```

## 6. Key Flows

- **Day Closing**: `tables_result` auto-pulls from `shifts.tables_result` (read-only); Slots manual; Income — выбираешь wallet + валюту + сумму, можно по номиналам. На lock → создаёт `fin_wallet_tx(kind=income)`.
- **Expense create**: ввод суммы в валюте кошелька; FX → TZS; проверка `MTD spent + new > budget.monthly × overrun_limit_pct`. Если превышает → требует `overrun_reason` + апрув Finance Manager. Создаёт `fin_wallet_tx(kind=expense)` + опц. attachment.
- **Manager Delete**: ставит `voided_at/voided_by` на оригинале + создаёт `fin_wallet_tx(kind=reversal, reversal_of=…, amount=-original)`. UI скрывает voided по умолчанию, toggle "Show voided".
- **Money Change**: одна транзакция пара out+in, может быть cross-casino (создаёт парные tx в обоих казино).
- **Payroll → Salary**: при `payroll_periods.status='closed'` trigger создаёт expense в категории `Staff Salary PAYROLL` на сумму gross.
- **Excel Import**: edge function `fin-excel-import` парсит → Lovable AI Gateway (`google/gemini-2.5-flash` бесплатно) предлагает mapping колонок → юзер подтверждает → bulk insert в `fin_budget` или `expenses`.
- **Inter-casino Office Safe transfer**: парные `transfer_out`/`transfer_in` в двух казино, atomic RPC.

## 7. Roles

| Role | Categories | Budget | Expenses | Day Closing | Money Change | Wallets/Office Safe | Audit |
|---|---|---|---|---|---|---|---|
| super_admin | CRUD | CRUD | CRUD+Delete | CRUD+lock | CRUD | CRUD | read |
| admin | read | CRUD | CRUD+Delete | CRUD+lock | CRUD | CRUD | read |
| finance_manager | CRUD | CRUD+approve overrun, set annual override | read+approve overrun | read | read | read | read |
| manager | read | read | CRUD+Delete (reversal) | CRUD+lock | CRUD | read | — |
| owner | read (premier all) | read | read | read | read | read | — |
| all others | hidden | hidden | hidden | hidden | hidden | hidden | hidden |

## 8. Migrations (3 steps)

1. **M1 Drop**: drop старых таблиц, drop старых RLS, drop старых триггеров.
2. **M2 Create**: новые `fin_*` таблицы + GRANTs + RLS (`casino_id = current_casino()` + role checks via `has_role`) + extend `expenses` + payroll-close trigger + `fin_budget_set_annual` RPC + reversal RPC + pg_cron `purge_fin_audit_log` (>365 days).
3. **M3 Seed**: insert 7 групп и ~80 категорий в `fin_categories`.

Edge function: `supabase/functions/fin-excel-import/index.ts` (Lovable AI Gateway, free Gemini).

## 9. Frontend (after migration approved)

- Delete: `src/pages/finance/*` старые, `src/hooks/useBudget*`, `useWallet*`, `useDailyReview*`, старые компоненты.
- New: `src/pages/finances/{Dashboard,DayClosing,Expenses,MoneyChange,Wallets,OfficeSafe,Budget,BudgetVsActual,AnnualAnalytics,ExcelImport,AuditLog}.tsx`.
- New hooks: `useFinCategories`, `useFinWallets`, `useFinWalletTx`, `useFinBudget`, `useFinDayClosing`, `useFinMoneyChange`, `useFinAudit`, `useFinExcelImport`.
- Sidebar: новая секция `Finances` (role-gated через `effective_module_perms`).
- Все страницы строго на `PageShell/PageHeader/PageSection/FormGrid/ResponsiveDialog/DataTable`, английский UI, DD/MM/YYYY, space-thousand, currencies TZS→USD→EUR→GBP→KES.

## 10. Order of execution

1. Migration M1 (drop old) — отдельный approval.
2. Migration M2 (create new + triggers + RPCs).
3. Migration M3 (seed categories).
4. Edge function `fin-excel-import` + secret check (Lovable AI key, уже есть).
5. Удаление старого кода + добавление новых страниц/хуков/sidebar.
6. Bump `package.json` patch.

Ожидаемо: ~3 migrations, 1 edge function, ~35 файлов фронта (новых + переименованных), удаление ~25 старых.
