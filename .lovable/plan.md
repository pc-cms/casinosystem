
## Правило rollover

Бизнес-день D заканчивается в момент:
```
end(D) = min( 07:00 EAT дня D+1 ,  business_day_closures.closed_at для D )
```
- если день закрыт **руками** раньше 07:00 → используем фактический `closed_at`
- иначе → 07:00 EAT (совпадает с реальностью: касса/смены к этому моменту закрыты)

Это правило заменяет все три текущих cutoff'а (5/11/13 EAT).

## Источник правды (DB)

Создать одну функцию + RPC, чтобы UI и DB бились по одному:

```sql
-- Возвращает границу окончания указанного бизнес-дня (UTC timestamptz)
CREATE FUNCTION public.business_day_end(_casino_id uuid, _business_date date)
RETURNS timestamptz
-- = min( (_business_date + 1) @ 07:00 EAT,  closures.closed_at )

-- Маппит произвольный момент в бизнес-дату (учитывает manual closures для прошлых дней)
CREATE OR REPLACE FUNCTION public.business_date_of(_ts timestamptz, _casino_id uuid)
RETURNS date
-- меняем сигнатуру: теперь принимает casino_id и учитывает closures
```

Обновить `get_current_business_date()` под то же правило (сейчас уже учитывает closures).

## DB изменения

1. **`business_date_of`** (5:00 → правило выше). Затрагивает `compute_tables_drop_split`, NEP-сегментацию, RPC что бьют транзакции по дням.
2. **`build_business_day_snapshot`** — заменить inline `EXTRACT(HOUR ...) < 5` на вызов новой функции для bucketing смен, expenses, table_tracker.
3. **`get_current_business_date`** — текущая граница `now → min(07:00 EAT, открытый день)`.
4. Бамп `package.json`.

⚠️ Историю не пересчитываем — `business_day_closures.snapshot` уже сохранён по старому правилу 5:00 для закрытых дней. Новое правило начинает работать «вперёд». Для уже закрытых дней snapshot остаётся истиной.

## Frontend изменения (src/)

Все `businessDayHourUTC(date, 11|13|11+24|13+24)` → новая helper-функция `businessDayBoundsUTC(casinoId, date)`, которая дёргает RPC `business_day_end` (с кэшем) и возвращает `[start, end]`.

Файлы:
- `src/lib/business-day.ts` — добавить `businessDayBoundsUTC()`, оставить `businessDayHourUTC` для legacy
- `src/pages/Reports.tsx` (Daily Report): окно + `tsToBusinessDate` → через RPC
- `src/pages/PlayerStatistics.tsx`, `Tables.tsx`, `Dashboard.tsx`, `ClosingsPage.tsx`
- `src/hooks/use-transactions.ts`, `use-expenses.ts`, `use-daily-expenses.ts`, `use-chip-transfers.ts`
- `src/components/player/PlayerPreviewHeader.tsx`
- `src/components/pit/ActivePlayers.tsx`
- `src/components/cage/PlayerInfoCard.tsx`, `ActivePlayersList.tsx`, `CageHistoryView.tsx`

Для перформанса — bulk RPC `business_day_bounds_bulk(casino_id, dates[])` чтобы Daily Report за месяц делал один вызов вместо 30.

## Сверка

После деплоя проверяю одну закрытую дату через `read_query`:
- Daily Report `result/dropR/cashout` за дату D
- vs `business_day_closures.snapshot` за дату D
- vs Player Statistics за дату D
Все три должны сойтись (для дат, закрытых после деплоя).

## Память

Обновить core-правило: rollover = `min(07:00 EAT, manual closure)`. Удалить «11:00 EAT» как cutoff (оставить только как cron-дедлайн auto-close, если он остаётся в 11:00 — уточните).

## Открытый вопрос

Авто-закрытие сейчас в **11:00 EAT**. Если rollover теперь в 07:00 — логично перенести cron auto-close тоже на 07:00 (или, скажем, 07:30 как grace period). Согласовать?
