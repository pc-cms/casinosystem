# План: Floor Manager + редактируемая матрица доступов

## Цели

1. Добавить роль **`floor_manager`** между `manager` и `pit` — отвечает за смену в зале, но **не за финансы**.
2. Перевести доступы из «жёстко зашитых пресетов» в формат **`(module × depth × perms)`** с возможностью редактирования.
3. Убрать ситуацию «manager/finance/super = все кнопки» — у каждой роли есть **зона ответственности**, а не «всё».
4. Сохранить безопасность: финансовая видимость остаётся жёстко по роли (ось B нельзя расширить через UI).

---

## 1. Новая роль `floor_manager`

**Зона ответственности:**
- Полный Pit (Rota, Breaklist, Live Tables, Players, Tables, Tracker, Pitbook, Incidents, Attendance).
- Reception, Guests, Blacklist — write.
- Cage — **read-only** + Close Business Day (с паролем менеджера).
- Staff (live game personnel view).
- Reports, Table Results.
- **Финансы — нет** (Budget / Wallets / CashCount / Review / Transfers / Summary / Expenses / BankChecks недоступны).
- Manager Override может лифтить ось A (день).

**Иерархия ролей (новая):**
```
super_admin > finance_manager > manager > floor_manager > pit
hr (изолированная ветка персонала)
cashier, reception, surveillance — параллельные узкие роли
```

---

## 2. Новая модель доступа: `(module, depth, perms)`

Сейчас есть только `user_module_permissions(user_id, module_key, can_view)`. Расширяем:

| Поле | Тип | Что задаёт |
|---|---|---|
| `module_key` | text | Какой модуль (Cage, Tables, Reception, …) |
| `can_view` | bool | Видеть пункт в меню и открывать страницу |
| `can_write` | bool | Создавать/редактировать в этом модуле (write‑экшены) |
| `day_horizon` | enum (`today`, `7d`, `30d`, `all`) | Глубина истории по дням |

**Источник истины:**
- `role_module_defaults(role, module_key, can_view, can_write, day_horizon)` — **базовый пресет роли** (read-only seed, редактируется только super_admin).
- `user_module_permissions(user_id, module_key, can_view, can_write, day_horizon NULL)` — **per-user override** (NULL = берём из role default).

**Эффективное право пользователя:**
```
effective(user, module) =
  user_override(module) ? user_override(module)
                        : merge_roles(user.roles → role_module_defaults(module))
```
При нескольких ролях — побитовое OR по `can_view/can_write` и `max(day_horizon)`.

**Ось B (финансы) НЕ редактируется через эту матрицу.** Она остаётся в `getFinancialScope()` по роли. Это явно отделено в UI.

---

## 3. Базовая матрица ролей (предлагаемая)

Легенда: V = view, W = write, — = нет, R = read-only (V только). Глубина: `T`=today, `7`=7d, `30`=30d, `∞`=all.

| Module | super_admin | finance_manager | manager | floor_manager | pit | cashier | reception | surveillance | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard | V/∞ | V/∞ | V/∞ | V/∞ | V/T | — | V/T | V/∞ | — |
| Pit Rota | VW/∞ | V/∞ | VW/∞ | VW/∞ | VW/T | — | — | V/∞ | V/∞ |
| Breaklist | VW/∞ | V/∞ | VW/∞ | VW/∞ | VW/T | — | — | V/T | — |
| Attendance | VW/∞ | V/∞ | VW/∞ | VW/∞ | VW/T | — | — | V/∞ | VW/∞ |
| Tables / Tracker / Analytics | VW/∞ | V/∞ | VW/∞ | VW/∞ | VW/T | — | — | V/∞ | — |
| Player Statistics | V/∞ | V/∞ | V/∞ | V/∞ | V/T | — | — | V/∞ | — |
| Pitbook | VW/∞ | V/∞ | VW/∞ | VW/∞ | VW/T | — | — | V/∞ | — |
| Incidents | VW/∞ | V/∞ | VW/∞ | VW/∞ | — | — | — | V/∞ | — |
| Weekly Bonus | VW/∞ | V/∞ | VW/∞ | — | — | — | — | — | — |
| Cage | V/∞ | V/∞ | V/∞ | **V/T** | — | **VW/T** | — | V/T | — |
| Close Business Day | ✓ | ✓ | ✓ | ✓ (с паролем) | ✓ (с паролем) | ✓ (с паролем) | — | — | — |
| Cage Closings | V/∞ | V/∞ | V/∞ | V/30 | — | — | — | — | — |
| Expenses / Cashless | VW/∞ | VW/∞ | VW/∞ | — | — | VW/T | — | — | — |
| Reception | V/∞ | V/∞ | V/∞ | V/∞ | — | VW/T | VW/T | — | — |
| Guests | V/∞ | V/∞ | V/∞ | V/∞ | V/T | — | V/T | V/∞ | — |
| Blacklist | VW/∞ | V/∞ | VW/∞ | VW/∞ | — | — | VW/∞ | V/∞ | — |
| Bank Checks | VW/∞ | VW/∞ | VW/∞ | — | — | — | — | — | — |
| Finance Dashboard / Wallets / Budget / Review / CashCount / Expenses(F) | VW/∞ | VW/∞ | VW/∞ (своё казино) | — | — | — | — | — | — |
| Finance Summary / Transfers | VW/∞ | VW/∞ | — | — | — | — | — | — | — |
| Miss Chips | V/∞ | V/∞ | V/∞ | V/30 | — | — | — | — | — |
| Reports / Table Results | V/∞ | V/∞ | V/∞ | V/30 | — | — | — | V/∞ | — |
| Groups | VW/∞ | V/∞ | VW/∞ | — | — | — | — | — | — |
| Business Days | VW/∞ | VW/∞ | VW/∞ | V/30 | — | — | — | — | — |
| Staff | VW/∞ | — | VW/∞ | V/∞ | — | — | — | — | VW/∞ |
| CCTV | V/∞ | — | V/∞ | — | — | — | — | VW/∞ | — |
| Import Reports | VW/∞ | — | VW/∞ | — | — | — | — | — | — |
| Logs | V/∞ | V/∞ | V/∞ | V/7 | — | — | — | — | — |
| Admin | VW/∞ | — | VW/∞ (свои пользователи) | — | — | — | — | — | — |

> Это **дефолты**. Любой пункт можно поменять per-user в Admin → User → Permissions (для super_admin/manager в своём казино).

---

## 4. UI редактора

**Где:** Admin → Users → [user] → «Permissions».

**Структура диалога:**
- Шапка: имя, роль, чекбокс **«Use role defaults»** (всё снимается → берётся из `role_module_defaults`).
- Таблица модулей (сгруппирована по Operations / Players / Finance / Reports / System):
  - Колонки: **View** (checkbox) · **Write** (checkbox, disabled если View=off) · **Day depth** (select: Today / 7d / 30d / All).
  - У каждой ячейки бейдж «Default» если совпадает с `role_module_defaults` для этой роли.
- Внизу — read-only блок «Financial visibility (locked by role)» с текущим scope (`all/shift/none`) и подсказкой, что меняется только сменой роли.

**Кто может открывать:**
- `super_admin` — любой пользователь сети.
- `manager` — только пользователи своего казино, и только в пределах того, что он сам видит (нельзя выдать больше, чем у тебя есть).

---

## 5. Точки применения в коде (без расширения области)

- `useModuleAccess(moduleKey)` → теперь возвращает `{ canView, canWrite, dayHorizon }`.
- `useBusinessDayFilter()` → дополнительно учитывает `dayHorizon` из эффективных прав (per-user override > role default).
- Sidebar (`AppSidebar.tsx`) → продолжает скрывать пункты по `canView`.
- Кнопки write‑экшенов в страницах (Cage, Reception, Tables, Players, …) → дизейблятся по `canWrite` (без изменения раскладки).
- `getFinancialScope()` в `role-access.ts` → **не трогаем** (ось B изолирована).

---

## 6. Миграция БД (для апрува отдельной командой)

1. `ALTER TYPE app_role ADD VALUE 'floor_manager'`.
2. `CREATE TABLE role_module_defaults (role app_role, module_key text, can_view bool, can_write bool, day_horizon text, PRIMARY KEY(role, module_key))` + RLS (read all authenticated, write super_admin).
3. Сидинг `role_module_defaults` по матрице из раздела 3.
4. `ALTER TABLE user_module_permissions ADD COLUMN can_write bool, ADD COLUMN day_horizon text` (NULL = inherit).
5. RPC `effective_module_perms(p_user_id) RETURNS TABLE(module_key, can_view, can_write, day_horizon)` — мерджит роли+оверрайды (используется и в UI, и в RLS‑helper'ах).

---

## 7. Что меняется в `role-access.ts` / `modules.ts`

- `AppRole` → добавить `'floor_manager'`.
- `ROLE_PRIORITY` → `super_admin > finance_manager > manager > floor_manager > hr > pit > cashier > reception > surveillance`.
- `ROLE_LABELS` → `floor_manager: "Floor Manager"`.
- `getFinancialScope` → `floor_manager` попадает в `none` (нет финансов). Снимается **только** через лифт оси A Manager Override’ом, ось B остаётся `none`.
- `MODULES` → без изменений (модули те же).

---

## 8. Документация

- Обновить `docs/ACCESS-MATRIX.md`:
  - Добавить колонку `floor_manager`.
  - Перевести таблицы в формат `V / W / depth`.
  - Зафиксировать редактор и его правила (super_admin / manager‑scoped).
- Обновить `mem://features/access-matrix` тем же резюме.
- `mem://auth/role-based-access-matrix` → добавить `floor_manager`.

---

## 9. Что НЕ входит в этот план

- Перенос ось B (финансовая видимость) в редактор — запрещено.
- Изменение RLS под новые права — выносится отдельной задачей после апрува миграции.
- Реорганизация существующих пользователей по новой роли — делаешь вручную в Admin.
- Mobile‑адаптация диалога редактора — оставляем стандартный ResponsiveDialog.

---

## 10. Открытые вопросы

1. **Floor Manager — сколько физически нужно прав на Cage?** Сейчас предлагаю V/T (только текущая смена, read‑only). Альтернативы: V/30 (история до 30 дней) или V/∞.
2. **Manager в чужом казино** — должен ли видеть что‑то? Сейчас RLS изолирует; редактор это не меняет.
3. **Day horizon = `7d/30d`** — нужен ли вообще, или достаточно `today / all`? Если да, я делаю только два значения и матрица упрощается.
4. **Pit Boss (`is_pit_boss=true`)** — не отдельная роль, а флаг внутри `pit`. Оставляем как есть или поднимаем до `floor_manager`?

Жду ответов на эти 4 вопроса (или «сделай по плану») перед миграцией.
