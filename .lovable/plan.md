
# POS Module — план

Полностью изолированный модуль внутри проекта. Свой URL `/pos`, своя навигация, свои роли, своя касса и Z-отчёты. С остальной CMS пересекается только в трёх точках: `casinos`, `players`, `expenses` (для comps).

---

## 1. Архитектура и точки входа

- Новый раздел роутов под `/pos/*` (без AppSidebar основного приложения).
  - `/pos/login` — отдельный логин-экран (тот же `supabase.auth`, но другой UI/branding "POS").
  - `/pos/waiter` — экран официанта.
  - `/pos/bar` — Bar Display (kitchen/bar screen).
  - `/pos/manager` — отчёты, меню, инвентарь, смены, Z-отчёты.
- Свой layout `PosLayout` (bottom-tab на планшете, минимум хрома).
- Свой контекст `PosShiftContext` (открытая POS-смена waiter'а).
- Casino scope — как везде: по сабдомену через существующий `useCasino()`.
- Основная CMS (`AppSidebar`, Cage, Pit и т.д.) **не показывает** POS-навигацию и наоборот.

---

## 2. Роли и доступ

Добавляем три новые роли в `app_role` enum:
- `pos_waiter` — только `/pos/waiter` + свой профиль/смена.
- `pos_bartender` — только `/pos/bar`.
- `pos_manager` — `/pos/manager/*` + всё waiter/bar (read-only).

Существующие роли:
- `manager`, `finance_manager`, `super_admin` — read-only доступ к POS-отчётам внутри **существующих** Reports/Finance Dashboard (новые карточки/страницы), но НЕ к waiter/bar экранам.
- `pit` — отдельная кнопка "Order for player" в `ActivePlayers` → создаёт comp-заказ от имени игрока за столом. Это единственная точка пересечения Pit ↔ POS.

`getFinancialScope` POS-ролей = `none` для игровой части казино. POS-роли НЕ видят cage/tables/players-finances.

Доступ к страницам — через существующий механизм `role_module_defaults` + `user_module_permissions` (добавим новые ключи модулей: `pos_waiter`, `pos_bar`, `pos_manager`).

---

## 3. Меню (управление товарами)

Управляется `pos_manager` в `/pos/manager/menu`:
- Категории (Bar, Coffee, Food, VIP Service…).
- Товары: name, category, price (TZS по умолчанию), is_active, optional stock_unit.
- История изменений цены (immutable audit).

Менеджер казино (`manager`) видит menu read-only из Finance Dashboard. Finance может править price (audit).

---

## 4. Биллинг — Hybrid

Каждый заказ имеет `payment_mode`:
1. `cash` — наличные, оседают в POS-кассе.
2. `card` — безнал (cashless ref optional), оседает в POS-кассе.
3. `comp_player` — за счёт казино, привязан к `player_id` → создаёт запись в `expenses` казино с категорией `POS Comp` и target_player.
4. `comp_house` — общий комп (без игрока), expense казино, target casino.

POS-касса — **независимый** денежный поток:
- Своя смена `pos_shifts` (open/close с opening_cash и closing_cash).
- Свой Z-отчёт по закрытию смены: total cash, total card, total comps, по категориям, по официанту.
- НЕ влияет на Cage баланс. Только comps попадают в expenses казино.

---

## 5. Потоки

**Waiter:**
1. Открывает смену (вводит opening cash).
2. Создаёт заказ: выбор товаров (большие тач-кнопки по категориям) → выбор стола / "Bar" / "Player card" → payment mode → confirm.
3. Заказ уходит в `pos_orders` со статусом `pending` → видим на Bar Display.
4. Bartender отмечает `ready` → waiter видит и относит.
5. Закрытие смены: вводит фактический cash, считает разницу, Z-отчёт.

**Bartender (Bar Display):**
- Колонка pending / preparing / ready (последние 30 мин).
- Только тап "Готово". Никаких цен.

**Pit → comp заказ:**
- В `ActivePlayers` кнопка "Order" на сидящем игроке → mini-форма (выбор товаров) → создаёт заказ `comp_player` + позицию на столе игрока. Bartender видит на своём экране с пометкой VIP + table number.

---

## 6. Inventory

Минимальная версия:
- Поле `stock_qty` на товаре (nullable).
- Каждый order_item уменьшает `stock_qty`.
- Manual stock-in от pos_manager (add/adjust с reason, immutable log).
- Алерт "low stock" на dashboard pos_manager (порог `low_threshold` на товар).
- Не реализуем рецептуру/ингредиенты — только готовые позиции.

---

## 7. Отчёты

В `/pos/manager`:
- Daily sales (по дню, категории, оплате, waiter).
- Shift Z-reports история.
- Inventory movements.
- Top items.

В существующем **Finance Dashboard** (видит manager/finance/super_admin):
- Карточка "POS Today" (cash / card / comps).
- В Expenses автоматически отображаются comp-заказы (категория POS Comp, target player).

В существующем **Reports** — линк "POS Reports" (deep-link в `/pos/manager/reports`, read-only для manager/finance).

---

## 8. Технические детали

### Новые таблицы (public):
- `pos_menu_categories` (id, casino_id, name, sort_order, is_active).
- `pos_menu_items` (id, casino_id, category_id, name, price_tzs bigint, stock_qty, low_threshold, is_active).
- `pos_menu_price_history` (audit, immutable trigger).
- `pos_shifts` (id, casino_id, waiter_user_id, opened_at, closed_at, opening_cash, closing_cash, z_report jsonb).
- `pos_orders` (id, casino_id, shift_id, waiter_user_id, player_id NULL, table_id NULL, payment_mode, total_tzs, status, created_at, ready_at, served_at, comp_reason, expense_id NULL).
- `pos_order_items` (id, order_id, item_id, qty, unit_price_tzs, line_total_tzs).
- `pos_inventory_movements` (id, item_id, delta, reason, user_id, created_at — immutable).

Все таблицы:
- `GRANT` для `authenticated` + `service_role` (см. правила проекта).
- RLS: scope по `casino_id` (через `useCasino`/JWT), POS-роли видят только свой casino + только свои смены (waiter), pos_manager — весь casino.
- Immutability triggers на `pos_orders`/`pos_order_items`/`pos_inventory_movements`/`pos_menu_price_history` (корректировки через новые записи, как везде в системе).
- Trigger: при `comp_player`/`comp_house` заказе автоматически создаёт строку в `expenses` (категория `POS Comp`) и записывает `expense_id` обратно в `pos_orders`.
- Trigger: при `pos_order_items` insert — `UPDATE pos_menu_items SET stock_qty = stock_qty - qty`.

### Enum:
- `pos_payment_mode`: `cash` | `card` | `comp_player` | `comp_house`.
- `pos_order_status`: `pending` | `preparing` | `ready` | `served` | `void`.
- `app_role`: добавить `pos_waiter`, `pos_bartender`, `pos_manager`.

### Realtime:
- `pos_orders` в supabase_realtime publication — для Bar Display и waiter live updates.

### UI:
- Полностью в существующем дизайн-системе (PageShell/PageHeader/FormGrid/DataTable/ResponsiveDialog).
- Waiter и Bar экраны — large touch buttons, минимум typing, density `touch` по умолчанию для POS-ролей.
- Свой POS-branded login (тот же `supabase.auth.signInWithPassword`, отдельный URL).

### Изоляция от основной CMS:
- В `AppSidebar` НЕ добавляем POS-секцию.
- В `App.tsx` маршруты `/pos/*` под отдельным layout, без `AppLayout`.
- POS-роли при логине через основной логин → редирект на `/pos/waiter` (или соответствующий).
- Не-POS роли при заходе на `/pos/*` → 403 (кроме `pos_manager` или прямого manager доступа к manager-страницам).

### Что НЕ трогаем:
- Cage, Tables, Pit, Reception, Finance Wallets, Chip Conservation — без изменений.
- `expenses` таблица — только пишем новые строки через trigger, схему не меняем (если хватает текущих полей; иначе добавим `pos_order_id` FK).

---

## 9. Этапы реализации

1. **M0 — Schema & roles.** Миграция: enum, таблицы, RLS, GRANTs, immutability triggers, expense-bridge trigger, realtime.
2. **M1 — Menu CRUD.** `/pos/manager/menu` для pos_manager.
3. **M2 — Waiter flow.** `/pos/login`, `/pos/waiter` с открытием смены, корзиной, оплатой, отправкой.
4. **M3 — Bar Display.** `/pos/bar` realtime kanban pending → ready.
5. **M4 — Shift close + Z-report.**
6. **M5 — Inventory + stock adjustments + low-stock alerts.**
7. **M6 — Pit "Order for player"** кнопка в ActivePlayers.
8. **M7 — Reports** (`/pos/manager/reports`) + карточки в Finance Dashboard.
9. **M8 — Memory + ACCESS-MATRIX.md update**, bump package.json version.

После одобрения плана начнём с M0 (миграция).
