# Plan: Display Order для столов + Avg Bet таблица на Live Game

## Что уже есть (не трогаем)
- `gaming_tables.name` — это и есть short name (AR1, BG1). Title display name (American Roulette 1) **пропускаем** — пользователь подтвердил, уже есть через `game` поле или не нужно.
- `client_sessions.avg_bet` + `bet_changed_at` уже хранят среднюю ставку на сессию игрока за столом. Pit/Reception/Manager уже редактируют.
- Добавление столов в Admin уже работает.

## Что делаем

### 1. Сортировка столов: `display_order` (миграция)
- Добавить колонку `gaming_tables.display_order INTEGER NOT NULL DEFAULT 0`.
- Бэкфилл: проставить порядок исходя из текущей группировки по `game` (AR → BG → Poker), внутри — alphanumeric по `name`.
- Индекс `(casino_id, is_archived, display_order)`.
- Все хуки/запросы, читающие `gaming_tables`, переводим на `.order('display_order').order('name')`. Затронуты Dashboard, Live Game grid, Tracker, Chip Count, Breaklist, отчёты.

### 2. Admin → Tables: редактирование порядка
- В существующей форме добавления/редактирования стола поле **Display Order** (number input, default = max+1).
- В списке столов в админке — компактная inline-редакция числа + кнопки ↑/↓ (опционально). Доступ: Manager/Super Admin.
- Floor Manager — read-only.

### 3. Поддержка нового типа игры "Poker" / "Club Poker"
- Тип игры `Texas Holdem` уже есть в БД. Добавление "Club Poker" не требует кода — Manager заведёт через Admin с `game='Poker'` (или таким `game`, как нужно). Дашборд и Live Game уже группируют по `game`. С `display_order` он автоматически встанет туда, куда задаст Manager (под Blackjack в Dashboard, под BG1 в Live Game).

### 4. Avg Bet таблица под сеткой Live Game (новый компонент)
**Расположение:** `src/pages/LiveGame.tsx` (или эквивалент), под существующей сеткой столов.

**Источник данных:** активные `client_sessions` где `stopped_at IS NULL` за текущий business day, scope = `useCasino().activeCasinoId`.

**Структура (как Player Statistics, но компактнее):**

```text
| Player         | AR avg | BG avg | Poker avg | Session start | Duration |
|----------------|--------|--------|-----------|---------------|----------|
| Ivan Petrov    | 100    | ·      | ·         | 19:42         | 1h 18m   |
| Anna Smith     | ·      | 50     | ·         | 20:15         | 0h 45m   |
```

- Каждая строка = одна открытая сессия (а не игрок). Если игрок одновременно сидит за двумя — две строки (но `uniq_client_sessions_open_per_player` это запрещает, так что де-факто одна).
- Колонка avg заполняется только в той, что соответствует `gaming_tables.game` сессии; остальные — `·` placeholder.
- `Duration` = `now() - started_at`, обновляется каждые 30 сек (realtime + interval).
- Pit/Manager/Floor Manager могут inline-редактировать avg (тот же механизм что в Player Tracker, через mutation, optimistic update) — это уже работает в существующем коде.

**Сортировка:** по `started_at DESC` (свежие сверху).

**Mobile:** на узких экранах — карточная вёрстка (Drawer-friendly, без горизонтального скролла).

### 5. Player Profile → Statistics: Avg Per Day (без backend изменений)
- В существующем блоке Player Statistics добавить строку **Avg Bet (per day)** = SUM(avg_bet всех сессий за день) / COUNT(сессий за день), агрегировано по дням. Lifetime = среднее этих daily-средних.
- Чисто клиентский расчёт по `client_sessions` игрока. Раздельно по game (AR/BG/Poker).

## Что НЕ делаем
- Не переименовываем `name` → `short_name` (пропускаем по ответу пользователя).
- Не добавляем `title_name` (пропускаем).
- Не меняем модель `client_sessions` — она уже подходит.
- Никакого автосчёта total_bet/duration на сервере сверх того, что уже есть.

## Версия
- Backend изменение (миграция + новая колонка) → bump `package.json` patch.

## Файлы
- **Миграция:** `display_order` колонка + бэкфилл + индекс.
- **Edited:**
  - `src/hooks/use-gaming-tables.ts` (или эквивалент) — `.order('display_order')`.
  - Admin форма стола — поле Display Order.
  - `src/pages/LiveGame.tsx` — встройка `<AvgBetSessionsTable />`.
  - Player Statistics компонент — Avg Per Day строка.
- **Created:**
  - `src/components/live-game/AvgBetSessionsTable.tsx`.
  - `src/hooks/use-active-sessions-avg.ts`.
