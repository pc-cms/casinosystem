# Apply tips-in-balance fix to historical shifts

В прошлом шаге исправлен только клиент (`CloseShiftDialog`, `ShiftClosingReport`, `cage-balance.ts`). Сохранённые в БД `shifts.balance` / `shifts.cash_desk_result` для уже закрытых смен (включая вчера) посчитаны **по старой формуле без вычета tips**. Поэтому в любом отчёте/реprint за вчера баланс по-прежнему завышен на сумму tips. Нужно поправить DB-функцию и пересчитать историю.

## Что меняется

### 1. DB migration — `compute_shift_balance_from_row`
Добавить вычет tips этой смены в формулу:

```sql
v_tips := COALESCE((
  SELECT SUM(amount) FROM public.transactions
  WHERE shift_id = s.id
    AND type IN ('tips_live','tips_poker','tips_floor')
    AND cancelled_at IS NULL
), 0)::bigint;

v_balance := v_cash_desk - v_tables - v_miss - v_tips;
```

И добавить `'tips'` в возвращаемый jsonb. Триггер, который пишет `shifts.balance` / `shifts.cash_desk_result` при изменении смены, продолжит работать как есть — он уже опирается на эту функцию.

### 2. Backfill для уже закрытых смен
В той же миграции — однократный `UPDATE`:

```sql
UPDATE public.shifts s
   SET balance = (public.compute_shift_balance_from_row(s) ->> 'shift_balance')::bigint
 WHERE status = 'closed'
   AND EXISTS (
     SELECT 1 FROM public.transactions t
      WHERE t.shift_id = s.id
        AND t.type IN ('tips_live','tips_poker','tips_floor')
        AND t.cancelled_at IS NULL
   );
```

Затрагивает только смены, у которых реально есть tips → безопасно для остальной истории. `daily_summaries.tables_result` не трогаем (там tables_result, не balance).

### 3. ReprintShiftDialog
Уже читает `shifts.balance` напрямую — после backfill автоматически покажет правильное значение. Доп. правки не нужны.

### 4. Версия
Bump `package.json` (backend change) — `1.3.198`.

## Что НЕ меняется
- Клиентская формула (`src/lib/cage-balance.ts`) уже корректна.
- `CloseShiftDialog` / `ShiftClosingReport` уже корректны.
- `daily_summaries` не пересчитываем — `tables_result` от tips не зависит.

## Проверка после миграции
1. Открыть Cage → Reprint вчерашней смены, где были tips → строка `− Tips` присутствует, Balance уменьшен ровно на сумму tips.
2. SQL спот-чек: `SELECT id, balance FROM shifts WHERE …` до/после backfill для затронутых смен.
