## Reports module — большое преображение

### 1. Tabs (новый порядок)

```text
Daily · Shifts · Slots · Tables · Players · Groups · Expenses · Miss Chips
```

Удаляем:
- `tables` (старый `TableReport` — Drop/Cashout/Result по столам из transactions)
- `tracker` (`TrackerReport` целиком)

Переименовываем:
- `table-results` → `tables` (label «Tables», иконка `Table2`). Контент — текущий `TableResultsPage` без изменений.

Добавляем новую вкладку `slots`:
- Слева — KPI-карточки за выбранный `from..to`: **Total Result**, **Total CDR**, **Total Cashless**, **Total Tips**, **Total Miss**, **Shifts count**. Стиль — как summary cards в Shifts.
- Ниже — таблица истории закрытых смен (mirror `CageSlotsHistoryView`): дата, кассир, opening cash, closing cash, system result, CDR, cashless (miss), tips, balance. Раскрытие строки + кнопка **Print** (через `PrintSlotsShiftDialog`). Read-only — никакой правки/approve.
- Фильтруется по `from..to` из шапки Reports.
- Источник данных: `cage_slots_shifts` со статусом `closed` (как в существующем History компоненте).

### 2. Expenses tab → полная копия `/expenses` (read-only)

Сейчас `ExpenseReport` показывает только By Category / By Player таблицы. Меняем на структуру страницы `/expenses`:

- **KPI-карточки**: Total, Approved, Pending, Bar charges. Все используют `useExpenseAnalytics` с фильтрами вкладки.
- **By-source mini-cards** (Live Game / Slots / Office) — клик переключает фильтр source.
- **NEW**: при клике на карточку **Total** — source сбрасывается в `"all"` (и сбрасываются category/target до `all`, диапазон дат не трогаем). Сейчас Total — статичный, не кликабельный.
- **Фильтры**: те же что в /expenses (From/To preset-кнопки Today/7d/30d/All, Source select, Category, Target, Status, Search). From/To дублируют шапку Reports — при изменении синхронизируем.
- **Таблица расходов** — те же колонки что в /expenses (`ExpensesTable`), **read-only** — без кнопок Edit/Delete/Approve и без формы добавления (`NewExpensesForm` и `ExpenseRowActions` не рендерим).
- **Сортировки**: добавляем `useSorted` обёртку на главную таблицу (Date, Amount, Source, Category, Target, Player, Status) — сейчас её нет.

Реализация: вынести существующую `/pages/Expenses.tsx` UI-часть в общий компонент `ExpensesView` (props: `readOnly: boolean`), и использовать его на обеих страницах. На странице `/expenses` — `readOnly=false`, в Reports — `readOnly=true`.

### 3. Сортировки в новых вкладках

В новой вкладке **Slots** — сортируемые заголовки (`SortTh` уже есть в Reports.tsx) для всех колонок таблицы истории.

### 4. Чистка

- Удалить из `Reports.tsx`: `TrackerReport`, старый `TableReport`, неиспользуемые импорты (`useTableTracker`, `useGamingTables` если больше не нужен, `Grid3X3`, `Table2` оставляем для новой Tables).
- Удалить старый локальный `ExpenseReport` — заменён общим `ExpensesView` (read-only).
- Удалить `useTransactions`/`useExpenses` импорты, если они становятся не нужны после удаления старых вкладок (Shift/Player/Group ещё пользуются — проверить).

### 5. Файлы

- `src/pages/Reports.tsx` — переработка табов, удаление 2 компонентов, добавление `SlotsReport`.
- `src/components/cage-slots/SlotsHistoryReport.tsx` *(новый)* — KPI + таблица истории смен с раскрытием и Print.
- `src/components/expenses/ExpensesView.tsx` *(новый)* — экстракт UI из `src/pages/Expenses.tsx` с пропом `readOnly`.
- `src/pages/Expenses.tsx` — становится тонкой оболочкой над `ExpensesView` (`readOnly={false}`).
- `package.json` — bump patch (фронтовый только, бэкенд не трогаем).

### Не трогаем

- БД, RPC, миграции — только фронт.
- Логику Shifts / Daily / Players / Groups / Miss Chips — без изменений.
- Доступ ролей к /expenses (sourceLocked для кассиров и т.п.) — переносим в `ExpensesView` как есть.
