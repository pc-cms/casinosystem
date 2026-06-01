## Проблема

1. Каждый отчёт растягивается на 3 страницы вместо 1 (`min-height: 281mm` + padding `@page 8mm` + увеличенные шрифты/паддинги превышают полезную область A4).
2. В сетке столов Cash Desk Report колонки **Open** и **Close** показывают пустоту/нули — суммы открытия и закрытия по столам не видны.
3. Chip Movement Report (3×2) с увеличенными ячейками тоже не помещается.

## Что делаю

### 1. `src/components/cage/ShiftClosingReport.tsx`
- Убираю `minHeight: 281mm` и `flex flex-col` — пусть высота тянется по контенту, страница остаётся одна.
- Возвращаю компактные размеры: `fontSize 11px` (10px при >14 столов), `lineHeight 1.3`, паддинги ячеек `2px/4px` (вместо 5px и `py-1.5`).
- Убираю инлайновый `<style>` который форсил `padding-top/bottom: 5px` на всех td/th.
- **Fix Open/Close totals:** проверяю `rowFor()` — если `dailyResults[t.id]` отсутствует, используется `baselines` (TZS-сумма baseline по чипам) и `sumChipsObj(closing_chips)`. Когда смена только-только закрыта и `table_daily_results` ещё не материализована, `baselines` пуст для конкретной смены — добавляю фолбэк через `baselineByDenom` суммированием по `CHIP_DENOMS`, и для Close — фолбэк на последний chip_snapshot `actual_quantity` если `closing_chips` пуст. Это вернёт реальные суммы Open/Close в строках и в итоговом ряду.

### 2. `src/components/cage/ChipMovementReport.tsx`
- Убираю `minHeight: 281mm` и `flex-1` на секциях/таблицах — высота по контенту.
- Сжимаю `DenomTable`: `fontSize 11px`, `py-0.5`, заголовок секции `text-[11px]`. Сохраняю layout 3 ряда × 2 колонки.
- Header (Casino · Date · Cashier) делаю одной компактной строкой.
- В итоге 6 маленьких таблиц помещаются на одном A4 портрет.

### 3. `src/index.css` (print rules)
- Оставляю `@page cashdesk-portrait { size: A4 portrait; margin: 8mm }`.
- Гарантирую `page-break-after: always` только для `#shift-print-area` и `page-break-before: always` для `#chip-print-area` — итого ровно 2 страницы (по одной на отчёт), без «хвостов» третьей.
- Убираю любые forced `min-height` через `!important`, если такие остались.

### 4. `src/components/cage/ReprintShiftDialog.tsx`
- Синхронизирую inline-стили iframe: `width: 194mm`, **без** `min-height: 281mm`, `page-break-after: always` для shift, `page-break-before: always` для chips.

### 5. Bump версии
- `package.json` 1.3.236 → 1.3.237 (изменения бекенда нет, но печать критична — пользователю нужен cache-bust).

## Результат
- Cash Desk Report — 1 страница A4 портрет, видны Open/Fill/Credit/Close/IN/Result + суммы по всем столам.
- Chip Movement Report — 1 страница A4 портрет, 3 ряда × 2 колонки (Opener · Diff / Fill · Credit / Miss · Close).
- Всего печатается ровно 2 листа.
