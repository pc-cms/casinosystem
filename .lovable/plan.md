## Goal
Когда открыта карточка игрока в Player Statistics, при прокрутке страницы должны "прилипать" одновременно: карточка игрока (PlayerPreviewHeader) + строка с названиями колонок (`thead`) + строка `Total`.

Сейчас sticky только карточка, а заголовки таблицы и строка тоталов уезжают вверх вместе с контентом.

## Changes

### 1. `src/components/player/PlayerPreviewHeader.tsx`
- Добавить `ref` на корневой `<div>` и `ResizeObserver`, который пишет высоту шапки в CSS-переменную `--ppheader-h` на `document.documentElement`.
- При размонтировании / отсутствии `playerId` сбрасывать `--ppheader-h` в `0px`.

### 2. `src/pages/PlayerStatistics.tsx`
- На `<thead>` строке заголовков (`<tr>` ~657) добавить класс `sticky` через inline `style={{ top: 'var(--ppheader-h, 0px)' }}` на каждом `<th>` (включая sticky-left ячейки `№` и `Name`).
- На строке Total (`<tr>` ~696) — sticky `top: calc(var(--ppheader-h, 0px) + <thead row height>)`. Проще: использовать переменную `--ppheader-h` плюс конкретный offset (~38px) на каждой ячейке `<td>`.
- Поскольку sticky на `<tr>` не работает, навешиваем `sticky` + `top: ...` + `z-20/30` на каждый `<th>`/`<td>` строки, не меняя структуру таблицы.
- Контейнер `<div className="overflow-x-auto">` оставляем — sticky внутри overflow-x работает корректно для вертикального направления; убедиться, что внешние родители (PageShell) не имеют `overflow:hidden` по вертикали (если есть — z-индексы и top решают вопрос, sticky остаётся в пределах ближайшего scroll-контейнера, которым является window).

### Implementation details
- thead `<th>`: добавить `sticky` и `style={{ top: "var(--ppheader-h, 0px)" }}`, поднять `z-20`/`z-30` для угловых sticky-left ячеек.
- Total `<td>`: добавить `sticky` и `style={{ top: "calc(var(--ppheader-h, 0px) + 34px)" }}` (34px = высота thead-строки `py-3` + текст), `z-10/20`.
- Фон у Total уже `bg-primary/10`, у thead `bg-muted` — sticky-видимость сохранится.

## Notes
- Чисто UI, без бэкенда. Версию не бампим.
- Та же связка работает и при закрытой карточке: `--ppheader-h = 0px`, и `top` сводится к 0 — поведение становится "обычным sticky thead".
