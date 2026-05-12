## Проблема

Формула баланса смены сейчас включает Miss в Cash Desk Result, но это даёт неверный 0-баланс, когда есть недостача/излишек фишек.

**Канонически (как должно быть):**
```
Cash Desk Result = ΔCash + Expenses + Collection − AddFloat + SlotsOut − SlotsIn
Shift Balance    = Cash Desk Result − Tables Result − Miss        (= 0 идеально)
```

Miss выносится отдельным членом баланса, а не «прячется» внутри CDR.

**Проверка на смене 11 мая:**
- CDR = −4 643 000 + 563 000 − 27 000 000 + 34 000 000 = **2 920 000**
- Tables Result = **2 885 000**
- Miss = **35 000**
- Balance = 2 920 000 − 2 885 000 − 35 000 = **0** ✓

## Что меняется

### 1. БД-триггер `compute_shift_balance` (миграция)

Файл: новая миграция в `supabase/migrations/`.

```sql
-- было:
v_cash_desk := v_delta_cash + v_expenses + v_collection - v_add_float
             + v_slots_out - v_slots_in + v_miss;
v_balance   := v_cash_desk - v_tables;

-- стало:
v_cash_desk := v_delta_cash + v_expenses + v_collection - v_add_float
             + v_slots_out - v_slots_in;          -- БЕЗ miss
v_balance   := v_cash_desk - v_tables - v_miss;   -- miss отдельным членом
```

Триггер `BEFORE INSERT OR UPDATE` на `shifts` уже навешен (миграция `20260511231033`) и обновляет колонки `cash_desk_result` и `balance` — значит для всех новых/повторно открытых смен значения пересчитаются автоматически.

Дополнительно — одноразовый `UPDATE shifts` для всех закрытых смен, чтобы пересчитать `cash_desk_result` и `balance` по новой формуле (через вызов функции в `UPDATE ... SET balance = ..., cash_desk_result = ...` либо `UPDATE shifts SET id = id` чтобы дёрнуть BEFORE-триггер).

### 2. UI-формула `src/lib/cage-balance.ts`

Зеркалим триггер:
```ts
const cashDeskResult =
  deltaCash + expenses + collection - addFloat + slotsOut - slotsIn;
const shiftBalance = cashDeskResult - tablesResult - miss;
```
Обновить doc-комментарий формулы в шапке файла.

### 3. Подсказка в `src/pages/cage/CageClosingsPage.tsx`

Поправить `title` у ячейки Balance:
```
"Cash Desk Result − Tables Result − Miss.
 Cash Desk Result = ΔCash + Expenses + Collection − AddFloat + SlotsOut − SlotsIn"
```

И fallback-расчёт (на случай NULL колонок):
```ts
const balance = s.balance != null
  ? Number(s.balance)
  : (cashDeskResult != null
      ? cashDeskResult - tablesResult - miss
      : tablesResult - cash - miss);
```

### 4. `ShiftClosingReport` (печатный отчёт)

Если в шапке/подвале отчёта есть текстовое описание формулы — синхронизировать с новой. Числа `balance`, `tablesResult`, `missTotal` уже приходят из `shifts.*` через `ReprintShiftDialog` и подтянутся автоматически.

### 5. Память проекта

Добавить пункт в `mem://features/canonical-tables-result` (или новый файл `mem://features/cash-desk-balance-formula`):
> Cash Desk Result = ΔCash + Expenses + Collection − AddFloat + SlotsOut − SlotsIn (БЕЗ Miss). Shift Balance = CDR − Tables Result − Miss. Источник истины — DB-функция `compute_shift_balance`, UI-зеркало — `src/lib/cage-balance.ts`.

### 6. Версия

Бамп `package.json` patch (есть миграция и изменение триггера).

## Что НЕ меняется

- Wizard закрытия смены, ввод данных, snapshot `closing_count.chip_miss_total` — без изменений.
- Колонки `shifts.miss_total`, `shifts.tables_result` — без изменений.
- Логика тригера `compute_tables_result` — без изменений.
- `ReprintShiftDialog` чтение канонических колонок — оставляем как есть (фикс прошлой итерации).

## Проверка после деплоя

- Смена 11 мая: `balance` должен стать **0** (вместо 2 920 000).
- В Closed Shifts колонка Balance = 0 → серая.
- Печатный отчёт показывает Balance = 0.
- На сменах без Miss поведение не меняется (Miss=0, формула эквивалентна старой).
