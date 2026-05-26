
## Slot Cage — приведение опенинга к канонической формуле

### Целевые формулы
```
ΔCash             = ClosingCash − OpeningCash       (CASH + MOBILE + BANK, БЕЗ карточек)
Slots Desk Result = ΔCash + Expenses + Collection − AddFloat + LiveGameOut − LiveGameIn
                    (Miss Card НЕ входит)
Slots Result      = вводится вручную (system_result)
Miss Card         = (CardOpening − CardClosing) × 5000
                    + если карты ушли (продали) → касса в плюсе
                    − если карты пришли (выкупили) → касса в минусе
Shift Balance     = Cash Desk Result − Slots Result − Miss Card    (идеал = 0)
```
Карточки — **только счётчик пластика**, не деньги в опенинге. Цена 5 000 TZS/шт используется только для расчёта Miss Card.

---

### Что менять

**1. `src/components/cage-slots/OpenSlotsShiftScreen.tsx`**
- Строка 50: убрать `+ cardsTzs` → `grandTotal = tzsTotal + fxTotalTzs`.
- Строка 147 (Step-1 Subtotal): убрать `+ cardsTzs`.
- В секции «Plastic Cards (Opening)» убрать подпись `× TZS …` и нижнюю строку с TZS-итогом — оставить только поле количества и пояснение что цена 5 000 TZS используется для Miss Card на закрытии.
- `opening_card_count` и `card_deposit_value_tzs=5000` продолжаем писать в `cage_slots_cards` (нужны для Miss Card).

**2. `src/hooks/use-cage-slots.ts`**
- В `useOpenSlotsShift` (строка ~314) убрать `+ input.opening_card_count * input.card_deposit_value_tzs` из `total_opening_tzs`. Snapshot `cards.{count,value_tzs}` в snapshot-payload остаётся (для аудита).

**3. `src/lib/cage-balance.ts`**
- **НЕ ТРОГАЕМ** знак: `cardsMiss = (openingCards − closingCards) × cardValue` уже соответствует требованию (+ ушли / − пришли).
- Обновить только JSDoc сверху, чтобы текст соответствовал согласованной семантике знака.

**4. БД-триггер `compute_slots_shift_balance_from_row`**
- Проверить через миграцию: `cards_miss = (opening_card_count − closing_card_count) × card_deposit_value_tzs`. Если уже так — миграция не нужна; если иначе — выровнять.
- Убедиться, что в `cash_desk_result` карты не входят (только ΔCash + Expenses + Collection − AddFloat + LG_Out − LG_In).
- Если потребуется правка триггера → bump `package.json` patch.

**5. `src/components/cage-slots/ActiveSlotsShiftView.tsx`**
- TileCard «Cards Closing» подпись `Miss: …` — отображает `openingCards − closingCards` (для согласованности со знаком Miss Card).
- Лейблы Cards Miss / Balance оставить как есть — `Stat … signed` уже подкрасит + зелёным / − красным.

---

### Что НЕ трогаем
- Схему таблиц `cage_slots_cards` / `cage_slots_shifts`.
- Логику Expenses / Collection / AddFloat / LG transfers / Cashless — формула CDR уже совпадает.
- UI инвентаря, истории, печать.

---

### Проверка после деплоя
1. Опенинг: ввели N карт × 5 000 → `Grand Total` не содержит этой суммы; карты показаны отдельным счётчиком.
2. Закрытие c меньшим числом карт (продали) → `Cards Miss` положительный (зелёный), Balance соответствует.
3. Закрытие с бо́льшим числом карт (выкупили) → `Cards Miss` отрицательный (красный).
4. Значения `cards_miss` в `cage_slots_shifts` (БД) совпадают с UI.
