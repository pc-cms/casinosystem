## Goal
Когда ячейка в Breaklist находится близко к нижнему краю экрана, выпадающее меню (BR/TR/SRT/CLS/S + Assign to table) должно открываться **вверх**, а не вниз — чтобы не вызывать скролл страницы и не "растягивать окно".

## Changes

**File:** `src/components/pit/BreaklistGrid.tsx`

1. Расширить state `activeCell` полем `dropUp: boolean`.
2. В `handleCellClick` принимать `MouseEvent`, измерять `getBoundingClientRect()` ячейки и сравнивать `window.innerHeight - rect.bottom` с порогом ~240px (высота поповера с секцией Assign to table). Если места снизу недостаточно — `dropUp = true`.
3. В `onClick` ячейки (строка 377) пробросить `e`: `onClick={(e) => isEditable && handleCellClick(dealer.id, slot, e)}`.
4. В рендере поповера (строка 402) заменить статичный `top-8 left-0` на условный класс:
   - `dropUp` → `bottom-8 left-0`
   - иначе → `top-8 left-0`

## Notes
- Порог 240px подобран под максимальную высоту поповера (5 ролей в ряд + до ~7 строк столов).
- Логика чисто клиентская, без изменений данных/RPC. Версию `package.json` не бампим (UI-only).
