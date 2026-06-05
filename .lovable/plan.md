## Что не так с Finances сейчас

Прошёл все 13 страниц `/finances/*`. Корневые проблемы — одинаковые:

1. **Все таблицы — самопальные `<table>`**. Никто не использует `DataTable` из дизайн-системы. Каждая страница рендерит свой `<thead class="bg-muted">` со своими отступами.
2. **Колонки с текстом съедают цифры**. `Description`, `Category`, `Wallet`, `Note` — без ограничения ширины, без `truncate`. Цифровые колонки (Amount/TZS/USD/%) не имеют фиксированной ширины и сжимаются.
3. **Шрифт цифр визуально равен или больше текстовых колонок**. Нет `tabular-nums`, нет уменьшенного шрифта для чисел, нет вторичных цветов для валюты.
4. **Высота строк завышена** (`py-1.5` + `text-sm` ≈ 36px). На MacBook 13" с 11+ колонками это ад.
5. **Дублирующие пары TZS/USD** (Monthly Report — 11 колонок: Plan Year TZS, USD, Plan Month TZS, USD, Actual TZS, USD, %, Remain TZS, USD, %). 6 валютных колонок в одной таблице.
6. **Нет sticky первого столбца** на широких сетках (Monthly Report, Budget) — при горизонтальном скролле теряешь, какая это категория.
7. **Дашборд — лесенка `PageSection`-карточек**. 4 KPI крупным шрифтом + 5 отдельных секций с графиками `h-72` подряд = бесконечный скролл.
8. **Бюджет** — 13 инпутов в ряд, у каждого нет фиксированной узкой ширины, инпуты по умолчанию растянуты, на MacBook колонки месяцев становятся шире самой категории.
9. **MoneyChange** — 8 колонок: Date / From / Amount / → / To / Amount / Rate / Note. Стрелка как отдельная колонка. Wallet-имена не trim'ятся.
10. **Expenses** — `Amount + currency` (текст) и отдельная `TZS` — две колонки про одно. Description без truncate.
11. **`px-3 py-2` хедер vs `px-3 py-1.5` тело** — рваные отступы.
12. **Empty / loading состояния** разные на каждой странице.

## План (только UI/презентация — без бизнес-логики)

### Фаза 1 — общий каркас финансовых таблиц

**Новый компонент `src/components/finances/FinTable.tsx`** — тонкая обёртка над `DataTable`, фиксирует финансовую плотность:

- Контейнер: `rounded-md border` (без двойной рамки).
- `<thead>` — `h-8`, `text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40`, sticky top.
- Строка тела — `h-8`, `text-[12px]`, hover `bg-muted/30`, zebra опционально.
- Хелперы колонок:
  - `<FinAmount value tzs ccy?>` — большое число `text-[12px] font-mono tabular-nums`, под ним `text-[10px] text-muted-foreground` валюта если не TZS; авто-цвет `cms-amount-positive/negative`.
  - `<FinDate value>` — `font-mono text-[11px] text-muted-foreground` (даты не должны кричать).
  - `<FinTrunc max>` — `truncate` с `title`-тултипом для description/note.
- Стандартные ширины: дата `w-[88px]`, валюта-код `w-[44px]`, % `w-[52px]`, сумма `w-[120px]` (right-align), действия `w-[40px]`. Текст занимает всё остальное и truncate'ится.
- Sticky первый столбец через `sticky left-0 bg-card` — включается флагом.

### Фаза 2 — переписать каждую страницу под FinTable

| Страница | Что меняем |
|---|---|
| **Dashboard** | 4 KPI → в один горизонтальный strip-блок (compact `text-base`, не `text-2xl`). Графики `h-72` → `h-56`. Wallets + Cash-by-currency объединить в одну секцию с двумя вкладками. |
| **Wallets** | Заменить таблицу на компактные карточки (по 3 в ряд) — Name (крупно) / Kind+Currency (мелко) / Balance (моно, крупно). Edit как icon-button в углу карточки. |
| **Expenses** | Слить «Amount+ccy» и «TZS» в `<FinAmount>`. Description = `<FinTrunc>`. Колонки: Date 88 · Category truncate · Wallet 140 truncate · Description flex truncate · Amount 120 · действия 40. |
| **Money Change** | Убрать колонку «→». Объединить в две композитные колонки: «From: Wallet + Amount + CCY» / «To: Wallet + Amount + CCY». Rate отдельной узкой колонкой. Note truncate. |
| **Monthly Report** | Скрыть USD-колонки по умолчанию (toggle «Show USD» в шапке). Остаётся: Category sticky · Plan/Year · Plan/Month · Actual · % · Remain · Remain %. Уменьшить шрифт тела до `text-[11px]`. Сделать первую колонку sticky. Drilldown-таблица — той же стилистики. |
| **Budget** | Sticky колонка Category. Инпуты `w-[60px] h-7 text-[11px] text-right`. Подсветка ячеек со значением. Annual — sticky правый край. |
| **Budget vs Actual** | Заменить ручной thead на FinTable. Цвета дельты через `cms-amount-*`. |
| **Day Closing** | Карточка статуса вверху + таблица истории через FinTable, даты узкие, методы как badge. |
| **Office Safe** | FinTable, операции badge'ами, `<FinAmount>` для TZS. |
| **Inter-Casino** | FinTable, From/To как badge-чипы, Amount компактно. |
| **Audit Log** | FinTable, action как badge, payload — диалог по клику (вместо длинной колонки). |
| **Aliases** | FinTable + truncate alias text. |
| **Excel Import** | Карточки статусов + FinTable истории. |

### Фаза 3 — общая шапка фильтров

В `PageHeader` шапке Finances везде один паттерн: `[CasinoSwitcher] [date/period] [search] [toggle]`. Сейчас разнобой (где `belowHeader`, где справа). Унифицировать — все фильтры в `belowHeader`, действия (Add/Export) справа в шапке.

### Фаза 4 — мелочи

- Единые empty-states: `<FinEmpty icon msg />`.
- Единый loading: skeleton-строки в FinTable.
- Все даты — через `fmtDate` (уже null-safe после прошлого фикса).
- Сортировка колонок (опционально, mvp без неё).
- Печать: `print:text-[9px] print:h-auto`.

## Что НЕ трогаем

- Хуки `use-fin*`, RPC, миграции, RLS — финансовая логика без изменений.
- Поведение форм / диалогов записи.
- `package.json` версия — изменения чисто визуальные, бамп не нужен.

## Объём

13 страниц + 1 новый компонент. Можно разбить на 2 PR-итерации:

- **Итерация A** (большой эффект сразу): `FinTable` + Dashboard + Expenses + Monthly Report + Budget — самые перегруженные экраны.
- **Итерация B**: Wallets / MoneyChange / OfficeSafe / DayClosing / InterCasino / AuditLog / Aliases / BudgetVsActual / ExcelImport.

Если ок — начну с итерации A.
