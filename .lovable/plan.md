
# Глобальная унификация UI/UX — Партия B+ (правки по замечаниям)

Цель: каждая страница выглядит как часть одной системы. Единый хедер, единая дата, единая логика кнопок, чистка дубликатов и лишних вкладок.

---

## 1. Глобально: роли везде убираем

**Где убрать упоминания роли:**
- `src/pages/Dashboard.tsx` — в `subtitle` сейчас `${displayName} · ${roles.join(", ")} · ${date}` → оставить только `displayName`, дату вынести в правый слот хедера.
- `src/components/layout/AppSidebar.tsx` — в нижнем блоке "user · role · theme · signOut" убрать цветной бейдж с ролью полностью.
- Поиск по проекту: `roles.join(`, `roles.includes(` в visible-тексте — оставить только в логике (доступ), не в UI.

**Если роль где-то всё-таки нужна показать** (например, заголовок CCTV или баннер Manager Override): показывать **только высший приоритет** (`super_admin > finance_manager > manager > hr > pit > cashier > reception > surveillance`). Хелпер `getPrimaryRole(roles)` — добавить в `src/lib/role-access.ts`.

---

## 2. Единый хедер для всех страниц

Расширяем `src/components/layout/PageHeader.tsx`: добавляем правый слот с **датой** (постоянный, единый стиль) + порядок «кнопки → дата».

**Структура (слева → направо):**
```text
[icon] Title              [actions buttons] [DATE]
       subtitle (опц.)
```

**Дата:**
- Формат: `fmtDate(new Date())` (уже есть в `src/lib/format-date.ts`, выводит `YYYY.MM.DD`).
- Класс: `text-base font-mono tabular-nums text-muted-foreground` — единый размер, шрифт, моноширинный, всегда правее всех кнопок.
- Не редактируется кнопкой "сегодня" — это просто отображение бизнес-даты.

**Изменение API `PageHeader`:**
- Новый проп `date?: Date | string | true` — если передан, рендерится в правом углу. `true` = `new Date()` авто.
- Старый `children` остаётся для action-кнопок и располагается **слева от даты**.
- Старый `context` (бейдж/период возле title) — оставляем, не трогаем.

**Применяем на всех страницах:** `Dashboard, Pit, Tables, TableTracker, Reception, Cage, Players, InCasino, Blacklist, Finance (Wallet), Expenses, Staff, BankChecks, MissChips, Stats, Reports, Groups, ImportReports, Logs, Admin`. Везде `<PageHeader ... date />`.

---

## 3. Сайдбар — нижний блок (user / theme / signOut)

Файл: `src/components/layout/AppSidebar.tsx` строки ~494-532.

**Сейчас:** имя + цветной бейдж роли (отдельная строка), затем кнопка Theme отдельной строкой, затем кнопка Sign Out отдельной строкой → блок высокий.

**Станет:**
```text
displayName
[Theme toggle]  [Sign Out]      ← одна строка, два маленьких icon-кнопки рядом
```
- Бейдж роли удалить целиком.
- `Theme` и `Sign Out` объединить в одну flex-row с `gap-2`, обе кнопки `h-8 px-2 text-xs` (или icon-only).
- Manager Override индикатор оставляем как есть.

---

## 4. Dashboard

Файл: `src/pages/Dashboard.tsx`.
- В `subtitle` убрать `roles.join(", ")` и дату — переносим дату в правый слот хедера (`date`).
- **Удалить блок `ChipConservationCard`** (строки 184-188) — это и есть «Chip Conservation».
- **Удалить блок «Initial Baseline»** — найти и убрать (вероятно внутри `ChipConservationCard` или ниже; проверим, есть ли отдельная карточка Initial Baseline на странице — если нет, считаем, что речь именно про Chip Conservation card, который и удалим).

---

## 5. Cage

Файл: `src/components/cage/ActiveShiftView.tsx` (заголовок ~134-154).

**Сейчас:** сделан кастомный заголовок с `<h1>Cage`, временем смены и курсами мелким шрифтом, справа кнопки Close Tables / Close Shift.

**Станет:**
- Заменить на стандартный `<PageHeader icon={Landmark} title="Cage" />`.
- **Время смены** (`{shiftDuration}`) и **курсы валют** (USD/EUR/GBP/X-rate) выводить через `belowHeader` или `context` — размером `text-lg font-semibold` (как заголовок Cage).
- Кнопки в правом слоте: `[Close Tables] [Close Shift] [DATE]` — дата слева быть не должна, она всегда справа от всего по глобальному правилу. Уточнение пользователя «дата слева от Close Tables» интерпретируем как «между кнопками и краем» — финально: кнопки → дата справа. Если пользователь хочет именно дату СЛЕВА от кнопок Close Tables — ставим `[DATE] [Close Tables] [Close Shift]`. **Спрошу при имплементации, если будет двусмысленно** — но по правилу «дата всегда в правом углу» оставлю справа.
- На `OpenShiftScreen` тоже добавить тот же `PageHeader`.

---

## 6. Players

Файл: `src/pages/Players.tsx`.
- **Удалить кнопку «New Player»** (`<Button onClick={() => setShowAdd(true)}>`) и компонент `AddPlayerDialog` со страницы (создание игроков — только через Reception → Register).
- На месте кнопки в правом слоте хедера — **дата** (через `date` проп `PageHeader`).
- **Доступ к разделу:** ограничить роли в сайдбаре — оставить только `manager`, `finance_manager`, `super_admin`. Файл `src/components/layout/AppSidebar.tsx`, NAV_ITEMS, строка `/players` → убрать `cashier`, `surveillance`. Также добавить guard в `App.tsx` на route `/players` через существующий `RoleGuard`/`role-access.ts`.
- Карточка игрока — см. секцию 7 (унификация).

---

## 7. Карточка игрока — единый компонент на всех страницах

Сейчас игрок открывается двумя разными диалогами:
- `PlayerDetailDialog` — на странице Players.
- `PlayerEditDialog` — на Reception, In Casino, Pit.

**План:** оставить **один** диалог = `PlayerEditDialog` (он поддерживает режим view/edit и Intelligence Notes view-only для Pit). Удалить `PlayerDetailDialog` либо превратить его в тонкий враппер над `PlayerEditDialog`.

- В `Players.tsx` поменять `PlayerDetailDialog` → `PlayerEditDialog`.
- Выровнять размеры/радиусы/секции через уже существующий `ResponsiveDialog`.
- Проверить, что верхняя плашка (фото + имя + категория + флаги) одинакова на Reception/InCasino/Pit/Players.

---

## 8. Blacklist — визуал «ярко выделено»

Файл: `src/pages/Blacklist.tsx`.

**Сейчас:** обычный список строк, фото 40×40 в круглой плашке `bg-destructive/10`.

**Станет (визуальный каталог):**
- Сетка карточек: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3`.
- Карточка: `border-2 border-destructive bg-destructive/5 rounded-md p-3`.
- Фото: **крупное** `w-full aspect-square object-cover` с красной рамкой `ring-2 ring-destructive`.
- Под фото: имя жирным, никнейм, кнопка `Reactivate` (outline).
- Тёмная тема: `bg-destructive/15`, более насыщенно.
- Хедер: `<PageHeader icon={ShieldAlert} title="Blacklist" date />` + кнопка-фильтр (если нужна). Кнопка "добавить в blacklist" остаётся только из карточки игрока (не отдельный UI) — текущее поведение сохраняется.

---

## 9. Reception — Edit Profile без вертикального скролла

Файл: `src/components/PlayerEditDialog.tsx`.

**Сейчас:** диалог с `max-h-[...] overflow-y-auto` → справа появляется вертикальный скроллбар.

**План:**
- Убрать `overflow-y-auto` на корне диалога.
- Контент перестроить в **2-колоночную форму** (`FormGrid` с `cols={2}`) на десктопе → влезает без скролла.
- Если контент всё-таки длиннее окна → использовать `ResponsiveDialog` с `max-h-[90vh]` и внутренним скроллом **только** в области табов (а не на всём диалоге, чтобы скроллбар не висел справа от шапки).
- Альтернатива: `overflow: overlay` или `scrollbar-gutter: stable both-edges` чтобы скролл не сдвигал layout — но лучше переверстать в 2 колонки.

---

## 10. In Casino — фикс бага «игроки не попадают в список после Check-in»

Файлы: `src/pages/InCasino.tsx`, `src/pages/Reception.tsx` (CheckInTab), `src/hooks/use-visits.ts`.

**Гипотезы (проверим в реализации):**
1. Realtime-канал на `casino_visits` не подписан или подписан до того, как Reception инвалидирует кэш `["casino-visits-today"]`. На InCasino используется `useVisitsToday` — новых визитов не видно до ручного refetch.
2. Reception инвалидирует один queryKey, а InCasino читает по другому (с другим `select`-параметром). Проверим: оба используют `useVisitsToday(...)` → один queryKey должен совпадать.

**Действия:**
- В `src/hooks/use-realtime.ts` убедиться, что есть подписка `postgres_changes` на `casino_visits` с `event: '*'` и она инвалидирует `["casino-visits-today"]` (и любые с разными select-аргументами через `predicate`/`exact: false`).
- Проверить, что `queryKey` у `useVisitsToday` **не зависит** от строки `select`, иначе Reception инвалидирует один ключ, а InCasino держит другой → багу.
- Если зависит — переписать на единый стабильный ключ `["casino-visits-today", casinoId, date]`, а `select` передавать только в queryFn.
- Добавить `refetchOnWindowFocus: true` как страховку.

---

## 11. Wallet (Finance) — удаление вкладок

Файл: `src/pages/Finance.tsx`.

**Сейчас табы:** Summary, Dashboard, Daily Review, Wallets, Expenses, Budget, Cash Count, Transfers.

**Пользователь хочет на странице Wallet:** удалить вкладки Dashboard, Daily Review, Wallets, Expenses, Budget, Cash Count → оставить **только** доступ к Cash Count (как кнопка/действие, а не вкладка).

**Интерпретация (чтобы не сломать остальные роли):**
Сайдбар ведёт на `/finance?tab=wallets`, `/finance?tab=budget`, `/finance?tab=expenses`, `/finance?tab=review`, `/finance?tab=dashboard`, `/finance?tab=summary`, `/finance?tab=transfers` — это **отдельные пункты меню**, т.е. каждая «вкладка» уже является отдельным разделом сайдбара. Но на самой странице мы лишний раз показываем все табы — это и есть «лишние вкладки» по жалобе пользователя.

**Действие:**
- В `Finance.tsx` **убрать `<TabsList>`** полностью. Содержимое страницы определяется только параметром `?tab=...` из URL (рендерим один соответствующий компонент). Заголовок страницы меняется в зависимости от tab: `Dashboard / Daily Review / Wallets / Expenses / Budget / Cash Count / Summary / Transfers`.
- На странице `?tab=wallets` (Wallet) — заголовок `Wallets`, описание, дата справа, **кнопка `Cash Count`** в правом слоте, которая открывает Cash Count как `ResponsiveDialog` (или ведёт на `?tab=cashcount`). Внутри страницы — никаких табов.
- Привести `Finance.tsx` к единому `PageShell + PageHeader` (сейчас он использует кастомный `<h1 class="text-2xl">` вместо PageHeader → нарушает design system).

---

## 12. Общий принцип «нет лишних вкладок»

Пройтись по всем страницам с `<Tabs>` и проверить — табы оставляем только там, где это **режим работы** одной и той же сущности (например, Reception: Check-in/Register/Update Data — это разные действия одного раздела, оставляем). Если таб = по сути отдельный раздел сайдбара — выносим.

Кандидаты на ревью (НЕ удаляем без подтверждения, только помечаем):
- `Pit.tsx` — табы Live Game/Breaklist/Attendance/Rota → это разные подразделы, оставляем.
- `Tables.tsx` — Active Players/Tracker/TableTracker → оставляем.

---

## Технические детали

**Изменяемые файлы:**
- `src/components/layout/PageHeader.tsx` — добавить `date` проп.
- `src/components/layout/AppSidebar.tsx` — убрать роль-бейдж, объединить Theme+SignOut в одну строку, убрать `cashier/surveillance` из `/players`.
- `src/lib/role-access.ts` — добавить `getPrimaryRole(roles)`.
- `src/pages/Dashboard.tsx` — хедер, удалить ChipConservationCard, дата.
- `src/components/cage/ActiveShiftView.tsx` + `OpenShiftScreen.tsx` — PageHeader, увеличить размер времени/курсов.
- `src/pages/Players.tsx` — удалить New Player + AddPlayerDialog, заменить детальный диалог.
- `src/pages/Blacklist.tsx` — переверстать в grid карточек.
- `src/components/PlayerEditDialog.tsx` — убрать внешний скролл, 2 колонки.
- `src/pages/InCasino.tsx` + `src/hooks/use-visits.ts` + `src/hooks/use-realtime.ts` — фикс realtime/queryKey.
- `src/pages/Finance.tsx` — убрать TabsList, единый PageHeader, Cash Count как кнопка на Wallets.
- Все остальные страницы — добавить `date` в `PageHeader`.

**Безопасность:**
- Гард на `/players` — добавить проверку роли в `App.tsx` (через текущий механизм routing-guard, посмотрим как сейчас устроено и встроимся туда же).
- Никаких изменений БД/RLS.

**Memory updates:**
- Обновить `mem://design/system-rules`: «Дата всегда в правом углу хедера, формат `YYYY.MM.DD`, моноширинный, `text-base text-muted-foreground`. Роль в UI не показываем (кроме отдельного OPS-индикатора Manager Override). Если роль нужна — только высший приоритет».
- Обновить `mem://features/player-management`: «Создание игрока — только через Reception → Register. На странице Players кнопки New Player нет».
- Обновить `mem://features/blacklist-system`: «Визуальный каталог — крупные карточки с красной рамкой, grid».

---

## Порядок работы (one PR per batch)

1. **Шаг 1 — Foundation:** PageHeader.date, AppSidebar (роль убрать, Theme+SignOut в строку), getPrimaryRole helper.
2. **Шаг 2 — Pages quick-wins:** Dashboard (убрать Chip Conservation, дата), Players (убрать New Player + дата + гард + единый диалог), Blacklist (карточки), Cage (PageHeader + крупные курсы/время).
3. **Шаг 3 — Wallet/Finance refactor:** убрать TabsList, единый хедер, Cash Count кнопкой.
4. **Шаг 4 — Bug fixes:** InCasino realtime, Reception edit dialog scroll.
5. **Шаг 5 — Sweep:** прогон по остальным страницам и добавление `date` + проверка единого стиля.

Подтверди план — стартую с Шага 1.
