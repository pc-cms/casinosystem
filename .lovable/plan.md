## Резюме

Базовая инфраструктура Payroll уже есть: `payroll_periods`, `payroll_entries` (с snapshot-полями и всеми вычисляемыми колонками — gross, GEPF, NSSF, PAYE, SDL, WCF, net), `payroll_settings`, RPC `payroll_create_period / duplicate_period / refresh_period / approve_hr / approve_manager / revert_to_draft / unlock_period`, экспортёры в `src/lib/payroll-exports.ts` (NSSF/PAYE/SDL/WCF/Journal/Bank CSV/Salary Slips print). Поэтому план не «строим с нуля», а **достраиваем недостающие куски** до уровня ТЗ и переупаковываем в чистое HR/Finance‑приложение с ежемесячной каруселью.

Главные пробелы по сравнению с ТЗ:

1. Workflow статусов — сейчас 3 (`draft / hr_approved / locked`), нужно 4 (`Draft / Reviewed / Approved / Paid`) + поле «оплачено когда/кем».
2. Настройки PAYE‑брэкетов и `off_day_multiplier` хранятся только как захардкоженные числа в триггере — нужны конфигурируемые таблицы и UI Settings.
3. Нет Payroll Settings страницы (только БД).
4. Нет дашборда Payroll с карточками и графиками.
5. Salary Slips — только print HTML; нужен превью + PDF + bulk.
6. Bank Export — есть базовый CSV, нужны валидации (нет счёта / дубликат / 0 / отрицательный) и поле "payment description".
7. Журнал — есть xlsx, но не привязан к настройкам SDL/WCF/employer pension.
8. Roles: сейчас `hr / finance_manager / super_admin`, ТЗ требует `Accountant / Approver / Viewer` — добавляем как алиасы поверх существующего `effective_module_perms`.
9. Department Subtotals — в текущем UI нет.
10. Карусель месяцев и единая навигация для Payroll / Slips / NSSF / PAYE+SDL / WCF / Settings / Dashboard.

UI везде: PageShell + PageHeader + DataTable + ResponsiveDialog + FormGrid, English‑only, DD/MM/YYYY, пробел как разделитель тысяч, плотность по токенам.

---

## 1. База данных — миграция `<ts>_payroll_full.sql`

### 1.1 Расширение статусов
- `payroll_periods.status` CHECK → `('draft','reviewed','approved','paid')`. Маппинг существующих: `hr_approved → reviewed`, `locked → approved`.
- Новые колонки: `reviewed_by/reviewed_at`, `approved_by/approved_at`, `paid_by/paid_at`, `payment_description text`, `branch_label text`.
- Новые RPC: `payroll_mark_reviewed`, `payroll_mark_approved`, `payroll_mark_paid`. Старые `approve_hr/approve_manager` оставляем как обратно‑совместимые обёртки.

### 1.2 Конфигурируемые правила расчёта
- Новая таблица `payroll_paye_brackets(casino_id, effective_from, ord, lower bigint, upper bigint nullable, base_tax bigint, rate_pct numeric)`.
- Дефолт сидируем 5 строками из ТЗ (0/9/22500+20/70500+25/130500+30).
- В `payroll_settings` добавить: `off_day_multiplier numeric default 2.0`, `holiday_method text default 'hours'` (hours/day), `default_payment_description text`.
- Триггер расчёта `payroll_entries` переписываем так, чтобы он:
  - Брал текущие настройки `payroll_settings` + `payroll_paye_brackets` для `(casino_id, effective_from <= period_first_day)`;
  - Считал PAYE по фактическим брэкетам, а не by hardcoded формуле;
  - Использовал `off_day_multiplier`;
  - `night_allowance_hours = night_days * night_hours_per_day` (уже так);
  - Записывал результат в существующие колонки.

### 1.3 Роли
- В `app_role` enum добавить `accountant`, `approver`, `viewer` (если ещё нет).
- В `role_module_defaults` сидим: `hr` — write payroll inputs; `accountant` — read + reports + recalc; `approver` — review + approve; `viewer` — read-only; `finance_manager` — paid + unlock.
- RLS на `payroll_entries`: write только пока статус `draft` или `reviewed` (для accountant) и пользователь имеет соответствующее право.

### 1.4 Bank export validations
- Новая VIEW `payroll_bank_export_v(period_id, employee_id, name, account_number, bank_code, branch_code, amount, warning text)` — генерирует warning «missing account», «zero», «negative», и помечает дубликаты по `account_number`.

Bump `package.json`.

---

## 2. Frontend — структура страниц

Сайдбар секция **Payroll** (HR/Accountant/Approver/Viewer/Finance/Super):

```text
Payroll
 ├── Dashboard          /payroll/dashboard
 ├── Periods            /payroll               (список, как сейчас)
 │    └── Period view   /payroll/:id           (главная таблица + Refresh + Status workflow)
 ├── Salary Slips       /payroll/:id/slips
 ├── NSSF Report        /payroll/:id/nssf
 ├── PAYE & SDL         /payroll/:id/paye-sdl
 ├── WCF Report         /payroll/:id/wcf
 ├── Bank Export        /payroll/:id/bank
 ├── Journal            /payroll/:id/journal
 └── Settings           /payroll/settings
```

В шапке каждой `:id`-страницы — общая «MonthCarousel» (← Apr 2026 →) + chip статуса + кнопки workflow в зависимости от роли (`Mark Reviewed`, `Approve`, `Mark Paid`, `Revert`, `Unlock`).

### 2.1 Period view (главная таблица) — `src/pages/payroll/PayrollPeriodPage.tsx`
- Один большой `DataTable`, ровно колонки из ТЗ §3.
- Группировка по `department` (Pit / Floor / Security / Office) с **Department Subtotals** строкой (count, basic, holiday, night, off, gross, NSSF, PAYE, advances, deductions, net).
- Inline‑редактирование только для manual полей (`public_holiday_worked`, `night_days`, `off_days`, `off_days_hours`, `cash_shortage`, `salary_advances`, `missing_days`, `gepf_loan`). Calculated cells — серый bg (`bg-muted/30`), tabular‑nums.
- Кнопки в шапке: **Refresh** (RPC `payroll_refresh_period`, тянет часы из `get_monthly_attendance`), **Add row** (для редких разовых сотрудников вне Staff Master — отключаем, не нужно).
- Status workflow: `Draft → [HR] Mark Reviewed → [Accountant/Approver] Approve → [Finance] Mark Paid`, с подтверждением и причиной для `Revert` / `Unlock`.

### 2.2 Salary Slips — `src/pages/payroll/SalarySlipsPage.tsx`
- Список сотрудников слева, превью A5 справа, кнопки **Print one / Print all / Download PDF**.
- PDF — генерация через `jspdf` + `jspdf-autotable` (добавить зависимость), bulk = один PDF с разрывами страниц.
- Содержание payslip — ровно поля из ТЗ §7, читает из `payroll_entries` snapshot полей.

### 2.3 NSSF Report — `src/pages/payroll/NssfPage.tsx`
- Шапка из `casinos` (employer name, address, registration number — добавить недостающие колонки в `casinos`, миграция).
- Таблица: # · Name · NSSF No. · Gross · Employee 10% · Employer 10% · Total 20% · Remarks.
- Export Excel (через `exportNssfReport`, расширим заголовком).

### 2.4 PAYE & SDL — `src/pages/payroll/PayeSdlPage.tsx`
- Две вкладки: PAYE (Tax ID, Taxable Pay, PAYE) и SDL (Gross, SDL 3.5%).
- Sticky totals, экспорт Excel каждый.

### 2.5 WCF — `src/pages/payroll/WcfPage.tsx`
- Шапка как NSSF, колонки: # · Name · Basic · Gross · WCF.
- Export Excel.

### 2.6 Bank Export — `src/pages/payroll/BankExportPage.tsx`
- Читает `payroll_bank_export_v`. Строки с warning подсвечены `bg-amber-500/10` (warning) или `bg-destructive/10` (block).
- Поле «Payment description» (default из settings, можно override).
- Кнопки **Export CSV / Export Excel** — генерируют файл только для строк без блокеров, с галкой «Include warnings».
- Доступ только при статусе `Approved` или `Paid`.

### 2.7 Journal — `src/pages/payroll/JournalPage.tsx`
- Сводная Dr/Cr таблица + сверка `Σ Dr = Σ Cr`. Если != 0 — красный alert.
- Категории строго из ТЗ §8 (gross, SDL, WCF, employer pension; payable: GEPF/NSSF/PAYE/SDL/WCF/pension; deductions: cash, advances, missing, gepf loan; net).
- Export Excel.

### 2.8 Settings — `src/pages/payroll/SettingsPage.tsx`
- `FormGrid` с полями: hours_per_month, standard_day_hours (новое в settings), night_hours_per_day, night_rate_pct, off_day_multiplier, gepf_pct, nssf_employee_pct, nssf_employer_pct, sdl_pct, wcf_pct, holiday_method, default_payment_description.
- Под ним — таблица **PAYE Brackets** с inline‑редактированием (lower / upper / base tax / rate). Сохранение создаёт новую строку `payroll_settings` / `payroll_paye_brackets` с `effective_from = today`, не ломая историю.
- Сверху алерт «Changes apply only to periods created after <date>».

### 2.9 Dashboard — `src/pages/payroll/DashboardPage.tsx`
- Карточки: Total Employees, Total Basic, Total Gross, Total PAYE, Total NSSF, Total Advances, Total Deductions, Total Net Payable, Status badge.
- 3 графика (recharts уже в проекте): **Gross by Department (bar)**, **Net by Department (bar)**, **Deductions by Type (donut)**.
- Селектор периода (карусель месяцев, такой же как в Period view).

---

## 3. Хуки и помощники

**New**
- `src/hooks/use-payroll-settings.ts` — чтение/запись `payroll_settings` + brackets.
- `src/hooks/use-payroll-bank-export.ts` — чтение view + валидации.
- `src/components/payroll/MonthCarousel.tsx` — общая карусель, реюзает `payroll_create_period` если периода нет.
- `src/components/payroll/StatusBadge.tsx` — 4 статуса.
- `src/components/payroll/DepartmentSubtotals.tsx` — строка‑итог в `DataTable`.
- `src/lib/payroll-pdf.ts` — генерация salary slips PDF (jspdf + autotable).
- `src/lib/payroll-bank-validations.ts` — типы/иконки warning.

**Edited**
- `src/hooks/use-payroll.ts` — расширить `Employee` (employee_number — добавить колонку), `PayrollPeriod` статусы, добавить `useMarkReviewed/Approved/Paid`.
- `src/lib/payroll-exports.ts` — добавить `payment_description`, шапки employer в NSSF/WCF, Journal balance check.
- `src/components/layout/AppSidebar.tsx` — секция Payroll по пункту выше.
- `src/App.tsx` — все новые роуты.
- `src/lib/route-module-map.ts`, `src/lib/modules.ts`, `docs/ACCESS-MATRIX.md` — новые модули `payroll-dashboard`, `payroll-slips`, `payroll-nssf`, `payroll-paye`, `payroll-wcf`, `payroll-bank`, `payroll-journal`, `payroll-settings` + новые роли.
- `package.json` — добавить `jspdf`, `jspdf-autotable`; патч‑бамп.

---

## 4. Зависимости (одноразово)
- `jspdf`, `jspdf-autotable` — для bulk PDF salary slips.
- `recharts` — уже стоит.
- `xlsx` — уже стоит.

---

## 5. Вне scope этой задачи

- Отдельный модуль employee_number (если HR хочет генератор) — если не указано иное, добавляем как text без авто‑генерации.
- Multi‑company / multi‑branch на уровне «компания над казино» — у нас `casino_id` уже играет роль branch; добавляем `branch_label` как свободный текст для отображения, без новой иерархии.
- Fingerprint/biometric attendance — часы тянем из существующего `get_monthly_attendance`.
- Email salary slips — позже, требует SMTP.

---

## 6. Память (после билда)
- `mem://features/payroll-workflow-v2` — 4 статуса, роли, RPC.
- `mem://features/payroll-settings` — конфигурируемые брэкеты PAYE и off_day_multiplier.
- `mem://features/payroll-pages-map` — карта страниц и URL.

---

## 7. Файлы (итог)

**Миграции**
- `supabase/migrations/<ts>_payroll_full.sql`

**Новые страницы**
- `src/pages/payroll/DashboardPage.tsx`
- `src/pages/payroll/SalarySlipsPage.tsx`
- `src/pages/payroll/NssfPage.tsx`
- `src/pages/payroll/PayeSdlPage.tsx`
- `src/pages/payroll/WcfPage.tsx`
- `src/pages/payroll/BankExportPage.tsx`
- `src/pages/payroll/JournalPage.tsx`
- `src/pages/payroll/SettingsPage.tsx`

**Новые компоненты/хуки/либы**
- `src/components/payroll/MonthCarousel.tsx`
- `src/components/payroll/StatusBadge.tsx`
- `src/components/payroll/DepartmentSubtotals.tsx`
- `src/hooks/use-payroll-settings.ts`
- `src/hooks/use-payroll-bank-export.ts`
- `src/lib/payroll-pdf.ts`
- `src/lib/payroll-bank-validations.ts`

**Изменения**
- `src/pages/payroll/PayrollPeriodPage.tsx` (главная таблица + subtotals + новый workflow)
- `src/pages/Payroll.tsx` (список периодов + кнопка New + статусы)
- `src/hooks/use-payroll.ts`
- `src/lib/payroll-exports.ts`
- `src/components/layout/AppSidebar.tsx`
- `src/App.tsx`
- `src/lib/route-module-map.ts`, `src/lib/modules.ts`, `docs/ACCESS-MATRIX.md`
- `package.json`
