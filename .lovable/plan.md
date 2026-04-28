## Goal

Add a new **TRANSFERS** tab in the Cage shift view (next to IN / OUT / CHECK) that handles 4 internal cage operations:

1. **ADD FLOAT** — manager пополняет кассу деньгами из сейфа (cash → cage)
2. **COLLECTION** — забор наличных из кассы в сейф менеджера (cage → safe)
3. **FILL** — отправка фишек из кассы на стол (chip inventory: cashier → table)
4. **CREDIT** — возврат излишка фишек со стола в кассу (chip inventory: table → cashier)

Все 4 типа учитываются при закрытии смены и закрытии столов.

---

## 1. Database — new `cage_transfers` table

Создаётся новая иммутабельная таблица (отдельно от `transactions`, чтобы не смешивать player IN/OUT с кассовыми операциями).

```text
cage_transfers
├── id              uuid PK
├── casino_id       uuid (RLS isolation)
├── shift_id        uuid (NOT NULL, валидируется триггером — должен быть open)
├── transfer_type   text  ('add_float' | 'collection' | 'fill' | 'credit')
├── direction       text  ('cash_in' | 'cash_out' | 'chip_to_table' | 'chip_from_table')
├── table_id        uuid NULL (только для fill/credit)
├── amount          bigint  (TZS, обязательно для add_float/collection; для fill/credit — суммарная стоимость фишек)
├── chips           jsonb NULL ({denomination: quantity}, только для fill/credit)
├── note            text  default ''
├── operator_id     uuid NOT NULL (cashier)
├── approved_by     uuid NOT NULL (manager — Manager Override required для add_float/collection)
├── created_at      timestamptz default now()
```

**Triggers:**
- `prevent_cage_transfer_modify` — UPDATE/DELETE запрещены (immutability rule).
- `validate_cage_transfer`:
  - сумма > 0
  - для `fill`/`credit` — `table_id` обязателен и chips not null
  - для `add_float`/`collection` — `table_id` должен быть NULL
  - `transfer_type` валидируется по списку
- `cage_transfer_apply_chip_movement` — для `fill` уменьшает `chip_inventory` cashier и увеличивает table (location_type='table', location_id=table_id); для `credit` — наоборот. Использует ту же логику, что и существующий `apply_chip_movement_from_transaction`.
- `auto_log_cage_transfer` → пишет запись в `activity_logs` (category='transaction', action=upper(transfer_type)).

**RLS:**
- SELECT: `casino_id = get_user_casino_id(auth.uid())` + super_admin/finance_manager/surveillance.
- INSERT: cashier или manager в своём casino, `operator_id = auth.uid()`, `approved_by NOT NULL`.
- UPDATE/DELETE: запрещены через триггер.

---

## 2. Manager Override

Для `add_float` и `collection` форма требует подтверждения через существующий `ManagerOverrideDialog` (как в Expenses/Blacklist). `approved_by` сохраняет id менеджера, подтвердившего операцию.

`fill` и `credit` — **без override** (это обычная операция кассира с инспектором). Но `approved_by` всё равно заполняется (= operator_id, либо отдельный флоор-инспектор; в MVP = operator_id).

---

## 3. Hook — `src/hooks/use-cage-transfers.ts`

```text
useCageTransfers(shiftId)         — list для текущей смены
useCreateCageTransfer()           — insert mutation, проходит через offlineMutation
                                    (для оффлайн-устойчивости как и transactions)
```

Возвращаемые типы — `Tables<"cage_transfers">`.

---

## 4. UI — `ActiveShiftView.tsx`

### 4.1 Tabs
TabsList → 4 колонки: **IN / OUT / CHECK / TRANSFERS**. Иконку для TRANSFERS возьмём `ArrowLeftRight` из lucide-react.

### 4.2 Новый компонент `TransfersForm` (внутри ActiveShiftView или отдельный файл `src/components/cage/TransfersForm.tsx`)

Layout: тот же `TwoColumnLayout` (форма слева, список справа).

**Левая колонка — форма:**
- Селектор типа: 4 кнопки-чипа `Add Float | Collection | Fill | Credit` (toggle group).
- В зависимости от выбранного типа:
  - **Add Float / Collection**:
    - `NumberInput` сумма (TZS).
    - `Textarea` note (опционально).
    - Кнопка submit → открывает `ManagerOverrideDialog` → после подтверждения insert.
  - **Fill / Credit**:
    - Селектор стола (горизонтальный список `openTables`, как в InForm).
    - `ChipDenomInput` (как в InForm) — выбор фишек.
    - Auto-calculated total TZS под чипами.
    - Note (опционально).
    - Submit без override.

**Правая колонка — `CageTransfersTable`:**
Колонки: Type | Table | Amount | Note | Time. Сортировка desc по `created_at`. Цвет:
- `add_float`, `credit` → `cms-amount-positive` (приход в кассу cash/chips)
- `collection`, `fill` → `cms-amount-negative` (расход из кассы)

### 4.3 Header KPI bar

Добавить два новых поля справа от Expenses (или заменить Txns counter):
- `+ Add Float` (sum cash_in)
- `− Collection` (sum cash_out)

**Обновить формулы:**
```text
expectedCash =
  openingFloat
  + totalIns          (player buys)
  + totalAddFloat     (NEW)
  − totalOuts         (player cashouts)
  − totalCollection   (NEW)
  − totalExpenses
```

`Fill` / `Credit` не влияют на cash KPI в шапке (это обмен фишками, не cash). Но они влияют на chip inventory кассы и стола → автоматически учитываются в `Close Tables` (через chip_inventory триггер) и в `Close Shift` (через finalize_floor_to_miss_chips).

### 4.4 Close Shift Dialog
`CloseShiftDialog` уже считает `cashResult = totalIns − totalOuts`. Передать туда новые суммы:
```text
cashResult = totalIns + totalAddFloat − totalOuts − totalCollection
```
(Add Float увеличивает прибыль смены? — нет, это просто пополнение кассы менеджером, не выигрыш. Поэтому **в `cash_result` НЕ включаем** add_float/collection — они влияют только на `expectedCash` для сверки физического остатка. `cash_result` остаётся `totalIns − totalOuts`.)

Резюме: `expectedCash` учитывает все 4 типа cash-движений; `cash_result` (= прибыль кассы) учитывает **только** player IN/OUT.

---

## 5. Files

**New:**
- `supabase/migrations/<timestamp>_cage_transfers.sql` — таблица + триггеры + RLS
- `src/hooks/use-cage-transfers.ts`
- `src/components/cage/TransfersForm.tsx`
- `src/components/cage/CageTransfersTable.tsx`

**Edited:**
- `src/components/cage/ActiveShiftView.tsx` — 4-я табка, новые KPI, передача totals в CloseShiftDialog
- `src/components/cage/CloseShiftDialog.tsx` — отображение Add Float / Collection в сводке (read-only)

**Auto-regenerated:**
- `src/integrations/supabase/types.ts` (после миграции)

---

## 6. Edge cases / правила

- Insert требует open shift (триггер `validate_transaction_shift`-аналог).
- Transfer immutable — корректировка только через обратную операцию (например, ошибочный Fill компенсируется Credit).
- Логирование в `activity_logs` (60-day retention).
- Offline: `useCreateCageTransfer` использует `offlineMutation`, как и `useCreateTransaction`.
- Все суммы в TZS (`bigint`). Foreign currencies для Add Float/Collection в MVP не поддерживаем — только TZS.

---

## 7. Open assumptions (подтвердить если не так)

- Add Float и Collection — **только TZS** в MVP (foreign-currency пополнения добавим позже при необходимости).
- Fill/Credit не привязываются к игроку.
- Manager Override использует существующий `ManagerOverrideDialog` (через edge function `verify-manager`).
- В шапке смены добавляем 2 новые ячейки KPI (Add Float, Collection); Fill/Credit показываются только в табе TRANSFERS, в шапке не дублируются.
