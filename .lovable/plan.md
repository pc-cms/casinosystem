Ты прав: текущий подход недостаточный. “Mirror green” сейчас означает только, что worker успешно pull/push-ит batches. Это не доказывает, что локальный сервер является полной копией Cloud. Для переключения Primary нужен отдельный режим: Full Clone + Parity Gate + Cutover Lock.

## Что нужно изменить

### 1. Исправить саму модель синхронизации
Сейчас в коде есть две главные причины, почему локальный сервер пустой/почти пустой:

- `cloud-seed-export` по умолчанию отдаёт только часть таблиц и только последние 90 дней для операционных данных.
- `sync_capture/sync_seed_from_existing` покрывают не все реальные таблицы проекта. В базе уже есть много таблиц, которые не попадают в текущий seed/backfill: `employees`, `attendance_hours`, `attendance_holidays`, `weekly_bonus_*`, `monthly_tips_*`, `payroll_*`, `incidents`, архивы, `role_module_defaults`, `user_roles`, `user_credentials`, `player_chip_adjustments`, и т.д.

Нужно сделать единый registry таблиц для clone/sync/parity, чтобы не было трёх разных списков в разных местах.

### 2. Full Clone вместо “snapshot compare вручную”
Добавить режим `Clone from Cloud — full`:

- выгружает все нужные public tables для выбранного casino;
- не режет историю на 90 дней;
- включает системные/глобальные таблицы, без которых локальный сервер не является рабочей копией: роли, module defaults, user permissions, credentials, peer config, справочники;
- импортирует в правильном FK-safe порядке;
- очищает локальные данные перед импортом;
- после импорта сбрасывает outbox/cursors, чтобы локалка не отправила Cloud обратно мусор или дубликаты.

### 3. Настоящий Parity Check 1-в-1
Вместо ручного сравнения snapshot-таблиц сделать автоматическую проверку:

- локалка считает по каждой таблице:
  - row count;
  - checksum ids;
  - checksum rows;
  - max updated/created timestamp;
- Cloud считает то же самое;
- UI сравнивает local vs Cloud;
- статус “Ready for Primary” появляется только если все обязательные таблицы совпали.

Это не “примерная проверка”, а gate: если хотя бы одна таблица отличается — Primary переключать нельзя.

### 4. Cutover-safe режим переключения Primary
Добавить процесс переключения:

1. `Freeze writes` — временно заблокировать новые записи на Cloud для этого casino, кроме super_admin/system.
2. Дождаться `outbox lag = 0` и `pull/push idle`.
3. Запустить final full parity check.
4. Если 100% совпало — разрешить `Promote local to Primary`.
5. Если есть расхождения — показать список таблиц и заблокировать promote.

### 5. Admin UI: понятный экран “Can I switch Primary?”
В Admin → Peers добавить один главный блок:

- `Clone completeness`: сколько таблиц проверено / сколько совпало;
- `Critical data`: users/roles/staff/dealers/tables/floats/business days/reports/miss chips;
- `Differences`: таблица с local count, cloud count, row checksum, status;
- `Actions`:
  - `Run full clone from Cloud`;
  - `Run parity check`;
  - `Repair missing data` / `Re-clone`;
  - `Promote to Primary` — disabled пока parity не 100%.

## Техническая реализация

### Database migrations
- Создать registry RPC/таблицу для sync scope: какие таблицы являются casino-scoped, user-scoped, global config, excluded runtime.
- Обновить `sync_seed_from_existing` так, чтобы он использовал полный registry, а не старый ручной список.
- Добавить RPC `mirror_full_parity_snapshot(p_casino_id)` с checksums по всем таблицам.
- Добавить lock/gate таблицу для cutover state: freeze, parity result, promoted_at.
- Обновить `sync_wipe_casino_data`, чтобы она очищала именно полный clone scope, не сохраняя старые “структурные” таблицы, если нужен 1-в-1 clone.

### Edge functions
- Обновить `cloud-seed-export`:
  - `mode=full`;
  - `days=all` по умолчанию для clone/cutover;
  - полный список таблиц;
  - manifest с counts/checksums.
- Добавить/расширить peer endpoint для Cloud parity snapshot, чтобы локальный сервер мог получить Cloud checksums автоматически.

### Frontend
- Заменить текущий `DataInventoryPanel` на `MirrorCutoverPanel`:
  - не просит сравнивать глазами;
  - сам показывает `100% match` или конкретные расхождения;
  - Primary promote доступен только после успешного parity gate.

### Package/version
- Так как это backend/sync change, автоматически поднять patch version в `package.json`.

## Важно
Это не просто “добавить кнопку”. Нужно привести clone/export/import/sync/parity к одному источнику правды по таблицам. Иначе снова будет зелёная полоска, но без стафа/ролей/столов/флотов.

После реализации правильный критерий будет такой:

```text
Cloud primary can be replaced by Local primary only when:
- worker connected
- no apply errors
- outbox lag = 0
- full table registry parity = 100%
- final write freeze parity = 100%
```

Только тогда это можно считать полной копией 1-в-1, с допустимой разницей только в адресе/peer identity/runtime metadata.