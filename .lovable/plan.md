## Goal

Превратить Staff Master в Excel-подобную таблицу с inline-редактированием, прилипшими колонками, корректным импортом всех колонок шаблона и без модалок добавления/редактирования.

---

## 1. DB migration — FK-safe wipe + nullable name parts

```sql
-- Allow hard-delete of employees while preserving payroll history (snapshot fields stay)
ALTER TABLE public.payroll_entries
  DROP CONSTRAINT IF EXISTS payroll_entries_employee_id_fkey;
ALTER TABLE public.payroll_entries
  ADD CONSTRAINT payroll_entries_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.payroll_entries
  ALTER COLUMN employee_id DROP NOT NULL;
```

Аналогично снимаем NOT NULL/каскад с любых других FK на `employees(id)`, найденных линтером (`shift_assignments`, `attendance`, `dealer_id` ссылки и т. п.) — все становятся `ON DELETE SET NULL`. Никаких новых колонок (`first_name`/`last_name` не добавляем — split только в UI).

Bump `package.json` patch.

---

## 2. Справочники (новый файл `src/lib/staff-dictionaries.ts`)

```ts
export const DEPARTMENTS = ["Office","Cash Desk","Live Game","Slots","Bar","Security","Housekeeper"] as const;

export const POSITIONS_BY_DEPT: Record<string, string[]> = {
  "Live Game":   ["Dealer","Inspector","Trainee","Pit Boss"],
  "Cash Desk":   ["Cashier","Head Cashier"],
  "Slots":       ["Waiter","Hostess"],
  "Bar":         ["Bartender"],
  "Security":    ["Security","Supervisor Security"],
  "Office":      ["IT","HR"],
  "Housekeeper": [],
};

// Live Game category derives from position: Dealer→D, Inspector→I, Trainee→T, Pit Boss→PB(+is_pit_boss)
```

Sidebar `Pit Boss` → `is_pit_boss=true` + `dealer_category=null` ставит DB-логика; в UI устанавливаем оба поля при выборе Position в Live Game.

---

## 3. Импорт из Excel — все колонки + sticky preview

`src/lib/staff-master-import.ts`: добавить недостающие поля шаблона (если в файле есть — парсим; иначе `null/0`):
- `nssf_number`, `tax_id`, `gepf_number`, `gepf_loan` (если присутствуют)
- сплит позиции на `is_pit_boss`/`dealer_category` по словам "Pit Boss"/"Dealer"/…
- bank: `bank_name`, `bank_code`, `branch_code`, `account_number` (если в шаблоне есть колонки) → возвращаем как опциональный `bank` объект.

Preview-диалог (вместо текущего «summary»):
- Полная таблица всех 32+ колонок parsed-данных.
- `position: sticky` для первых ДВУХ колонок (S/N, Full Name) + горизонтальный скролл (`overflow-x-auto`, `min-w-max`).
- Сверху строка-итог: «Parsed N · Existing M · ⚠ Wipe will delete M employees». Кнопки `Cancel` / `Import N (replace all)`.
- Wipe идёт через `delete().eq("casino_id", id)` — теперь работает благодаря миграции.

---

## 4. Главная таблица — Excel-style inline edit

Перестроить `src/pages/StaffMaster.tsx`:

### Layout
- Удалить `EmployeeEditorDialog` целиком и кнопку «Add Employee», открывающую модалку.
- Удалить кнопку-карандаш в строке.
- Внешний контейнер: `overflow-auto max-h-[calc(100vh-...)]` + `min-w-max` внутри таблицы.
- **Sticky columns** (через `position: sticky; left: …; z-index: 2; background`):
  1. S/N (`left-0`, ~40px)
  2. First Name (~140px)
  3. Last Name (~160px)
- Sticky header (`sticky top-0`).
- Первый столбец каждой группы — заголовок отдела (`bg-muted/50`) тоже sticky.

### Колонки (33 шт.) — точно как сейчас, но `Name` → `First Name` + `Last Name`
Split на лету: первое слово = First, остальные = Last. Save: склеиваем обратно в `full_name`.

### Click-to-edit
Создать компонент `EditableCell` (новый файл `src/components/staff-master/editable-cell.tsx`):
- Props: `value`, `onSave(next)`, `type: "text"|"number"|"date"|"yesno"|"select"`, `options?`.
- Обычный режим: рендерит значение или `·`.
- Клик / Enter / F2: переходит в режим input/select/date с автофокусом и выделением.
- `Enter` или blur → save (через `useUpsertEmployee` debounce). `Esc` → cancel. `Tab` → save + focus следующая editable-ячейка справа. `Shift+Tab` ← влево. `↑`/`↓` — переход по строкам.
- Yes/No — toggle через клик (без режима ввода).
- Photo, S/N, Remain, Exp YY, Age, End Mon, Renew — read-only (calc).
- `dealer_category`/`is_pit_boss` редактируется неявно через Position (Live Game). Для прочих отделов скрыто.

### Bottom "add row"
- Внизу таблицы (после `Other`): постоянная пустая строка с inputs во всех 30+ редактируемых ячейках, S/N показывает `+`.
- Минимум для создания: First Name + Last Name + Department + Position. После сохранения (Enter в любой ячейке или авто-blur при заполненных required) → инсёрт через `useUpsertEmployee`, строка очищается, фокус возвращается на First Name.
- Помечена `bg-primary/5` визуально.

### Группировка
Сохраняем секции по `department` в текущем `DEPT_ORDER`. Pit Boss в Live Game (как сейчас).

---

## 5. Версия

`package.json` — patch bump (есть миграция).

---

## Files

**Created**
- `src/lib/staff-dictionaries.ts`
- `src/components/staff-master/editable-cell.tsx`
- `supabase/migrations/<ts>_employees_fk_set_null.sql`

**Edited**
- `src/pages/StaffMaster.tsx` (большой рефакторинг: убрать модалку, sticky, inline-edit, bottom add-row, split name)
- `src/lib/staff-master-import.ts` (все колонки + sticky preview заголовки)
- `src/hooks/use-payroll.ts` (мелко — позволить partial inline-saves single-field; ничего не ломаем)
- `package.json`

**Deleted (внутри `StaffMaster.tsx`)**
- `EmployeeEditorDialog`, `Section`, кнопка «Add Employee», иконка-карандаш.

---

## Out of scope
- Reorder/resize колонок, фильтры, сортировка, поиск — не трогаем.
- Photo upload — оставляем как есть (PhotoBadge в первой видимой sticky-колонке S/N? — нет, оставим как сейчас в отдельной micro-колонке слева от S/N, тоже sticky `left-0`, S/N тогда `left-10`).
- Bank-аккаунты в inline-edit не выносим (там есть отдельный Payroll-экран).
