## Изменения формулы Cage Slots

### Новая каноническая формула

```text
ΔCash            = ClosingCash − OpeningCash
Cash Desk Result = ΔCash + Expenses + Collection − AddFloat (Fill)
                 + LG_Out − LG_In + Cashless_Out − Cashless_In
Cards Miss       = (OpeningCards − ClosingCards) × CardValue
Slots Result     = System Result − OpeningCash − AddFloat (Fill)   ← НОВОЕ
Shift Balance    = Cash Desk Result − Slots Result − Cards Miss
```

`Slots Result` — производная величина (нормально может быть отрицательной), отдельно от введённого вручную `System Result`.

---

## Что меняем

### 1. `src/lib/cage-balance.ts`
- В `SlotsBalanceResult` добавить `slotsResultDerived: number`.
- Считать `slotsResultDerived = systemResult − openingCash − addFloat`.
- `shiftBalance = cashDeskResult − slotsResultDerived − cardsMiss`.
- Поле `slotsResult` оставить = `systemResult` для обратной совместимости снапшотов.

### 2. `src/components/cage-slots/ActiveSlotsShiftView.tsx` — плитка на «дашборде» смены
- В верхнем strip (строка из 5 плиток) заменить **Balance (TZS) · Last Check** на **Slots Result (TZS)**:
  - значение = `slotsResultDerived`, может быть отрицательным;
  - стили `cms-amount-negative` / `cms-amount-positive`;
  - подпись `System − Opening − Fill`.
- Удалить логику `lastCheckBalance` (больше не используется).
- В Closing Preview и Manager Review добавить строку **Slots Result** рядом с System Result.
- В снапшоты `totals` (mid-check и closing) писать `slots_result_derived` дополнительно к существующим полям.

### 3. `src/components/cage/CashCheckViewerDialog.tsx` — режим `balanceMode="slots"`
- Заменить текущий 6-stat strip на 4 плитки: **Cash Count** · **System Result** · **Slot Result** · **Shift Balance**.
  - Cash Count = `totals.total_tzs` (наличка).
  - System Result = `totals.slots_result` (введённое).
  - Slot Result = `totals.slots_result_derived` (новое).
  - Shift Balance = `totals.shift_balance` (выделить рамкой, как сейчас).
- Скрыть секцию **TZS Chips** полностью, когда `balanceMode === "slots"` (в slots cage чипов нет).
- В компактной шапке диалога рядом со временем выводить `Balance: ±N` (либо `Balanced`, либо знаковая разница) — это и есть «в строке пишем Balance или разницу».

### 4. `src/components/cage-slots/CageSlotsHistoryView.tsx`
- Добавить колонку **Slots Result** (после «System»), стилизованную знаково. Колонки «Cash Desk Result», «Cards Miss», «Balance» оставить.

### 5. Без изменений
- DB-триггер `compute_slots_shift_balance_from_row` уже считает `shift_balance = CDR − slots_result − cards_miss`. Поскольку клиент будет писать `slots_result_derived` в `shifts.slots_result`, формула на сервере останется корректной. *(Подтверждаем при реализации: миграция не требуется — клиент закрывает смену с уже вычисленным `slots_result = systemResult − openingCash − fill`.)*

### Технические детали
- Тип `SlotsBalanceResult` расширяется одним полем — все вызовы хука получат его автоматически через destructure.
- В JSONB `cash_counts.denominations.totals` добавляем ключ `slots_result_derived`; старые чеки без этого ключа графятся как `0` (graceful fallback).
- Чисто UI/presentation-изменения, никаких миграций БД и edge-функций. `package.json` патч-бамп НЕ нужен (по правилу: backend без изменений).
