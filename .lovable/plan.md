# Drop R / Drop V — модель NEP (External vs Recycled)

## Проблема

Сейчас `Drop R` = просто сумма всех `buy`-транзакций игрока. Если игрок:
1. Внёс 2M (NEP = +2M)
2. Забрал 3M (NEP = −1M, играет на «деньги казино»)
3. Снова приносит 1M

— текущая система засчитает +1M в Drop R, хотя по сути это **возврат выигрыша**, а не новые внешние деньги. Это «фейк-дроп».

## Решение: NEP-модель

Для каждого игрока ведём бегущий счёт **NEP = Σ Cash In − Σ Cash Out** в хронологическом порядке.

При каждом новом `buy` (cash-in) сумма автоматически делится на 2 части:

```text
recycledPart = min(cashIn, max(0, -prevNEP))   // покрытие отрицательного NEP
externalPart = cashIn - recycledPart            // остаток = новые внешние деньги
```

После транзакции: `NEP_new = prevNEP + cashIn − cashOut_за_тот_же_момент`. Для `cashout` целиком уменьшаем NEP, externalPart = 0, recycledPart = 0 (cash-out не дробится — он только смещает NEP).

### Итог:
- **Drop R** (Real Drop) = Σ `externalPart` всех buy за период
- **Drop V** (Volume Drop) = Σ `recycledPart` + Σ `total_bet` из Table Tracker
- **Result** считается как и раньше: `cashout − total_buy` (логика «чистой игры» не меняется — это касса, не PnL игрока)

## Где правим

### 1. БД: новая RPC + view-расширение

Создать SQL-функцию `compute_player_drop_split(player_id, from_ts, to_ts)` возвращающую `(drop_r bigint, drop_v_recycled bigint)`. Алгоритм: SELECT все `transactions` игрока с `created_at <= to_ts` ORDER BY `created_at, id`, итерируем, ведём `nep`, для каждой buy в диапазоне `[from_ts, to_ts]` накапливаем external/recycled.

Дополнительно — RPC `compute_table_drop_split(casino_id, shift_id_or_date_range)`: тот же алгоритм, но возвращает Map<table_id, {drop_r, recycled}>; для каждой `buy.table_id` присваиваем split на основе глобального NEP игрока на момент транзакции.

> **Важно:** NEP считается **глобально по игроку** (lifetime), а не по смене/столу — игрок может «принести выигрыш вчерашней смены» сегодня. Splitting по таблицам/сменам — атрибуция уже посчитанных частей.

### 2. Frontend

- **`src/pages/Tables.tsx`** (строки 277–296, 213–252): заменить `dropR = sum(buy.amount)` на split из RPC; `dropV` дополнить recycled-частью.
- **`src/pages/Dashboard.tsx`** (строки 80–117): то же самое.
- **`src/components/pit/ActivePlayers.tsx`** (≈198) и **`src/components/pit/SeatedPlayerChip.tsx`**: показывать `dropR` (external) — будет 0 у игроков, играющих на выигрыше.
- **`src/components/pit/TableSeatingDialog.tsx`** (≈136): то же.
- **`src/components/player/PlayerVisitsBreakdown.tsx`** (строки 71–105, 200, 231, 260, 291): добавить колонку `Drop R` рядом с `Drop` (текущий = total buy, оставить как «Drop V cash-side» / переименовать). Решение по UI ниже.
- **`src/hooks/use-players.ts`** (`usePlayerEconomyRange`, ≈125–215): добавить вычисление NEP-split на клиенте для диапазона (или дёрнуть RPC).

### 3. View `player_economy`
Добавить два столбца:
- `total_drop_r bigint` — lifetime External
- `total_drop_recycled bigint` — lifetime Recycled
`total_drop` (= sum buy) **оставить как есть** для обратной совместимости и аудита.

## ASCII-схема

```text
buy 2M  ─► NEP: 0  → +2M  | ext=2M  rec=0
cashout 3M ► NEP: +2M → −1M | (no split)
buy 1M  ─► NEP: −1M → 0   | ext=0   rec=1M  ◄── фейк-дроп нейтрализован
buy 500K ► NEP: 0   → +500K| ext=500K rec=0
```

## Тесты

- `src/test/business-logic.test.ts`: добавить describe `dropSplit`:
  - простой кейс «всегда в минусе» → весь buy = external
  - кейс из примера выше: 2M / −3M / 1M → drop_r=2M, recycled=1M
  - несколько cashout подряд: NEP уходит глубоко в минус, потом большой buy частично гасит
  - порядок по `created_at` соблюдается даже если транзакции из разных смен/столов

## Открытые вопросы (нужно подтверждение)

1. **Старт NEP**: с момента регистрации игрока? (предполагаю «да, lifetime от первой транзакции»)
2. **Comps/expenses** влияют на NEP? (предполагаю **нет** — это не касса, не cash-flow игрока)
3. **`type='in'` / `type='out'`** считать как buy/cashout для NEP? (по текущему коду dropR их учитывает — оставлю так же)
4. UI в `PlayerVisitsBreakdown`: добавить отдельную колонку `Drop R` или **заменить** текущую `Drop` (lifetime = total buy) на `Drop R`? Рекомендую **заменить**, оставив total buy только в детальной карточке игрока.

После подтверждения — реализую миграцию + RPC + правки во всех перечисленных файлах + тесты.
