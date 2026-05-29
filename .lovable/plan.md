# M1 — POS Menu CRUD

Goal: дать роли `pos_manager` (а также `manager`/`finance_manager`/`super_admin` — read-only) полноценный CRUD меню в `/pos/manager/menu`. Без касания waiter/bar UI, без логики заказов.

## Scope

1. Страница `/pos/manager/menu` внутри `PosLayout` (уже есть из M0).
2. Две сущности: **Categories** и **Items**, обе scoped по `casino_id` (из `useCasino`).
3. История цен пишется автоматически триггером (схема из M0).

## UI

### Layout
- `PageShell` + `PageHeader` (title "POS Menu", subtitle = casino name).
- Двухпанельная раскладка (desktop) / табы (mobile):
  - Left: **Categories** список (sort_order, name, active toggle, +Add, drag-to-reorder опционально — на M1 просто числовое поле `sort_order`).
  - Right: **Items** таблица отфильтрованная по выбранной категории (или All).

### Categories panel
- `DataTable`: Name · Sort · Active · Actions (Edit/Archive).
- Add/Edit через `ResponsiveDialog` с `FormGrid`: name (required), sort_order (number, default = max+10), is_active (switch).
- Архивирование = `is_active=false` (никаких DELETE — manual-entry / immutable принцип).

### Items panel
- Фильтры (FilterBar): Category select, Active only switch, search by name.
- `DataTable`: Name · Category · Price (TZS, space separator) · Stock · Low threshold · Active · Actions.
- Add/Edit `ResponsiveDialog` + `FormGrid`:
  - name (required)
  - category (select из активных категорий, required)
  - price_tzs (number, required, ≥0)
  - stock_qty (number, nullable — пусто = не отслеживается)
  - low_threshold (number, nullable)
  - is_active (switch, default true)
- На edit: если price_tzs изменилась → DB-триггер из M0 сам пишет запись в `pos_menu_price_history` (UI ничего не шлёт).
- Кнопка "Price history" на строке → drawer/dialog со списком изменений (audit, read-only).
- Архивирование `is_active=false`, без DELETE.

### Read-only режим
- Для ролей `manager`/`finance_manager`/`super_admin` (не `pos_manager`) — те же таблицы, но без кнопок Add/Edit/Archive (выводим Badge "Read-only").

## Hooks (новые)

`src/hooks/use-pos-menu.ts`:
- `usePosMenuCategories(casinoId)` — list + realtime.
- `useUpsertPosMenuCategory()` — insert/update (без delete).
- `usePosMenuItems(casinoId, { categoryId?, activeOnly?, search? })` — list + realtime.
- `useUpsertPosMenuItem()` — insert/update.
- `usePosMenuPriceHistory(itemId)` — list.

Все через React Query, инвалидируем по `['pos-menu', casinoId, ...]`.

## Routing

В `App.tsx` (или в `PosLayout`-роутере) добавить `/pos/manager/menu` → новый компонент `PosManagerMenu.tsx`. В существующем `PosManager.tsx` добавить ссылку-карточку "Menu".

## Access guard

В `PosLayout` уже есть проверка POS-роли. Дополнительно:
- Edit-кнопки скрываем если `role !== 'pos_manager'`.
- Для не-POS manager/finance/super_admin — разрешаем заход на `/pos/manager/menu` в read-only (через тот же layout без POS-навигации? — нет, оставляем PosLayout, чтобы не плодить дубликаты; они увидят POS-шапку, это нормально).

## Files

Новые:
- `src/hooks/use-pos-menu.ts`
- `src/pages/pos/PosManagerMenu.tsx`
- `src/components/pos/CategoryEditDialog.tsx`
- `src/components/pos/ItemEditDialog.tsx`
- `src/components/pos/PriceHistoryDialog.tsx`

Изменённые:
- `src/App.tsx` — добавить route `/pos/manager/menu`.
- `src/pages/pos/PosManager.tsx` — добавить навигационную карточку "Menu".
- `package.json` — version bump (patch).

## Не входит в M1

- Заказы, смены, Z-отчёты (M2–M4).
- Inventory stock-in движения и low-stock алерты (M5 — здесь только поля).
- Drag-and-drop сортировка категорий (можно позже; сейчас числовое `sort_order`).
- Удаление записей (никогда — только архивирование).

После одобрения — выполняю и возвращаюсь с подтверждением и предложением M2.
