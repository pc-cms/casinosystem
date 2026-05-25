# Аудит доступа: Роли × Меню × Глубина

> Источник истины для product‑решений. Документ описывает **текущее состояние** и **согласованное направление развития** (per‑user глубина по дням; финансы — жёстко по роли).
>
> Изменений в коде по результатам аудита **нет**. Расхождения вынесены в раздел 6 как открытые вопросы.

---

## 1. Роли (8)

| Код | Метка | Скоуп | Назначение |
|---|---|---|---|
| `super_admin` | Super Admin | Сеть | Полный доступ ко всему |
| `finance_manager` | Finance | Сеть (через `premier`) | Финансы всех казино, межказино‑переводы |
| `manager` | Manager | 1 казино | Полный операционный + финансовый доступ внутри своего казино |
| `pit` | Pit | 1 казино | Зал, столы, активные игроки в смене |
| `cashier` | Cashier | 1 казино | Касса (Cage), расходы, безнал, приём игроков |
| `reception` | Reception | 1 казино | Регистрация и обновление игроков, чёрный список |
| `surveillance` | Surveillance | 1 казино | Read‑only наблюдение + теги/наблюдения, фото сотрудников |
| `hr` | HR | 1 казино | Кадры, посещаемость, ротации; **изолирован от финансов** |

**Правило мульти‑ролей:** видимость = объединение всех ролей пользователя; финансовый scope — по «самой сильной» (`all` > `shift` > `none`).

---

## 2. Секции бокового меню

| Секция | Кому адресована |
|---|---|
| **OVERVIEW** | Все, кроме hr/cashier (Dashboard) |
| **PIT** | Pit/Manager/Finance/Super + Surveillance (read) |
| **CASHIER** | Cashier (write) + Manager/Finance/Super (read/write) + Surveillance (Cage read) |
| **RECEPTION** | Reception/Cashier/Pit + Manager/Finance/Super + Surveillance |
| **FINANCE** | Manager/Finance/Super (часть пунктов — только Finance/Super) |
| **HR** | HR/Manager/Super |
| **ANALYTICS** | Manager/Finance/Super + Surveillance (Table Results) |
| **SYSTEM** | Manager/Super (Logs — также Finance) |

---

## 3. Полная матрица «Меню × Роль»

Легенда: ✅ — есть в сайдбаре; **R** — read‑only / без модификаций; — — нет доступа.

> Источник: `src/components/layout/AppSidebar.tsx → NAV_ITEMS`. Surveillance отображается отдельно, потому что почти везде у него read‑only.

### OVERVIEW

| Пункт | super_admin | finance_manager | manager | pit | cashier | reception | surveillance | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard `/` | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — |

### PIT

| Пункт | super_admin | finance_manager | manager | pit | cashier | reception | surveillance | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Break List `/pit?tab=breaklist` | ✅ | ✅ | ✅ | ✅ | — | — | R | — |
| Live Tables `/tables` | ✅ | ✅ | ✅ | ✅ | — | — | R | — |
| Player Statistics `/player-statistics` | ✅ | ✅ | ✅ | ✅ | — | — | R | — |
| Table Check `/table-tracker` | ✅ | ✅ | ✅ | ✅ | — | — | R | — |
| Table Analytics `/tables/analytics` | ✅ | ✅ | ✅ | ✅ | — | — | R | — |
| Attendance (parent) → Live / Floor / Security / Office | ✅ | ✅ | ✅ | ✅ | — | — | R | — |
| Rota (parent) → Live / Floor | ✅ | ✅ | ✅ | ✅ | — | — | R | — |
| Weekly Bonus `/weekly-bonus` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Pitbook `/pitbook` | ✅ | ✅ | ✅ | ✅ | — | — | R | — |
| Incidents `/incidents` | ✅ | ✅ | ✅ | — | — | — | R | — |

### CASHIER

| Пункт | super_admin | finance_manager | manager | pit | cashier | reception | surveillance | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Cage `/cage` | ✅ (R) | ✅ (R) | ✅ (R) | — | ✅ **write** | — | R | — |
| Closings `/cage/closings` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Cage Slots `/cage-slots` | 🔒 per-user | 🔒 per-user | 🔒 per-user | 🔒 per-user | 🔒 per-user | — | — | — |
| Expenses `/expenses` | ✅ | ✅ | ✅ | — | ✅ | — | — | — |
| Cashless `/cashless` | ✅ | ✅ | ✅ | — | ✅ | — | — | — |

> **Правило:** Cage **write** — только cashier. Все остальные видят историю в read‑only. Surveillance видит Cage, но не Closings (см. вопрос 6.2).
>
> **Cage Slots:** доступа по роли НЕТ ни у кого. Модуль выдаётся только адресно через Admin → Users → Permissions (на текущий момент — только пользователю `Slots`).

### RECEPTION

| Пункт | super_admin | finance_manager | manager | pit | cashier | reception | surveillance | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Reception `/reception` | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — |
| Guests `/guests` | ✅ | ✅ | ✅ | ✅ | — | ✅ | R | — |
| Blacklist `/blacklist` | ✅ | ✅ | ✅ | — | — | ✅ | R | — |

### FINANCE

| Пункт | super_admin | finance_manager | manager | pit | cashier | reception | surveillance | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Bank Checks `/bank-checks` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Budget `/finance/budget` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Cash Count `/finance/cash-count` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Daily Review `/finance/review` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Finance Dashboard `/finance/dashboard` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Finance Expenses `/finance/expenses` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Miss Chips `/miss-chips` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Summary `/finance/summary` | ✅ | ✅ | — | — | — | — | — | — |
| Transfers `/finance/transfers` | ✅ | ✅ | — | — | — | — | — | — |
| Wallets `/finance/wallets` | ✅ | ✅ | ✅ | — | — | — | — | — |

> Summary и Transfers — только **Finance/Super** (cross‑casino, premier).

### HR

| Пункт | super_admin | finance_manager | manager | pit | cashier | reception | surveillance | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Live Game (Personnel view) `/pit` | ✅ | — | ✅ | — | — | — | — | ✅ |
| Floor Staff `/staff` | ✅ | — | ✅ | — | — | — | — | ✅ |

> HR видит вкладку Employee внутри Pit/Staff (полные права на персонал), но не имеет финансовых пунктов.

### ANALYTICS

| Пункт | super_admin | finance_manager | manager | pit | cashier | reception | surveillance | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Groups `/groups` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Reports `/reports` | ✅ | ✅ | ✅ | — | — | — | — | — |
| Table Results `/table-results` | ✅ | ✅ | ✅ | — | — | — | R | — |
| Business Days `/business-days` | ✅ | ✅ | ✅ | — | — | — | — | — |

### SYSTEM

| Пункт | super_admin | finance_manager | manager | pit | cashier | reception | surveillance | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Import Reports `/import-reports` | ✅ | — | ✅ | — | — | — | — | — |
| Logs `/logs` | ✅ | ✅ | ✅ | — | — | — | — | — |

---

## 4. Три независимые оси глубины доступа

### Ось A — Глубина по дням (history horizon)

Источник: `src/hooks/use-business-day-filter.ts`.

| Роль | Default | Эффект Manager Override |
|---|---|---|
| `pit`, `cashier`, `reception` | **Только текущий business day** | Снимает ограничение |
| `manager`, `finance_manager`, `super_admin`, `surveillance`, `hr` | Без ограничений | — |

**Согласованное направление (документируется, не реализуется в этом проходе):**

- Добавить per‑user поле `history_horizon ∈ { today, 7d, 30d, all }` в `user_module_permissions` (или новой `user_access_settings`).
- Приоритет: **per‑user override > role default**.
- Точка применения — единственная: внутри `useBusinessDayFilter()` (значение `restrictedToToday` и `businessDate` будут вычисляться с учётом per‑user горизонта).
- Manager Override продолжает работать как «временный лифт на сессию».

### Ось B — Финансовая видимость (жёстко по роли)

Источник: `src/lib/role-access.ts → getFinancialScope`.

| Роль | Scope | Что видит |
|---|---|---|
| `manager`, `finance_manager`, `surveillance`, `super_admin` | `all` | Lifetime KPI игрока, IN/OUT/Result, Player Tracker |
| `pit` | `shift` | Только текущая смена; снимается Manager Override |
| `cashier`, `reception`, `hr` | `none` | KPIs/Visits/Tracker в Player Card скрыты |

**Запрещено** добавлять per‑user override этой оси (security‑критично; решение зафиксировано пользователем).

### Ось C — Casino scope (immutable)

| Роль | Casino scope |
|---|---|
| `super_admin`, `finance_manager` | Все казино сети — через сабдомен `premier` |
| Все остальные | Только своё казино (RLS по `casino_id`) |

Источник: RLS политики + `src/lib/casino-context.tsx` + сабдомен `premier`.

---

## 5. Особые правила (cross‑reference)

- **Cage write** — только `cashier`. Все остальные видят Cage в read‑only.
- **Pit Boss** (`is_pit_boss=true`) никогда не появляется в Breaklist; только в Rota с лейблом PB.
- **HR** — полный контроль над персоналом, **изолирован от финансов**.
- **Surveillance** — read‑only во всех модулях + теги/наблюдения + фото сотрудников.
- **Manager Override** — сессионный тогл, требует пароль менеджера; лифтит ось A (для pit/cashier/reception) и оставляет ось B по pit (`shift`) пока активен — фактически тоже даёт `all` контекст для Pit.
- **Текущий business day** берётся из RPC `get_current_business_date` через `useEffectiveBusinessDate()`. Legacy `getBusinessDate()` — fallback.
- **Close Business Day** — кнопка в Cage; видна `cashier/manager/pit/finance_manager/super_admin`; всегда требует пароль менеджера.

---

## 6. Открытые вопросы (для решения владельцем)

> Найдено при аудите. Без рекомендаций — только факты.

1. **Cashier видит Reception, но не Dashboard** — намеренно? Сейчас Dashboard скрыт для cashier и hr.
2. **Surveillance видит Cage (read), но не Cage Closings** — намеренно? Логически Closings это та же история Cage.
3. **HR не видит Dashboard вообще** — намеренно? Все остальные операционные роли видят.
4. **Weekly Bonus скрыт от pit** — намеренно? Виден только manager/finance/super.
5. **HR имеет доступ к Live Game (Personnel view)** — где граница с Pit? HR заходит в `/pit` и `/staff`, но без вкладки операций.
6. **Incidents скрыт от pit** — намеренно? Pit видит Pitbook, но не Incidents.
7. **Logs виден finance_manager** — намеренно? Это операционные логи, не финансовые.

---

## 7. Указатели на источник истины

| Факт | Файл / символ |
|---|---|
| Видимость пунктов меню | `src/components/layout/AppSidebar.tsx` → `NAV_ITEMS` |
| Module gating (страницы) | `src/lib/modules.ts`, `src/lib/route-module-map.ts`, `useMyModulePermissions` |
| Ось A (день) | `src/hooks/use-business-day-filter.ts` |
| Ось B (финансы) | `src/lib/role-access.ts` (`getFinancialScope`, `canSeePlayerFinancials`) |
| Manager Override | `src/lib/auth-context.tsx`, `src/components/ManagerOverrideDialog.tsx` |
| Ось C (casino scope) | RLS политики + `src/lib/casino-context.tsx` + сабдомен `premier` |
| Business date | RPC `get_current_business_date` + `useEffectiveBusinessDate()` |
| Close Business Day | `src/components/cage/CloseBusinessDayDialog.tsx` |

---

## 8. Вне области текущего прохода

- Никаких изменений в `NAV_ITEMS`, RLS, миграциях, хуках.
- Per‑user горизонт истории (ось A) — только документируется, UI редактора не создаётся.
- Никакой реорганизации ролей.
- Только документ + memory‑запись.
