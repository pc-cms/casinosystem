# Pending Task: DB Scaling for 3+ Years

**Status**: APPROVED, deferred. Не запускать пока пользователь не скажет (завтра после 13:00 EAT).

## Что будет сделано (по команде пользователя)

### 1. Сохранить задачу в память
Создать `mem://tasks/db-scaling-3-years` с полным контекстом плана, чтобы при возврате к задаче я сразу знал что делать.

### 2. Миграция: cron `archive_operational_purge` (ежедневно 04:00 EAT)
Удаляет из `chip_snapshots`, `breaklist`, `breaklist_logs`, `table_tracker` записи старше 95 дней — **только для (casino_id, date), у которых есть запись в `business_day_closures`**. Логирует в `cron_run_log`. SECURITY DEFINER.

### 3. Миграция: BRIN-индексы по `created_at`
Для `transactions`, `cashless_transactions`, `cage_transfers`, `client_sessions`, `chip_snapshots`. Дешёвые (~10 КБ на 1M записей), идеальны для time-range запросов.

### 4. Миграция: `player_lifetime_stats` + триггеры
Таблица `player_id, total_drop, total_nep, total_cashin, total_cashout, last_visit, visit_count`. Обновляется триггерами на `transactions`, `chip_transfers`, `casino_visits`. Player Card / Tracker читают одну строку вместо агрегации миллионов.

### 5. Snapshot fallback в `/business-days`
Проверить, что хук `use-business-day-history` корректно отдаёт данные из `business_day_closures.snapshot` когда live-таблицы уже очищены.

### 6. UI: виджет «Database Health» в Admin
Размер БД, топ-10 таблиц, дни оперативного хранения, дата последнего purge.

### 7. Auto-bump `package.json` patch version
Согласно правилу — есть бэкенд-изменения.

## Что НЕ трогаем (вечное хранение)
`transactions`, `cashless_transactions`, `cage_transfers`, `chip_transfers`, `expenses`, `bank_checks`, `cash_count_snapshots`, `table_daily_results`, `daily_summaries`, `business_day_closures`, `wallet_transactions`, `budget_*`, `chip_emissions`, `miss_chips`, `casino_visits`, `client_sessions`, `cctv_observations`, `player_position_history`.

## Защита
- НЕ запускать в рабочие часы казино (18:00–05:00 EAT).
- Cron purge работает в 04:00 — между авто-закрытием и утренним handover.
- Каждый DELETE проверяет `business_day_closures` перед удалением.
- Все изменения SECURITY DEFINER + логирование в `cron_run_log`.

## Прогноз
3 года × 5 казино: ~13 ГБ итого. Postgres легко работает с 100+ ГБ.

---

**После апрува**: я только сохраню задачу в память. Все миграции запускаются ТОЛЬКО когда пользователь явно скажет «запускай DB scaling» завтра.
