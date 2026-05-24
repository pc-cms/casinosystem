
# Per-Player Daily Average Bet — Manual Entry by Pit

## Problem

Сейчас на странице **Live Tables** показывается `ActiveSessionsAvgBetTable` — он берёт активные сессии за столом. Это неправильно. Нужен совершенно другой механизм: **средняя ставка по игроку за игровой день**, которую Пит/Менеджер вводит вручную для всех присутствующих в казино игроков, независимо от того, сидят они за столом или нет.

Активные сессии за столами (длительность + avg/table) — это отдельная сущность, она остаётся как есть на странице столов и втекает в профиль игрока через session-механику. Их не трогаем.

## Что строим

### 1. Новая таблица БД: `player_daily_avg_bets`

Хранит ставки по игроку за бизнес-день, разбитые по группам игр (AR / BG / Poker).

Поля:
- `casino_id`
- `player_id`
- `business_date` (date)
- `avg_bet_ar`, `avg_bet_bg`, `avg_bet_poker` (numeric, nullable)
- `updated_by` (user id), `updated_at`
- UNIQUE (casino_id, player_id, business_date)

История изменений в течение дня — отдельная таблица `player_daily_avg_bet_changes` (player_id, business_date, game_group, value, changed_at, changed_by) — для того, чтобы в конце дня посчитать среднее по изменениям.

RLS: read для всех ролей казино, write — pit/manager/floor_manager.

Триггер: при INSERT/UPDATE в основной таблице — запись в changes log.

### 2. Закрытие бизнес-дня → финализация средних

В RPC закрытия дня (или отдельный шаг) для каждого `(player, business_date, game_group)` считаем AVG по changes log и записываем финальное значение в `player_daily_avg_bets` как «final». Это значение далее показывается в профиле игрока по дням.

### 3. UI: новая таблица на Live Tables (на месте текущей `ActiveSessionsAvgBetTable`)

Колонки (как в Player Statistics): **Card · Level · Name · Visits · Entry · Left · AR · BG · Poker**.

Источник строк — все игроки, находящиеся в казино сегодня (visits с `business_date = today`, в первую очередь те, у кого нет `left_at`; ушедшие — в конце или скрыты тогглом «Show left»).

Ячейки AR/BG/Poker — inline-редактируемые для pit/manager/floor_manager (как сейчас в `ActiveSessionsAvgBetTable`). Пустые значения показываются как `·`. Заполнено может быть только одно из трёх или несколько.

### 4. Player Statistics — изменения

- Удаляем колонку **Position** полностью.
- Добавляем колонку **Avg Bet** — показывает обобщённое значение (если заполнен только покер — покер; если несколько — наибольшее или сумма; уточняю: показываем последнее по приоритету AR→BG→Poker, или если несколько — показываем «mixed»). Кликом по ячейке открывается popover/dropdown с тремя строками: **AR / BG / Poker** и их значениями.

### 5. Player Profile — daily avg bet

В профиле игрока в разделе истории по дням показываем финальное `avg_bet_ar / bg / poker` за каждый business day из `player_daily_avg_bets`.

## Тех. детали

- Новый хук `use-player-daily-avg-bets.ts`: `usePlayerDailyAvgBets(date)` — список по казино за день; `useSetPlayerDailyAvgBet()` — мутация upsert одной ячейки.
- Новый компонент `src/components/pit/PlayerDailyAvgBetTable.tsx` заменяет `ActiveSessionsAvgBetTable` в `Tables.tsx` (импорт меняем; старый файл оставляю, чтобы откатиться, либо удаляю по чистоте — удалю).
- В `PlayerStatistics.tsx`: удаление колонки Position; добавление колонки Avg Bet с popover из `@/components/ui/popover`.
- Финализация в закрытии дня — расширяем существующий RPC закрытия (`close_business_day` или эквивалент) шагом, который читает changes log и пишет среднее обратно в `player_daily_avg_bets`. Если RPC не существует/слишком сложно — делаем отдельную RPC `finalize_player_daily_avg_bets(p_business_date)` и вызываем её из `CloseBusinessDayButton`.

## Открытые вопросы (отвечу по умолчанию если не уточнишь)

1. **Как считать «итог» в Player Statistics, если заполнено несколько групп?** — По умолчанию покажу значение группы, по которой игрок реально играл больше (по visits/positions); если непонятно — приоритет Poker → BG → AR. Кликом — всегда полный разрез.
2. **Показывать ли ушедших игроков (Left ≠ null)?** — По умолчанию да, с серым тоном; верх таблицы — присутствующие.
3. **Удалять ли `ActiveSessionsAvgBetTable.tsx` совсем?** — Да, удалю, т.к. функционал переезжает.

Если со всем согласен — начну с миграции БД.
