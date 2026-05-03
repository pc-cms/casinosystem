## Глобальный принцип CCTV

Surveillance **не вносит ничего** в финансовые/операционные модули. Единственное место, где он что-то постит — это **Pitbook** (общение с Pit). Везде остальное — только просмотр.

## Что меняем

### 1. Cage для surveillance — снять все write-кнопки

Файл: `src/components/cage/CageHistoryView.tsx`

- **Удалить кнопку "New Chip Transfer"** во вкладке Chip Transfers (строки 261–269) и сопутствующий `ChipTransferPickerDialog` (строки 366+) — это сейчас единственный write-action в этом view.
- **Убрать вкладку Expenses** (ты сказал отмена) — оставить 4 вкладки: IN/OUT, Cashless, Cage Transfers, Chip Transfers.
- **Поправить grid вкладок**: сейчас `grid-cols-4`, оставляем `grid-cols-4` (Expenses и так была 5-й, удаляем — числа сходятся, но проверим JSX).
- В Cashless вернуть/оставить provider-фильтр (MTN/Tigo/Airtel/Halopesa) — он уже есть.

Итог Cage для CCTV: 4 read-only таба, ноль кнопок ввода.

### 2. Снять права на запись chip_transfers для surveillance

Сейчас RLS даёт surveillance INSERT в `chip_transfers`. Меняем миграцией:
- Drop INSERT policy для surveillance на `chip_transfers`.
- Surveillance остаётся с SELECT.

Также проверяем и удаляем у surveillance возможность писать в `players.status='blacklist'` через UI — оставляем только просмотр Blacklist (см. п. 5).

### 3. Новая страница /pitbook (CCTV ↔ Pit общение)

Использует существующую таблицу `cctv_observations`.

Маршрут: `/pitbook` — доступен ролям: `surveillance`, `pit`, `manager`, `super_admin`, `finance_manager`.

UI (PageShell + PageHeader + PageSection):
- Лента наблюдений (последние 7 дней) — автор, время, привязка (player / table / freeform), текст, статус (new / acknowledged).
- Surveillance: видит форму "New observation" (textarea + опц. выбор player/table) → INSERT в `cctv_observations`.
- Pit / Manager: видит ленту + кнопка "Acknowledge" (UPDATE флага).
- Realtime подписка на таблицу для мгновенного обновления у Pit.

Сайдбар:
- Новая секция "PITBOOK" (или внутри существующего PIT-блока) с пунктом **Pitbook** — иконка `MessageSquare`, видна тем же ролям что и страница.

### 4. RLS для cctv_observations

Проверить/добавить миграцией:
- SELECT: surveillance, pit, manager, super_admin, finance_manager (по своему casino).
- INSERT: surveillance, manager, super_admin (author = auth.uid()).
- UPDATE (acknowledge): pit, manager, super_admin.

### 5. PIT-блок и остальное меню — без изменений

По твоему ответу:
- **Все 7 PIT-пунктов остаются read-only** (Break List, Live Tables, Player Statistics, Table Check, Table Analytics, Attendance, Rota) — ничего не трогаем.
- Dashboard, Guests, Blacklist, Player Profile — остаются.
- В Player Profile у surveillance остаются: notes, tags (это разрешённые "пятна" записи). Это согласуется с прошлым решением — НЕ трогаем.
- В Blacklist surveillance может банить (создавать), не может снимать бан — оставляем как есть.

### 6. Версия

Бамп `package.json` patch (миграция RLS + новая страница) → 1.0.52.

## Технические детали

**Файлы к правке:**
- `src/components/cage/CageHistoryView.tsx` — убрать вкладку Expenses, удалить кнопку и диалог Chip Transfer.
- `src/components/layout/AppSidebar.tsx` — добавить пункт Pitbook.
- `src/App.tsx` — добавить маршрут `/pitbook` + permissions.
- `src/pages/Pitbook.tsx` — новый файл (лента + форма).
- `src/hooks/use-cctv-observations.ts` — новый хук (list / insert / acknowledge + realtime).
- `src/lib/route-module-map.ts` — зарегистрировать `/pitbook`.
- Миграция БД:
  - DROP INSERT policy on `chip_transfers` for surveillance.
  - Ensure RLS policies on `cctv_observations` (см. п. 4).
  - Добавить колонку `acknowledged_at`, `acknowledged_by` в `cctv_observations` если их нет.
- `package.json` → 1.0.52.

**Что НЕ делаем:**
- Не трогаем PIT-меню surveillance.
- Не добавляем Expenses в Cage.
- Не трогаем Player Profile / Blacklist write-actions surveillance.

После апрува переключаюсь в build mode и применяю.