## Финальная модель балансов и фишек

### Принципы (зафиксированы)

**Локации фишек: только 2 типа**
- `cashier` — фишки в кассе (склад + сейф)
- `table:{id}` — фишки на каждом конкретном столе

Фишки "у игроков" в системе НЕ отслеживаются как отдельная локация — они просто "ушли" из кассы/стола.

**Касса = двойной баланс**
```
Балaнс кассы = Cash + Σ(Chips × denom) = const за смену
```
IN/OUT — это **обмен эквивалентами** внутри кассы, баланс не меняется.

**Знаки в UI (история транзакций)**
- IN: `+` зелёный (cash пришёл в кассу)
- OUT: `−` красный (cash ушёл из кассы)

**Expected при сверке = baseline (статика)**
Сравниваем `actual` против изначального baseline. Любое расхождение — это нормально и интерпретируется как игроки унесли/принесли фишки.

**Семантика Miss (новая)**
```
chip_diff = actual_total − baseline_total

chip_diff < 0  →  фишек МЕНЬШЕ  →  игроки унесли  →  +доход казино (на эту сумму)
chip_diff > 0  →  фишек БОЛЬШЕ  →  игроки принесли (фальшак?)  →  -убыток
chip_diff = 0  →  идеально
```

Это **финансовый результат**, не "ошибка". Переименовываем `MISS` → нейтральный термин, отображаем как сумму в TZS.

---

### Что нужно реализовать

#### 1. DB Migration: триггер авто-движения chip_inventory

Триггер `AFTER INSERT ON transactions`:
- **type='in'**: `cashier.chips[denom] -= qty` для каждой деномы из `chips` JSONB
- **type='out'**: `cashier.chips[denom] += qty`
- Если запись в `chip_inventory` для (casino, cashier, denom) не существует — создаёт её
- Bypass в seed mode (`app.seed_mode = 'on'`)

Обработка legacy `buy`/`cashout` идентично `in`/`out`.

#### 2. Удалить локацию `floor`/`safe` из логики (если присутствует)

Проверить `getExpectedChips` в `src/hooks/use-chips.ts` — сейчас есть распределение `cashier + safe + tables`. Объединить `safe` в `cashier` (или оставить если физически разные склады, но в рамках одной "локации" для трекинга).

Уточнение: судя по `CHIP_DISTRIBUTION` есть `cashier`, `safe`, `roulette`, `card`. Поскольку выбрано "Cashier + Tables только" — `safe` вливается в `cashier` baseline.

#### 3. Обновить `validate_chip_consistency`

Возвращать дополнительно:
- `chip_value_diff` (numeric, в TZS) = (actual − expected) × denom
- `interpretation` ('PLAYERS_TOOK_CHIPS' / 'EXTRA_CHIPS_RETURNED' / 'BALANCED')

Удалить логику `INCIDENT` как алерта — это нормальное состояние.

#### 4. UI: переименовать "Miss" → "Chip Result" / "Результат по фишкам"

Файлы:
- `src/components/cage/CloseShiftDialog.tsx` — в Chip Reconciliation секции
- `src/components/finance/cash-count/*` если есть отображение miss
- `src/components/admin/FloatManagement.tsx` если показывает baseline diff

Стилизация: `cms-amount-positive` когда фишек меньше (доход), `cms-amount-negative` когда больше.

#### 5. Cash Result в смене (формула)

```
Expected Cash = Opening Cash 
              + Σ(IN amounts)        // принесли cash
              − Σ(OUT amounts)       // забрали cash
              − Σ(Expenses)
              + Σ(Collections incoming)
```
Уже корректно в `CloseShiftDialog`, проверить только что используются `in`/`out` (не `buy`/`cashout`).

#### 6. Total Shift Result

```
Shift Result = Cash Result Δ + Chip Result (в TZS)
             = (фактический cash − expected cash) + (baseline chips − actual chips) × denom
```
Должен сходиться с суммой `table_results` всех закрытых столов за смену (валидация).

---

### Технические детали

**Миграция (SQL skeleton):**
```sql
CREATE OR REPLACE FUNCTION public.apply_chip_movement_on_tx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  denom_key text; qty bigint; denom bigint; sign int;
BEGIN
  IF current_setting('app.seed_mode', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.chips IS NULL THEN RETURN NEW; END IF;
  
  -- IN: chips leave cashier (negative). OUT: chips enter cashier (positive).
  sign := CASE WHEN NEW.type::text IN ('in','buy') THEN -1 ELSE 1 END;
  
  FOR denom_key, qty IN SELECT * FROM jsonb_each_text(NEW.chips) LOOP
    denom := denom_key::bigint;
    INSERT INTO public.chip_inventory (casino_id, location_type, location_id, denomination, quantity, updated_by)
    VALUES (NEW.casino_id, 'cashier', NULL, denom, sign * qty::bigint, NEW.operator_id)
    ON CONFLICT (casino_id, location_type, denomination) WHERE location_id IS NULL
      DO UPDATE SET quantity = chip_inventory.quantity + (sign * qty::bigint),
                    updated_at = now(), updated_by = NEW.operator_id;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_chip_movement
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_chip_movement_on_tx();
```
(может потребоваться unique index для ON CONFLICT)

**Files to edit:**
- `supabase/migrations/*.sql` (new)
- `src/hooks/use-chips.ts` — удалить `safe` из `CHIP_DISTRIBUTION` ссылок или объединить
- `src/components/cage/CloseShiftDialog.tsx` — переименование Miss → Chip Result, формула
- `src/lib/currency.ts` — проверить `CHIP_DISTRIBUTION`
- Memory update: `mem://features/financial-and-chip-reconciliation` и `mem://features/chip-reconciliation-and-results`

### Что НЕ делаем
- Не вводим локацию `floor`
- Не вводим понятие `INCIDENT` (фишек больше — нормально)
- Не блокируем закрытие смены при расхождении фишек
