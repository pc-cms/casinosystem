# Unified Layout Rules — Scroll, Columns, Numbers, Modals

Целевой экран: Full HD 21"+ при `density=comfort`, body 17px, sidebar 320px. Все правила вшиваются в общие примитивы (`DataTable`, `ResponsiveDialog`, `MoneyCell`), а не правятся по местам.

---

## 1. Scroll: никогда две полосы одновременно

Гибрид по контенту, решает сама таблица:

- **Узкие (≤8 колонок или ширина контента ≤ контейнера)** → только вертикальный скролл страницы. `overflow-x: visible`. Колонки сжимаются по правилам §2.
- **Широкие (>8 колонок или min-content шире контейнера)** → таблица в собственном контейнере: `overflow-x: auto`, `overflow-y: visible`, страница НЕ скроллится горизонтально, sticky header + sticky первая колонка (имя/время/дата).
- Авто-детект в `DataTable` через `ResizeObserver`: сравнивает `scrollWidth` vs `clientWidth` родителя и переключает режим.
- `PageShell` получает класс `overflow-x-clip` на корне — гарантия от случайного двойного скролла.

## 2. Ширины колонок: auto-fit + min/max токены

В `DataTable` каждая колонка получает `type` (заменяет ручной `className="w-…"`):

| type | min | max | align | font |
|---|---|---|---|---|
| `text` | content | 240px | left | sans, truncate + tooltip |
| `name` | content | 220px | left | sans, truncate + tooltip |
| `money` | под `999 999 999` (~10ch) | auto | right | mono tabular |
| `int` | под `9 999` (~5ch) | auto | right | mono tabular |
| `time` | под `HH:MM` (~6ch) | fixed | center | mono |
| `date` | под `DD/MM/YYYY` (~12ch) | fixed | center | mono |
| `status` | content | 120px | center | badge |
| `actions` | content | content | right | icons |

Таблица = `table-layout: auto` + `width: max-content`, ячейки = `white-space: nowrap`. Длинный текст обрезается `…` с tooltip полного значения.

Имя/время/категория больше НЕ растягиваются — освобождают место под цифры.

## 3. Числа: K/M через toolbar-toggle

- Новый компонент `<MoneyCell value={n}/>` и хелпер `formatMoneyCompact(n, mode)`:
  - `full` → `1 250 000`
  - `compact` → `1.25M`, `112K`, `1.2B`
  - Правило: 4+ цифры → K, 7+ → M, 10+ → B; 1 знак после запятой, если результат ≠ целое.
- Toggle `Full / Compact` в `<DataTableToolbar>` (новый глобальный toolbar из прошлого тура), хранится в localStorage по ключу таблицы.
- Tooltip с полным значением ВСЕГДА (даже в Full), на hover/focus.
- Cage, Cash Count, Expenses формы — всегда `full` (toggle спрятан, формат-инпуты не меняются).
- Печать (print stylesheet) — всегда `full`.

## 4. Modals: две ширины и точка

Удаляются размеры `sm | md | lg | xl | 2xl` у `ResponsiveDialog`. Остаются:

- `<ResponsiveDialog size="form">` — **560px**. Простые формы: cancel transaction, notes, quick grant, weekly bonus, expense category, new player tag, password prompt.
- `<ResponsiveDialog size="table">` — **880px**. Табличные формы: Open/Close Table, Open/Close Slot, Chip Count, Cage Tx, Promo Grant edit, AM Quick Grant, Cashier Redeem, Stock Count, Inter-Casino Transfer.

Общие правила контента:

- Высота: `auto`, max `min(80vh, 720px)`, внутренний скролл только у `<DialogBody>`. Header/footer sticky.
- Внутри только `<FormGrid>` — `form` = 1 колонка, `table` = 2 колонки (на mobile коллапс в 1). Никаких произвольных `grid-cols-*`.
- Все инпуты — 40px (form-density), числовые — `<MoneyInput>` (без стрелок, разделитель пробел, parse при blur, мгновенный ввод).
- Один primary в footer + Cancel ghost. Destructive только в destructive-action диалогах.
- Mobile (<768px) — `<Drawer>` снизу автоматически (как сейчас), правила те же.

Жертвы: пустое место в простых формах допускается ради консистентности. Никаких “средних” размеров.

## 5. Refactor scope

Затрагиваемые примитивы:
- `src/components/ui/data-table.tsx` — добавить `columns` prop с `type`, авто-детект скролла, sticky-first.
- `src/components/ui/data-table-toolbar.tsx` (новый из прошлого тура) — добавить Full/Compact toggle.
- `src/components/ui/responsive-dialog.tsx` — оставить только `size: "form" | "table"`, удалить остальные.
- `src/components/ui/money-cell.tsx` (новый), `src/lib/format-money.ts` (compact helper).
- `src/components/ui/page-shell.tsx` — `overflow-x-clip`.

Миграция вызовов (≈90 файлов): кодомод-скрипт `size="lg|xl|2xl" → "table"`, `size="sm|md" → "form"`. DataTable вызовы помечаются `columns=[…]` постепенно: критичные сначала (Cage, Cash Count, Promo, AM, Tables, Slots, Reports), остальные дефолтятся к auto-fit-text.

## 6. Acceptance

- Ни одна страница на 1920×1080 не имеет одновременно H-scroll и V-scroll на `<html>`.
- Колонка `Name` в Cage Transactions / Promo Grants / Player list сжата до содержимого; цифры не переносятся.
- В широких отчётах (Cashback, AM Budget, Monthly Tips) toggle Compact превращает столбцы в `K/M` без сдвига вёрстки.
- Все диалоги имеют одну из двух ширин; нет ни одного `max-w-…` руками.
- Open/Close Table modal: цифры не наезжают друг на друга на любом денежном пресете.

## 7. Out of scope (этот PR)

- Bento-грид дашбордов и Cage/Slots parity — следующие итерации.
- Изменение бизнес-логики, RLS, edge-функций. Только presentation-слой.
