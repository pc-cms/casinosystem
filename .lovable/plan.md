## Цель
- **Slots**: 1 страница A4 портрет.
- **Live Game**: 1 страница A4 портрет (Cash Desk) + 1 страница A4 альбом (Chips Movement).
- Унифицировать визуальный стиль двух отчётов.
- Зафиксировать ширины колонок (`table-layout: fixed` + `<colgroup>`), чтобы они не «плясали» между сменами.
- Увеличить шрифт — место есть.

## Корневая причина 3-й страницы Live Game
Print-iframe в `ReprintShiftDialog` задаёт `@page { size: 210mm 297mm }` (портрет) для всего документа. Отчёт фишек (`ChipMovementReport`) — это 3 колонки × 2 ряда плотных таблиц по 12 деноминаций, в портрет не помещается и переливается на 3-й лист. Решение — named CSS pages: cash-desk портрет, chips landscape.

## Изменения

### 1. `src/components/cage/ReprintShiftDialog.tsx`
Заменить единый `@page` в print-iframe на два named pages:
```css
@page portrait  { size: A4 portrait;  margin: 8mm; }
@page landscape { size: A4 landscape; margin: 8mm; }
#shift-print-area { page: portrait; }
#chip-print-area  { page: landscape; page-break-before: always; }
```
Убрать жёсткий `width: 194mm` для `.live-game-print-area`, чтобы chip-area мог растянуться на альбомную ширину.

### 2. `src/components/cage/ChipMovementReport.tsx`
- Контейнер: `width: 281mm; min-height: 194mm` (A4 landscape − 8 mm полей).
- Снять `print:break-before-page` (управление через named page).
- Шрифт: `10–11px` → **12px** (таблицы) и **13px** (заголовки).
- На каждый `DenomTable`: `tableLayout: fixed` + `<colgroup>` `45% / 25% / 30%` (Den / Qty / Value) — все 6 таблиц одинаковые.

### 3. `src/components/cage/ShiftClosingReport.tsx`
- На все `<table>` (Tables grid, Cash Flow, Cashless, Summary) поставить `style={{ tableLayout: "fixed" }}` + явные `<colgroup>` с процентами.
- Шрифт: `compact` 10.5px → **12px**, обычный 13px → **14px**.
- Шапка/заголовки секций — выровнять под Slots (тот же `bg-gray-200`, тот же размер заголовка, та же логика итоговой панели).
- Удалить мёртвые helper'ы (`CashFlowColumn`, `SummaryRow`, `SignatureBlock`, `Row`).

### 4. `src/components/cage-slots/SlotsConsolidatedReport.tsx`
- Те же `tableLayout: fixed` + `<colgroup>` на все таблицы.
- Шрифт 13 → **14px**, заголовок 16 → **18px**.
- Унифицировать с Live Game:
  - заголовок: `<casino> Slots Cash Desk Report` + `Date` справа в одну строку;
  - блок Cashless 5 колонок Provider / IN / OUT / NET / Balance — идентичен Live Game;
  - подписи внизу — идентичный layout;
  - `Shift Balance` — в `bg-gray-300` строке как в Live Game.

### 5. `src/components/cage-slots/PrintSlotsShiftDialog.tsx`
- Оставить портрет, но обновить `@page` `margin: 8mm`, добавить safety `overflow: hidden` на `.slots-print-area`.

### 6. `package.json`
- Bump `1.3.229` → `1.3.230` (чисто фронтовая правка печати, миграций нет).

## Файлы
- `src/components/cage/ReprintShiftDialog.tsx`
- `src/components/cage/ChipMovementReport.tsx`
- `src/components/cage/ShiftClosingReport.tsx`
- `src/components/cage-slots/SlotsConsolidatedReport.tsx`
- `src/components/cage-slots/PrintSlotsShiftDialog.tsx`
- `package.json`

## Итог
- Slots → 1 × A4 портрет.
- Live Game → 1 × A4 портрет + 1 × A4 альбом.
- Единый visual язык, стабильные ширины колонок, читаемый шрифт.
