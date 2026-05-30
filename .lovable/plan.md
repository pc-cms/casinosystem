## Что чинится

Чаевые (`tips_live`, `tips_poker`, `tips_floor`) физически лежат в кассе и попадают в `closingCashTotalTzs`, но в формуле Shift Balance их нет — отсюда «плюс» ровно на сумму tips (вчера +165 000).

Текущая формула (`src/lib/cage-balance.ts` + DB RPC `compute_shift_balance`):
```
Cash Desk Result = ΔCash + Expenses + Collection − AddFloat + SlotsOut − SlotsIn
Shift Balance    = Cash Desk Result − Tables Result − Miss
```

Новая формула:
```
Shift Balance    = Cash Desk Result − Tables Result − Miss − Tips
```
(`Tips` = сумма `tips_live + tips_poker + tips_floor` транзакций **этой смены**.)

## Изменения

1. **`src/lib/cage-balance.ts`** — добавить опциональное поле `tips` в `CageBalanceInputs`, вычитать из `shiftBalance`. Комментарий канонической формулы обновить.

2. **`src/components/cage/CloseShiftDialog.tsx`**
   - Загрузить tips текущей смены: `SELECT amount, type FROM transactions WHERE shift_id = :id AND type IN ('tips_live','tips_poker','tips_floor') AND cancelled_at IS NULL` (один useEffect или extend `useTransactions`).
   - Передать `tips: tipsTotal` в `computeShiftBalance`.
   - В правой панели формулы (≈ строка 452) добавить строку `− Tips` под `− Miss Chips`.
   - В пропсы `<ShiftClosingReport …>` передать `tipsTotal` (для display-консистентности).

3. **`src/components/cage/ShiftClosingReport.tsx`**
   - `tipsByShift` уже грузится. Сейчас показывается как «informational, NOT included». Переместить блок Tips Day/Tips Night **внутрь Summary до Shift Balance** (между Casino Expenses и Shift Balance) с пометкой «− Tips» — чтобы печатный отчёт совпадал с диалогом. Сам `balance` приходит готовый из caller (CloseShiftDialog/Reprint), формула там уже скорректирована.

4. **`src/components/cage/ReprintShiftDialog.tsx`** — пересчитать баланс на лету с учётом tips закрытой смены (либо взять сохранённый `cash_desk_balance` из `shifts`, если уже сохранён с правильной формулой → тогда менять не надо; проверю при имплементации).

5. **DB RPC `compute_shift_balance`** — обновить миграцией: добавить `_tips` параметр или внутри функции SUM tips по `shift_id`. Это нужно чтобы исторические `shifts.cash_desk_balance`, перезаписи и `daily_summaries` тоже соответствовали. Auto-bump `package.json` версии (backend change).

## Вопрос перед стартом

Tips копятся отдельно (выплачиваются дилерам по ведомости в Monthly Tips). Когда касса физически отдаёт tips дилерам/poker/floor — это происходит **внутри той же смены** (тогда `ΔCash` сама себя обнуляет) или **позже из накопителя**? Если позже, моя правка корректна (вычитаем tips, чтобы остаток в кассе считался ожидаемым). Если в ту же смену через `expense`/выплату — двойного учёта не будет, но надо проверить, что выплата tips НЕ записывается как обычный expense.

Если коротко: подтверди — **tips физически остаются в кассе на момент закрытия смены и выплачиваются позже** (тогда план как описан выше).
