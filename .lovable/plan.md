# M2 — POS Waiter flow (Player tabs, no cart)

Цель: официант открывает смену, бьёт позиции прямо «на карту игрока» (или walk-in), бартендер видит и меняет статус, оплата — гибридная (по умолчанию tab → close bill со сплитом, либо «pay now» по конкретной позиции). Без корзины.

---

## Модель

```
pos_shifts        — уже из M0
pos_tabs          — НОВАЯ. Открытый счёт = 1 игрок (или walk-in) в рамках смены.
pos_orders        — РЕФАКТОР. Каждый "send" = order, привязан к tab_id. Статусы по заказу.
pos_order_items   — без изменений.
```

Сейчас `pos_orders.payment_mode` + триггер expense-bridge срабатывают по заказу. В M2 это переезжает на уровень **tab** (оплата фиксируется при закрытии счёта), потому что в момент отправки на бар payment_mode ещё неизвестен.

### `pos_tabs`
- `id`, `casino_id`, `shift_id`, `opened_by_user_id`, `opened_at`, `closed_at`, `closed_by_user_id`
- `player_id` (nullable; null = walk-in)
- `walkin_label` (text nullable — "Bar 2", "Floor", etc., для walk-in)
- `status`: `open` | `closed` | `voided`
- `total_tzs` (computed by trigger из orders, минус void)
- `payment_split` jsonb (заполняется при close): `{cash, card, comp_player, comp_house}` sum == total
- `expense_id` (nullable, ставится триггером при закрытии если есть comp_*)
- Уникальный partial index: один **open** tab на одного `player_id` в смене (walk-in без ограничения).

### Изменения `pos_orders`
- `tab_id` uuid NOT NULL (FK pos_tabs).
- Поля `payment_mode`, `expense_id`, `comp_reason`, `player_id`, `table_id` — переезжают на `pos_tabs` (комп-обоснование и игрок — на tab). На `pos_orders` остаются: `tab_id`, `casino_id`, `shift_id`, `waiter_user_id`, `status`, `total_tzs`, таймстемпы.
- `status`: `pending` | `preparing` | `ready` | `served` | `voided`. Void допустим только пока статус `pending` или `preparing` (CHECK + trigger).
- Удалить старый expense-bridge trigger на orders. Новый — на `pos_tabs` при переходе `open → closed`.

### Триггеры
1. `pos_orders` AFTER INSERT/UPDATE → пересчитать `pos_tabs.total_tzs`.
2. `pos_orders` BEFORE UPDATE — запретить смену `status` из `ready/served/voided` обратно (immutable forward).
3. `pos_tabs` BEFORE UPDATE на close — валидация `sum(payment_split) = total_tzs`, минимум один способ.
4. `pos_tabs` AFTER UPDATE (закрытие) с `comp_player > 0` или `comp_house > 0` → создать `expenses` (категория `pos_comp`), сохранить `expense_id`.

### RLS / GRANT
- `pos_tabs`: SELECT/INSERT/UPDATE — все waiters текущей смены (любой waiter может дополнить чужой tab). pos_manager/super_admin — всё. Bartender — SELECT (для просмотра контекста заказа).
- Index: `(casino_id, shift_id, status)`, `(casino_id, player_id, status)`.

---

## UI (`/pos/waiter`)

Touch-first, density `touch`. Один экран — 3 колонки на десктопе/планшете, табы на мобиле:

### Колонка 1 — **Tabs** (открытые счета смены)
- Кнопки «+ New tab»: выбрать игрока (поиск по имени/CMS/RFID) ИЛИ «Bar walk-in» с label.
- Список открытых tabs: имя игрока (или walk-in label) · total · последние позиции · автор. Активный подсвечен.
- В шапке: текущая смена (`Shift #N · opened HH:mm`), opening cash, кнопка «Close shift» (placeholder для M4).

### Колонка 2 — **Menu** (для выбранного tab)
- Tabs по категориям (горизонтальный скролл). Большие квадратные кнопки товара: Name + Price.
- Тап = немедленно добавить позицию (qty 1) к текущему tab → orders статус `pending` уезжает бартендеру.
- Long-press / shift-tap = выбрать qty 2/3/5 на лету.
- Item disabled, если stock_qty=0.

### Колонка 3 — **Active tab** (детали выбранного)
- Шапка: игрок (или walk-in), opened_at, waiter author.
- Список orders (последние сверху), каждая позиция: name · qty · price · line_total · статус-чип (`pending` серый / `preparing` синий / `ready` зелёный / `served` muted / `voided` strike).
- Кнопка `Void` рядом с позицией — активна только если `pending`/`preparing` (после `ready` скрыта).
- Кнопка **Pay now** на позиции (для гибрида) → быстрый ResponsiveDialog: cash/card → создаёт мини-tab из этой одной позиции и закрывает её, основной tab продолжает.
- Итог: `Total: X TZS` крупно.
- **Close bill** primary button → ResponsiveDialog со сплитом: 4 поля (Cash / Card / Comp player / Comp house), live-валидация суммы = total, кнопка Confirm.
- Если игрока нет (walk-in) — comp_player отключён.

### Mobile
- Bottom tab-bar: Tabs / Menu / Active. Каждый — отдельный экран. Возврат к предыдущему контексту сохранён.

### Realtime
- `pos_orders` (уже в publication из M0) — статусы обновляются у waiter без перезагрузки.
- `pos_tabs` — добавим в `supabase_realtime` для общего view.

---

## Shift gate

Если у waiter нет открытой `pos_shifts` в текущем казино — `/pos/waiter` показывает «Open shift» card с полем opening_cash, после ввода создаёт `pos_shifts` и заходит в основной экран. Закрытие смены — отдельный milestone M4 (сейчас только заглушка).

---

## Hooks (новые)

`src/hooks/use-pos-shift.ts`
- `usePosCurrentShift(casinoId, userId)` — текущий open shift waiter'а.
- `useOpenPosShift()` — open with opening_cash.

`src/hooks/use-pos-tabs.ts`
- `usePosOpenTabs(casinoId, shiftId)` — все open tabs смены + realtime.
- `useOpenPosTab()` — {player_id | walkin_label}.
- `useClosePosTab()` — {payment_split}.
- `useVoidPosTab()`.

`src/hooks/use-pos-orders.ts`
- `usePosTabOrders(tabId)` — orders tab'а + realtime.
- `useAddPosOrder()` — `{tab_id, item_id, qty}` → создаёт order + 1 order_item; trigger пересчитывает total.
- `useVoidPosOrder()` — допускается только pending/preparing.

---

## Файлы

**Новые:**
- `src/pages/pos/PosWaiter.tsx` (полная реализация, заменяет заглушку)
- `src/components/pos/waiter/OpenShiftCard.tsx`
- `src/components/pos/waiter/TabsPanel.tsx`
- `src/components/pos/waiter/MenuPanel.tsx`
- `src/components/pos/waiter/ActiveTabPanel.tsx`
- `src/components/pos/waiter/NewTabDialog.tsx` (player search + walk-in label)
- `src/components/pos/waiter/CloseBillDialog.tsx` (split form)
- `src/components/pos/waiter/PayNowDialog.tsx`
- `src/hooks/use-pos-shift.ts`
- `src/hooks/use-pos-tabs.ts`
- `src/hooks/use-pos-orders.ts`

**Изменённые:**
- `supabase/migrations/...` — новая миграция:
    - `CREATE TABLE pos_tabs` + GRANT + RLS + триггеры.
    - `ALTER TABLE pos_orders` — добавить `tab_id`, удалить `player_id/table_id/payment_mode/comp_reason/expense_id` (если уже использовалось — переезжает на tab; пустые из M0 — drop columns).
    - DROP старый expense-bridge trigger; CREATE новый на `pos_tabs`.
    - `ALTER PUBLICATION supabase_realtime ADD TABLE pos_tabs`.
- `package.json` — version bump (миграция).

---

## Не входит в M2

- Закрытие POS-смены + Z-report — M4.
- Bar Display (статусы у бартендера) — M3 (но writes из M2 уже совместимы).
- Pit «Order for player» из ActivePlayers — M6.
- Stock-in / low-stock алерты — M5 (декремент stock на add order уже работает из M0).
- Печать чека — вне scope POS-модуля (отдельный milestone позже, если потребуется).

После одобрения запускаю миграцию, дальше код в одном проходе.
