## Задача

Сейчас Chip Count panel и автозапись в Number Count tracker показывают «сырой» результат `(actual − baseline) × denom`. Если за смену были Fill (кассир дал фишки столу) или Credit (кассир забрал фишки со стола) — цифра завышена/занижена ровно на их сумму. Финальный shift P&L при закрытии всё равно пересчитывается RPC корректно (`SnapResult − Fill + Credit`), но **во время смены** пит и менеджер видят неверные результаты, и неверные значения улетают в Number Count tracker.

Исправляем: везде во время смены показываем **adjusted** результат:

```
DisplayedResult = (actual − baseline) × denom − ΣFill + ΣCredit
```

Fill/Credit берём из `cage_transfers` за **активную смену** на каждый стол.

---

## Что меняется

### 1. Источник Fill/Credit — новый хук
Новый `src/hooks/use-shift-table-adjustments.ts`:
- Вход: `shiftId` (активная смена для текущего бизнес-дня).
- Запрос: `cage_transfers` где `shift_id = :shiftId` и `transfer_type IN ('fill','credit')`.
- Возвращает map `{ [tableId]: { fill: number, credit: number, adjustment: number } }` где `adjustment = credit − fill` (готов к прибавлению к raw SnapResult).
- Использует `useActiveShift()` чтобы взять текущую открытую смену.

### 2. ChipCountPanel (`src/components/tables/ChipCountPanel.tsx`)
- Подключить новый хук.
- В `rowResults` менять формулу:
  ```
  total = rawSnapDelta + adjustments[loc.id].adjustment
  ```
- `grandTotal` пересчитается автоматически (сумма adjusted строк).
- В блоке Snapshot history — тоже применить adjustment (история показывает adjusted, чтобы пит понимал, что видел в моменте).
- При `handleSave` → `setTrackerValue.mutate({ value: rowResults[ri].total })` — пишем уже **adjusted** значение в Number Count.

### 3. Live Table Result (`src/lib/table-live-result.ts`)
- Расширить `LiveResultArgs`: добавить опциональный `adjustmentMap?: Record<string, number>` (tableId → credit − fill).
- В `liveTableResult`: если `closingResult` нет, к chipSnapshotResult прибавить adjustment.
- Все вызывающие (`Tables.tsx`, `TablesAnalytics.tsx`, дашборды) — пробросить adjustments из нового хука. Места найти `rg "liveTableResult\("`.

### 4. Number Count tracker (`src/pages/TableTracker.tsx`)
Вьюшка только показывает значения из БД — она ничего не пересчитывает. Поскольку с шага 2 в `table_tracker` уже пишутся adjusted значения, исторические слоты после первого Chip Count в новой логике будут корректные. Старые записи трогать не надо (immutable data, см. Core Principles).

### 5. Подсказка для пита
В заголовке Chip Count panel под "Rows: tables · Columns: denominations" показать мелкую строку:
```
Result includes Fill/Credit adjustments for current shift
```
Чтобы пит понимал, что цифра — это уже реальный P&L стола, а не разница фишек.

---

## Что НЕ меняется

- **DB RPC `compute_shift_table_results`** — там формула уже правильная (`SnapResult − Fill + Credit`). Это источник истины для `shifts.tables_result` при закрытии смены. Никакой миграции не нужно.
- **`shifts.tables_result`** и закрытие смены — без изменений.
- **`chip_snapshots`** — продолжаем хранить только actual/expected фишек (физика). Корректировка применяется только на отображении.
- **Прошлые snapshots и table_tracker записи** — не пересчитываем (immutable).

---

## Технические детали

**Файлы:**
- `+ src/hooks/use-shift-table-adjustments.ts` (новый)
- `~ src/components/tables/ChipCountPanel.tsx` (формула + history + tracker write)
- `~ src/lib/table-live-result.ts` (опциональный adjustmentMap)
- `~ src/pages/Tables.tsx`, `~ src/pages/TablesAnalytics.tsx`, и любые другие потребители `liveTableResult` — пробросить adjustments

**Поведение при оффлайне:** хук `useCageTransfers` уже использует react-query c кэшем, при оффлайне покажет последние известные значения. Это согласуется с binary online/offline моделью.

**Знак adjustment:**
- `transfer_type='fill'` → `direction='chip_to_table'` → стол получил фишки → вычитаем `amount`.
- `transfer_type='credit'` → `direction='chip_from_table'` → стол отдал фишки → прибавляем `amount`.
- Формула: `adjustment = Σ(credit.amount) − Σ(fill.amount)`, итог: `displayed = rawDelta + adjustment`.

**Backend изменений нет** → версию package.json бампать не нужно (правило Core применяется только к backend изменениям).
