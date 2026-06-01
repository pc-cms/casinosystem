## Изменения в `src/components/cage/ShiftClosingReport.tsx`

Сейчас в таблице первая колонка (Open) и Close часто пустые, потому что они тянутся из устаревшего `dailyResults` (legacy import path) и только при его отсутствии — из baseline/`closing_chips`. Также колонка `IN` берёт сумму из `transactions` (Cash Desk IN) — пользователь хочет переименовать её и подтянуть значения из финального снимка Пита.

### Новая логика колонок (per row)

| Колонка | Источник |
|---|---|
| **Table** | `gaming_tables.name` |
| **Open** | Сумма стандартного флота стола = `baselines[tableId]` (Σ baseline.expected × denom) — всегда из chip_baseline, без `dailyResults` |
| **Fill** | `fillCredits[tableId].fill` (cage_transfers, type=`fill`) |
| **Credit** | `fillCredits[tableId].credit` (cage_transfers, type=`credit`) |
| **Close** | Σ (latest snapshot.actual × denom) по столу — из `snapshotIndex[tableId].perDenom` (финальный Chip Count Пита). Если снимка нет → пусто |
| **DROP (NEP)** | переименовать заголовок `IN` → `DROP (NEP)`. Источник пока остаётся прежним (`inByTable` = Σ transactions type `buy`/`in` за смену) |
| **Result** | `serverResults[tableId]` — авторитетный результат из RPC `compute_shift_table_results` (формула `(Σ(actual−baseline)·denom) − Fill + Credit`). Уже так есть |

### Конкретные правки в `ShiftClosingReport.tsx`

1. **`rowFor(t)`** (≈ строки 229–239): убрать ветку `if (dr) return ...` для Open/Fill/Credit/Close. Всегда вычислять:
   - `op = baselines[t.id] || 0`
   - `fl = fillCredits[t.id]?.fill || 0`
   - `cr = fillCredits[t.id]?.credit || 0`
   - `cl` = сумма из `snapshotIndex[t.id].perDenom` (Σ qty × denom). Если снимка нет — `0`.
   - `inVal = inByTable[t.id] || 0`
   - `res = serverResults[t.id] ?? 0`
   
   `dailyResults` оставляем загружаться (не ломаем другие потенциальные потребители), но в гриде не используем.

2. **Заголовок столбца** (≈ строка 343): заменить `"IN"` на `"DROP (NEP)"`.

3. **Комментарии в шапке файла и над `rowFor`**: обновить описание колонок (Open = baseline, Close = последний снимок Пита, DROP (NEP) = транзакции кассы IN).

4. **Totals** (`useMemo` строки 241–248): пересчёт автоматически подтянет новые значения, дополнительных правок не нужно — продолжает суммировать те же поля.

### Bump
- `package.json` → `1.3.239` (UI-only правка отчёта; backend не трогаем, но это печатный документ — bump чтобы пользователи получили свежий билд после force-reload).

### Что НЕ трогаем
- `ChipMovementReport.tsx`, `ReprintShiftDialog.tsx` — без изменений.
- RPC `compute_shift_table_results`, RLS, миграции — без изменений.
- Логику Result и сам формат отчёта (шрифты, плотность, A4 portrait) — без изменений.
