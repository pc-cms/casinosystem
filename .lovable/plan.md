# Аудит ссылок и новая модель прав (Module = URL) — финальная версия

## Принцип (правило №1)

**Одна ссылка = один маршрут = один ModuleKey.** Никаких `?tab=`, никаких "одна страница на 3 роли с разной начинкой". Если две роли видят разное содержимое — это **два разных модуля и два разных URL** (даже если они рендерят похожий компонент).

Каждый ModuleKey в матрице имеет три оси:
- `can_view` — видит пункт в меню и может открыть страницу
- `can_write` — может редактировать/создавать
- `day_horizon` — глубина по дате (`today` / `7d` / `30d` / `all`)

Если разница между ролями = только редактирование или глубина — это **один модуль** с разными настройками. Если разница в **наборе кнопок/вкладок/секций** — это **разные модули** на разных URL.

## Решения по открытым вопросам (зафиксировано)

1. **Floor Manager на `/cage`**: видит всё **без Manager Override**, но дополнительные кассирские действия (открыть/закрыть смену, edit opening chips, register player) требуют Override. То есть `cage_main.can_view = true` для FM, `can_write` остаётся за override.
2. **`expenses_approvals`**: Manager и Floor Manager — `can_write = true` (апрув без Override). Pit — `can_view = true` (видит очередь), `can_write = false`, апрув становится доступен только при Manager Override.
3. **`finance_payments` ≠ `expenses_cage`**: Payments — реестр исходящих платежей менеджера (Office Safe → банк/контрагент). Expenses — повседневные кассовые расходы. Связь: апрувленный Expense может породить Payment, но это разные сущности и разные экраны.
4. **`/cage/view` для Reception/HR**: НЕ дают доступ. Только Manager / Floor Manager / Pit / Surveillance / Finance.

## Финальная карта URL (плоская, без `?tab=`)

### OVERVIEW
- `/` → `dashboard`

### PIT (operations)
- `/breaklist` → `pit_breaklist`
- `/tables` → `tables`
- `/tables/analytics` → `tables_analytics`
- `/table-tracker` → `table_tracker`
- `/player-statistics` → `pit_active_players`
- `/attendance/live` → `pit_attendance`
- `/attendance/floor` → `staff_attendance_floor`
- `/attendance/security` → `staff_attendance_security`
- `/attendance/office` → `staff_attendance_office`
- `/rota/live` → `pit_rota`
- `/rota/floor` → `staff_rota_floor`
- `/rota/security` → `staff_rota_security`
- `/rota/office` → `staff_rota_office`
- `/weekly-bonus` → `weekly_bonus`
- `/pitbook` → `pitbook`
- `/incidents` → `incidents` *(новый модуль — сейчас отсутствует, поэтому Floor Manager видит пустоту)*

### CASHIER (Cage variants — это и есть та "ахинея")
- `/cage` → `cage_main` — полнофункциональный кассирский модуль. Cashier `can_write=true`. Manager / Floor Manager / Pit / Finance / Surveillance — `can_view=true`, `can_write` только при Manager Override.
- `/cage/view` → `cage_view` — read-only витрина истории смен (то, что сейчас отдаёт `CageHistoryView`). Manager / Floor Manager / Pit / Finance / Surveillance.
- `/cage/closings` → `cage_closings` — список закрытых смен.
- `/cage/close-shift`, `/cage/shift/:id/edit-opening`, `/players/register` — дочерние операции `cage_main` (наследуют его права).
- `/expenses` → `expenses_cage` — журнал кассовых расходов (создание). Cashier write; Manager / Floor Manager — view + write через Override.
- `/expenses/approvals` → `expenses_approvals` — очередь апрува. Manager / Floor Manager / Finance — write по умолчанию. Pit — view, write только при Override.
- `/cashless` → `cashless`

### RECEPTION
- `/reception` → `reception`
- `/guests` → `in_casino`
- `/blacklist` → `blacklist`
- `/players/:id` → `players_profile` (один модуль, видимость финансовых блоков остаётся role-locked)

### FINANCE
- `/finance/payments` → `finance_payments` (исходящие платежи, **не** дубль Expenses)
- `/finance/wallets` → `finance_wallets`
- `/finance/dashboard` → `finance_dashboard`
- `/finance/review` → `finance_review`
- `/finance/budget` → `finance_budget`
- `/finance/cash-count` → `finance_cash_count`
- `/finance/summary` → `finance_summary`
- `/finance/transfers` → `finance_transfers`
- `/bank-checks` → `bank_checks`
- `/miss-chips` → `miss_chips`

### HR / Staff
- `/staff/dealers` → `staff_master_dealers`
- `/staff/floor` → `staff_master_floor`
- `/staff/master` → `staff_master_full`
- `/payroll`, `/payroll/:id` → `payroll`

### ANALYTICS
- `/groups` → `groups`
- `/reports` → `reports`
- `/table-results` → `table_results`
- `/business-days` → `business_days`

### SYSTEM
- `/admin/users` → `admin_users`
- `/admin/permissions` → `admin_permissions`
- `/admin/branding` → `admin_branding`
- `/admin/float` → `admin_float`
- `/admin/network` → `admin_network`
- `/import-reports` → `import_reports`
- `/logs` → `logs`

## Правило вариантов (когда один модуль, когда несколько)

```
Различие в UI                            → решение
─────────────────────────────────────────────────────────────
Только редактирование/чтение             → ОДИН модуль, can_write
Только глубина по дате (today/30d)       → ОДИН модуль, day_horizon
Manager Override открывает write         → ОДИН модуль (override flips can_write)
Разный набор кнопок/секций               → РАЗНЫЕ модули (Main / View / Approvals)
Разный список (свои / все / очередь)     → РАЗНЫЕ модули
```

Суффиксы:
- `_main` — полный операционный экран
- `_view` — read-only витрина того же контента
- `_approvals` — очередь модерации
- `_dealers` / `_floor` / `_full` — срезы списка по группам персонала

## Шаблон для новой страницы (обязательный чек-лист)

1. Один URL в `App.tsx` (никаких `?tab=`).
2. Один `ModuleKey` в `src/lib/modules.ts`.
3. Маппинг URL → ModuleKey в `src/lib/route-module-map.ts`.
4. Baseline в миграции `role_module_defaults` для всех ролей.
5. Пункт сайдбара в `AppSidebar.tsx` без `roles: [...]` — фильтрация только через матрицу.
6. `RoleGuard` оборачивает `Route` (он уже резолвит модуль через `route-module-map`).
7. Внутри страницы — `useModuleWrite(key)` для блокировки кнопок и `useModuleHorizon(key)` для фильтра по дате.
8. Если нужен view-вариант — отдельный URL `*/view`, отдельный модуль `*_view`. Никакого `if (role === ...)` внутри страницы.
9. Тест в `src/test/access-matrix.test.ts` — добавить URL в `GATED_ROUTES` и обновить allow-list ролей.

## План реализации (порядок шагов)

1. **Расширить `ModuleKey`** в `src/lib/modules.ts`: добавить новые ключи (`cage_main`, `cage_view`, `cage_closings`, `expenses_cage`, `expenses_approvals`, `finance_payments`, `tables_analytics`, `incidents`, `pitbook`, `weekly_bonus`, `bank_checks`, `table_results`, `business_days`, `cashless`, `staff_attendance_{floor,security,office}`, `staff_rota_{floor,security,office}`, `staff_master_{dealers,floor,full}`, `admin_{users,permissions,branding,float,network}`).
2. **Flat-URL миграция** для `/breaklist`, `/attendance/*`, `/rota/*`, `/staff/*`, `/admin/*`. Старые URL → `<Navigate>` редиректы.
3. **Cage split**: новый маршрут `/cage/view` → `CageHistoryView`. `/cage` остаётся `cage_main` (Cashier write, остальные view + write-by-override). Убрать дубль пункта сайдбара для Surveillance — он будет ссылаться на `/cage/view`.
4. **Expenses split**: `/expenses` = `expenses_cage`. Новый `/expenses/approvals` = `expenses_approvals` с кнопкой Approve, доступной по матрице (Manager/FM/Finance) или через Override (Pit).
5. **`route-module-map.ts`** — переписать под flat URL и новые модули.
6. **Миграция БД** — пересеять `role_module_defaults` под новый набор ключей. Floor Manager = Manager минус финансовые модули. Прописать write для `expenses_approvals` у Manager / Floor Manager / Finance.
7. **`AppSidebar.tsx`** — убрать `roles: [...]` из `NAV_ITEMS`, видимость = `allowedModules.has(moduleKeyForRoute(to))`.
8. **Удалить `Pit.tsx` и `Staff.tsx`** как страницы-скелеты — компоненты уже отдельные. Legacy URL → редиректы.
9. **`docs/ACCESS-MATRIX.md`** обновить (новые модули, варианты Main/View/Approvals, шаблон).
10. **Тесты** в `access-matrix.test.ts` — обновить `GATED_ROUTES` и `FLOOR_MANAGER_ALLOWED`.

После аппрува плана — иду в реализацию.
