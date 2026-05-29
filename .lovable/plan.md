## Cage Slots — обновление формул

### Новые формулы

```
ΔCash            = closingCash − openingCash            (оставляем для отображения)
Cash Desk Result = closingCash + Expenses − Ace Fill + Collection + LG_Out − LG_In
Cards Miss       = (openingCards − closingCards) × cardValue   (без изменений)
Slots Result     = systemResult
Expected         = systemResult
Shift Balance    = Cash Desk Result − systemResult − Cards Miss
```

`Cashless Balance` / `Cashless Final` — без изменений.

### Что меняется в коде

**1. `src/lib/cage-balance.ts` → `computeSlotsShiftBalance`**
- `cashDeskResult = closingCash + expenses − addFloat + collection + lgOut − lgIn`
- `slotsResult = systemResult`
- `expected = systemResult`
- `shiftBalance = cashDeskResult − systemResult − cardsMiss`
- Обновить JSDoc-комментарии в шапке файла.

**2. DB RPC `compute_slots_shift_balance_from_row`** (миграция)
- Привести к тем же формулам, чтобы записи в `cage_slots_shifts.cash_desk_result`, `slots_result`, `balance` совпадали с live preview.

**3. `src/components/cage-slots/SlotsShiftReportBody.tsx` — секция Balance Calculation**
Новый порядок строк:
```
Closing Cash
+ Expenses
− Ace Fill
+ Collection
+ LG Out
− LG In
= Cash Desk Result          (emphasize)
System Result
Slots Result (= System Result)
− Cards Miss
= Shift Balance             (emphasize)
```
- Убрать строки `Opening Cash`, `ΔCash`, `− (System − Opening)` из этой секции (Opening/Closing уже есть в Inventory выше).
- Подпись `Slots Result` поменять с `(System − Opening − Ace Fill)` на `(= System Result)`.
- Fallback-вычисления внутри компонента (когда `shift.*` пустой) переписать под новые формулы.

**4. Печатный отчёт `PrintSlotsShiftDialog.tsx` / `SlotsConsolidatedReport.tsx`**
- Синхронизировать ту же секцию Balance Calculation с новым порядком и подписями.
- Bank-строки и EOD MPESA-блок, добавленные в прошлом шаге, не трогаем.

**5. Версия**
- Bump patch в `package.json` (миграция + изменение бизнес-логики).

### Чего НЕ меняем
- Ввод полей (`openingCash`, `closingCash`, `systemResult`, `addFloat`/Ace Fill, expenses, collection, LG in/out, cards) — без изменений.
- Cashless секция и Cashless Final — без изменений.
- Inventory (Opening/Closing Cash таблицы) и все остальные секции отчёта — без изменений.

### Проверка после внедрения
- Открыть смену из истории, сверить значения в Balance Calculation вручную по новой формуле.
- Сверить, что DB-записанные `cash_desk_result` / `slots_result` / `balance` совпадают с UI.
