## Что делаем

Единая система **планирования и блокировки** для всех четырёх рот: Pit (Live Game), Floor, Security, Office.

Три задачи в одном:
1. **Планирование на следующий месяц** — кнопка навигации «next month» во всех ротах (сейчас работает только в Pit).
2. **Lock / Unlock на месяц** — Manager / HR / Super Admin могут залочить/разлочить целый месяц. Когда залочено — все правки запрещены на уровне БД.
3. **Роль на момент даты** — если Abraham был Inspector в мае и стал Pit Boss с 1 июня, в майской роте он показан в секции Inspector, в июньской — в секции Pit Boss. История роли ведётся автоматически.

---

## Схема БД (1 миграция)

### 1. `employee_role_history` — история ролей
```sql
employee_id, effective_from (date), department, position, dealer_category, is_pit_boss
PRIMARY KEY (employee_id, effective_from)
```
- Триггер на `employees` UPDATE: если изменилось `department / position / dealer_category / is_pit_boss` — пишем новую строку с `effective_from = CURRENT_DATE`.
- Seed: одна строка на каждого текущего сотрудника с `effective_from = COALESCE(onboarding_date, employment_date, created_at::date)`.

### 2. Функция `employee_role_at(employee_id, on_date)`
Возвращает `(department, position, dealer_category, is_pit_boss)` — последняя запись истории с `effective_from <= on_date`.

### 3. `rota_locks` — блокировки месяца
```sql
casino_id, scope ('pit' | 'floor' | 'security' | 'office'),
month (date, всегда первое число),
locked_by, locked_at
PRIMARY KEY (casino_id, scope, month)
```
- Запись = месяц залочен. Удаление = разлочен. История lock/unlock пишется отдельно в `operational_logs`.

### 4. Триггер-страж на `pit_rota` / `staff_rota`
BEFORE INSERT/UPDATE/DELETE: если для `(casino_id, scope, date_trunc('month', NEW.date))` есть строка в `rota_locks` — `RAISE EXCEPTION 'Rota is locked for this month'`. Scope для `pit_rota` всегда `'pit'`; для `staff_rota` определяется по `employee.department / position` (через mapping floor / security / office).

### 5. RLS на `rota_locks`
- SELECT: все авторизованные пользователи casino.
- INSERT / DELETE: только `manager`, `hr`, `super_admin` (через `has_role`).

---

## Фронт

### Хуки (`src/hooks/use-rota-lock.ts`)
- `useRotaLock(scope, month)` → `{ isLocked, lockedBy, lockedAt }`
- `useLockRota()` / `useUnlockRota()` мутации.

### Компонент `<RotaLockButton scope month />`
Размещается в шапке рота-вкладки рядом с навигацией месяца:
- Незалочено → бейдж `Unlocked` + кнопка `Lock month` (видна только manager / hr / super_admin).
- Залочено → бейдж `🔒 Locked by {name} · DD/MM/YYYY` + кнопка `Unlock` (только те же роли). Для остальных — просто бейдж.

### Поведение грида
- Когда `isLocked === true` → весь грид рендерится с `readOnly={true}` (уже поддерживается в Pit; добавим в Staff). Клавиатура, paste, click — всё игнорируется. Гард на мутациях тоже сработает (двойная защита).
- Кнопка `Next month` доступна для **текущего + следующего месяца** (как уже сделано в Pit). Применим то же правило в Staff rota (сейчас отсутствует).

### Группировка по роли-на-дату
В `RotaGrid` (Pit) и в группах Floor/Security/Office:
- Сортируем сотрудников не по `employees.department/position` напрямую, а через `employee_role_at(id, month_start)`.
- Дозагрузка: один запрос `SELECT employee_id, department, position, dealer_category, is_pit_boss FROM employee_role_at_bulk(:casino_id, :month_start)` (SQL-функция возвращает таблицу).
- Pit-роте: секции Dealer / Inspector / Trainee / Pit Boss формируются по `position` на 1-е число месяца.
- Staff-ротам: группа (Floor / Security / Office) определяется тем же способом.
- Сотрудник, ещё не нанятый на 1-е число → скрыт.
- Сотрудник, уволенный (`payroll_status='inactive'`) до 1-го числа → скрыт.

### Где применяется
- `src/pages/Pit.tsx` — RotaGrid (Live Game).
- `src/pages/Staff.tsx` — три rota-вкладки (Floor / Security / Office).
- Добавить `<RotaLockButton>` в шапку каждой rota-вкладки.

---

## Технические детали

```text
employees ──UPDATE trigger──> employee_role_history
                                       │
rota grids ──employee_role_at(id, m)──┘  ← группировка/секции

pit_rota / staff_rota ──BEFORE trigger──> rota_locks (block writes)

UI: <RotaLockButton scope month> ──insert/delete──> rota_locks
                                                       │
                                              грид перерендерится readOnly
```

**Scope mapping для staff_rota guard-триггера:**
- department=`Security` → `security`
- department=`Office` → `office`
- иначе (`Floor`) → `floor`

**Версия:** автобамп `package.json` (миграция + триггеры).

---

## Что НЕ делаем
- Lock по неделям/диапазону дней — только целый месяц (по решению).
- Доступ к месяцам дальше +1 — только следующий.
- HR role-edit интерфейс не меняем; история заполняется автоматом при изменении должности через существующий Staff Master.
- Manager password при unlock не запрашиваем (можно добавить позже, если попросите).