## Цель

Сделать **Staff Master** единым каталогом всего персонала Arusha (~69 человек) с правильной структурой департаментов и видимыми колонками онбординга/контракта/стажа.

## Шаг 1 — Миграция БД

**Расширить `employees`:**
- `onboarding_date date` — реальная дата найма (отдельно от employment_date)
- `contract_end date` — окончание контракта
- `dealer_category text` — `dealer` / `inspector` / `trainee` (NULL для не-pit)
- `is_pit_boss boolean default false`
- `source_table text` — `staff_members` или `dealers` (для будущих ре-импортов)

**Группировка департаментов:** добавить хелпер-функцию или хранить готовый `dept_group text` (Pit / Floor / Security / Office), вычисляемый при импорте:
- `Pit` ← все из `dealers` (department='pit', position = "Pit Boss" / "Dealer" / "Inspector" / "Trainee")
- `Floor` ← cashier, bartender, hostess, waiter, cleaner, reception
- `Security` ← security
- `Office` ← it, hr, driver

`employment_date` = `onboarding_date` (для совместимости со старым UI/payroll).

## Шаг 2 — RPC `reimport_staff_master(p_casino_id uuid)`

Полная переинициализация для одной казино:
1. Удалить `employee_bank_accounts` и `employees` где `casino_id = p_casino_id` (BANK данные сейчас пусты у всех — потеря несущественна).
2. Вставить заново из `staff_members`:
   - position = department label (Cashier, Waiter, Bartender, …)
   - department = `dept_group` (Floor / Security / Office)
   - onboarding_date, contract_start, contract_end, photo_url, salary, is_active → payroll_status
3. Вставить из `dealers`:
   - department = `Pit`
   - position = `Pit Boss` (если is_pit_boss) иначе `Dealer` / `Inspector` / `Trainee` (по category)
   - dealer_category, is_pit_boss
   - onboarding_date, contract_start, contract_end, photo_url, salary, is_active → payroll_status
4. Связь `staff_member_id` сохраняется только для строк из staff_members (для dealers создадим колонку `dealer_id` для будущей синхронизации).

Запустить RPC для Arusha (`48f4404f-...`) сразу после миграции.

## Шаг 3 — UI Staff Master

Перестроить `src/pages/StaffMaster.tsx`:

**Группировка по департаментам** (Pit → Floor → Security → Office) с заголовками-разделителями в `DataTable`.

**Новые колонки:**
| Photo | Name | Position | Department | Onboarding | Tenure | Contract Start | Contract End | Salary | Bank | Acc # | NSSF | Tax ID | Status | ⋮ |

- **Onboarding** = `onboarding_date`, формат DD/MM/YYYY (`fmtDate`)
- **Tenure** = years since onboarding (1 знак после запятой, `5.3y`)
- **Pit Boss / Category** — бейдж рядом с Position для dept=Pit (PB / D / I / T)
- Salary — формат с пробелом (1 250 000)

**Editor Dialog:** добавить поля Onboarding Date, Contract End, Pit Boss toggle (если department=Pit), dropdown Position по департаменту.

## Шаг 4 — Хук `use-payroll.ts`

Расширить `Employee`:
```ts
onboarding_date: string | null;
contract_start: string | null;
contract_end: string | null;
dealer_category: 'dealer'|'inspector'|'trainee'|null;
is_pit_boss: boolean;
```

`useUpsertEmployee` — пишет новые поля.

## Шаг 5 — Версия

Bump `package.json` patch (миграция + RPC).

## Что НЕ меняем

- `staff_members` и `dealers` остаются основными источниками для рота / breaklist / pit-rota — они не трогаются.
- Bank / NSSF / Tax ID — они и так пусты, HR заполняет вручную через диалог.
- Payroll periods/entries — структура не меняется, они продолжают читать `employees`.

## Технические детали для проверки

- Проверить, что `department text` в `employees` примет новые значения (Pit/Floor/Security/Office) — это `text` без CHECK, значит ок.
- RLS на employees уже разрешает HR/Manager — RPC будет SECURITY DEFINER чтобы выполнить полную замену атомарно.
- После RPC запустить контрольный SELECT: ожидаем 40 + 29 = **69 строк** для Arusha, разбиение Pit=29 / Floor=30 / Security=6 / Office=4.
