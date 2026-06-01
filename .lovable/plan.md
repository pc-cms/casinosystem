# Daily Totals cleanup + Slots transfer rename

Pure frontend changes. Backend / formulas / version bump — не трогаем. ACE Fills и Slots Result в закрытии Slots остаются как есть (manual input, не участвует ни в одной формуле кроме `Slots Result = System − ACE Fills`).

## 1. `src/pages/ClosingsPage.tsx` — Daily Totals

**Убрать колонку `System Shift Result`:**
- Удалить `<SortTh label="System Shift Result" …/>` из `<thead>`.
- Удалить соответствующую `<td>` с `r.systemShiftResult`.
- Убрать `"systemShiftResult"` из `TotalSortKey`.
- Очистить из агрегации: поле `systemShiftResult` в `row()`, накопление `r.systemShiftResult += …`, выборку `system_shift_result` в `cage_slots_shifts` select.
- Поменять `colSpan={8}` → `colSpan={7}` в loading/empty строках.

**Починить Drop Tables:**
- Сейчас агрегируется `transactions.type = 'buy'`, но в проекте используется `'in'` (live game buy-in). Заменить:
  ```ts
  .eq("type", "buy")  →  .eq("type", "in")
  ```
- Это вернёт реальные данные в колонку Drop Tables (сейчас 0 / пусто).

## 2. Slots Cage transfers — переименовать "Ace Fill" → "Add Float"

Тип `fill` в `cage_slots_transfers` остаётся как есть в БД (никаких миграций), меняется только UI-лейбл.

- **`src/hooks/use-cage-slots-transfers.ts`** строка 32:  
  `fill: "Ace Fill"` → `fill: "Add Float"`
- **`src/components/cage-slots/SlotsTransfersForm.tsx`** строка 25:  
  `label: "Ace Fill"` → `label: "Add Float"`  
  description оставить либо обновить на нейтральное "Cash IN from manager safe to slots cage".

## 3. Закрытие Slots — без изменений

Поля `ACE Fills (TZS)` и `Slots Result (TZS)` в `ActiveSlotsShiftView.tsx` уже работают как требовалось:
- ACE Fills — manual numeric input в той же секции закрытия.
- Slots Result = `system_shift_result − ace_fills` — информативная метрика, пишется в `cage_slots_shifts.slots_result`, не участвует в Cash Desk / Balance / Cards Miss.

Ничего здесь не трогаем.

## Files

- `src/pages/ClosingsPage.tsx` — удаление колонки + фикс типа транзакции
- `src/hooks/use-cage-slots-transfers.ts` — лейбл
- `src/components/cage-slots/SlotsTransfersForm.tsx` — лейбл

Бэкенд (миграции, RPC, триггеры) не меняется → `package.json` НЕ бампается.
