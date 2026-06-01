## Изменения

### 1. БД (миграция)

**`cage_slots_shifts`** — добавить колонку:
```sql
ALTER TABLE public.cage_slots_shifts
  ADD COLUMN ace_fills bigint NOT NULL DEFAULT 0;
```

**`compute_slots_shift_balance_from_row(s)`** — переписать только блок результата:
- `v_slots_result := COALESCE(s.system_shift_result,0) − COALESCE(s.ace_fills,0)` (раньше = system_shift_result).
- `v_balance` продолжает вычитать `system_shift_result` (НЕ `slots_result`) — закрытие/баланс не меняется.
- В возвращаемом JSON: `system_result` = system_shift_result, `slots_result` = новый (System − ACE).

**Триггеры пересчёта** (`compute_slots_shift_balance_trigger` и подобные) — добавить `ace_fills` в список полей, при изменении которых пересчитывается `slots_result`.

Бамп `package.json` (patch) — обязателен из-за backend-изменений.

### 2. UI — закрытие смены (`ActiveSlotsShiftView.tsx`)

В той же секции, где сейчас редактируется **System Result**, рядом добавить второй numeric input:
- Поле **ACE Fills (TZS)** — `aceFillsInput` state, hydrated из `shift.ace_fills`, `onBlur` пишет `update cage_slots_shifts set ace_fills = ...`.
- Под ним показать вычисленное **Slots Result = System − ACE Fills** (информативно, signed).

Существующая плитка `Slots Result (TZS)` (строки ~671 «System − Opening − Ace Fill») переименовать в **System Shift Result** и оставить как есть (она = systemResult), а новую плитку **Slots Result** = `systemResult − aceFills` поставить рядом.

`computeSlotsShiftBalance` (lib/cage-balance.ts) и поле `addFloat = transfersAgg.fill` — НЕ ТРОГАЕМ. CDR/Shift Balance остаются без изменений (как пользователь и просил).

### 3. UI — список закрытий

**`ClosingsPage.tsx`** (Slots секция, ≈ строки 304, 528, 538):
- Существующий столбец «Slots Result» (читает `s.slots_result`) → переименовать заголовок в **System Shift Result** и читать из `s.system_shift_result`.
- Добавить новый столбец **Slots Result** справа от него, читающий `s.slots_result` (это уже = System − ACE из DB).
- В SELECT-запросе добавить поля `system_shift_result, ace_fills` к существующему `slots_result`.
- Сортировка/тоталы: добавить ключ `systemShiftResult` для нового столбца; оба идут в Total Results строки.

**`CageSlotsHistoryView.tsx`** (≈ строки 49, 68–69):
- Те же два столбца: System Shift Result + Slots Result.

**`SlotsHistoryReport.tsx`** (≈ строки 55–56, 133, 156):
- Аналогично: два столбца, две суммы в KPI-полосе.

### 4. Что НЕ трогаем
- `compute_slots_shift_balance` баланс/CDR — без изменений.
- Transfers form (fill / collection / lg_in / lg_out) — без изменений.
- Печатные отчёты слотов (`SlotsShiftReportBody`, `SlotsConsolidatedReport`, `PrintSlotsShiftDialog`) — в этом запросе не упомянуты, оставляю как есть; могу добавить отдельной задачей по запросу.
- Daily Review / FinanceDashboard — продолжают использовать `system_shift_result` для расчётов баланса; `slots_result` теперь только информативный.

### Файлы под редактирование
- новая миграция `supabase/migrations/...`
- `src/components/cage-slots/ActiveSlotsShiftView.tsx`
- `src/pages/ClosingsPage.tsx`
- `src/components/cage-slots/CageSlotsHistoryView.tsx`
- `src/components/reports/SlotsHistoryReport.tsx`
- `package.json` (bump)
