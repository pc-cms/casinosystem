## Что, скорее всего, происходит

Сейчас это не похоже на UI-only проблему. Часть данных действительно синхронизируется, но есть несколько разных причин, почему отдельные блоки остаются пустыми/неполными:

1. **`player_cards`**
   - `player_cards` не имеет `casino_id`, поэтому обычная логика `WHERE casino_id = ...` её не покрывает.
   - В clone/backfill уже начата правка через `player_id -> players.casino_id`, но нужно добить это во всех местах: export, import, wipe, parity, live-sync apply.

2. **Player Statistics: average bet есть, а drop/result нет**
   - `average bet` берётся из `client_sessions` / tracker-данных.
   - `drop/result` берётся из `player_economy`, а это VIEW, не физическая таблица. Его нельзя “синхронизировать” строками — он должен пересчитываться локально из `transactions`, `expenses`, `client_sessions` и NEP-функций.
   - Значит нужно чинить локальные VIEW/RPC (`player_economy`, `player_session_stats`, NEP split), а не импортировать их как таблицы.

3. **Breaklist logs sync есть, а Breaklist нет**
   - Логи и сама operational-таблица идут разными путями.
   - Возможная причина: `sync_capture_change()` берёт `casino_id` только напрямую из строки; для таблиц без прямого `casino_id` или со старыми колонками изменения могут попадать в outbox неправильно/не попадать в нужную выборку.
   - Также нужно сверить `date` vs `business_date`: UI использует `date`, а в части registry/export указано `business_date`.

4. **Rota / Attendance / Staff Master**
   - UI Staff Master читает `employees`, не `dealers/staff_members`.
   - В старой sync attach-функции `employees` местами отсутствует, поэтому изменения staff master могли не попадать в outbox.
   - Rota/attendance завязаны на `employee_id`; если `employees` не синхронизированы, строки rota/attendance могут существовать, но UI выглядит пустым/битым.

## План исправления

### 1. Sync registry и дата-колонки
- Исправить canonical registry/repair так, чтобы:
  - `breaklist` использовал `date`, не `business_date`.
  - `pit_rota` использовал `date`, не `rota_date`, если фактическая схема такова.
  - `staff_rota`, `dealer_attendance`, `staff_attendance` тоже проверялись по реальным колонкам UI (`date`) либо через fallback, если колонка называется иначе.
- Убрать VIEW из seed/parity как физические таблицы:
  - `player_economy`
  - `player_session_stats`
  - `player_session_drops`

### 2. Локальный repair SQL
- Расширить `deploy/postgres/repair-local-schema.sql`:
  - гарантировать `sync_attach` на `employees`;
  - гарантировать `sync_attach` на `breaklist_logs`, `attendance_hours`, payroll/bonus tables, если они есть;
  - пересоздать локальные VIEW:
    - `player_economy WITH (security_invoker=true)`
    - `player_session_stats WITH (security_invoker=true)`
  - добавить/исправить NEP RPC, чтобы Drop R / result считались локально так же, как в Cloud.

### 3. Outbox capture для таблиц без прямого `casino_id`
- Исправить `sync_capture_change()` так, чтобы он вычислял `casino_id` не только из `row.casino_id`, но и:
  - для `player_cards`, `player_tags`, `group_members` через `players` / `player_groups`;
  - для `breaklist_logs` через `breaklist_id` или собственные поля;
  - для employee-linked tables через `employee_id`, если прямого `casino_id` нет или старая строка неполная.
- Это нужно для live-sync после clone/backfill, чтобы новые изменения не терялись.

### 4. Cloud seed/export и clone/backfill
- Добить `cloud-seed-export`:
  - экспорт `player_cards` только через игроков нужного casino;
  - paging маленькими chunk-ами, чтобы не терять часть карточек;
  - исключить derived VIEWs.
- Добить локальный импорт:
  - `player_cards` fallback по `card_number`;
  - strip generated columns;
  - skip derived VIEWs;
  - логировать не только первые ошибки, но и итог `errors_by_table`, чтобы сразу видеть root-cause.
- Добить `clone-from-cloud` wipe:
  - таблицы без `casino_id` чистить через join (`player_id`, `group_id`, etc.), иначе clone остаётся merge, а не 100% копия.

### 5. Continuous sync apply
- Обновить `peer_apply_change()`:
  - strip/ignore generated columns (`duration_seconds`);
  - не молча `RETURN` на schema mismatch — писать нормальную apply error;
  - для `player_cards` fallback на unique `card_number`, если конфликт не по `id`;
  - применять изменения для `employees`, breaklist/rota/attendance без потери из-за старых колонок.

### 6. Verify parity должен проверять именно проблемные таблицы
- Расширить `cloud-parity-counts` и локальный `--verify-parity`:
  - `employees`
  - `breaklist`
  - `breaklist_logs`
  - `pit_rota`
  - `staff_rota`
  - `dealer_attendance`
  - `staff_attendance`
  - `client_sessions`
  - `transactions`
  - `player_cards`
- Для таблиц без прямого `casino_id` считать через join, не глобально.
- Для Cloud-only/runtime таблиц оставить `INFO`, а не `DIFF`.

### 7. Версия и деплой
- Bump `package.json` patch-версии.
- Deploy edge functions:
  - `cloud-seed-export`
  - `cloud-parity-counts`
  - при необходимости `cloud-schema-export`.

### 8. Что нужно будет запустить на локальном сервере после релиза
Только стандартные команды через updater:

```bash
sudo casino-update --update
sudo casino-update --repair
sudo casino-update --backfill
sudo casino-update --verify-parity
```

Если после этого `player_cards` всё ещё DIFF, тогда нужно будет запустить UI Clone from Cloud один раз, потому что clone — это wipe & replace, а backfill — merge/update.