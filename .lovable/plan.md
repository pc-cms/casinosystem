## Цель

Разделить Cage Slots и Cage Live Game на **две независимые кассы** с раздельными балансами, отдельными Expenses и Cashless. Между ними остаются только трансферы (уже есть `cage_slots_in`/`cage_slots_out` / `cage_lg_in`/`cage_lg_out`), которые фиксируются в отчёте каждой кассы.

Дополнительно: глобально, при вводе транзакции в кассе (Live Game и Slots) рядом с полем оператора Cashless показывать **серую подсказку** с суммой уже записанных транзакций по этому оператору за смену.

---

## Изменения

### 1. Раздельность Cashless (Slots vs Live Game)
- Добавить колонку `cage_type` в `cashless_transactions` со значениями `'live_game' | 'slots'` (default `'live_game'`, NOT NULL после backfill).
- Backfill: если `shift_id` указывает на `cage_slots_shifts` → `'slots'`, иначе `'live_game'`.
- Trigger при INSERT: автоматически выставлять `cage_type` по таблице смены (если не передано явно).
- Хуки:
  - `use-cashless.ts` → фильтр по `cage_type='live_game'` на странице Live Game и в Live Game cage.
  - `use-cage-slots.ts` (`useCageSlotsCashless`) → фильтр `cage_type='slots'`.
- Страница `/cashless` (Live Game) показывает только LG. Добавить новую вкладку/страницу `/cage-slots/cashless` или таб внутри Slots — оставить отдельно по аналогии.

### 2. Раздельность Expenses (Slots vs Live Game)
- Добавить колонку `cage_type` в `expenses` (`'live_game' | 'slots'`, default `'live_game'`).
- Trigger: при INSERT с `shift_id` на cage_slots_shifts → `'slots'`.
- Хук `useExpenses(date)` принимает опционально `cage_type` фильтр.
- Страница `/expenses` остаётся для Live Game (фильтр `live_game`).
- В **Cage Slots** добавить кнопку «Expense» в шапке `ActiveSlotsShiftView`: открывает тот же диалог что и в Live Game cage, но создаёт расход с `cage_type='slots'` и `shift_id` слотовой смены.
- Sub-page истории расходов Slots — компактный список в табе «Expenses» Slots-кассы.

### 3. Раздельные балансы и закрытие
- Уже сейчас Slots-смена закрывается отдельно (`cage_slots_shifts`). Подтверждаем:
  - Баланс Live Game считается только по транзакциям/expenses/cashless с `cage_type='live_game'`.
  - Баланс Slots — только по `cage_type='slots'`.
- Трансферы между кассами (`cage_slots_in/out`, `cage_lg_in/out`) уже зеркальные → продолжают учитываться в Cash Flow обеих смен и в Shift Closing Report соответствующей кассы (добавим отдельный блок «Inter-Cage Transfers» в отчётах обеих сторон).

### 4. Серая подсказка по оператору Cashless в кассе
- Хук `useCashlessTotalsByOperator(shiftId, cageType)` — `SUM(amount) GROUP BY operator` для текущей смены.
- В компоненте `CashlessForm` (Live Game и Slots) под полем «Operator» / рядом со списком операторов отрисовать `text-muted-foreground` подсказку: `Mpesa: 1 250 000 · Tigo: 320 000 · ...`. Только записанные операторы.
- Подсказка обновляется реактивно через invalidation после успешной записи.

### 5. Shift Closing Report
- В отчёте Live Game: добавить строку «Cage Slots IN / OUT» в Cash Flow панели и в Summary (как отдельный сумматор Inter-Cage Transfers).
- В отчёте Cage Slots: симметрично «Cage LG IN / OUT».

---

## Файлы (ориентировочно)

**Миграция (одна):**
- `cashless_transactions.cage_type` + backfill + trigger + index
- `expenses.cage_type` + backfill + trigger + index

**Хуки:**
- `src/hooks/use-cashless.ts` — фильтр по `cage_type`
- `src/hooks/use-expenses.ts` — фильтр по `cage_type`
- `src/hooks/use-cage-slots.ts` — выставлять `cage_type='slots'` при insert cashless
- новый `src/hooks/use-cashless-operator-totals.ts`

**Компоненты:**
- `src/components/cage/CashlessForm.tsx` — серая подсказка
- `src/components/cage-slots/SlotsCashlessForm.tsx` (или общий) — серая подсказка
- `src/components/cage-slots/ActiveSlotsShiftView.tsx` — кнопка Expense + диалог
- `src/components/cage-slots/SlotsExpensesForm.tsx` (новый) — диалог/таб
- `src/components/cage/ShiftClosingReport.tsx` — блок Inter-Cage Transfers
- `src/pages/CageSlotsReport.tsx` — блок Inter-Cage Transfers
- `src/pages/Expenses.tsx` — фильтр LG only

**Без изменений:** структура смен, role-access, RLS-логика (только добавление колонок).

---

## Что НЕ делаем
- Не объединяем балансы.
- Не трогаем существующие зеркальные трансферы (логика IN→зеркальный OUT уже работает).
- Не меняем закрытие Live Game.

Подтвердишь — запускаю миграцию и правки.