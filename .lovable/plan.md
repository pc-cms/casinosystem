
# План: модуль Cage Slots

Новый модуль для сверки слотовой смены. Только слоты (без столов и PP). UI **на английском**. Архитектурно — клон Live Game Cage, без фишек, но с «пластиковыми картами» как фишками номиналом 5 000 TZS. Переиспользуем всё, что уже есть.

## 1. Что переиспользуем (ничего не дублируем)

| Концепция | Источник |
|---|---|
| Cash inventory UI (TZS/USD/EUR/GBP/KES + номиналы) | `CashDenomInput`, `CurrencySection`, `CASH_DENOMS`, `calcCashTotalTzs` |
| Бизнес-день | `useEffectiveBusinessDate()` / RPC `get_current_business_date` |
| Casino scope | `useAuth().casinoId` + RLS `get_user_casino_id`, `has_role`, `is_manager_op` |
| Cashless (M-Pesa, T-Pesa/Tigo, H-Pesa/Halotel, AirTel) | таблица `cashless_transactions`, хуки `use-cashless` |
| Offline / outbox | `offlineMutation()` |
| Audit log | `logAction(casino_id, 'cage_slots', ...)` |
| Roles / меню | `role_module_defaults` + `effective_module_perms` |
| Print | паттерн `ShiftClosingReport` + `PrintPortal`, `window.print()` |
| Manager close с паролем | `ManagerOverrideDialog` |
| Mid-shift Cash Check | паттерн `cash_counts` (count_type `check`) |
| Correction после закрытия | паттерн `useCancelTransaction` |

## 2. Workflow (по ответам)

```text
draft → open → ready_for_review → approved/closed → (reversed)
```

- **Cashier** открывает смену сам (как Live Game Cage): вводит FX-курсы, opening cash inventory, opening cards → Open Shift.
- Во время смены: записывает cashless через существующий компонент, может делать **mid-shift Cash Check** (snapshot cash + cards, без закрытия — пишется в историю как сейчас в Cage), вносит System Shift Result, mid-edits разрешены.
- Closing: cashier вводит closing cash + closing cards → **Submit for Review** (= финальный Closing Check, фиксирует snapshot).
- **Manager** открывает Review-экран, проверяет калькуляцию, если `difference ≠ 0` — обязательный комментарий, затем **Approve & Close** через `ManagerOverrideDialog` (пароль менеджера, как везде в системе). Закрытие НЕ блокируется ненулевой разницей.
- После Closed: прямая правка запрещена RLS; правки только через **Reverse & Recreate** (новая смена со ссылкой `reverses_id`).

Смены: `day` 13:00–20:55 / `night` 20:45–05:00. Бизнес-дата берётся стандартно. Уникальность: одна **open** смена на (casino, business_date, shift_type).

## 3. Карты как «фишки 5000 TZS» (по выбору пользователя)

Никаких отдельных «card balance effect» с формулой `(opening+fill−credit−closing−miss)*5000`. Логика 1:1 с фишками Live Game:

- `opening_card_count` — введён вручную при открытии (как opening chip count).
- `closing_card_count` — введён вручную при закрытии.
- `miss_cards = closing − opening` (signed, может быть − или +). Полный аналог miss-фишек.
- TZS-стоимость = `miss_cards × card_deposit_value_tzs` (по умолчанию 5000, настраивается в `cage_slots_settings`).
- Никаких card_fill/card_credit — так как cards ведут себя как фишки одной деноминации, движения = просто closing − opening.
- Отрицательный miss = недостача, положительный = излишек. Цветом `cms-amount-negative` / `cms-amount-positive`.

В Closing Check и Shift Report карты показываются отдельной строкой рядом с currency-секциями.

## 4. Формула сверки (DB как source of truth)

DB-функция `compute_cage_slots_balance(p_shift_id) returns jsonb`:

```text
opening_total_tzs  = Σ opening cash × rates + opening_cards × deposit
closing_total_tzs  = Σ closing cash × rates + closing_cards × deposit
cash_movement_tzs  = closing_total_tzs − opening_total_tzs
cashless_net_tzs   = Σ cashless IN − Σ cashless OUT (только этой смены)
actual_cage_result = cash_movement_tzs − cashless_net_tzs
difference_amount  = actual_cage_result − system_shift_result
balanced           = difference_amount = 0
```

System Shift Result — одно число, может быть отрицательным (отображается красным `cms-amount-negative`).

Триггер на `cage_slots_shifts / cash_inventory / cards / cashless_transactions(WHERE cage_slots_shift_id IS NOT NULL)` пересчитывает `actual_cage_result` и `difference_amount` на родительской строке. Фронт ничего не считает — только отображает.

## 5. Cash Check (mid-shift + closing) — как в Live Game

Новая таблица `cage_slots_cash_counts` (1:1 паттерн `cash_counts`):
- `id`, `cage_slots_shift_id`, `count_type` (`opening | check | closing`), `denominations` jsonb (cash + cards + totals), `total_tzs`, `counted_by`, `created_at`.
- При Open автоматически seed-ится `opening` snapshot (как делает `useOpenShift`).
- Cashier кнопкой «New Check» делает `check` snapshot в любой момент — пишется в историю, не меняет статус смены.
- Submit for Review = создание `closing` snapshot + переход статуса в `ready_for_review`.
- История checks видна на вкладке Overview/Audit и идёт в Shift Report.

## 6. Cashless

Не плодим новую архитектуру. К существующей таблице `cashless_transactions` добавляем 2 nullable колонки: `cage_slots_shift_id uuid` и `source_module text` (`cage_slots`). Старые потоки не ломаются — поля nullable, default null.

На вкладке Cashless внутри смены: тот же UI/хук, что и на `/cashless`, но фильтр по `cage_slots_shift_id = current` и insert проставляет ссылку. Провайдеры: AIRTEL, MPESA, TIGO (T-Pesa), HALOTEL (H-Pesa) — уже в check constraint.

## 7. Структура БД (миграция)

Enums: `cage_slots_status`, `cage_slots_shift_type`.

Таблицы:
- `cage_slots_shifts` (id, casino_id, business_date, shift_type, cashier_id, opened_by/at, submitted_at, reviewed_by/at, closed_by/at, status, system_shift_result bigint, actual_cage_result bigint, difference_amount bigint, manager_comment, cashier_note, client_uuid uuid unique, reverses_id, created/updated_at).
- `cage_slots_exchange_rates` (shift_id, currency_code, rate_to_tzs numeric). UNIQUE(shift_id, currency_code).
- `cage_slots_cash_inventory` (shift_id, inventory_type, currency_code, denomination bigint, quantity int, rate_to_tzs, total_tzs bigint). UNIQUE(shift_id, inventory_type, currency_code, denomination).
- `cage_slots_cards` (shift_id UNIQUE, opening_card_count int, closing_card_count int, miss_card_count int, card_deposit_value_tzs bigint, card_balance_effect_tzs bigint).
- `cage_slots_cash_counts` (см. §5).
- `cage_slots_comments` (shift_id, comment_type, comment_text, created_by).
- `cage_slots_settings` (casino_id UNIQUE, card_deposit_value_tzs default 5000, updated_by/at).
- Колонки в `cashless_transactions`: `cage_slots_shift_id uuid NULL`, `source_module text NULL`.

Партиальный unique index: одна `open` смена на (casino_id, business_date, shift_type).

RLS зеркально `shifts` + `cashless_transactions`:
- SELECT/INSERT/UPDATE: cashier|manager_op|finance_manager|super_admin своего casino.
- UPDATE заблокирован если `status IN ('closed','approved','reversed')` (RLS USING-условие).
- Settings UPDATE — только manager_op|super_admin.

Audit — через существующий `logs` + `logAction` (kind `cage_slots`). Никакой новой audit-таблицы.

## 8. Frontend

```text
src/pages/cage-slots/
  CageSlotsDashboard.tsx          # список смен + фильтры
  OpenCageSlotsPage.tsx           # экран открытия (rates + opening cash + opening cards)
  CageSlotsShiftPage.tsx          # активная смена: tabs
  CageSlotsReviewPage.tsx         # экран менеджера
  CageSlotsReportPage.tsx         # printable

src/components/cage-slots/
  ShiftOverviewTab.tsx
  SystemResultTab.tsx             # одно поле + note, поддержка отрицательных
  CashInventoryTab.tsx            # CurrencySection × 5 currencies + Cards section
  CashlessTab.tsx                 # обёртка над существующим Cashless UI с фильтром
  CashChecksTab.tsx               # история checks + кнопка New Check
  PlasticCardsBlock.tsx           # opening/closing/miss как фишки
  BalanceCheckPanel.tsx           # таблица сверки
  AuditTab.tsx
  SubmitForReviewDialog.tsx       # = Closing Check
  CloseSlotsShiftDialog.tsx       # Manager approve, обязательный comment если diff≠0
  ReverseShiftDialog.tsx
  CageSlotsShiftReport.tsx        # print A4 + подписи

src/hooks/
  use-cage-slots-shift.ts
  use-cage-slots-inventory.ts
  use-cage-slots-cards.ts
  use-cage-slots-cash-counts.ts
  use-cage-slots-settings.ts
  use-cage-slots-cashless.ts      # тонкая обёртка над use-cashless
```

UI обязательно через `PageShell` / `PageHeader` / `PageSection` / `FormGrid` / `ResponsiveDialog` / `DataTable`. Все суммы — `formatNumberSpaces`, отрицательные `cms-amount-negative`. Даты — `fmtDate`. Все строки UI — английский.

Routing `/cage-slots`, `/cage-slots/open`, `/cage-slots/:id`, `/cage-slots/:id/review`, `/cage-slots/:id/report`. Sidebar entry «Cage Slots» через `role_module_defaults` (cashier/manager/pit/finance_manager/super_admin → view; cashier/manager → edit).

## 9. Offline / Sync

Все write-операции (`shifts`, `inventory`, `cards`, `cash_counts`, `cashless`) идут через `offlineMutation()`. `client_uuid` обеспечивает идемпотентность при ресинке. Поведение 1:1 с текущим Cage: на офлайне закрытие помечается `requires_review=true`, audit `..._OFFLINE`.

## 10. Shift Report (print)

`CageSlotsShiftReport.tsx` использует тот же print CSS, что `ShiftClosingReport`. Секции:

1. Header: casino, business_date, shift_type, opened/closed times, cashier, manager, status.
2. System Result (с note).
3. Opening Cash Inventory (по валютам + Cards).
4. Closing Cash Inventory (по валютам + Cards).
5. Cashless Summary (по провайдерам IN/OUT/Net).
6. Plastic Cards: opening / closing / miss / TZS-effect.
7. Balance Calculation (полная формула из §4).
8. Difference (зелёный Balanced / жёлтый Difference Found).
9. Manager Comment.
10. Signature lines: Cashier / Manager.

`window.print()` → PDF.

## 11. Validations

- Open: все 5 FX-rates > 0, opening cash inventory непустая, opening_card_count указан.
- Submit for Review: system_shift_result введён (может быть 0 или отрицательный), closing cash непустая, closing_card_count указан.
- Manager Close: если `difference_amount ≠ 0` — `manager_comment` обязателен (валидация формы + DB check).
- Closed смена: UPDATE заблокирован RLS, кнопки disabled; только Reverse.

## 12. Порядок реализации

1. Миграция (enums + 7 таблиц + 2 колонки в cashless + RLS + триггеры + `compute_cage_slots_balance` + seed `cage_slots_settings` для всех casino) + bump `package.json`.
2. Hooks + типы.
3. Pages + components (Dashboard → Open → Shift tabs → Review → Report).
4. Sidebar entry + `role_module_defaults` row + route gating.
5. Печать + smoke-test закрытия с/без разницы + offline-сценарий.

## 13. Out of scope (явно)

PP machines, table games, per-machine slot data, импорт-парсеры, миграция Excel, новая cashless-модель, новая бизнес-дата, кросс-casino отчёты, Daily/Monthly Slots summary (можно добавить позже).
