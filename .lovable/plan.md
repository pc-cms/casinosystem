# Унификация бизнес-дня на 11:00 EAT (Africa/Nairobi = Africa/Dar_es_Salaam, UTC+3)

## Принцип
- **11:00 EAT** — единственный rollover бизнес-дня. До 11:00 текущего календарного дня EAT — это всё ещё предыдущий business_date.
- **05:00 EAT** — это **чекаут казино / закрытие открытых сессий и визитов**, НЕ rollover бизнес-дня. Cron `auto_close_business_day` остаётся как есть в этой роли.
- DB уже на 11:00 (`get_current_business_date` fallback `< 11`, cron `auto-close-business-day` в `:05` после 11:00). Расхождение только в клиентском коде — он на 13:00.

## Файлы и изменения

### 1. `src/lib/business-day.ts`
- Docstring: «13:00 EAT» → «11:00 EAT»; добавить пояснение, что 05:00 — это чекаут, не rollover.
- `getBusinessDate(shiftEndHour = 13)` → `= 11`.
- `isBusinessToday(date, shiftEndHour = 13)` → `= 11`.

### 2. `src/hooks/use-incidents.ts`
- Docstring (строки 36–42): «13:00 → 13:00» → «11:00 → 11:00».
- Комментарий (стр. 67) и фильтр (стр. 69–70): `13:00:00` → `11:00:00`.

### 3. `src/hooks/use-transactions.ts`
- Стр. 23 комментарий: «D 13:00 EAT → D+1 13:00 EAT» → «D 11:00 EAT → D+1 11:00 EAT».
- Стр. 24: `businessDayHourUTC(date, 13)` и `13 + 24` → `11` и `11 + 24`.

### 4. `src/hooks/use-expenses.ts`
- Стр. 22 комментарий и стр. 24: тот же swap `13` → `11`.

### 5. `src/hooks/use-business-day-filter.ts`
- Стр. 36 комментарий: «13:00 EAT» → «11:00 EAT».

### 6. `package.json`
- Bump patch: `1.0.111` → `1.0.112` (затрагивает фильтрацию данных; формальный bump, без миграции).

### 7. `mem://index.md` (Core)
- Заменить «Auto-close runs at 11:00 EAT if forgotten» — оставить как есть (уже корректно).
- В строку про timezone добавить уточнение: «Business-day rollover at 11:00 EAT (single source of truth). 05:00 EAT is casino checkout / open-sessions cleanup, NOT a rollover.»

### 8. `mem://features/business-day-logic` — обновить «05:00 AM rollover logic» → «11:00 EAT rollover; 05:00 EAT = checkout cron only».

## Что НЕ трогаем
- DB-функции (`get_current_business_date`, `close_business_day`, `auto_close_business_day`, `auto-close-business-day` cron) — уже корректны.
- `BreaklistGrid` `shift_end` (это конец смены казино, отдельная сущность).
- Edge-case в `get_current_business_date` (`LEAST(last_closed+1, today_eat)`), 2-арг overload `close_business_day`, scope-check — оставляем на отдельный заход (вы их пока не одобрили).

## Отчёт после применения
Дам короткий отчёт: какие файлы изменены, какие строки заменены, и подтверждение `rg "13:00\|getBusinessDate(1[023])"` без совпадений в `src/`.
