## Правило (закон проекта)

**Miss Chips = только `closing_count.chip_miss_total`** — физическая разница пересчёта фишек кассы при закрытии смены (counted − opening). Это единственное определение Miss во всей системе. Никаких "floor miss", "conservation miss", "settlement".

**Shift Result = Cash Result + Miss Chips.**

---

## План реализации

### 1. Снос неправильной таблицы и триггера
- `DROP TRIGGER IF EXISTS finalize_floor_to_miss_chips ON shifts;`
- `DROP FUNCTION IF EXISTS finalize_floor_to_miss_chips() CASCADE;`
- `DROP TABLE IF EXISTS public.miss_chips CASCADE;`
- Удалить хук `src/hooks/use-chip-conservation.ts` (или функции `useMissChipsByShift` / `useMissChipsArchive` из него) — они читают сносимую таблицу.

### 2. Серверный расчёт `compute_shift_close` (RPC)
- Перестать суммировать таблицу `miss_chips` (её больше нет).
- `miss_total = (shifts.closing_count->>'chip_miss_total')::numeric`.
- `shift_result = cash_result + miss_total`.
- Поле `shifts.miss_total` при закрытии писать тем же значением.

### 3. UI закрытия смены
- В `CloseShiftDialog` использовать только `missTotal` из физического пересчёта кассы. Логика уже корректная — оставить, убрать любые упоминания "floor miss".

### 4. Список закрытых смен (`Cage Closings`)
- Колонка `Miss` показывает `shifts.miss_total` (после фикса будет правильный).
- Backfill: для всех `shifts WHERE status='closed'`:
  `miss_total = (closing_count->>'chip_miss_total')::numeric`,
  `shift_result = cash_result + miss_total`.

### 5. Новая таблица "Daily Miss Chips" (Excel-like) — заменяет `/reports/miss-chips`
Источник данных: только `shifts.closing_count`.

```text
| Date       | 1 000 | 5 000 | 25 000 | 100 000 | 500 000 | 1 000 000 | ... | TOTAL TZS  |
|------------|-------|-------|--------|---------|---------|-----------|-----|------------|
| 2026-05-09 |   +5  |   -2  |    0   |   +1    |    0    |    +1     | ... |   967 000  |
| 2026-05-08 |   -3  |    0  |   +4   |    0    |   +2    |     0     | ... | 1 245 000  |
| ...        |       |       |        |         |         |           |     |            |
| MONTH SUM  |  +12  |   -1  |   +18  |   +5    |   +9    |    +3     | ... | 9 870 000  |
```

- Строка = одна закрытая смена (одна дата).
- Колонки = все номиналы фишек (`CHIP_DENOMS` из `src/lib/currency.ts`), от меньшего к большему.
- Ячейка = разница штук фишек по этому номиналу (`closing_count.chip_miss_by_denom[denom]`).
- Последняя колонка `TOTAL TZS` = `closing_count.chip_miss_total`.
- Внизу — строка `MONTH SUM` (сумма по месяцу для каждого номинала + общий total).
- Шапка с переключателем месяца (← May 2026 →).
- Стиль: monospace, плотная сетка; `+` зелёный, `-` красный, `0` мутед (`·`).
- Никаких "Per Shift / By Month" переключателей — одна простая таблица.
- Полностью переписать `src/pages/MissChips.tsx` на этот источник.

### 6. Память проекта
- Обновить `mem://features/shift-management-and-closing` с новым правилом Miss.
- Обновить `mem://features/chip-conservation-law`: убрать упоминания "Floor finalized to Miss on shift close" — этого больше нет.
- Обновить `mem://features/miss-chips-monthly-report`: новая структура (Date × Denoms × Total), источник = `shifts.closing_count`.

### 7. Версия
- Patch-bump `package.json` (миграция + изменения RPC).

---

## Технические детали

**Файлы:**
- `supabase/migrations/<new>.sql` — DROP таблицы и триггера + новая `compute_shift_close` + backfill `shifts.miss_total` / `shift_result`.
- `src/pages/MissChips.tsx` — полностью новая Excel-таблица.
- `src/hooks/use-chip-conservation.ts` — удалить функции, читающие `miss_chips` (`useMissChipsByShift`, `useMissChipsArchive`); проверить, нет ли других потребителей.
- `package.json` — patch bump.

**Что НЕ трогаем:**
- `CloseShiftDialog` — расчёт `missTotal` уже правильный.
- Таблицу `chip_emissions` и историю физического оборота фишек — не относится к Miss.

**Запрос для новой таблицы:**
```sql
SELECT business_date,
       closing_count->'chip_miss_by_denom' AS by_denom,
       (closing_count->>'chip_miss_total')::numeric AS total_tzs
FROM shifts
WHERE casino_id = :casino
  AND status = 'closed'
  AND business_date BETWEEN :from AND :to
ORDER BY business_date DESC;
```