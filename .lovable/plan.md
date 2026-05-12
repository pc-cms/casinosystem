
# Аудит доступа: Роли × Меню × Глубина

**Цель:** один документ‑справочник (без изменений в коде), фиксирующий текущее состояние ролевого доступа и согласованное направление развития (per‑user глубина по дням; финансы — жёстко по роли).

## Что будет создано

1. `docs/ACCESS-MATRIX.md` — мастер‑документ (на русском, как просил пользователь). Источник истины для product‑решений.
2. Запись в `mem://features/access-matrix` (~30 строк) — короткая выжимка с указателем на документ.
3. Обновление `mem://index.md` → раздел **Auth & Users**: добавить ссылку на `mem://features/access-matrix`.

**Без изменений** в `AppSidebar.tsx`, `role-access.ts`, `use-business-day-filter.ts`, RLS, миграциях, хуках, UI.

---

## Структура `docs/ACCESS-MATRIX.md`

### 1. Роли (8)
Таблица: код / метка / скоуп (одно казино vs сеть) / назначение.
- `super_admin`, `finance_manager`, `manager`, `pit`, `cashier`, `reception`, `surveillance`, `hr`.
- Примечание: пользователь может иметь несколько ролей; видимость = объединение, финансовый scope = по самой «сильной».

### 2. Секции меню
Описание восьми секций сайдбара: OVERVIEW, PIT, CASHIER, RECEPTION, FINANCE, HR, ANALYTICS, SYSTEM — кому каждая адресована.

### 3. Полная матрица «Меню × Роль»
Одна строка на каждый пункт из `NAV_ITEMS` (включая виртуальные группы Attendance/Rota и их под‑пункты Live / Floor / Security / Office). Колонки = 8 ролей. Значения: ✅ / R (read‑only) / —. Дополнительно: страницы вне сайдбара (Cashless, Bank Checks, Pitbook, Incidents, Weekly Bonus, Table Results, Business Days, Admin).

### 4. Три оси глубины доступа

**Ось A — Глубина по дням (history horizon)**
- Сейчас: `pit / cashier / reception` → только текущий business day; остальные → вся история. Manager Override (сессионный тогл с паролем) снимает ограничение для pit.
- **Согласованное направление (документируется, не реализуется):** добавить per‑user поле `history_horizon ∈ {today, 7d, 30d, all}` в `user_module_permissions` (или новой `user_access_settings`). Приоритет: per‑user override > role default. Применяется во всех местах, где сейчас вызывается `useBusinessDayFilter()`.

**Ось B — Финансовая видимость (жёстко по роли)**
- `manager / finance_manager / surveillance / super_admin` → `all` (lifetime KPI игрока, IN/OUT/Result).
- `pit` → `shift` (current day; снимается Manager Override).
- `cashier / reception / hr` → `none` (Player Card KPIs/Visits/Tracker скрыты).
- **Документ явно запрещает** per‑user override этой оси (security‑критично).

**Ось C — Casino scope (immutable)**
- `super_admin / finance_manager` → все казино через `premier` сабдомен.
- Остальные → только своё казино (RLS по `casino_id`).

### 5. Особые правила (cross‑reference)
- Cage write — только cashier; остальные read‑only история.
- Pit Boss никогда в Breaklist, только в Rota с лейблом PB.
- HR изолирован от финансов.
- Surveillance read‑only + теги/наблюдения + фото сотрудников.
- Manager Override — сессионный, требует пароль менеджера, лифтит ось A для pit и ось B для pit.
- Текущий business day берётся из RPC `get_current_business_date`.

### 6. Открытые вопросы (для решения владельцем)
Перечисление расхождений, найденных при аудите, в форме вопросов (без рекомендаций):
- Cashier видит Reception в меню, но не Dashboard — намеренно?
- Surveillance видит Cage, но не Cage Closings — намеренно?
- HR не видит Dashboard вообще — намеренно?
- Weekly Bonus скрыт от pit, но открыт manager/finance — намеренно?
- HR не имеет доступа к финансам, но видит «Live Game (Personnel view)» — где граница с Pit?

### 7. Указатели на источник истины
Для каждого факта — путь и символ:
- Видимость меню → `src/components/layout/AppSidebar.tsx` (`NAV_ITEMS`).
- Module gating → `src/lib/modules.ts`, `src/lib/route-module-map.ts`, `useMyModulePermissions`.
- Ось A → `src/hooks/use-business-day-filter.ts`.
- Ось B → `src/lib/role-access.ts`.
- Manager Override → `src/lib/auth-context.tsx`, `ManagerOverrideDialog.tsx`.
- Ось C → RLS политики + `src/lib/casino-context.tsx` + сабдомен `premier`.

---

## Обновление памяти

Создать `mem://features/access-matrix.md` (краткая выжимка трёх осей + ссылка на `docs/ACCESS-MATRIX.md`).

В `mem://index.md` под **Auth & Users** добавить:
```
- [Access Matrix](mem://features/access-matrix) — Полный аудит ролей × пунктов меню × глубины; per-user day-depth override как направление; финансовая видимость заблокирована per-role
```

## Вне области (явно)

- Никаких изменений в `NAV_ITEMS`, RLS, миграциях, хуках.
- Ось A (per‑user горизонт истории) только документируется, UI редактора не создаётся в этом проходе.
- Никакой реорганизации ролей.
- Никакого кода — только документ + memory.

## Язык

Документ `docs/ACCESS-MATRIX.md` — на русском (по запросу). Названия ролей, путей файлов, кодов модулей и SQL‑идентификаторов оставить на английском, как в кодовой базе.
