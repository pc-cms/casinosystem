## Цель

Безопасно мигрировать `breaklist`, `staff_rota`, `staff_attendance` со старых таблиц `dealers` / `staff_members` на единый `employees` (Staff Master), сохранив всю историю и не сломав Pit / Rota / Attendance / Payroll.

---

## Текущее состояние (по данным)

- **FK отсутствуют** — все ссылки сейчас «loose uuid» (нет ни одного `pg_constraint` с `confrelid in (dealers, staff_members, employees)`).
- `dealers`: 29 записей, **все 29** уже имеют пару в `employees.dealer_id`.
- `staff_members`: 40 записей, **39** связаны через `employees.staff_member_id`, **1 сирота**.
- `breaklist`: 5 809 строк, `dealer_id` → `dealers`, **0 orphans**.
- `staff_rota`: 1 247 строк, `staff_id` → `staff_members`, **0 orphans**.
- `staff_attendance`: 195 строк, `staff_id` → `staff_members`, **0 orphans**.
- Код, читающий старые id: `use-dealers.ts`, `use-staff.ts`, `BreaklistGrid.tsx`, `Pit.tsx`, `Staff.tsx`, `AttendanceMonthly.tsx`, `WeeklyBonus.tsx`, `Dashboard.tsx`, `Incidents.tsx`, `use-attendance-monthly.ts`, `use-weekly-bonus.ts`, `use-payroll.ts`, `use-log-lookups.ts`.

Хорошая новость: связи 1:1 уже в `employees`, и достаточно «перевернуть» направление — сделать `employees.id` целевым ключом во всех трёх журналах.

---

## Стратегия: 4 фазы, каждая обратима до фазы 4

```
Phase 1: Подготовка/закрытие сирот     (1 миграция, безопасно)
Phase 2: Backfill ID + двойная запись  (1 миграция + код)
Phase 3: Переключение чтений на employees (только код)
Phase 4: Drop старых таблиц            (1 миграция, точка невозврата)
```

---

## Phase 1 — Подготовка

**Миграция `phase1_staff_master_prep.sql`:**

1. Найти 1 сироту `staff_members` (без `employees.staff_member_id`) и создать для неё `employees` (department/position по `staff_members.department`, через map `security→Security`, `cashier→Cash Desk/Cashier`, и т.д.). Проставить `employees.staff_member_id = sm.id`.
2. Добавить колонки-приёмники:
   ```sql
   ALTER TABLE breaklist        ADD COLUMN employee_id uuid;
   ALTER TABLE staff_rota       ADD COLUMN employee_id uuid;
   ALTER TABLE staff_attendance ADD COLUMN employee_id uuid;
   ```
3. Индексы: `(casino_id, employee_id, date)` на rota/attendance, `(casino_id, employee_id, date, time_slot)` на breaklist.
4. Sanity-view `v_staff_master_legacy_map` — для отладки соответствия.

Код не трогается. Откат тривиальный (drop column).

---

## Phase 2 — Backfill + двойная запись

**Миграция `phase2_staff_master_backfill.sql`:**

1. Backfill единым `UPDATE` без блокировок чтения:
   ```sql
   UPDATE breaklist b SET employee_id = e.id
     FROM employees e WHERE e.dealer_id = b.dealer_id;
   UPDATE staff_rota r SET employee_id = e.id
     FROM employees e WHERE e.staff_member_id = r.staff_id;
   UPDATE staff_attendance a SET employee_id = e.id
     FROM employees e WHERE e.staff_member_id = a.staff_id;
   ```
2. Verify: после backfill `count(*) WHERE employee_id IS NULL` = 0 во всех трёх (assertion в миграции).
3. **Триггеры двойной записи** (на `BEFORE INSERT/UPDATE`) — пока код пишет старые id, триггер автоматически проставляет `employee_id`; и наоборот, если кто-то начнёт писать `employee_id` без legacy id, триггер заполнит legacy. Это даёт zero-downtime переход.
4. Добавить **реальные FK** на `employees(id) ON DELETE RESTRICT` для `employee_id` (теперь это безопасно — данные чистые). Старые `dealer_id` / `staff_id` остаются без FK.
5. Bump version (есть миграция).

Откат: drop trigger + drop FK + nullify employee_id. История не страдает.

---

## Phase 3 — Переключение кода (без миграций)

Только UI/hooks. Каждый шаг — отдельный коммит, проверяемый отдельно.

1. **`use-dealers.ts`** → читать `employees WHERE department='Live Game'`, маппить в текущий `Dealer` shape (`category` ← `dealer_category`, `is_pit_boss`, `name` ← `full_name`, `id` ← `employees.id`).
2. **`use-staff.ts`** → читать `employees WHERE department <> 'Live Game'`. Сохранить публичный API (`StaffMember`, `useStaffMembers`, `useStaffRotaRange`, `useStaffAttendanceRange`).
3. **`BreaklistGrid.tsx` / `Pit.tsx`**: при upsert breaklist писать `employee_id` (legacy `dealer_id` пишется триггером). При чтении группировать по `employee_id`. `useDealers` всё так же возвращает «дилеров» — но id уже от `employees`.
4. **`Staff.tsx` / Rota / Attendance**: `useSetStaffRota`, `useSetStaffAttendance`, `useDeleteStaffRota` → upsert по `(casino_id, employee_id, date)` (после Phase 4 уберём `staff_id`-колонку). Ключ кэша остаётся прежним.
5. **`AttendanceMonthly.tsx` + `use-attendance-monthly.ts`**, **`WeeklyBonus.tsx` + `use-weekly-bonus.ts`**, **`Dashboard.tsx`** (метрики active staff), **`Incidents.tsx`** (`employee_id` уже там), **`use-log-lookups.ts`** (resolve имён) — заменить join по старым id на `employee_id`.
6. **`use-payroll.ts`** уже работает с `employees` — без изменений; добавить inline-проверку, что больше нет вызовов `staff_members.delete()` из UI.
7. **Backward compat**: `useUpdateStaffMember`, `useDeleteStaffMember`, `useCreateStaffMember` маршрутизируем на `employees` (через `usePatchEmployee`/`useDeleteEmployee` из `use-payroll`).

Между шагами — приложение работает: триггеры обеспечивают, что запись и в старом, и в новом ключе всегда совпадает.

Bump patch на каждом коммите-шаге не нужен (нет миграций). Один patch bump в конце фазы 3 за «переключение чтений».

---

## Phase 4 — Точка невозврата (через 1–2 рабочих дня после Phase 3)

После того как Pit / Rota / Attendance отработали как минимум одну business-day закрытую и в логах нет ошибок:

**Миграция `phase4_staff_master_finalize.sql`:**

1. Удалить триггеры двойной записи.
2. `ALTER TABLE breaklist DROP COLUMN dealer_id;`
   `ALTER TABLE staff_rota DROP COLUMN staff_id;`
   `ALTER TABLE staff_attendance DROP COLUMN staff_id;`
3. `ALTER TABLE ... ALTER COLUMN employee_id SET NOT NULL;`
4. `DROP TABLE staff_members;`
5. `DROP TABLE dealers;` (предварительно перенеся `employees.dealer_id`/`staff_member_id` в `employees.legacy_dealer_id`/`legacy_staff_member_id` как `text` на случай аудита, либо просто DROP COLUMN если не нужны).
6. `employees.source_table` оставить — это уже исторический маркер.
7. Удалить `use-staff.ts` и `use-dealers.ts` полностью **нельзя** (на них завязаны типы) — оставить как тонкие обёртки над `use-payroll.ts`, либо выпилить и заменить импорты (грязный, но финальный шаг).
8. Bump minor (большая зачистка).

Откат фазы 4 = restore из бэкапа. До фазы 4 откат — это просто отключить триггеры и вернуть код.

---

## Файлы

**Новые миграции (по одной за фазу):**
- `supabase/migrations/<ts1>_staff_master_prep.sql`
- `supabase/migrations/<ts2>_staff_master_backfill.sql`
- `supabase/migrations/<ts4>_staff_master_finalize.sql` (после ручной приёмки)

**Меняем в Phase 3:**
- `src/hooks/use-dealers.ts`
- `src/hooks/use-staff.ts`
- `src/hooks/use-attendance-monthly.ts`
- `src/hooks/use-weekly-bonus.ts`
- `src/hooks/use-log-lookups.ts`
- `src/components/pit/BreaklistGrid.tsx`
- `src/pages/Pit.tsx`, `src/pages/Staff.tsx`, `src/pages/AttendanceMonthly.tsx`, `src/pages/WeeklyBonus.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Incidents.tsx`

---

## Риски и контроль

| Риск | Защита |
|---|---|
| Сирота `staff_members` потеряется | Phase 1 явно создаёт для неё `employees` |
| Breaklist «переехал» на чужого employee | После Phase 2 — assertion `WHERE employee_id IS NULL = 0`; ручная сверка count по dealer |
| Старый код пишет, новый читает | Триггеры двойной записи в Phase 2 |
| Кто-то delete employee во время Phase 3 | FK `ON DELETE RESTRICT` блокирует |
| Откат после Phase 4 | Только бэкап — поэтому Phase 4 запускаем отдельной командой пользователя |

---

## Что НЕ делается

- Не трогаем `incidents.employee_id` (уже корректное).
- Не трогаем `payroll_entries` (уже на `employees`).
- Не объединяем `staff_rota` и breaklist в одну таблицу — у них разная семантика (день vs слот).
- Не вводим новых ролей / прав / UI-фич — это чистая миграция данных и переключение источника.
