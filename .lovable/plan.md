# Surveillance — финальная версия (с нуля)

Полностью переписываем интерфейс роли `surveillance`. Никаких лишних вкладок, никаких кнопок редактирования. Доступно строго 5 пунктов меню. Глубина истории — **90 дней**. Старый `CctvView` / `CctvLayout` удаляем — Surveillance везде использует обычный `AppLayout`.

---

## Меню (только эти пункты)

### 1. Dashboard
- Полная копия менеджерского `Dashboard` (KPI, In Casino, Tables, последние транзакции).
- Внизу добавлен блок **Floor Staff** — список вышедшего на смену стафа.
- Селектор бизнес-дня в шапке (до 90 дней назад).
- Никаких кнопок действия (Check-out, Approve и т.п.).

### 2. Pit (всё, что есть у Pit-роли — read-only)
Один пункт меню `/pit` с табами:
- **Breaklist** — таблица только для просмотра.
- **Live Tables** — статус столов, текущий результат.
- **Active Players / Player Tracker** — посадка, ставки, время.
- **Table Check** + **Table Analytics**.
- **Attendance** + **Rota** — Live + Floor + Security + Office.

Селектор бизнес-дня (90 дней) переключает все табы на выбранный день.

### 3. Player Statistics (как у менеджера, полная)
- Полный список игроков с финансовой статистикой.
- Поиск, фильтры, сортировки — как у менеджера.
- Вход в карточку игрока (см. глобальный блок ниже): можно оставлять **Notes**, проставлять **Tags**, отправлять в **Blacklist**, делать **Chip Transfer**.

### 4. Cage (read-only списки + Chip Transfers)
Одна страница `/cage` с табами:
- **IN / OUT** — все cash-транзакции (`transactions`) за выбранный день.
- **Cashless** — все `cashless_transactions` за выбранный день.
- **Cage Transfers** — `cage_transfers` (Cage↔Table) за выбранный день.
- **Chip Transfers** — `chip_transfers` (player↔player) за выбранный день, **с кнопкой «New Chip Transfer»** — открывает существующий `ChipTransferDialog` (выбираем from-player, to-player, сумму/фишки). Это единственное действие, доступное Surveillance в Cage.

В шапке: селектор даты + список **закрытых смен** этого дня. Глубина — 90 дней. Никаких форм Add Float / Collection / Fill / Credit / Cashless.

### 5. Blacklist
- Верхняя строка — глобальный поиск игроков (по имени/никнейму/ID/карте) для отправки в blacklist.
- Под ней — список забаненных (фото, имя, **дата бана**, **последнее посещение**).
- Кнопка «Reactivate» **скрыта** для Surveillance (только Manager).

---

## Глобальные изменения карточки игрока (`/players/:id`)

Видны для **Pit / Manager / Surveillance / Super Admin**.

### A. Кнопка «Add to Blacklist»
- В верхней панели рядом с «Chip Transfer».
- Открывает диалог с обязательным полем «Причина» → `players.status='blacklist'` + запись в `activity_logs`.

### B. Вкладка «Notes»
- Лента сообщений: **дата · автор · текст**, новые сверху.
- Поле ввода + «Post» — Pit / Manager / Surveillance.
- Хранится в `player_notes`.

### C. Tags
- Surveillance может добавлять/снимать теги (как Pit/Manager).

### D. Chip Transfer
- Кнопка уже есть — добавляем `surveillance` в условие видимости.

---

## Технические детали

### Маршрутизация
`src/App.tsx`:
- Удалить ветку `isCctvMode` и lazy-импорт `CctvView`.
- `ROUTE_ROLES`: оставить `surveillance` только в `/`, `/pit`, `/player-statistics`, `/players/:id`, `/cage`, `/blacklist`. Убрать из `/tables`, `/in-casino`, `/players`, `/reports`, `/logs`, `/table-results`, `/miss-chips`.
- `getDefaultRoute` для чистого Surveillance → `/`.

### Read-only режим
- Новый хук `src/hooks/use-readonly-mode.ts` → `true` если `surveillance` без `manager`/`super_admin` (и без активного `managerOverride`).
- В компонентах Pit (BreaklistGrid, ActivePlayers, TableSeatingDialog, FloorTableCard, Attendance/Rota grids) — на верхнем уровне: если `readOnly`, отключаем onClick/onChange/drop, скрываем кнопки Add/Edit/Save/Approve/Close/Delete, ставим `pointer-events-none` на интерактивные ячейки.
- Surveillance-разрешённые действия (Notes post, Tags toggle, Add to Blacklist, Chip Transfer, поиск в Blacklist) — read-only **не** блокирует.

### Сайдбар
`src/components/layout/AppSidebar.tsx` `NAV_ITEMS` — для `surveillance` оставить только:
- `/` (Dashboard)
- `/pit` (Pit, без подпунктов в сайдбаре — табы внутри)
- `/player-statistics` (Player Statistics)
- `/cage` (Cage)
- `/blacklist` (Blacklist)

Все остальные пункты убрать из видимости Surveillance.

### Селектор бизнес-дня
- Контекст `src/lib/surveillance-date-context.tsx` (день + опционально `shift_id`).
- Компонент `src/components/SurveillanceDatePicker.tsx` встраивается в `PageHeader` когда `useReadOnlyMode()`.
- Лимит: max 90 дней назад, max — сегодня.
- На страницах Dashboard / Pit / Cage / Player Statistics использовать выбранную дату вместо `getBusinessDate()`.

### Cage страница для Surveillance
- Новый компонент `src/components/cage/CageHistoryView.tsx`: 4 таба (IN/OUT, Cashless, Cage Transfers, Chip Transfers).
- Фильтры по дате/смене.
- В табе **Chip Transfers** — кнопка «New Chip Transfer» открывает `ChipTransferDialog` (уже существует, использует `useCreateChipTransferPair`).
- В `src/pages/Cage.tsx`: если `useReadOnlyMode()` → рендерим `CageHistoryView` вместо обычного Cage UI.

### Blacklist страница
`src/pages/Blacklist.tsx`:
- Сверху строка поиска игроков (использует `usePlayers`) с кнопкой «Send to Blacklist» (диалог с причиной).
- В карточках — добавить «Banned at» и «Last visit».
- Скрыть «Reactivate» для Surveillance.

### Карточка игрока
`src/pages/PlayerProfile.tsx`:
- Условие на «Chip Transfer»/«Add to Blacklist»: `["pit","manager","surveillance","super_admin"]`.
- Новый диалог `src/components/player/BlacklistPlayerDialog.tsx` (причина обязательна) → update `players.status='blacklist'` + лог.
- Вкладка «Notes» с формой ввода видна Pit/Manager/Surveillance.
- `usePlayerNotes` уже есть → нужен `useCreatePlayerNote`.

### RLS / миграции
Новая миграция `supabase/migrations/<timestamp>_surveillance_full_access.sql`:
- `player_notes`: добавить INSERT policy для `surveillance` (по `user_has_casino_access`).
- `player_tags`: INSERT/DELETE для `surveillance` в своих казино.
- `players`: UPDATE `status` доступен `surveillance` (отдельный policy с `user_has_casino_access`).
- `chip_transfers` уже разрешён через INSERT policy `pit/manager` — расширить до `surveillance`. Также проверить, что RPC `create_chip_transfer_pair` не делает `has_role('pit') OR has_role('manager')` явно — если делает, добавить `surveillance`.
- SELECT policies для `transactions`, `cashless_transactions`, `cage_transfers`, `chip_transfers` для Surveillance уже есть — оставляем.

### Файлы

**Новые:**
- `src/hooks/use-readonly-mode.ts`
- `src/lib/surveillance-date-context.tsx`
- `src/components/SurveillanceDatePicker.tsx`
- `src/components/cage/CageHistoryView.tsx`
- `src/components/player/BlacklistPlayerDialog.tsx`
- `supabase/migrations/<timestamp>_surveillance_full_access.sql`

**Изменённые:**
- `src/App.tsx` — убрать CCTV ветку, обновить `ROUTE_ROLES`, default route.
- `src/components/layout/AppSidebar.tsx` — урезать видимость Surveillance до 5 пунктов.
- `src/pages/Dashboard.tsx` — добавить Floor Staff блок, использовать SurveillanceDate.
- `src/pages/Pit.tsx` + `src/components/pit/*` — read-only хуки, поддержка SurveillanceDate.
- `src/pages/Cage.tsx` — branch на `CageHistoryView` для Surveillance.
- `src/pages/Blacklist.tsx` — поиск + send-to-blacklist + новые поля + скрытие Reactivate.
- `src/pages/PlayerProfile.tsx` — кнопка Blacklist, расширить Chip Transfer на surveillance, вкладка Notes.
- `src/hooks/use-player-profile.ts` — `useCreatePlayerNote`.

**Удалённые:**
- `src/pages/CctvView.tsx`
- `src/components/cctv/CctvLayout.tsx`
- `src/hooks/use-cctv.ts` (если используется только в CctvView).

После approve выйду из plan-mode и реализую всё разом.
