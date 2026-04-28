## Финальная модель балансов, фишек и Floor / Miss Chips

### Принципы (зафиксированы)

**Локации фишек в `chip_inventory` (физические):**
- `cashier` — фишки в кассе (включает сейф)
- `table:{id}` — каждый стол отдельно

**Floor — виртуальная computed-локация (в реальном времени):**
```
Floor = Initial_Total − Σ Cashier_chips − Σ Tables_chips
```
Видят: Manager, CCTV (live на дашборде).

**Касса = двойной баланс:**
```
Балaнс кассы = Cash + Σ(Chips × denom) = const за смену
```
IN/OUT — обмен эквивалентами, баланс кассы не меняется.

**Знаки в UI (история транзакций):**
- IN: `+` (cash пришёл), OUT: `−` (cash ушёл)

---

### Жизненный цикл Floor → Miss Chips

```
ВО ВРЕМЯ СМЕНЫ:
  Floor (live) = Initial − Cashier − Tables
  ↓ показываем в Manager Dashboard + CCTV

ПРИ ЗАКРЫТИИ СМЕНЫ (DB-триггер на UPDATE shifts.status='closed'):
  1. Считаем Floor по деномам
  2. INSERT в miss_chips (immutable archive)
  3. UMENЬШАЕМ chip_baseline на эти количества
     → Initial_Total для следующей смены = старый − Floor
  4. Floor сразу обнуляется (Initial и actual оба уменьшились)

ВОЗВРАТ ФИШЕК (игрок принёс старые фишки):
  Обычная OUT транзакция → chip_inventory[cashier] +
  → Floor становится отрицательным
  → При следующем закрытии: запись в miss_chips с отрицательной суммой
  → Baseline увеличивается обратно
```

---

### Что нужно реализовать

#### 1. Migration: новая таблица `miss_chips` (immutable archive)
```sql
CREATE TABLE public.miss_chips (
  id uuid PK,
  casino_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  business_date date NOT NULL,
  denominations jsonb NOT NULL,       -- {5: 12, 25: 3, 100: 1}
  total_value bigint NOT NULL,        -- в TZS (может быть отрицательным)
  created_at timestamptz DEFAULT now(),
  recorded_by uuid
);
-- RLS: SELECT для manager/cctv/super_admin, INSERT только триггером
-- Trigger prevent_modify (immutable)
```

#### 2. Migration: триггер авто-движения chip_inventory при IN/OUT
`AFTER INSERT ON transactions`:
- IN (`buy`/`in`): cashier chips −= qty по деномам из `chips` JSONB
- OUT (`cashout`/`out`): cashier chips += qty
- Bypass в `app.seed_mode='on'`

#### 3. Migration: триггер финализации Floor при закрытии смены
`AFTER UPDATE ON shifts WHEN OLD.status='open' AND NEW.status='closed'`:

```
FOR each denomination IN chip_baseline:
  expected_total = baseline.expected_quantity
  cashier_qty   = chip_inventory[cashier, denom]
  tables_qty    = Σ chip_inventory[table:*, denom]
  floor_qty     = expected_total − cashier_qty − tables_qty
  
  IF floor_qty != 0:
    add to miss_chips.denominations
    chip_baseline.expected_quantity −= floor_qty
    
INSERT miss_chips (casino_id, shift_id, business_date, denominations, total_value)
```

#### 4. Hook: `useFloorChips(casinoId)` 
Computed live floor для UI:
- Возвращает `{ denominations: {5: 50, 25: 200,...}, totalValue: 1250000 }`
- `Initial = SUM(chip_baseline)`, `Cashier+Tables = SUM(chip_inventory)`

#### 5. UI: Floor блок на Manager Dashboard и CCTV View
Карточка "Floor Chips (на руках у игроков)":
- Big total в TZS (с цветом: положительный = у игроков, отрицательный = вернули больше)
- Breakdown по деномам в монопсе
- Авто-обновление через realtime подписку на `chip_inventory`

#### 6. UI: Miss Chips Archive (Manager-only)
Новая страница/секция (например, в Finance или Admin):
- Фильтр периода (день/неделя/месяц/год/custom)
- Таблица: дата, смена, total в TZS, breakdown по деномам
- Итог за период + график тренда (опционально)
- Export CSV

#### 7. Cleanup: терминология
- `Miss` (старое значение в `chip_snapshots`) переименовать → `Chip Variance` или удалить если дублирует
- `validate_chip_consistency`: убрать INCIDENT-семантику (расхождение = норма)
- В CloseShiftDialog показать preview Floor перед закрытием

---

### Файлы

**Migrations:**
- `supabase/migrations/{ts}_miss_chips_table.sql`
- `supabase/migrations/{ts}_chip_movement_trigger.sql`
- `supabase/migrations/{ts}_floor_finalization_trigger.sql`

**Hooks:**
- `src/hooks/use-chips.ts` — добавить `useFloorChips`, `useMissChipsHistory`
- (опционально) `src/hooks/use-miss-chips.ts`

**UI:**
- `src/components/dashboard/FloorChipsCard.tsx` (новый)
- `src/components/cage/CloseShiftDialog.tsx` — preview Floor
- `src/components/finance/MissChipsArchive.tsx` (новый)
- `src/pages/Dashboard.tsx`, `src/pages/CctvView.tsx`, `src/pages/Finance.tsx` — wire-in
- `src/components/cctv/CctvLayout.tsx` — добавить Floor виджет

**Memory:**
- `mem://features/financial-and-chip-reconciliation` — обновить
- `mem://features/chip-reconciliation-and-results` — обновить
- Новый: `mem://features/floor-and-miss-chips` — описать модель

---

### Что НЕ делаем
- Не вводим `floor` как физическую локацию в `chip_inventory`
- Не блокируем закрытие смены при Floor != 0
- Не различаем "возврат старых фишек" от обычного OUT
- Не помечаем Floor как INCIDENT/ошибку — это нормальный финансовый показатель
