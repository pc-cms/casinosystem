## Staff Master — full Excel-template parity

Привожу таблицу и редактор сотрудника к точному набору колонок из загруженного Excel-шаблона (32 колонки, включая вычисляемые).

### Маппинг колонок шаблона → схема `employees`

| # | Колонка шаблона | Откуда берётся |
|---|---|---|
| 1 | S/N | вычисл. (порядковый номер в группе) |
| 2 | Name | `full_name` ✅ |
| 3 | Remain Days | вычисл. = Earned − Used − Sold |
| 4 | Department | `department` ✅ |
| 5 | Position | `position` ✅ |
| 6 | **Contract Type** (PM / FT / PT…) | **новое поле** `contract_type` |
| 7 | Basic Salary | `basic_salary` ✅ |
| 8 | Joining Date | `onboarding_date` ✅ |
| 9 | Experience YY | вычисл. (сегодня − Joining Date, в годах с десятичной) |
| 10 | **Birthday** | **новое** `birthday date` |
| 11 | Ages | вычисл. из Birthday |
| 12 | **Phone** | **новое** `phone text` |
| 13 | **Job Description** | **новое** `job_description text` |
| 14 | **General Details** | **новое** `general_details text` |
| 15 | **Introduct to Work** | **новое** `intro_to_work boolean` |
| 16 | **Staff Rules** | **новое** `staff_rules_acknowledged boolean` |
| 17 | **Disciplinary Proced** | **новое** `disciplinary_acknowledged boolean` |
| 18 | **Confid Agreement** | **новое** `confidentiality_agreement boolean` |
| 19 | Contract Start Date | `contract_start` ✅ |
| 20 | Contract End Date | `contract_end` ✅ |
| 21 | Contract End Month | вычисл. (= Contract End, формат MMM YYYY) |
| 22 | **Annual Leave Earned** | **новое** `annual_leave_earned numeric` |
| 23 | **Annual Leave Used** | **новое** `annual_leave_used numeric` |
| 24 | **Annual Leave Sold** | **новое** `annual_leave_sold numeric` |
| 25 | **Corporate Mail** | **новое** `corporate_mail text` |
| 26 | **Gender** | **новое** `gender text` ('M'/'F') |
| 27 | **Nationality** | **новое** `nationality text` |
| 28 | **License Type** | **новое** `license_type text` |
| 29 | **License Availability** | **новое** `license_available boolean` |
| 30 | **Pass Date** (license expiry) | **новое** `license_pass_date date` |
| 31 | To Renew Days | вычисл. = Pass Date − today |
| 32 | **Uniform** | **новое** `uniform_issued boolean` |

Итого **17 новых полей** (14 хранимых + 3 уже на месте) и **6 вычисляемых на лету** в UI.

### Изменения

**1. Migration (ALTER TABLE employees)**
Добавить 17 колонок (типы выше). Все nullable, без значений по умолчанию (кроме boolean → false). Никаких данных не теряется. RLS уже настроен.

**2. UI — таблица `/staff-master`**
Перестроить `DataTable`:
- 32 колонки в порядке шаблона.
- Горизонтальный скролл (`overflow-x-auto`), `text-xs font-mono` для плотности.
- Вычисляемые колонки помечены тонкой `bg-muted/30` (визуально отличаются от ручных полей — стандарт «calculated vs manual»).
- Boolean → "Yes"/"·" (тёмная точка для пустоты).
- `Remain Days` и `To Renew Days` — красные при отрицательных, зелёные при положительных.
- `fmtDate` для всех дат (DD/MM/YYYY).
- `fmt(n)` (пробел-разделитель) для зарплаты.

**3. UI — `EmployeeEditorDialog`**
Реорганизовать в **5 секций** (через `PageSection`-подобные блоки внутри Dialog):
1. **Identity** — Full Name, Gender, Birthday, Nationality, Phone, Corporate Mail
2. **Position** — Department, Position, Contract Type, Pit fields (если Pit)
3. **Contract & Salary** — Joining Date, Contract Start/End, Basic Salary, Status
4. **Leave** — Earned, Used, Sold (Remain показан рядом, read-only)
5. **Compliance & Other** — все 4 boolean (чекбоксы), License Type/Availability/Pass Date, Uniform, Job Description, General Details (textarea)
6. **Bank & Tax** — оставить как есть (NSSF, Tax ID, GEPF, Bank).

Layout: `FormGrid` 2-колоночная, textarea — full width.

**4. Хук `useEmployees` / `useUpsertEmployee`**
Расширить тип `Employee` 17-ю новыми полями. Прокинуть в select/insert/update. Обновится автогенерируемый `types.ts` после миграции.

**5. Версия**
`package.json` → 1.0.153 (миграция БД).

### Чего **не** делаем (уже подтверждено ранее)
- Двусторонние триггеры sync `employees ↔ dealers/staff_members` — это отдельная задача.
- Замена `reimport_staff_master` на UPSERT — отдельная задача.
- Импорт из текущего Excel в `employees` — могу добавить отдельной кнопкой позже, если нужно.

### Проверка после реализации
- Открыть `/staff-master`, убедиться что отображаются все 32 колонки.
- Создать тестового сотрудника, заполнить все поля, проверить вычисляемые (Ages, Tenure, Remain Days, To Renew, Contract End Month).
- Проверить, что старые сотрудники остались целы (новые поля = null/false).

Подтверди — начну с миграции.
