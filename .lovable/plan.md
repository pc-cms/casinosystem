
# План: подготовка к MVP-презентации

Цель — единый, цельный интерфейс, который выглядит как один продукт, без визуального шума и недоделанных «горячих клавиш». Делаем в 4 этапа, каждый можно показать клиенту независимо.

---

## Этап 1 — Сайдбар: сворачивание до иконок + перегруппировка по ролям

### 1.1. Mini-режим (icon rail)
Сейчас сайдбар сворачивается полностью и показывается только маленькая стрелка возврата. Меняем на классический «icon rail» 56px:

- Когда `collapsed = true` → сайдбар остаётся видимым шириной `w-14`, показывает только иконки (логотип, иконки разделов, аватар роли, theme toggle, sign out).
- Hover на иконке → tooltip с названием пункта.
- Активный пункт подсвечивается тем же `bg-sidebar-accent`.
- Подпункты (Tables → Active Players / Tracker / Table Tracker, Pit, Staff) в свернутом виде НЕ показываются — клик по родителю ведёт на страницу с дефолтным табом.
- Кнопка-«гамбургер» сверху rail-а разворачивает обратно в полную ширину.
- Сохраняем текущее состояние в `localStorage` (уже есть ключ `cms.sidebar.collapsed`).

Файлы: `src/components/layout/AppSidebar.tsx` (добавить prop `collapsed`, две версии рендера), `src/components/layout/AppLayout.tsx` (всегда рендерить sidebar, передавать `collapsed`, убрать абсолютную «стрелку возврата»).

### 1.2. Группировка меню по ролям (для Super Admin / Manager)
Сейчас секции `OVERVIEW / OPERATIONS / HR / ANALYTICS` — функциональные. Перегруппировываем по ролям, которые фактически выполняют работу. Это решает «меню по ролям» и одновременно делает структуру самообъясняющей для демо.

```text
OVERVIEW
  Dashboard

PIT (Live Game)
  Live Game        (/pit)
  Breaklist        (/pit?tab=breaklist)
  Active Players   (/tables?tab=activeplayers)
  Player Tracker   (/tables?tab=tracker)
  Table Tracker    (/tables?tab=tabletracker)

CASHIER (Cage)
  Cage
  Bank Checks
  Expenses

RECEPTION
  Reception
  Players
  In Casino
  Blacklist

FINANCE
  Finance
  Groups
  Tables (results overview)
  Table Results
  Import Reports

HR
  Floor Staff

ANALYTICS  (для finance/manager/surveillance)
  Reports
  Stats
  Logs

SYSTEM     (только manager / super_admin)
  Admin
```

- Для НЕ super_admin / не manager секции остаются те же, но видны только те, в которых есть хотя бы один доступный пункт (фильтрация по `roles`).
- Заголовок секции = название роли, маленькими капсами, как сейчас.
- Порядок ролей в меню = типичный workflow смены (Pit → Cashier → Reception → Finance → HR).

Файлы: `src/components/layout/AppSidebar.tsx` (поменять `section` в `NAV_ITEMS`, упорядочить массив).

---

## Этап 2 — Удалить глобальные хоткеи (кроме Rota / Attendance)

### Что убрать:
- Все `cms-kbd` бейджики справа от пунктов меню (`D`, `B`, `Alt+B`, `C`, …) — поле `shortcut` убираем из рендера.
- Глобальные слушатели `keydown` в `src/pages/Players.tsx` и `src/pages/Reception.tsx` (`P`, `R`, `Ctrl+F`, и т.п. — оставить только Esc-закрытие диалогов и навигацию по таблицам стрелками внутри сетки).
- `Ctrl+B` для сайдбара в `AppLayout.tsx` — убираем (кнопка-иконка остаётся).
- Подсказки «Show sidebar (Ctrl+B)» в tooltip-ах → просто «Show sidebar».

### Что оставить:
- Клавиатурная навигация внутри Rota / Attendance / Live Game grid / Table Tracker (стрелки, Tab, Space, paste) — это часть UX сетки, не глобальный хоткей.
- Esc для закрытия модалок (стандарт Radix, не трогаем).

Файлы: `AppSidebar.tsx`, `AppLayout.tsx`, `pages/Players.tsx`, `pages/Reception.tsx`.

---

## Этап 3 — Единый интерфейс: общие компоненты-«шапки»

Сейчас каждая страница рисует фильтры/заголовок по-своему (Bank Checks, Table Results, Players, Logs). Делаем 3 переиспользуемых компонента и применяем их везде.

### 3.1. `PageHeader` — единая шапка страницы
`src/components/layout/PageHeader.tsx` (новый):

```text
┌──────────────────────────────────────────────────────────────┐
│  [Icon]  Page Title                          [actions...]    │
│          subtitle / context                                  │
└──────────────────────────────────────────────────────────────┘
```

Props: `icon`, `title`, `subtitle?`, `children` (правая зона для кнопок типа Export, New, Refresh).

### 3.2. `FilterBar` — единая панель фильтров
`src/components/layout/FilterBar.tsx` (новый). Горизонтальная панель под PageHeader. Слоты:
- `presets` — чипы пресетов (Day / Week / Month / Year / Custom) — общий компонент `<DateRangePresets value onChange />`, используем существующую логику из BankChecks/TableResults и выносим её в `src/components/ui/date-range-presets.tsx`.
- `search` — `<SearchInput />` слева.
- `filters` — выпадающие селекты (Bank, Currency, Casino…).
- `right` — Export, Reset.

Все элементы — высота `h-9`, `text-sm`, mono для дат. Один и тот же background `bg-card border-b`.

### 3.3. `DataTable` shell
Не перерабатываем все таблицы (большая работа), но создаём базовый стиль-обёртку `src/components/layout/TablePanel.tsx`:
- одинаковые рамки (`border rounded-md`),
- `<thead>` с `bg-muted/50 text-xs uppercase tracking-wider`,
- zebra строки `even:bg-muted/20`,
- sticky header,
- футер с totals (опционально).

Применяем как «обёртку» к существующим таблицам без переписывания логики — просто заменяем root-`<div>`/`<table>` на `<TablePanel>`.

### 3.4. Применение
Прогоняем по страницам:
- `BankChecks.tsx`, `TableResults.tsx`, `ImportReports.tsx`, `Players.tsx`, `Logs.tsx`, `Reports.tsx`, `Stats.tsx`, `Expenses.tsx`, `InCasino.tsx`, `Blacklist.tsx`, `Groups.tsx`, `Reception.tsx`.
- Каждая страница → `<PageHeader>` + (если есть фильтры) `<FilterBar>` + контент.
- Удаляем дублированные inline-шапки.

Это не переписывание, а замена внешней обёртки → 1 коммит на страницу, риски минимальны.

---

## Этап 4 — Финальная косметика (чтобы выглядело «как продукт»)

- Единые иконки в `PageHeader` для каждой страницы (уже есть в `NAV_ITEMS`).
- Единый стиль кнопок Export Excel (один компонент `<ExportButton onExport />`).
- Единый «empty state» для таблиц без данных (иконка + текст «No data for selected period»).
- Единый loading-skeleton для таблиц (используем `LoadingSkeletons.tsx`).
- Удалить из футера сайдбара дублирующиеся кнопки которые теперь в icon rail.
- Smoke-проход всех ролей: Login → Dashboard → каждый пункт меню открывается, фильтры выглядят одинаково.

---

## Технические детали

**Новые файлы:**
- `src/components/layout/PageHeader.tsx`
- `src/components/layout/FilterBar.tsx`
- `src/components/layout/TablePanel.tsx`
- `src/components/ui/date-range-presets.tsx` (вынос общей логики Day/Week/Month/Year/Custom из BankChecks)
- `src/components/ui/export-button.tsx`

**Изменяемые:**
- `src/components/layout/AppSidebar.tsx` — mini-режим, перегруппировка по ролям, удаление `cms-kbd`.
- `src/components/layout/AppLayout.tsx` — всегда рендерить sidebar, убрать Ctrl+B handler и floating chevron.
- `src/pages/Players.tsx`, `src/pages/Reception.tsx` — убрать global keydown.
- ~12 страниц — обернуть в `PageHeader` + `FilterBar`.

**НЕ трогаем:** Rota, Attendance, Live Game grid, Table Tracker (их keyboard UX оставляем как есть), бизнес-логику, БД, RLS, edge functions.

---

## Порядок выполнения и контрольные точки

1. **Этап 1** (sidebar mini + role grouping) — самостоятельный, можно сразу показать.
2. **Этап 2** (удаление хоткеев) — 1 коммит, быстро.
3. **Этап 3.1–3.3** (создаём общие компоненты).
4. **Этап 3.4** (мигрируем страницы пачками по 3–4).
5. **Этап 4** (косметика, empty states).

После каждого этапа — пройтись по приложению визуально перед следующим.

---

## Открытые вопросы — нужны решения перед стартом

Прежде чем начать кодить, подтверди:
1. Группировка меню «по ролям» (PIT / CASHIER / RECEPTION / FINANCE / HR / ANALYTICS / SYSTEM) — ок, или ты хочешь другую группировку/названия?
2. В свернутом сайдбаре подпункты (Active Players / Player Tracker / Table Tracker) показывать как отдельные иконки, или только родителя `Tables`?
3. Делаем сразу всё (этапы 1–4 одним заходом), или поэтапно с твоим ревью между этапами?
