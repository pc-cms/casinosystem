# План: Закон сохранения фишек + Floor → Miss Chips

## Концепция

**Аксиома:** `Сейф + Касса + Столы + Miss Chips = Initial Baseline` (всегда, по каждому номиналу).

Фишки физически существуют в 4 состояниях:
- **В локациях** (Сейф/Касса/Столы) — `chip_inventory`
- **У игроков** (Miss Chips) — архив `miss_chips`

Floor = живой расчёт во время смены: `Initial − (Касса + Столы)`. При закрытии смены Floor финализируется в Miss Chips.

## База данных

### 1. Новая таблица `chip_initial_baseline` (immutable, источник истины)
```
casino_id, denomination, initial_quantity, created_at, created_by
```
- Snapshot самой первой инициализации
- Меняется ТОЛЬКО через операцию Chip Emission (см. ниже)

### 2. Новая таблица `miss_chips` (архив ушедших к игрокам)
```
id, casino_id, shift_id, business_date, denomination, 
quantity (может быть отрицательным при возврате), 
total_value_tzs, created_at
```
- Immutable (триггер `prevent_miss_chips_modify`)
- Запись создаётся автоматически при закрытии смены

### 3. Новая таблица `chip_emissions` (аудит докупки фишек)
```
id, casino_id, denomination, quantity_added, reason, 
operator_id, created_at, approved_by
```
- Только Manager / Super Admin
- Увеличивает `chip_initial_baseline.initial_quantity`
- Обязательный текстовый `reason`

### 4. Триггеры
- **`trg_apply_chip_movement`** на `transactions`: IN → Касса фишек −, OUT → Касса фишек +
- **`trg_finalize_floor_on_shift_close`** на `shifts.status='closed'`:
  - Считает Floor по каждому номиналу = `Σinitial − Σchip_inventory`
  - Минус уже архивированный Miss за прошлые смены
  - Дельта пишется в `miss_chips`
- **`trg_validate_chip_invariant`** на `chip_inventory` и `miss_chips`:
  - Проверка: `Σinventory + Σmiss == Σinitial` по каждому номиналу
  - При нарушении → `RAISE EXCEPTION` (защита от багов)
- **`trg_prevent_negative_miss_total`**: суммарный Miss по номиналу не может стать < 0 (нельзя вернуть больше, чем ушло за всю историю)

## Frontend

### Hooks
- **`useFloorChips(casinoId)`** — live расчёт по номиналам:
  ```
  floor[denom] = initial[denom] − inventory[denom] − archivedMiss[denom]
  ```
- **`useMissChipsArchive(casinoId, dateRange)`** — отчёты по дням/месяцам
- **`useChipIntegrity(casinoId)`** — проверка инварианта для UI алерта

### UI компоненты

**1. `FloorChipsCard`** (Dashboard + CCTV)
- Live таблица: Номинал | На столах | В кассе | В сейфе | Floor (у игроков) | Miss архив
- Внизу — индикатор целостности:
  ```
  Initial:    10,000,000 TZS
  В наличии:   9,970,000 TZS
  Miss:           30,000 TZS
  Дельта:              0 TZS  ✓
  ```

**2. `CloseShiftDialog`** — превью перед закрытием
- "Chip Result этой смены: +15,000 TZS уйдёт в Miss Chips"
- Или: "−5,000 TZS вернётся из Miss Chips (игрок принёс старые фишки)"

**3. `MissChipsArchive`** (Manager view, новая страница)
- Группировка: день / месяц / год
- Таблица по номиналам: сколько ушло, сколько вернулось, нетто
- Фильтры по периоду

**4. `ChipEmissionDialog`** (Manager / Super Admin)
- Доступ из Chip Inventory Control
- Поля: номинал, количество, причина (обязательно)
- После подтверждения: запись в `chip_emissions` + UPDATE `chip_initial_baseline`
- Аудит-лог в `activity_logs`

## Поведение по сценариям

| Событие | Касса | Столы | Miss | Initial | Инвариант |
|---|---|---|---|---|---|
| Init | +X | +X | 0 | 3X | ✓ |
| IN (игрок купил) | Cash+/Chips− | — | 0 | 3X | ✓ (Floor live = 30) |
| Close shift | — | — | +30 | 3X | ✓ |
| OUT (старые фишки вернулись) | Chips+ | — | — | 3X | ✓ |
| Close shift (return) | — | — | −5 | 3X | ✓ |
| Chip Emission +100 | — | — | — | 3X+100 | ✓ |

## Безопасность и роли

- **`miss_chips`**: SELECT для Manager/Surveillance/Super Admin, INSERT только через триггер
- **`chip_initial_baseline`**: SELECT для всех casino users, UPDATE только через `chip_emissions` trigger
- **`chip_emissions`**: INSERT для Manager/Super Admin, immutable после создания

## Memory updates

Обновить `mem://features/chip-inventory-control` и добавить новую memory `mem://features/chip-conservation-law` с описанием инварианта и Miss Chips жизненного цикла.

## Out of scope (не делаем сейчас)

- UI для частичного "списания" Miss Chips вручную (только через возврат игрока через OUT)
- Прогноз / аналитика трендов потерь фишек
- Уведомления при превышении порога Miss
