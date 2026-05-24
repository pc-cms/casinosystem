
# Фикс: стол **Club** (Club Poker) — стандартные фишки + нулевой флот

## Что не так
Стол `Club` (game = `Club Poker`, id `4d83be68-…f475589`) в БД имеет:
- `denominations = {5, 25, 100, 500, 1000}` — нестандартные мелкие номиналы. Именно их рисует Close-Table Wizard, отсюда «странные» значения при закрытии.
- `chip_baseline` для этого стола пуст → флот уже фактически 0, но wizard всё равно показывает строки с этими мелкими номиналами.

Все остальные столы (AR/BJ) используют стандартный набор `{500, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 500000, 1000000, 5000000}`.

## Что меняем (только стол Club, точечно)

Одна миграция, без правок UI:

1. `UPDATE gaming_tables SET denominations = '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}' WHERE id = '4d83be68-a801-4431-9cde-07547f475589';`
2. `DELETE FROM chip_baseline WHERE location_type='table' AND location_id = '<Club id>';` — гарантирует Float = 0 на каждой строке (wizard корректно отображает 0, когда baseline отсутствует).
3. `DELETE FROM chip_snapshots WHERE location_type='table' AND location_id = '<Club id>' AND date >= CURRENT_DATE;` — выкидываем устаревшие snapshot'ы со старыми мелкими номиналами, чтобы они не подставлялись как prefill в Close Wizard.
4. Авто-bump `package.json` (patch).

## Что увидишь после
- В Close-Table Wizard для **Club** → 11 строк со стандартными номиналами (5M → 500).
- Колонка **Float** = 0 везде.
- **Actual Count** пустой → Diff = 0, Result = 0, пока кассир не введёт реальные фишки.
- На остальных столах ничего не меняется.

## Не трогаем
- Код UI (`CloseTableWizard`, `FloatManagement`) — он уже корректно работает с пустым baseline.
- Другие покерные таблицы и столы других казино.
- Permissions / роли.
