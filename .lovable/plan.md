# Chip Count → Number Count: перенос моста в БД

## Цель
Любая запись `chip_snapshots` (с любого UI, оффлайн-sync, Close Shift, прямой insert) должна автоматически попадать в нужный часовой слот `table_tracker`. Сейчас мост живёт только в `ChipCountPanel.handleSave` и пропускает все остальные потоки — поэтому чек 21:58 не дошёл до слота 22:00.

## Что делаем

### 1. Statement-level AFTER INSERT триггер на `chip_snapshots`
Statement-level (не row-level), чтобы один батч из ~30 строк создавал ровно один upsert на стол, а не 30.

Функция `public.bridge_chip_snapshot_to_tracker()`:

1. Берёт из `new_table` (transition table) только строки `location_type='table'`, новейший `created_at` на стол.
2. По времени снепшота в `Africa/Dar_es_Salaam` считает целевой слот по той же логике, что в `slotForChipCount` (`src/components/tables/ChipCountPanel.tsx:24-40`):
   - `04:50–07:59` → `05:00` (Final), всегда пишет
   - `m ≥ 50` → `HH+1:00`, всегда пишет
   - `m ≤ 10` → `HH:00`, всегда пишет
   - `m 11–49` → `HH:00`, пишет **только если слот пуст** (fallback)
   - Разрешённые слоты: `19:00–23:00` и `00:00–04:00` (+ `05:00` через Final-ветку)
3. Считает `result` для стола: `Σ ((actual − baseline.expected) × denomination)` по последнему батчу снепшотов этого стола в этот `business_date`. Берём baseline из `chip_baselines` (или из самого snapshot.expected_quantity, что эквивалентно).
4. `business_date` = поле `date` из `chip_snapshots` (уже бизнес-день).
5. `time_slot` пишем в существующее уникальное (table_id, date, time_slot) через `INSERT … ON CONFLICT DO UPDATE`. Для fallback-ветки добавляем `WHERE table_tracker.value IS NULL`.
6. `recorded_by` = `NEW.recorded_by` из снепшота.

### 2. Backfill для 21:58 сегодня
Один разовый `INSERT … ON CONFLICT DO NOTHING` для слота `22:00` на `2026-05-26`, чтобы дозалить пропущенные значения от снепшота 21:58 EAT (тех таблиц, у которых `22:00` сейчас пуст). Это часть той же миграции, выполняется один раз.

### 3. Что НЕ трогаем
- Клиентский мост в `ChipCountPanel.handleSave` — оставляем, он даёт мгновенный optimistic-апдейт в UI. Триггер идемпотентен (тот же ключ конфликта), повторная запись с теми же значениями безопасна.
- `chip_baselines`, `gaming_tables`, `table_tracker` — структура без изменений.
- Никаких изменений в UI/коде фронтенда.

## Технические детали

### Имена и сигнатуры
```text
public.bridge_chip_snapshot_to_tracker()  -- trigger fn, SECURITY DEFINER, search_path=public
trg_bridge_chip_snapshot_to_tracker        -- AFTER INSERT ON chip_snapshots
                                              REFERENCING NEW TABLE AS new_rows
                                              FOR EACH STATEMENT
```

### Логика слота (SQL)
```text
ts_eat := created_at AT TIME ZONE 'Africa/Dar_es_Salaam'
h := extract(hour from ts_eat); m := extract(minute from ts_eat)
final_window := (h=4 AND m>=50) OR h IN (5,6,7)
target_h := CASE
  WHEN final_window THEN 5
  WHEN m >= 50      THEN (h+1) % 24
  ELSE h
END
only_if_empty := (NOT final_window) AND m BETWEEN 11 AND 49
allowed := target_h BETWEEN 19 AND 23 OR target_h BETWEEN 0 AND 4
          OR final_window  -- 05:00
```

### Идемпотентность и порядок
- `recalc_shift_tables_on_snapshot` уже AFTER INSERT — новый триггер тоже AFTER, порядок неважен (разные таблицы).
- `sync_capture_change` поймает upsert в `table_tracker` сам — реплика на on-prem узлы пойдёт штатно.
- Замечание про replication mode: добавим в начале функции `IF current_setting('cms.applying_sync', true) = 'true' THEN RETURN NULL; END IF;`, чтобы при применении входящего sync-патча из `chip_snapshots` не плодить локальные `table_tracker` upsert'ы (они приедут отдельной записью outbox с источника).

### Bump версии
`package.json` patch+1 в этом же коммите (правило Auto Version Bump).

## Проверка после миграции
1. `SELECT * FROM table_tracker WHERE date='2026-05-26' AND time_slot='22:00'` — должны появиться значения для всех столов из снепшота 21:58.
2. Симуляция: вставить тестовый `chip_snapshots` через RPC/UI — убедиться, что соответствующий `table_tracker` upsert произошёл с правильным слотом.
3. `chip_count_panel` save проверить: значение всё ещё мгновенно появляется в Numbers (клиентская ветка), и БД-триггер не создаёт дубль (тот же `(table_id, date, time_slot)`).
