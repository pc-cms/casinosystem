## Цель
Расширить `src/pages/admin/KycReviewsPage.tsx` четырьмя улучшениями (a–d) поверх уже сделанных ссылок в профиль и кнопки Quick Grant.

## A. Wallet balance в строке
- Добавить колонку **Balance** в табах `Verified by Reception` и `Trusted (AM)`.
- Источник: уже существующий `balanceMap` (sum `promo_grants.remaining` где `status='active'` по списку игроков на странице).
- Формат: `1 250 000` (пробел-разделитель), нулевые значения — placeholder `·`.
- Сортируемая колонка (DataTable sort by balance desc по умолчанию для Trusted).

## B. Last activity
- Новая колонка **Last activity** в табах `Verified by Reception`, `Trusted (AM)`, `Not Verified`.
- Источник: `useLastVisitsByPlayers(playerIds)` (хук уже есть) + max(`promo_grants.created_at`) по тому же списку.
- Значение = max(last_visit, last_grant). Формат через `fmtDate` (DD/MM/YYYY). Пусто → `·`.
- Подсветка «спит»: если > 30 дней — `text-muted-foreground`, > 90 дней — `text-amber-500`.

## C. Bulk grant
- Колонка чекбоксов (первая) во всех 4 табах, с чекбоксом в шапке «select all visible».
- Состояние выбора локальное per-tab (`Set<player_id>`).
- Над таблицей появляется sticky-бар при `selected.size > 0`:
  - `N selected` · кнопка **Grant to selected** · кнопка **Clear**.
- Кнопка открывает `BulkGrantDialog` (новый компонент, копия `QuickGrantDialog` с теми же полями, но без `player` — показывает список выбранных как бэйджи).
- Логика: последовательный вызов `am_issue_grant` по каждому игроку (Promise.allSettled), прогресс-бар, итоговый toast `X granted, Y failed`.
- Доступ: `account_manager` / `super_admin`.

## D. История грантов игрока
- Иконка-кнопка **History** (`History` из lucide) рядом с Grant во всех табах.
- Открывает `PlayerGrantsHistoryDrawer` (новый компонент, mobile-friendly через `ResponsiveDialog size="lg"`).
- Содержимое — две секции (последние 20 каждая, сорт по дате desc):
  1. **Grants** — из `promo_grants`: дата, сумма, source, funding_pool, expiry, remaining, статус, notes.
  2. **Redemptions** — из `promo_redemptions`: дата, сумма, кассир, casino, ссылка/ref.
- Сверху мини-сводка: `Total granted`, `Total redeemed`, `Active balance`, `Grants count (30d)`.
- Кнопка `Open full promo page` → ссылка на `/admin/promo-grants?player=<id>`.

## Технические детали
- Файлы:
  - `src/pages/admin/KycReviewsPage.tsx` — колонки, чекбоксы, sticky-бар, кнопки History/Grant.
  - `src/components/admin/BulkGrantDialog.tsx` — новый.
  - `src/components/admin/PlayerGrantsHistoryDrawer.tsx` — новый.
- Новые запросы (react-query, lazy per-tab):
  - `last-grant-by-players` — `promo_grants.select(player_id, max(created_at))` группировкой на клиенте.
  - `player-grants-history` — по `player_id`, лимит 20 на таблицу, enabled только при открытии drawer.
- Никаких миграций / новых RPC — используем `am_issue_grant`, существующие таблицы `promo_grants`, `promo_redemptions`, `casino_visits`.
- Стили: только семантические токены (`text-muted-foreground`, `text-amber-500` через tailwind config), форматирование чисел `1 250 000` (space-separator).

## Что НЕ входит
- Фильтры по casino/AM (пункт f), inline notes (e), CSV export (g) — отложены.
