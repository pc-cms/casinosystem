
# План: Унификация дизайн-системы CMS

## Диагноз (что не так сейчас)

После аудита 24 страниц и компонентов — система действительно выглядит «от разных авторов»:

| Проблема | Где | Эффект |
|---|---|---|
| `PageHeader` есть, но используется только на 9 из 24 страниц | Reception, Pit, Tables, Cage, Dashboard, Finance, Staff, TableTracker, CctvView, TableResults, ImportReports пишут `<h1>` руками | Заголовки прыгают (text-xl vs text-2xl vs text-lg), иконки то есть то нет, граница снизу то есть то нет |
| Нет иерархии кнопок | 45× `outline`, 13× `ghost`, всего 2× `default` | Непонятно где «главное» действие на странице |
| Размеры вразброс | 88× `sm`, 7× `md`, 3× `lg`, 2× `default` | Кнопки разной высоты в одном ряду |
| Ручные высоты инпутов | 46 случаев `h-8/h-9/h-10/h-11` | Поля прыгают вверх-вниз даже внутри одной формы |
| `FormGrid` создан, но применён только в Reception register + PlayerEditDialog | Все остальные формы (Cage, Expenses, Players filters, Pit dialogs, Bank Checks, Admin) | Поля «прыгают левее-правее» |
| Карточки разные | `cms-panel`, `<Card>`, голый `div` с border | Разные тени, радиусы, паддинги |
| Радиусы вперемешку | `rounded-md/lg/full` | Кнопки скруглены сильнее карточек на одной странице |
| Плотность таблиц разная | Reception, Players, Cage используют свои padding/font-size | Нет ощущения единой системы |

## Цель

Каждая страница в системе должна:
1. Иметь **одинаковый каркас** (header → filters → content card).
2. Использовать **один набор примитивов** (Button, Input, Select, Card, Dialog, Drawer) с одинаковыми размерами.
3. Иметь **чёткую иерархию действий** (1 primary, N secondary, ghost для иконок).
4. Выглядеть **одинаково под всеми ролями** — скрытие по правам = только `display:none`, а не другая вёрстка.

## Дизайн-токены (фиксируем стандарт)

```text
HEIGHTS (везде, без исключений)
  Кнопка / Инпут / Select / Trigger     h-9   (compact, для плотных таблиц/фильтров)
  Кнопка / Инпут в формах диалогов      h-10  (для PlayerEdit, Cage, Expenses dialogs)
  Иконочные кнопки                       h-9 w-9
  Большие действия (логин, главные CTA) h-11

RADIUS
  Карточки, диалоги, инпуты, кнопки     rounded-md  (= var(--radius) = 0.375rem)
  Бейджи / chips                         rounded-full
  НИКАКИХ rounded-lg/xl на формах

TYPOGRAPHY
  Заголовок страницы H1                  text-lg font-semibold (через PageHeader)
  Заголовок секции H2                    text-sm font-semibold uppercase tracking-wider text-muted-foreground
  Лейбл поля                             text-xs text-muted-foreground font-medium
  Числа / деньги                         font-mono tabular-nums
  Body                                   text-sm

SPACING
  Отступ между секциями                  space-y-4
  Внутри карточки                        p-4
  Между полями формы                     gap-3 (FormGrid уже задаёт)
  Между кнопками в группе                gap-2

BUTTON HIERARCHY (правило)
  default     — главное действие страницы / диалога (1 шт)
  secondary   — вторичные действия
  outline     — фильтры, переключатели, неутвердительные кнопки
  ghost       — иконки в таблицах, close, навигация
  destructive — только удаление/блокировка
```

## Что унифицируем — конкретные действия

### 1. PageHeader везде

Прогоняемся по всем страницам где сейчас ручной `<h1>` и заменяем на `<PageHeader>`:

```text
Reception, Pit, Tables, TableTracker, Cage, Dashboard,
Finance, Staff, TableResults, ImportReports, CctvView (все 10 заголовков),
Admin, NotFound (оставляем)
```

В правый слот `children` — основные действия страницы (1 primary + N outline).
Расширяем `PageHeader`: добавим опциональный `actionsAlign` и поддержку breadcrumbs/casino-context (для CCTV).

### 2. Каркас страницы — `PageShell`

Создаём новый компонент `src/components/layout/PageShell.tsx`:

```text
<PageShell>
  <PageHeader ... />
  <FilterBar>... </FilterBar>     (опционально)
  <PageContent>...</PageContent>  (= <Card> с p-4 или табличный контейнер)
</PageShell>
```

Это даёт одинаковые внешние отступы и поведение под мобильным.

### 3. Унификация кнопок (button.tsx)

- В `button.tsx` фиксируем дефолт `size = "default"` → `h-9` (было `h-10`).
- Удаляем кастомные размеры `md` (используется неконсистентно).
- Добавляем правило-эслинт-комментарий в шапку файла «не использовать `h-*` руками».

Затем проходимся по страницам:
- Главная кнопка действия → `variant="default"` (например «Save», «Register Player», «New Expense», «Close Shift»).
- Все «Filter», «Export», «Refresh» → `variant="outline" size="sm"`.
- Иконки в строках таблиц → `variant="ghost" size="icon"`.

### 4. Унификация форм — FormGrid обязателен

Прогоняем все формы (не только Reception+PlayerEdit):

```text
- src/pages/Expenses.tsx                  (форма создания)
- src/pages/Cage.tsx + components/cage/*  (Mobile Money, Float, Withdrawals)
- src/pages/Pit.tsx + components/pit/*    (Player Tracker, Result entry)
- src/pages/BankChecks.tsx                (форма чека)
- src/components/registration/*           (Register dialog)
- src/components/player/*                 (Filters, Edit)
- src/pages/Admin.tsx                     (User create/edit, Casino settings)
- src/pages/Finance.tsx + components/finance/*  (Budget, Collections, Cash Count, Adjustment)
```

Везде убираем ручные `grid grid-cols-*` и `h-*` на инпутах. Высота — через size="sm"/"default" в Input.

### 5. Унификация карточек

Один источник правды — `<Card>` из `ui/card.tsx`. Удаляем класс `cms-panel` (или делаем его alias на тот же стиль). Везде где сейчас голый `<div class="border rounded-md p-4 bg-card">` → `<Card>`.

### 6. Диалоги и Drawers — одинаковый каркас

Все Dialog с формами:
- Header: title + опциональный subtitle (строго `DialogHeader`)
- Body: `<FormGrid>` внутри `space-y-4`
- Footer: справа — `default` + `outline (Cancel)` (порядок везде одинаковый)

На мобильном (≤ md) автоматически превращаем эти диалоги в `Drawer` через утилиту `ResponsiveDialog` (создадим — обёртка над shadcn Dialog/Drawer).

### 7. Таблицы

Стандартизируем плотность:
- Header row: `h-9 text-xs uppercase tracking-wider text-muted-foreground`
- Body row: `h-10 text-sm`
- Числовые ячейки: `text-right font-mono tabular-nums`
- Hover: `hover:bg-muted/50`

Создадим `<DataTableShell>` хелпер, либо просто обновим класс `cms-data-table` в `index.css`.

### 8. Видимость по ролям ≠ другая вёрстка

Текущая проблема (например в `PlayerEditDialog`): для разных ролей мы убираем колонки/блоки, и из-за этого диалог визуально другой.

Правило: **скелет всегда одинаковый**. Скрываемые блоки заменяются на `null` ВНУТРИ той же ячейки сетки, либо помечаются `aria-hidden`/`pointer-events-none` с заглушкой. Размеры карточки/диалога фиксированы.

### 9. Иконки

Все иконки в навигации/кнопках — `w-4 h-4`. В PageHeader badge — `w-5 h-5`. Без исключений.

### 10. Цвета

Уже есть семантические токены (`--primary`, `--success`, `--danger`, `--info`). Запрещаем хардкод `text-blue-500`, `bg-green-100` и т.д. в страницах (кроме грид-цветов смен, которые уже задокументированы в memory).

Прогоним поиск по `text-(red|green|blue|yellow|amber|emerald|sky|purple)-` и заменим на семантические или утилитарные классы (`cms-amount-positive/negative`, `text-success`, `text-info`).

## Порядок выполнения

1. **Фундамент**: обновить `button.tsx` (h-9 default), создать `PageShell`, расширить `PageHeader` для CCTV-кейса, создать `ResponsiveDialog`, добавить хелпер таблиц.
2. **Прогон страниц партиями** (по 4-5 за раз, чтобы было удобно ревьюить):
   - Партия A: Dashboard, Reception, Pit, Tables, TableTracker
   - Партия B: Cage, Finance + все finance-компоненты
   - Партия C: Players, Blacklist, Groups, Staff, Expenses
   - Партия D: BankChecks, Reports, MissChips, Logs, ImportReports, Admin, TableResults, Stats
   - Партия E: CctvView (10 заголовков унифицировать через PageHeader)
3. **Чистка**: удалить мёртвые классы, прогнать grep по `text-2xl font-bold`, `h-8/h-10/h-11`, `rounded-lg` в страницах — точечно поправить.
4. **QA**: пройти по всем ролям (admin/manager/pit/reception/surveillance/hr/cashier) и убедиться, что вёрстка одинаковая, отличается только содержимое.

## Что НЕ трогаем

- Landing page (`Landing.tsx`) — это маркетинг-сайт, у него свой стиль и брендинг.
- Login / Auth screens — отдельная визуальная категория.
- Print-стили в `index.css` (для Rota/Attendance) — уже работают.
- Цветовая палитра смен и финансовые цвета — задокументированы в memory, не меняем.

## Запоминаем в Core memory

После реализации сохраним правила (heights, radius, button hierarchy, FormGrid обязателен, видимость ≠ другая вёрстка) в `mem://design/system-rules`, чтобы будущие изменения автоматически следовали стандарту.

---

**Объём работы**: один большой проход. Реалистично уложить в 5-6 итераций (по партии страниц). После одобрения начну с фундамента (шаг 1) и Партии A.
