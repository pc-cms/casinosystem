# Канонический tables_result + аудит IN/OUT

## Цель
Сделать `tables_result` единственным источником P&L смены по фишкам:
`Σ по столам ((последний_snapshot.actual − baseline.expected) × номинал) − Fill + Credit`.
Прокинуть его через Cage Closings, Close Shift UI, Daily Review, Finance Dashboard, Summary Dashboard. Перестать перезаписывать `tables_result` кэшем. Добавить аналитический индикатор IN/OUT (НЕ финансовое исправление, см. ниже).

## Что произойдёт с сегодняшней открытой сменой
**Для кассира посреди смены ничего не ломается.** Изменения применяются в момент закрытия и при чтении:
- `CloseShiftDialog` Шаг 1 (кассир считает кэш/фишки) — ввод не меняется.
- Шаг 2 (Manager Review) — панель «Three Key Results» покажет 4 KPI (Cash Result, Miss, Tables Result, Balance), считая через `compute_shift_table_results` вместо суммы `gaming_tables.closing_result`. Это **смена расчёта на тех же данных в БД** — никакого нового обязательного ввода.
- Поля на `shifts` после закрытия: `cash_result`, `miss_total`, **новое** `tables_result`, плюс устаревший `shift_result` остаётся как алиас = `tables_result` для старых читателей.
- Daily Review за сегодня: открывается только после закрытия → читает новый `tables_result`. Старые дни — backfill.
- Finance Dashboard / Summary: перерисуется из нового поля, схема не ломается.

Сегодня риск только в `CloseShiftDialog` (панель сводки) и в RPC закрытия. Если на сегодня нет `chip_baseline` — **предупреждаем**, но **не блокируем**: Tables Result упадёт на fallback = сумма `closing_result` закрытых столов. Закрытие сегодня не застрянет.

## IN/OUT — разбор твоего второго вопроса
Из чтения `ActiveShiftView.tsx`:
- IN = кассир берёт деньги у игрока, отдаёт фишки. OUT = наоборот.
- Общая VALUE кассы (фишки + кэш) **инвариантна** относительно IN/OUT — это чистый обмен.
- В активной смене UI показывает аналитический `cashResult = Σ IN − Σ OUT` (из `transactions`).
- Реальный `shifts.cash_result` после закрытия = `closing_cash_total − (opening_cash − float_added + collection)` — выводится из физического пересчёта кэша, **не** из лога транзакций.

**Вывод:** незаписанная пара IN/OUT (игрок дал 100к кэша, получил 100к фишек, транзакции нет) — **финансово нейтральна**. Кэш сходится, miss сходится, `cash_result` верный, `tables_result` верный. Финансово ничего не сломано.

Что теряется: персональный трекер игрока, атрибуция drop, NEP split и live-показатель `Σ IN − Σ OUT` в активной смене. Это **аналитика, не финансы**.

**План по IN/OUT:** добавить пассивную полоску **«IN/OUT Audit»** в Manager Review со значениями:
- `Σ IN − Σ OUT` (из лога транзакций)
- `cash_delta` (физический)
- разница (подсветка если ≠ 0) с подсказкой: *«Похоже, не записаны IN/OUT. На cash result не влияет, но трекер игроков неполный»*

Без блокировок, без авто-коррекции — manual-entry philosophy сохраняется (mem://project/core-principles).

## Реализация

### 1. Миграция
- `ALTER TABLE shifts ADD COLUMN tables_result bigint`.
- Переписать RPC `compute_shift_close(shift_id)`: пишет `cash_result`, `miss_total`, `tables_result` (= `SUM(compute_shift_table_results(shift_id).result)`), и `shift_result := tables_result` (алиас).
- Триггер на UPDATE `closing_count` → пересчёт.
- Backfill всех закрытых смен (минимум 90 дней) — пересчитать и перезаписать `tables_result`; обнулить аномальные `miss_total` там, где `chip_baseline` был пуст (с записью в audit log).
- Backfill `daily_summaries.tables_result = SUM(shifts.tables_result)` по `date+casino`, пересчитать `total_result`.

### 2. Чтение на фронте
- `useTablesResultForDate` → читает `tables_result` (а не `shift_result`).
- `CageClosingsPage`: колонка «Tables Result» из `s.tables_result` (fallback `closing_count.result_table` → `shift_result`). Добавить колонку «Balance» = `tables_result − cash_result − miss_total − expenses`.
- `ReprintShiftDialog` / `ShiftClosingReport`: `tables_result` для итога; RPC только для разбивки по столам.
- `FinanceDashboard`, `SummaryDashboard`: код не трогаем (читают через `daily_summaries`/`useTablesResultForDate`, теперь данные верные).

### 3. Запись на фронте — баги
- `CloseShiftDialog` строки 112–115, 154–156, 187, 207–208: убрать `closedTables.reduce(...closing_result)`, использовать новый хук `useShiftTablesResultLive(shift.id)` через RPC `compute_shift_table_results`. Сохранять `tables_result` в payload; `shift_result` оставить для совместимости (тоже = это значение).
- `DailyReview` строки 50, 74, 160: перестать писать `cashResult` в `tables_result`. Новое: `tables_result = useTablesResultForDate(date)`. Cash Result отдельной строкой в MoneyBreakdown.

### 4. Полоска IN/OUT Audit
- Маленький `<InOutAuditStrip>` в Шаге 2 `CloseShiftDialog`. Берёт `Σ IN`, `Σ OUT` через `useTransactions(shift.id)`, сравнивает с `cash_delta`. Только отображение, без сохранения.

### 5. Memory + версия
- Bump патч-версии в `package.json` (бэкенд-изменение).
- Обновить mem: `financial-and-chip-reconciliation`, `shift-management-and-closing`. Добавить строку в Core: *«Источник P&L смены = `shifts.tables_result` (фишки, последний snapshot vs baseline). `shift_result` — устаревший алиас.»*

### 6. QA
- SQL: для всех закрытых смен за 60 дней проверить `shifts.tables_result = SUM(compute_shift_table_results)`.
- SQL: `daily_summaries.tables_result = SUM(shifts.tables_result)` по дате.
- Руками: открыть сегодняшний CloseShiftDialog → значения совпадают с математикой Pit Chip Count.

## Вне плана
- Шаг 1 кассирского пересчёта не трогаем.
- `gaming_tables.closing_result` не трогаем (используется в CloseTableWizard).
- Раскладку Finance/Summary не меняем — только корректные числа.
- Чип-трансферы, expenses, кошельки — без изменений.
