## Диагноз

Печать слотового отчёта (`PrintSlotsShiftDialog` → кнопка **Print**) выходит белой/пустой страницей из‑за конфликта глобальных `@media print` правил в `src/index.css`.

Что происходит:

1. `printSlotsReport()` создаёт скрытый `<iframe>`, копирует в него **все** стили основного приложения (`<style>` + `<link rel="stylesheet">`) и записывает `source.innerHTML` (то есть содержимое `.slots-print-area`, **без самого враппера**).
2. Среди скопированных стилей действует глобальное правило (index.css:319):
   ```css
   @media print {
     body * { visibility: hidden; }
     .print-target, .cms-print-root, #shift-print-area, #chip-print-area,
     .print-target *, .cms-print-root *, #shift-print-area *, #chip-print-area * {
       visibility: visible !important;
     }
   }
   ```
3. В whitelist'е **отсутствует `.slots-print-area`**, и сам враппер не попал в body iframe → ни один селектор не матчится → всё `visibility: hidden` → **бумага белая**.

Этим же объясняется, почему обычный Ctrl+P из диалога ещё как‑то работает (там содержимое внутри `.cms-print-root` через `PrintPortal`), а наша кнопка Print через iframe — нет.

## План правки

Чисто фронтенд, без миграций и без бэкенда.

1. **`src/index.css`** — добавить `.slots-print-area, .slots-print-area *` в whitelist видимости внутри `@media print` (рядом со `.cms-print-root`, `#shift-print-area` и т.д.). Это починит и системный Ctrl+P, и iframe‑путь.

2. **`src/components/cage-slots/PrintSlotsShiftDialog.tsx`** — в `printSlotsReport()`:
   - обернуть содержимое iframe в `<div class="slots-print-area cms-print-root">…</div>`, чтобы whitelist гарантированно сматчился независимо от порядка стилей;
   - в инлайновый `<style>` iframe добавить страховку `@media print { body, body * { visibility: visible !important; } }` — на случай других визибилити-правил;
   - убедиться, что `@page slots { size: A4 portrait; margin: 8mm }` объявлен в iframe (сейчас задаём `@page` без имени — селектор `.slots-print-area { page: slots }` ссылается на несуществующее в iframe имя). Заменим на безымянный `@page { size: 210mm 297mm; margin: 8mm }` и уберём `page: slots` через override.

3. Версия (`package.json`) **не** трогаем — правка чисто UI/CSS, без backend изменений.

## Проверка после фикса

- Открыть Cage Slots · History → ряд за 28 мая → Print → в превью видно отчёт → нажать Print → в системном print‑preview должна быть видна одна A4 страница с отчётом, не белая.
- Проверить второй путь: `/cage-slots/report/:id` → Print → тот же результат.
- Проверить обычный Ctrl+P в открытом диалоге — тоже не должен быть белым.

## Технические детали (необязательно к прочтению)

Глобальный visibility‑gate — стандартный приём «печатать только нужный блок». Все остальные «печатные» зоны (`.print-target`, `.cms-print-root`, `#shift-print-area`, `#chip-print-area`) уже в whitelist'е. `.slots-print-area` добавили позже и забыли в него вписать — это и есть единственный корневой дефект; всё остальное в `SlotsConsolidatedReport` и `PrintSlotsShiftDialog` корректно (`bg-white text-black`, mm‑размеры, `@page A4 portrait`).
