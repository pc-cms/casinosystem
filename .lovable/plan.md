## Цель

Полностью очистить таблицу `employees` для активного казино и заново заполнить её из загруженного файла `template-2.xlsx` (54 сотрудника, 32 колонки).

## Что в файле

- 54 строки, 8 департаментов: **Live Game, Slots, F&B, Cash Desk, Security, Housekeeper, Management, Office**
- 12 позиций (Dealer, APB, Cashier, Shift Manager, Bar Tender, Cleaner, Slot Attendant, Hostes, Slots Supervisor, Security Officer, Maasai, HR Manager)
- Все на контракте `PM`
- License Type: `Key` / `Support`
- Compliance-флажки приходят как `"Yes"` / пусто

## Маппинг колонок шаблона → `employees`

| Шаблон | Поле БД | Заметки |
|---|---|---|
| Name | `full_name` | trim |
| Department | `department` | как есть, free-text |
| Position | `position` | |
| Contract Type | `contract_type` | "PM" |
| Basic Salary | `basic_salary` | numeric |
| Joining Date | `onboarding_date` | date |
| Birthday | `birthday` | date |
| Phone | `phone` | очистить ведущий `/` |
| Job Descrit / General Details | `job_description` / `general_details` | как текст ("Yes" сохраняется) |
| Introduct to Work / Staff Rules / Displinary / Confid Agree | `intro_to_work`, `staff_rules_acknowledged`, `disciplinary_acknowledged`, `confidentiality_agreement` | `"Yes"` → true, иначе false |
| Contract Start / End | `contract_start`, `contract_end` | |
| Annual Leave Earned/Used/Sold | `annual_leave_earned`, `_used`, `_sold` | numeric |
| Corprtv Mail | `corporate_mail` | |
| Gender (M/F) | `gender` | |
| Nationality | `nationality` | |
| License Type | `license_type` | |
| License Avalability | `license_available` | `"Yes"` → true |
| Pass Date | `license_pass_date` | |
| Uniform | `uniform_issued` | `"Yes"` → true |

Игнорируем расчётные: S/N, Remain Days, Experience-YY, Ages, Contract End Month, To Renew Days.

Поля, которых нет в шаблоне (`nssf_number`, `tax_id`, `gepf_number`, `bank`, `photo_url`, `dealer_category`, `is_pit_boss`), не трогаем — оставляем `null/false`.

## Реализация

### 1. UI на странице `/staff-master`

Добавить рядом с **Reimport** новую кнопку **«Import from Excel…»** (только для HR/Manager/Super Admin).

Поток:
1. Открывает `<input type="file" accept=".xlsx">`.
2. Парсит локально через **ExcelJS** (уже в проекте после замены xlsx).
3. Показывает диалог-превью: «Будет удалено N текущих записей и импортировано 54 новых». Чекбокс **«Wipe existing employees for this casino»** (по умолчанию on).
4. По подтверждению:
   - Если wipe: `supabase.from('employees').delete().eq('casino_id', activeCasinoId)`.
   - Bulk `insert` нарезанными чанками по 100.
5. Toast с итогом + invalidate `["employees"]`.

Никаких миграций / RPC / триггеров — всё клиентом, чтобы оставаться в духе «manual entry, no smart logic».

### 2. Файл с парсером

Новый `src/lib/staff-master-import.ts`:

```ts
export type StaffRow = Partial<Employee> & { full_name: string };
export async function parseStaffMasterXlsx(file: File): Promise<StaffRow[]>
```

- Использует ExcelJS `Workbook.xlsx.load(buffer)`.
- Берёт первый лист, строки начиная со 2-й.
- Хелперы: `toBool(v) = v === 'Yes'`, `toDate(v)`, `toNum(v)`, `cleanPhone(v) = String(v).replace(/^\/+/, '').trim()`.
- Возвращает массив строк, готовых к `useUpsertEmployee` (но импорт делаем bulk-insert напрямую, без upsert).

### 3. Department list

В `StaffMaster.tsx` расширить `DEPT_ORDER` до полного набора: `["Management", "Office", "Cash Desk", "Live Game", "Slots", "F&B", "Security", "Housekeeper"]`, чтобы группировка показывала все секции в естественном порядке.

### 4. Версия

Бамп `package.json` → `1.0.154`.

## Что НЕ делаем

- Не трогаем `dealers` / `staff_members` — Staff Master живёт независимо.
- Не делаем UPSERT-merge по имени — пользователь явно хочет очистку.
- Не сохраняем шаблон в репозитории.
- Не меняем схему БД.

## Файлы

- `src/pages/StaffMaster.tsx` — кнопка + диалог импорта, расширенный DEPT_ORDER
- `src/lib/staff-master-import.ts` — новый парсер
- `package.json` — версия
