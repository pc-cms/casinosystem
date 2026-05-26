## Cage Slots — формула закрытия по аналогии с Live Game + дневной итог казино

### Основная идея

Slots должна работать как Live Game: канонические результаты считаются в БД триггером, хранятся в столбцах смены, и при закрытии бизнес-дня агрегируются в один итог казино.

### Каноническая формула смены (slots)

```
ΔCash            = ClosingCash − OpeningCash
                   (cash all currencies → TZS + banks → TZS + mobile total)

Cash Desk Result = ΔCash
                 + Expenses                  (approved этой смены)
                 + Collection                (transfers OUT to safe)
                 − AddFloat                  (transfers IN from safe)
                 + LG_Out − LG_In            (slots ↔ live)
                 + CashlessOut − CashlessIn
                 (no Miss, no Cards)

Cards Miss       = (OpeningCards − ClosingCards) × CardValue
                   (минус = недостача карт)

Slots Result     = SystemResult              (заявленный результат системой)

Balance          = Cash Desk Result − Slots Result − Cards Miss   (= 0 идеально)
```

Expected Cash удаляется полностью.

### Дневной итог казино (новое)

```
Daily Result = Σ shifts.tables_result            (Live Game за день)
             + Σ cage_slots_shifts.slots_result  (Slots за день)
             − Σ shifts.miss_total               (Chip Miss live)
             − Σ cage_slots_shifts.cards_miss    (Cards Miss slots)
             − Σ expenses (approved, не Collection/Fill — это внутренние)
```

Collections, Fills (AddFloat), LG↔Slots transfers — **внутренние перемещения**, в дневной итог НЕ входят. Только реальные расходы.

### План работ

**M1 — Миграция: новые поля в `cage_slots_shifts`**

```sql
ALTER TABLE cage_slots_shifts
  ADD COLUMN IF NOT EXISTS cash_desk_result bigint,
  ADD COLUMN IF NOT EXISTS cards_miss       bigint,
  ADD COLUMN IF NOT EXISTS slots_result     bigint,  -- = system_shift_result, канон
  ADD COLUMN IF NOT EXISTS balance          bigint;
```

`actual_cage_result` / `difference_amount` остаются как legacy, не используются.

**M2 — Триггер `compute_slots_shift_balance`**

Аналог триггера для live `shifts`. Срабатывает на UPDATE при `status='ready_for_review'` или `'approved'`. Считает:
- ΔCash из последнего `cage_slots_cash_counts` где `is_closing=true` минус opening seed.
- Expenses approved из `expenses WHERE cage_slots_shift_id = NEW.id AND approved`.
- Transfers (collection/add_float/lg_in/lg_out) из `cage_slots_transfers`.
- Cashless из `cashless_transactions WHERE cage_slots_shift_id = NEW.id`.
- Cards Miss из `cage_slots_cards`.
- Записывает в `cash_desk_result`, `cards_miss`, `slots_result`, `balance`.

UI больше не передаёт расчётные поля — DB единственный источник истины.

**M3 — Расширить `build_business_day_snapshot`**

Добавить новые секции в snapshot:

```jsonb
{
  ...existing,
  "slots_shifts": [ {id, shift_type, slots_result, cards_miss, cash_desk_result, balance, ...} ],
  "live_shifts":  [ {id, tables_result, miss_total, cash_desk_result, balance, ...} ],
  "daily_result": {
    "tables_total":   <Σ shifts.tables_result>,
    "slots_total":    <Σ cage_slots_shifts.slots_result>,
    "chip_miss_total":<Σ shifts.miss_total>,
    "cards_miss_total":<Σ cage_slots_shifts.cards_miss>,
    "expenses_total": <Σ approved expenses (live + slots), без internal transfers>,
    "net_result":     <tables + slots − chip_miss − cards_miss − expenses>
  }
}
```

**M4 — UI `ActiveSlotsShiftView.tsx`** (только отображение, расчёт остаётся как preview):

- Удалить `computeExpectedCashNow`, `countedCashNow`, `closingCardsTzs`.
- Локально вычислять preview по той же формуле через новый helper `computeSlotsShiftBalance` в `src/lib/cage-balance.ts`.
- Закрытие/Check показывает: ΔCash · Cash Desk Result · Slots Result (system) · Cards Miss · **Balance**.
- Удалить блок "Expected vs Counted".
- Mid-shift Check сохраняет в `denominations.totals` поля: `cash_desk_result, cards_miss, balance` (без expected).
- При `submit_for_review` в `closing_denominations` — те же поля. Триггер пересчитает и впишет в столбцы при апруве.

**M5 — UI Manager Review** — те же 5 KPI, без expected.

**M6 — UI Business Days History** (`src/pages/BusinessDays.tsx` / `ClosureDetail.tsx`):

- Добавить блок "Daily Result" вверху страницы закрытия: Tables · Slots · −Chip Miss · −Cards Miss · −Expenses · **Net**.
- Использовать `snapshot.daily_result`.

**M7 — Версия:** bump patch в `package.json`.

### Что НЕ трогаем
- Live Game Cage — без изменений.
- `cage_slots_shifts.system_shift_result` остаётся вводимым полем; `slots_result` дублирует его через триггер как канон (как `tables_result` vs `shift_result` в live).
- Открытие смены и opening seed snapshot (carry-over banks/mobile) — без изменений.
- Approve flow, expense entry, transfer entry, cashless entry — без изменений.
- Существующие закрытые смены: миграция оставляет новые поля NULL; одноразовый бэкфилл — отдельной задачей при необходимости.

### Файлы

**Миграции (новая)**:
- ALTER `cage_slots_shifts` + триггер `compute_slots_shift_balance` + замена `build_business_day_snapshot`.

**Frontend**:
- `src/lib/cage-balance.ts` — добавить `computeSlotsShiftBalance`.
- `src/components/cage-slots/ActiveSlotsShiftView.tsx` — переписать расчёты + UI Shift Result + Mid-check + Manager Review.
- `src/components/business-days/ClosureDetail.tsx` (или `ReportPanels.tsx`) — блок Daily Result.
- `package.json` — bump patch.

### Подтверждённые соглашения
- Cards Miss = (OpeningCards − ClosingCards) × CardValue.
- Cashless и Slots transfers входят в CDR по полной аналогии с live.
- Internal transfers (Collection, AddFloat, LG↔Slots) НЕ вычитаются из дневного итога казино.
- Дневной итог = Tables + Slots − ChipMiss − CardsMiss − Expenses(approved).
