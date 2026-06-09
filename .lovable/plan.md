## Scope

Файл `src/pages/Reports.tsx` — только UI шапки. Логика отчётов, RPC, формулы — не трогаются.

## Изменения

1. **Удалить** текущий `PageHeader` со старыми двумя date-инпутами (lines ~101–110).
2. **Один общий пикер** над `Tabs`:
   - Компонент: `DateRangePresets` (`src/components/ui/date-range-presets.tsx`) — кнопки Day / Week / Month / Year / All / Custom + поля From/To для Custom.
   - Состояние остаётся в Reports: `from`, `to`, `preset`. Прокидывается без изменений во все существующие табы (`DailyReport`, `ShiftReport`, `SlotsHistoryReport`, `PlayerReport`, `GroupReport`, `CashlessReport` и т.д.).
3. **Дефолт по умолчанию** — «с 1-го числа текущего месяца по сегодня (business date)»:
   - `from = YYYY-MM-01` текущего business-месяца
   - `to = useEffectiveBusinessDate()` (фоллбек `getBusinessDate()`)
   - `preset = "custom"` (т.к. это не совпадает ни с одним из стандартных пресетов Day/Week/Month/Year/All — `month` у пресета = последние 30 дней, а не календарный месяц).
4. **Tabs** — список вкладок, порядок, иконки, контент не меняются.
5. **URL-параметр** `?tab=` сохраняется как есть. Диапазон в URL не пишем (как сейчас).

## Out of scope

- Внутренности каждого таба (`DailyReport` и т.д.) — без изменений.
- Никаких изменений RPC / БД / расчётов / package.json.
- Вкладка `Expenses` и `MissChips` рендерят свои страницы целиком (со своими шапками) — оставляем как сейчас.

## Технические заметки

- Импорт: `import { DateRangePresets, presetRange, type DatePreset } from "@/components/ui/date-range-presets"`.
- Лейаут: `<PageShell>` → `<div className="cms-panel p-3 mb-3">{DateRangePresets}</div>` → `<Tabs>`. Без `PageHeader` сверху (по требованию убрать шапку).
