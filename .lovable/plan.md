# План: P3 + P4 + G3 + G4

Четыре независимых блока. Можно катить по очереди (P3 → P4 → G3 → G4), каждый = отдельная мини-миграция + UI.

---

## P3 · Comp Budget Hard Limits

Сейчас `CompBudgetCard` показывает прогресс/over, но **не блокирует** оформление house-comp при превышении. Делаем жёсткий лимит + manager override + аудит.

**DB**
- Триггер `pos_tabs_before_close_check_comp_budget()` — при close таба с `comp_house > 0`:
  - читает `pos_comp_budget_status(casino, month)`
  - если `used_house + this_house > limit AND limit > 0` → `RAISE EXCEPTION 'COMP_BUDGET_EXCEEDED'`, кроме случая когда в таб записан валидный `override_token` (см. ниже)
- Таблица `pos_comp_budget_overrides` (audit): `id, casino_id, tab_id, month_start, amount_tzs, manager_user_id, reason, created_at`. GRANT + RLS (manager/finance/super_admin INSERT; SELECT для них же).
- Поле `pos_tabs.comp_override_id uuid null` (FK на override).

**UI**
- В `PosBar`/`PosWaiter` при попытке close с house-comp выше лимита → диалог "Comp budget exceeded" с `ManagerOverrideDialog` (уже есть в проекте) + обязательный `reason`. На success — записываем override, прикрепляем к табу, повторяем close.
- В `CompBudgetCard` добавить вкладку/секцию "Recent overrides" (последние 10) с кем/когда/сколько/reason.
- В `PosManager` карточка показывает badge "N overrides this month".

**Logging**: каждый override → `logs` через стандартный logger (`pos_comp_override_used`).

---

## P4 · Bar Shift Reconciliation Report

Сводный отчёт по каждой смене бармена: продажи vs наличка vs stock variance — для manager-аудита.

**Где**: новая страница `/pos/manager/shift-reconciliation` (карточка в PosManager).

**Источник данных** (новая RPC `pos_shift_reconciliation(_casino, _from, _to)`):
- из `pos_shifts` + `z_report` JSONB: gross, cash, card, comp_player, comp_house, opening/closing_cash, expected_cash, cash_delta
- из `pos_stock_counts` (M10b): сумма `variance_value_tzs` за смену
- из `pos_player_charges` созданных в эту смену: outstanding amount
- из `pos_comp_budget_overrides`: кол-во оверрайдов

**UI** (`DataTable`):
| Date | Shift | Waiter | Gross | Cash | Card | Comp(P/H) | Cash Δ | Stock Δ | Outstanding | Overrides | Status |

Status: `clean` (всё ноль), `minor` (|Δ| < threshold), `flagged` (большая дельта или override).

Фильтры: месяц, бармен, status. Экспорт в Excel (используем `excel-export.ts`).
Доступ: pos_manager, manager, finance, super_admin (через PosLayout whitelist).

**Без DB-изменений кроме одной read-only RPC.**

---

## G3 · Marketing / Promo Budgets

Промо-кампании как отдельный модуль с бюджетом и ROI. Логически = "expense с привязкой к кампании + tracking attributed revenue".

### Модель

**Таблицы**
1. `promo_campaigns` — `id, casino_id, name, type (event|bonus|advertising|sponsorship|other), starts_on, ends_on, budget_tzs, status (planned|active|closed|cancelled), description, created_by, created_at`.
2. `promo_campaign_expenses` — связка expense ↔ campaign: `id, campaign_id, expense_id, amount_tzs, created_at`. (один expense может относиться к одной кампании.)
3. `promo_campaign_players` — какие игроки "привлечены" кампанией: `id, campaign_id, player_id, tagged_at, tagged_by, note`. Уникально (campaign_id, player_id).

GRANT + RLS: read manager/finance/marketing/super_admin; write — marketing/manager/finance.

**Новая роль `marketing`** (опционально, можно стартануть на manager) — добавить в `app_role` enum и в Permission Matrix.

### Метрики (RPC `promo_campaign_kpi(campaign_id)`)
- **Spent** = сумма `promo_campaign_expenses.amount_tzs` (+ возможность ручных allocations)
- **Budget utilization** = spent / budget
- **Attributed players**: count из `promo_campaign_players`
- **Attributed drop / NEP / theo win**: SUM по player_lifetime_stats для tagged players за период `[starts_on, ends_on + 30d]` (окно после кампании)
- **ROI** = (attributed NEP − spent) / spent
- **Per-player CAC** = spent / count(players)

### UI
- `/marketing/campaigns` — список (DataTable): name, period, status, budget, spent (%), players, NEP, ROI, badge.
- `/marketing/campaigns/:id` — детальная: KPI cards + expenses tab + players tab (add/remove player через PlayerNameAutocomplete) + timeline notes.
- Карточка `/marketing/budget` — суммарный месячный/годовой бюджет vs spent vs ROI по всем активным кампаниям.
- В **Expenses** добавить опциональное поле "Campaign" (dropdown активных) → при сохранении пишет в `promo_campaign_expenses`.
- В **Player Card** показать badge "Promo: <campaign name>" если игрок tagged.

### Интеграция в Finance
- Промо-расходы остаются обычными expenses (видны в Finance Review). Линковка кампании — это **метаданные**, не дублирует деньги.
- В Finance Dashboard опциональный widget "Active campaigns ROI".

---

## G4 · Player CRM Page

Отдельная страница `/crm/players` — **не финансовая аналитика, а операционный CRM-список**: контакты + поведение + теги. Для хостов и менеджеров.

### Колонки (DataTable, virtualized, sticky header)

**Identity**
- Photo · Card # · Full name · Category (D/P/G/N) · Tags · Status (active/blacklisted/inactive)

**Контакты**
- Phone · Email · Birthday (DD/MM с подсветкой "today" / "this week") · Anniversary (если есть)
- Language · City

**Поведение** (из `player_lifetime_stats` + visits)
- Last visit (DD/MM/YYYY + дней назад) · Visit count (last 90d / total)
- Avg visit length (часы) · Favorite shift (day/evening/night/late)
- Favorite game (top-1 table type)
- Avg bet (последние 30 дней)

**Экономика** (только если `canSeePlayerFinancials()` — для cashier/reception скрыто)
- Lifetime Drop · Lifetime NEP · Lifetime Comps · Comp ratio (comps/NEP) · Last 30d NEP

**CRM-поля** (new)
- Host (assigned manager) · Segment (VIP/Regular/New/Dormant — авто-вычисляется по правилам) · Birthday card sent (Y/N) · Last contact (date + note)

### Новое в DB
1. `player_crm` — `player_id (PK), host_user_id, segment (vip|regular|new|dormant|custom), birthday_card_sent_year int, last_contact_at timestamptz, last_contact_note text, custom_tags text[], updated_at, updated_by`.
2. RPC `player_segment_recalc()` — пересчёт segment по правилам (например: NEP last 90d > X → vip; no visit 60d → dormant). Запускается nightly через cron + on-demand кнопкой.
3. RPC `crm_players_list(_casino, filters)` — собирает JOIN всего вышеперечисленного одним запросом (server-side computation, как требует core rule).

GRANT + RLS: read для manager/host/marketing/super_admin; write для них же (last_contact, host assignment).

### Фильтры/сортировки
- Birthday this month/week/today (фильтр-чип)
- Segment, host, category, tag, city, last visit (>30d / >60d / >90d)
- Search по имени/телефону/карте
- Сорт: last visit, NEP, drop, birthday, alphabetical

### Действия (inline / row drawer)
- Quick call (`tel:` link) / WhatsApp (`wa.me/<phone>` link)
- Add contact note (last_contact_at + note)
- Assign host
- Add custom tag
- "Mark birthday card sent"
- Open full player profile

### Layout / доступ
- Mobile: bottom Drawer per row (как в Reception)
- Sidebar: новая секция "CRM" → "Players" (+ позже "Campaigns" из G3, "Birthday list", "Dormant list")
- Permission Matrix: новый ModuleKey `crm_players`. По умолчанию: manager, super_admin, hr (read-only без финансов).

### Полезное, но не финансовое (доп. дашборд-карточки сверху страницы)
- "Birthdays this week" (мини-список)
- "Dormant 60+ days" count
- "New players (last 30d)" count
- "Unassigned hosts" count
- "Pending birthday cards"

---

## Порядок выкатки и оценка

| Блок | DB миграции | Edge fn | Сложность |
|------|-------------|---------|-----------|
| P3 Comp hard limits | 1 (trigger + table + column) | — | S |
| P4 Shift reconciliation | 1 (RPC only) | — | S |
| G3 Promo campaigns | 1 (3 tables + RPC + role) | — | M |
| G4 Player CRM | 1 (table + 2 RPC + cron) | — | L |

Каждый блок завершается auto-bump `package.json` (backend change rule).

---

## Технические детали (для внутреннего использования)

- Все суммы — `bigint` TZS, формат через `formatNumberSpaces`.
- Все даты DD/MM/YYYY через `fmtDate*`.
- Все страницы — PageShell + PageHeader + PageSection + DataTable + ResponsiveDialog (design system rule).
- Casino isolation через `useCasino().activeCasinoId` во всех hooks.
- Server-side financial computation: KPI и ROI считаются в Postgres RPC, UI только рендерит.
- Realtime опционально (campaign progress, CRM last_contact) — `postgres_changes` после `ALTER PUBLICATION supabase_realtime ADD TABLE ...`.

---

Подтверди — катим в порядке P3 → P4 → G3 → G4, или поменять очерёдность?
