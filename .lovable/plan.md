## Live Game Cash Desk Report → A4 portrait

Переделать `ShiftClosingReport` под вертикальную ориентацию по образцу `SlotsConsolidatedReport`. CSS-правило `@page cashdesk { portrait }` уже есть, но контент сейчас слишком широкий (grid-cols-3, p-6) и не вписывается в портрет.

### Изменения

**`src/components/cage/ShiftClosingReport.tsx`** — перепаковка JSX (логика и data-fetch не трогается):
- Корневой `<div id="shift-print-area">`: фиксированная ширина `194mm`, `minHeight: 281mm`, `display: flex; flex-direction: column`, Arial 11px, padding 0 (поля даёт `@page`).
- Заголовок в одну табличную строку: `{casinoName} Live Game Cash Desk Report` + `Date {fmtDate(businessDate)}`.
- Таблица столов (Table / Open / Fill / Credit / Close / IN / Result): `px-1.5 py-0.5`, `tabular-nums`, итоговая строка `Total` с серым фоном. При `tables.length > 12` — авто-сжатие шрифта до 9.5px, чтобы влезть на одну страницу.
- Cash Flow Opener / Closer: две колонки рядом (`grid-cols-2 gap-1`), используем существующий компонент `CashFlowColumn`.
- Summary panel вынесена **под** Cash Flow в виде широкой таблицы 4 колонки (label / value / label / value) с финальной строкой `Shift Balance` на всю ширину с серой заливкой. Включает: Tables Result, Casino Expenses, Cash Flow FILL/CREDIT, Cash Desk Chips FILL/CREDIT, Tips Day/Night, − Tips (this shift), Miss Chips, Shift Balance.
- Подписи внизу страницы через `mt-auto` (Cashier / Manager).

### Не трогаем
- `ChipMovementReport` — уже отдельная портретная страница.
- RPC, расчёты, props, fetch-логика.
- `index.css` (правило `@page cashdesk { portrait }` уже корректное).
- `PrintPortal`, `ReprintShiftDialog` — без правок.

### Технические детали
- Заголовок отчёта меняется с `Consolidating Cash Desk Report` на `Live Game Cash Desk Report` для консистентности с `Slots Cash Desk Report`.
- Чисто косметическая правка → версию пакета не бампим.
