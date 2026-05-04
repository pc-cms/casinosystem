
# Закрытие кассы — финальная логика

## 1. Принцип

Касса — изолированная зона. У неё свой **Chip Float** и **Cash Float**, унаследованные с закрытия предыдущей смены. Закрытие кассы сходится **само в себе** через формулу с учётом результата столов и Miss по номиналам.

## 2. Условие старта

Кнопка **Close Shift** в кассе становится активной **только** когда Пит закрыл все столы за текущий business day (нет `gaming_tables` со статусом open за этот casino_id и дату). Иначе — disabled с подсказкой "Waiting for Pit to close all tables".

## 3. Главная формула

```text
Cash Desk Balance =
      Result Table
    + Result Cash Desk (Chips + Cash + Mobile + Bank)
    − Opening (Chips + Cash)
    ± MISS CHIPS
```

- `Result Table` — `SUM(result)` всех `gaming_tables` (через закрытия столов) за business_date смены.
- `Result Cash Desk` — финальный пересчёт всех ценностей в кассе.
- `Opening` — `shift.opening_float` (chips + cash), то что было на открытии.
- `MISS CHIPS` — сумма стоимостей расхождений по каждому номиналу (со знаком).

Идеал = **0**. Если `> 0` — лишние деньги. Если `< 0` — недостача. В обоих случаях:
- Обязательный комментарий кассира.
- Обязательный Manager Access (пароль/RFID менеджера) для подтверждения.
- Закрыть смену **можно**, расхождение логируется в `cash_desk_balance` и в `activity_logs`.

При балансе = 0 — всё равно требуем Manager Access для закрытия смены (менеджер всегда присутствует).

## 4. Miss Chips — по каждому номиналу

```text
Для каждого номинала D:
  miss_qty[D]   = counted[D] − opening[D]
  miss_value[D] = miss_qty[D] × D

MISS_TOTAL = Σ miss_value[D]   (со знаком)
```

Хранение в `cage_shifts.closing_count`:
```json
{
  "chip_miss_by_denom": { "1000": -2, "5000": +1, ... },
  "chip_miss_total": -1000
}
```

Месячный отчёт `/reports/miss-chips` — разворот по номиналам + итог.

## 5. UI закрытия — один экран, четыре блока

Мастер на 3 шага упраздняем. Один длинный диалог с секциями:

### Block 1 — Tables (read-only)
Таблица: `Table | Result`. Снизу `Total Result Table: +X XXX XXX`.
Подгружается из закрытий столов за business_date смены.

### Block 2 — Cash Desk: Chips (per denom)
Сетка по номиналам:
```text
Denom │ Open │ Close │ Miss (qty) │ Miss (value)
1 000 │  120 │   118 │     −2     │   −2 000
5 000 │   40 │    41 │     +1     │   +5 000
…
```
Внизу: `MISS TOTAL: +3 000`.

### Block 3 — Cash Desk: Cash + Mobile + Bank
Существующий `CashCountGrid` + Mobile + Bank секции. Внизу: `Cash Desk Total (TZS).`

### Block 4 — Balance (formula card)
```text
  Result Table              +X XXX XXX
+ Cash Desk Result          +Z ZZZ ZZZ
− Opening                   −O OOO OOO
± Miss Chips                ±Y YYY
─────────────────────────────────────
  Cash Desk Balance         = 0  ✓
```
Цветовое выделение:
- = 0 → success.
- ≠ 0 → destructive + обязательный комментарий + блок "Manager confirmation required".

### Footer
- Textarea Notes (обязателен если balance ≠ 0).
- Кнопка `Close Shift (Manager Confirm)` → открывает `ManagerOverrideDialog` (пароль/RFID) → после подтверждения смена закрывается.

## 6. Технические изменения

### Frontend

**`src/components/cage/CloseShiftDialog.tsx`** — переписать:
- Убрать 3-шаговый wizard, сделать секционный layout.
- Гард: `disabled` пока есть открытые столы (новый хук `useOpenTablesCount(businessDate)`).
- Заменить `expectedChips` на per-denom diff против `shift.opening_float.chips`.
- Добавить блок `Tables Result` (новый хук `useTableResultsForBusinessDate(businessDate)`).
- Добавить расчёт `cashDeskBalance` по формуле.
- Обязательный `ManagerOverrideDialog` перед `onConfirm`.
- Запрет confirm если balance ≠ 0 и notes пуст.

**`src/components/cage/CageHelpers.ts`** — новые утилиты:
- `computeMissByDenom(opening, counted)` → `{denom: qty}`.
- `missTotalValue(missByDenom)` → number.
- `cashDeskBalance({ resultTable, openingChips, openingCash, closingChips, closingCash, missTotal })` → number.

**`src/hooks/use-tables.ts`** (или новый):
- `useTableResultsForBusinessDate(date)` — `SUM(result)` из `gaming_tables`/`table_closings` за дату.
- `useOpenTablesCount(date)` — кол-во `gaming_tables` со статусом open.

**`src/pages/MissChips.tsx`** — переключить на per-denom отображение из `chip_miss_by_denom`.

**`src/components/business-days/SnapshotTable.tsx`** — добавить секцию `cash_desk_balance` (формула + итог) в snapshot.

### Database (migration)

1. Расширить `cage_shifts.closing_count` (JSONB) — никаких schema changes, просто новые поля внутри:
   - `chip_miss_by_denom: jsonb`
   - `chip_miss_total: numeric`
   - `cash_desk_balance: numeric`
   - `result_table: numeric`
   - `manager_confirmed_by: uuid`

2. Триггер `cage_shifts_close_validate` (новый):
   - При UPDATE `cage_shifts` со статусом → closed:
     - Запрет если есть `gaming_tables` со статусом open за casino_id + business_date.
     - Авто-вычисление `cash_desk_balance` server-side из закрытия (security: не доверять клиенту).
     - Запись `cash_desk_balance` обратно в `closing_count`.

3. RPC `get_table_results_for_business_date(p_casino_id uuid, p_date date)` → `numeric` (sum of results).

4. Snapshot бизнес-дня (`business_day_closures.snapshot`) — добавить секцию `cash_desk` с формулой.

### Backend version bump
Auto-bump `package.json` patch version (миграция + триггер + RPC).

## 7. Что НЕ меняем

- `opening_float` формат — уже хранит chips и cash.
- Логику buy-ins/cashouts/transfers/expenses — `cash_result` считается как сейчас.
- Daily Review — продолжает получать `cash_result` через `useShiftClosingForDate`.
- `ChipConservationCard` (общий по казино) — отдельная плоскость для Manager, не смешивается с балансом кассы.

## 8. Порядок реализации

1. Migration: расширение `closing_count` + триггер блокировки + RPC `get_table_results_for_business_date`.
2. Хуки: `useOpenTablesCount`, `useTableResultsForBusinessDate`.
3. Helpers: `computeMissByDenom`, `cashDeskBalance`.
4. Переписать `CloseShiftDialog` (секционный layout + 4 блока + Manager confirm).
5. Обновить `MissChips` отчёт на per-denom.
6. Добавить секцию `cash_desk_balance` в `BusinessDays` snapshot.
7. Bump version.

После твоего апрува — переключаюсь в build mode и поехали.
