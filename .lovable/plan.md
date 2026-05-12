# Floor Manager Parity & Expenses ↔ Payments Split

> Цель: Floor Manager (Peter) получает **все** операционные привилегии Manager — апрувать кассирские расходы, использовать Manager Access Override, закрывать кассу, открывать закрытые столы и т.д. — но **без** доступа к финансовым штукам (Wallets, Finance Dashboard, Finance Summary, Finance Daily Review, Finance Cash Count). Параллельно: финансовый модуль "Expenses" переименовываем в **Payments** (это перевод денег с кошелька), а кассовые "Expenses" остаются как есть.

---

## 0. Корень проблемы

Сейчас:
- `isManager` в `auth-context.tsx:200` = `roles.includes("manager") || managerOverride.active`. **`floor_manager` сюда не входит**, поэтому 50+ мест в коде блокируют его (Approve expense, Manager Override gate, Pit past-day edit, Player blacklist, Cashless approve, etc.).
- RLS `Managers approve expenses` (миграция `20260328180149`) проверяет только `has_role(uid,'manager')`. Даже если фронт даст кнопку — БД запретит.
- ManagerOverrideDialog (RFID-проверка) принимает только `role === "manager"` — Floor Manager не может ни выступить аппрувером, ни активировать Override на себя.
- Два модуля с именем "Expenses": `/expenses` (Cage расходы по кассе, immutable, approve кассиру) и `/finance/expenses` (списания с финансовых кошельков). Это путает пользователя.

---

## 1. Стратегия: «Floor Manager = Manager без денег»

Вводим единственное правило в коде: **везде, где сегодня проверяется `manager`-роль для операционных действий, добавляется `floor_manager`**. Финансовые поверхности уже корректно ограничены ролями `manager`/`finance_manager`/`super_admin` (см. AppSidebar роли FINANCE) — туда `floor_manager` не добавляем.

### 1a. Что разблокируем для Floor Manager

| Способность | Где | Действие |
|---|---|---|
| Approve cashier expenses | RLS + `Expenses.tsx` `isManager` | ✅ |
| Manager Access Override (toggle on self + RFID approve) | `ManagerOverrideDialog.tsx`, `auth-context.tsx` | ✅ |
| Close Cage shift | RLS на `shifts`/`cage_*` | ✅ |
| Reopen closed gaming tables | RLS + `useReopenTable` | ✅ |
| Edit past-day Pit/Staff Rota & Attendance | `Pit.tsx`, `Staff.tsx` `isManager` гейт | ✅ |
| Edit player category, blacklist, notes | `PlayerEditDialog.tsx`, `PlayerProfile.tsx` | ✅ |
| Edit Business Days History (Pit-секции) | `use-business-day-history.ts` | ✅ |
| Approve Cashless | `Cashless.tsx` `isManager` | ✅ |
| Confirm Inter-Casino Transfers | `InterCasinoTransfers.tsx` `isManagerOrAbove` | ✅ |
| Pitbook post/ack | `Pitbook.tsx` | ✅ |
| Edit Players (full) / Issue cards | `PlayerEditDialog`, `Cage` actions | ✅ |
| BreaklistGrid lock/unlock | `BreaklistGrid.tsx` | ✅ |
| Manage tables (Admin → TableManagement) | проверить `RoleGuard` | ✅ |
| Table Tracker edit | `TableTracker.tsx` | ✅ |
| ImportReports | `ImportReports.tsx` | ✅ |
| Close Business Day from Cage | RLS на `business_day_closures` + кнопка в Cage | ✅ |
| Admin sidebar item | `AppSidebar.tsx` `isManager` → `canSeeAdmin` | ❌ оставить только для `manager`/`super_admin` |

### 1b. Что НЕ разблокируем (финансы)

| Поверхность | Текущая роль | Floor Manager? |
|---|---|---|
| `/finance/dashboard` (FinanceDashboard) | manager, finance_manager | ❌ |
| `/finance/wallets` | manager, finance_manager | ❌ |
| `/finance/summary` | finance_manager, super_admin | ❌ |
| `/finance/review` (Daily Review) | manager, finance_manager | ❌ |
| `/finance/cash-count` | manager, finance_manager | ❌ |
| `/finance/budget` | manager, finance_manager | ❌ |
| `/finance/transfers` (Inter-Casino) **просмотр** | manager, finance_manager | ❌ |
| `/finance/expenses` → станет `/finance/payments` | manager, finance_manager | ❌ |
| `/payroll/*` | hr, finance_manager, super_admin | ❌ |
| Lifetime player financials (KPIs/Visits/Stats) | role-locked через `canSeePlayerFinancials` | оставить как есть (floor_manager уже = "shift" scope) |

**Важно:** `getFinancialScope(['floor_manager'])` сейчас = `"shift"` — это корректно, не трогаем. Floor Manager видит **только текущий business day** для player-financials, как Pit. Manager Override **не повышает** до `"all"` — это сознательно (см. `Operational Business-Day Scope` memory).

---

## 2. Реализация — Frontend

### 2a. `src/lib/auth-context.tsx`
```diff
- const isManager = roles.includes("manager") || managerOverride.active;
+ const isManager =
+   roles.includes("manager") ||
+   roles.includes("floor_manager") ||
+   managerOverride.active;
```
Это автоматически разблокирует **все** 30+ мест, где используется `isManager`. Risk: `Admin` сайдбар item — отдельно проверим, оставим за `manager`/`super_admin` (см. ниже).

### 2b. `src/components/layout/AppSidebar.tsx`
```diff
- const canSeeAdmin = isManager;
+ const canSeeAdmin = roles.includes("manager") || roles.includes("super_admin");
```
(Admin даёт доступ к настройкам казино — это финансово-чувствительно.)

### 2c. `src/components/ManagerOverrideDialog.tsx`
```diff
- const isManager = roles?.some(r => r.role === "manager");
+ const isManager = roles?.some(r => r.role === "manager" || r.role === "floor_manager");
  if (!isManager) {
-   setError(`${profile.display_name} is not a manager`);
+   setError(`${profile.display_name} is not a manager or floor manager`);
```
И аналогично в password-flow внутри того же диалога (если есть отдельная проверка). Это позволяет Floor Manager выступать аппрувером для Override, и активировать Override на себе самому (через тот же RFID/пароль flow).

### 2d. `src/pages/Pitbook.tsx`
```diff
- const isManager = roles.includes("manager") || roles.includes("super_admin");
+ const isManager = roles.includes("manager") || roles.includes("floor_manager") || roles.includes("super_admin");
```

### 2e. `src/hooks/use-business-day-history.ts`
```diff
- const isManager = roles.includes("manager");
+ const isManager = roles.includes("manager") || roles.includes("floor_manager");
```
(Только Pit-секции; Finance-секции уже жёстко за `finance_manager`.)

### 2f. Точечные ручные включения

Пройти по списку из 1a и убедиться, что нет hard-coded `roles.includes("manager")` без Floor Manager. Кандидаты по grep:
- `src/components/finance/InterCasinoTransfers.tsx` — `isManagerOrAbove` определение проверить (вероятно `manager || finance_manager || super_admin` → НЕ добавлять Floor Manager, это финансы; **подтвердить с пользователем**, см. Open question 1).

---

## 3. Реализация — Backend (RLS)

Универсальный helper, чтобы не плодить копии:

```sql
-- security definer функция: "имеет ли пользователь права уровня менеджера операций"
CREATE OR REPLACE FUNCTION public.is_manager_op(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('manager','floor_manager','super_admin')
  );
$$;
```

Затем заменить во всех RLS политиках, которые сейчас гейтят чисто-операционные действия (НЕ финансовые!), `has_role(auth.uid(),'manager')` → `public.is_manager_op(auth.uid())`. Конкретно:

| Таблица / политика | Было | Стало |
|---|---|---|
| `expenses` UPDATE "Managers approve expenses" | `has_role(uid,'manager')` | `is_manager_op(uid)` |
| `expenses` DELETE (если есть manager-only) | то же | `is_manager_op(uid)` |
| `gaming_tables` UPDATE для reopen | то же | `is_manager_op(uid)` |
| `shifts` close-related (если manager-only) | то же | `is_manager_op(uid)` |
| `business_day_closures` INSERT | то же | `is_manager_op(uid)` |
| `player_chip_adjustments` INSERT | manager/pit | оставить как есть (floor_manager эквивалент pit на полу — добавить) |
| `cashless_*` approve | manager | `is_manager_op(uid)` |
| `pit_rota`, `staff_rota`, `pit_attendance`, `staff_attendance` past-day write | manager | `is_manager_op(uid)` |

**НЕ трогаем** RLS на `wallet_transactions`, `wallets`, `daily_summaries`, `cash_count_*`, `budget_*`, `payroll_*` — они должны остаться `manager`/`finance_manager` only.

Bump `package.json` patch (миграция → правило auto-bump).

---

## 4. Expenses → Payments rename (Finance модуль)

### Что остаётся как «Expenses»
- `/expenses` (страница `Expenses.tsx`) — **кассовые расходы**, immutable, approve менеджером, идут на `expenses` таблицу. Используется кассирами.
- Sidebar PIT/CAGE: остаётся «Expenses».

### Что переименовывается в «Payments»
- Маршрут `/finance/expenses` → `/finance/payments` (со 301-редиректом со старого URL для совместимости).
- Файлы:
  - `src/pages/finance/FinanceExpensesPage.tsx` → `src/pages/finance/FinancePaymentsPage.tsx`
  - `src/components/finance/FinanceExpenses.tsx` → `src/components/finance/FinancePayments.tsx`
  - Экспорт `FinanceExpenses` → `FinancePayments`
  - Заголовок «Office Expenses» → «Payments»
- Sidebar FINANCE: лейбл `"Expenses"` → `"Payments"`, иконка `Receipt` → `Banknote` (или оставить).
- `src/lib/route-module-map.ts`: `if (base === "/finance/expenses") return "expenses";` → новая строка для `/finance/payments` → ключ модуля **остаётся `"expenses"`** (чтобы не делать миграцию `role_module_defaults` и `user_module_permissions`). Это аккуратно — внутри БД ключ остаётся, в UI лейбл другой.
- Старый редирект: `<Route path="/finance/expenses" element={<Navigate to="/finance/payments" replace />} />`.

### Семантическое уточнение в UI
Под заголовком Payments добавить subtitle: `"Money paid out from operating wallets — recorded as wallet transactions, not cashier expenses."` Чтобы пользователь понимал разницу.

### НЕ трогаем
- Таблицу `wallet_transactions` и enum `tx_type` (`manual_expense`, `use_reserve`) — это backend, переименование сломает миграции и историю.
- `EXPENSE_CATEGORY_GROUPS`, `CATEGORY_LABELS` константы.
- Тест `access-matrix.test.ts` — заменить только пути, ключ модуля тот же.

---

## 5. Проверки и smoke-тест

1. Зайти под Peter (floor_manager):
   - Открыть `/expenses` → кнопка `Approve` появляется на pending записях кассиров → кликнуть → запись становится Approved (RLS пропускает).
   - Открыть Pit/Staff rota за прошлый день → редактируется (нет Lock иконки).
   - В Cage → нажать Close Business Day → диалог манагер-пароля → проходит RFID/пароль самого Peter.
   - Reopen closed table → работает.
   - В Player Card → виден category edit, blacklist, notes.
   - `/finance/*` → нет в сайдбаре, прямой URL → RoleGuard 403.
   - `/admin` → нет в сайдбаре (только settings-чувствительные модули).
2. Зайти под обычным `manager` → ничего не сломалось.
3. Зайти под `cashier` → не видит `Approve` (как раньше).
4. `/finance/expenses` URL → редиректит на `/finance/payments`, лейбл «Payments».
5. Тест `access-matrix.test.ts` обновить с новым путём.

---

## 6. Memory updates

- `mem://auth/role-based-access-matrix` — дополнить: «Floor Manager идентичен Manager во всех **операционных** действиях, но финансовые модули (Finance Dashboard/Wallets/Summary/Review/CashCount/Budget/Payments/Transfers) и Admin для него закрыты. Реализовано через `isManager` (auth-context) и SQL функцию `is_manager_op()`.»
- `mem://features/editable-access-matrix` — отметить, что ключ модуля `expenses` теперь означает Finance Payments в UI, кассовые Expenses — это `cage` / отдельный гейт.
- `mem://features/financial-control/overview` или новый файл `mem://features/payments-vs-expenses` — пояснить семантику: Expenses = cashier petty cash log; Payments = wallet outflow.

---

## Файлы

**Frontend:**
- `src/lib/auth-context.tsx` — расширить `isManager`
- `src/components/layout/AppSidebar.tsx` — `canSeeAdmin` гейт; лейбл Payments
- `src/components/ManagerOverrideDialog.tsx` — accept floor_manager в обоих flow (RFID + пароль)
- `src/pages/Pitbook.tsx` — добавить floor_manager
- `src/hooks/use-business-day-history.ts` — добавить floor_manager
- `src/lib/route-module-map.ts` — добавить `/finance/payments`
- `src/App.tsx` — переименовать lazy import + route + редирект
- `src/pages/finance/FinanceExpensesPage.tsx` → `FinancePaymentsPage.tsx`
- `src/components/finance/FinanceExpenses.tsx` → `FinancePayments.tsx` (export, заголовок, subtitle)
- `src/test/access-matrix.test.ts` — путь обновить

**Backend (1 миграция):**
- `is_manager_op(uuid)` security definer
- DROP/CREATE RLS политик на: `expenses`, `gaming_tables` (reopen), `shifts` (close), `business_day_closures`, `cashless_*`, `pit_rota`, `staff_rota`, `pit_attendance`, `staff_attendance`, `player_chip_adjustments` — заменить `has_role('manager')` на `is_manager_op()` ТОЛЬКО для операционных таблиц.
- Bump `package.json` patch.

---

## Открытые вопросы

1. **Inter-Casino Transfers подтверждение:** сейчас `isManagerOrAbove` (вероятно `manager || finance_manager || super_admin`). Это перевод денег между казино — финансовая операция. Дать ли Floor Manager эту способность? Предложение: **нет**, оставить только Manager+ (Floor Manager — только операции на полу). Подтвердите.
2. **`/admin` для Floor Manager:** сейчас открывается всем `isManager`, но содержит много чувствительного (TableManagement, Branding, Permissions, Float). Предложение: оставить **только** Manager / super_admin. (Так и сделано в плане.) Подтвердите.
3. **Manager Override на самого себя:** Floor Manager сможет активировать Override на себе (как сейчас Manager). Это даёт `isManager=true` транзитно. Поскольку мы и так включаем floor_manager в `isManager` напрямую — Override становится для него **бесполезен** (он уже всё может). Оставить toggle видимым или скрыть для floor_manager? Предложение: **скрыть toggle** (нет смысла) — его роль уже даёт max операционных прав.
