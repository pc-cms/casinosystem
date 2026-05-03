## Цель

Сделать **Result** на всех экранах единым по правилу:

- **DROP R** = реальный дроп денег (с учётом NEP) — без изменений
- **DROP V** = счётчики столов (Table Tracker) + турновер — без изменений
- **Result** = **последний Chip Count snapshot vs исходный baseline стола**. Никаких кумулятивных сумм. Никакого Table Tracker в Result.

Применяется **глобально ко всем столам** (AR, BJ, Poker, Texas Holdem и т.д.) во всех экранах.

## Логика для каждого стола

```text
if (table.closing_result != null) → closing_result   // стол закрыт
else if (есть snapshot)            → Σ (snap.actual − baseline.expected) × denom
else                                → 0
```

## Изменения в файлах

1. **`src/lib/table-live-result.ts`** — упростить `liveTableResult`:
   - Убрать аргумент `trackerData` и всю логику сравнения времён snapshot vs tracker.
   - Snapshot есть → считать против `baselineMap[tableId]` (исходный baseline).
   - Snapshot нет → `0`.

2. **`src/pages/Dashboard.tsx`** — убрать `trackerData` из вызова `liveTableResult`.

3. **`src/pages/Tables.tsx`** — убрать `trackerData` из вызова `liveTableResult`.

4. **`src/pages/TablesAnalytics.tsx`** — убрать `trackerData` из вызова `liveTableResult`.

5. **DROP V** — оставить как есть: `trackerSum + recycled` (`useTablesDropSplit` + `tableTrackerTotals`).

6. **DROP R** — оставить как есть: из `useTablesDropSplit` (NEP-aware) с fallback на buy/in транзакции.

7. **Snapshot history таблица** в `ChipCountPanel.tsx` — НЕ трогать (там специально дельта между сейвами).

## Memory

Обновить `mem://features/live-table-result-resolution`:
- Result = только последний snapshot vs baseline. Никаких кумулятивных значений.
- Tracker используется только для Drop V, не для Result.

## Проверка ожидаемых значений (03.05.2026, AR1)

- Последний snapshot 23:57: actual − исходный baseline = **+TZS 3 240 000** ✓
- DROP R = 5 000 000 (внешний) — без изменений
- DROP V = 6 975 000 (tracker+recycled) — без изменений

То же поведение применится автоматически ко всем остальным столам (AR2, BJ1, P1–P4 и далее).
