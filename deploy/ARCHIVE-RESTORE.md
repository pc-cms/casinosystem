# Восстановление архивных данных

После 60 дней записи переезжают из основных таблиц в архивные:

| Основная таблица      | Архив                              |
|-----------------------|------------------------------------|
| `activity_logs`       | `activity_logs_archive`            |
| `breaklist_logs`      | `breaklist_logs_archive`           |
| `client_sessions`     | `client_sessions_archive`          |
| `casino_visits`       | `casino_visits_archive`            |

Архивы синхронизированы по структуре с оригиналами и доступны на чтение только ролям `super_admin` и `finance_manager`.

`sync_inbox_log` и `sync_outbox` **не архивируются** — это служебные данные.

---

## Когда нужно восстанавливать

- Запрос регулятора / проверки (например, история визитов конкретного игрока > 60 дней).
- Расследование инцидента, по которому требуется лог действий старее 60 дней.
- Сверка спорных финансовых движений (через `activity_logs`).

Восстановление **не нужно** для разовой выборки — достаточно прямого запроса к архивной таблице.

---

## Просмотр без восстановления (рекомендуется)

```sql
-- Все действия конкретного оператора за период
SELECT * FROM activity_logs_archive
WHERE operator_id = '...'
  AND created_at BETWEEN '2026-01-01' AND '2026-02-01'
ORDER BY created_at DESC;

-- Визиты игрока за прошлый квартал
SELECT * FROM casino_visits_archive
WHERE player_id = '...'
  AND date BETWEEN '2025-10-01' AND '2025-12-31';
```

Все архивы имеют те же индексы, что и оригиналы (`LIKE … INCLUDING ALL`).

---

## Полное восстановление в основную таблицу

Только если нужны живые джойны / реалтайм / RLS родительской таблицы.

```sql
BEGIN;

-- 1. Скопировать обратно (ON CONFLICT защищает от дублей)
INSERT INTO public.activity_logs
SELECT * FROM public.activity_logs_archive
WHERE created_at BETWEEN '2026-01-01' AND '2026-02-01'
ON CONFLICT (id) DO NOTHING;

-- 2. Проверить количество
SELECT count(*) FROM public.activity_logs
WHERE created_at BETWEEN '2026-01-01' AND '2026-02-01';

-- 3. Если всё ок — удалить из архива (опционально)
DELETE FROM public.activity_logs_archive
WHERE created_at BETWEEN '2026-01-01' AND '2026-02-01'
  AND id IN (SELECT id FROM public.activity_logs);

COMMIT;
```

⚠️ **Внимание**: восстановленные записи снова попадут под политику ретенции и будут архивированы снова через 60 дней. Для долгого хранения — оставьте их в архиве и выгрузите в CSV.

---

## Выгрузка архива в CSV

```bash
psql "$SUPABASE_DB_URL" -c "\
  COPY (SELECT * FROM activity_logs_archive \
        WHERE created_at >= '2026-01-01') \
  TO STDOUT WITH CSV HEADER" > activity_logs_2026.csv
```

---

## Мониторинг очистки

```sql
-- Последний прогон cleanup
SELECT * FROM cron_job_health WHERE job_name = 'cleanup_old_data';

-- История за неделю
SELECT created_at, status, duration_ms, details
FROM cron_run_log
WHERE job_name = 'cleanup_old_data'
ORDER BY created_at DESC
LIMIT 10;

-- Нездоровые задачи (упали или давно не запускались)
SELECT * FROM cron_job_health WHERE is_unhealthy;
```

Если `is_unhealthy = true`:
1. Открыть `details` последнего ошибочного запуска — там `error` и `sqlstate`.
2. Проверить, что `pg_cron` живёт: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;` (требует прав `postgres`).
3. Перезапустить вручную: `SELECT public.cleanup_old_data();`

---

## Гарантии целостности

Функция `cleanup_old_data()` атомарна:

1. Сначала `INSERT … ON CONFLICT DO NOTHING` в архив.
2. Затем `DELETE` **только тех id**, что подтверждённо лежат в архиве.
3. Если хоть один шаг упал — вся транзакция откатывается, ничего не удалено.
4. В `cron_run_log` пишется `status='error'` с `SQLERRM` для алёрта.

Это значит: **данные не могут пропасть из-за сбоя cleanup** — они либо в основной таблице, либо в архиве, либо и там и там (дубликаты безопасны — есть `ON CONFLICT`).
