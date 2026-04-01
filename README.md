# CMS — Casino Management System

## Назначение

CMS — это операционная платформа для управления казино в реальном времени. Охватывает полный цикл: от учёта игроков и фишек до финансовой отчётности и бюджетирования. Построена по принципу **ручного ввода** — никакого ИИ или автоматических решений. Все данные иммутабельны: удаление запрещено, исправления только через новые транзакции (совместимость с CCTV-верификацией).

---

## Архитектура

| Слой | Технология |
|------|-----------|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind CSS 3, shadcn/ui |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, RLS) |
| State | TanStack React Query (staleTime 30s, refetch on focus) |
| Multi-tenancy | `casino_id` на всех таблицах, RLS изоляция |

### Мультиарендность
Каждый пользователь привязан к одному казино через `profiles.casino_id`. Все запросы фильтруются через `get_user_casino_id(auth.uid())` на уровне RLS — утечка данных между площадками невозможна.

---

## Роли и доступ

| Роль | Зона доступа |
|------|-------------|
| **manager** | Полный доступ ко всем модулям, Admin-настройки, создание пользователей |
| **finance_manager** | Финансы, бюджет, кеш-каунт, отчёты, просмотр операций |
| **cashier** | Касса (Cage), расходы, таблицы — без дашборда |
| **pit** | Breaklist, рота, посещаемость дилеров, трекер клиентов |
| **reception** | Дашборд, регистрация игроков, чек-ин визитов |
| **security** | Дашборд, просмотр игроков/столов, отчёты, логи |

### Manager Override
Глобальный переключатель в сайдбаре для временного повышения прав до уровня менеджера. Аутентификация через пароль или RFID. Действует на всю сессию до ручной деактивации. Все действия логируются с ID менеджера.

---

## Модули

### 1. Dashboard (`/`)
Общий обзор: активные игроки, открытые столы, статус смены, ключевые метрики дня.

### 2. Cage — Касса (`/cage`)
Центр денежных операций смены:
- **Открытие смены** — двухшаговый визард: фишки + TZS/Mobile → валюты + банки
- **Buy-in / Cashout** — транзакции с игроками, привязка к столу и смене
- **Фишки** — учёт по деноминациям, автоматический расчёт ожидаемого баланса
- **Закрытие смены** — 3 шага: подтверждение столов → подсчёт фишек/кеша → сверка
- **Результаты**: `cash_result` (Buy − Cashout), `miss_total` (фишки), `shift_result`

Формула кассира: `Ожидаемый баланс = Opening + Buy-ins − Cashouts − Expenses`

### 3. Tables — Столы (`/tables`)
- Управление игровыми столами (poker, blackjack и др.)
- Открытие/закрытие с фиксированным float
- **Chip Count** — полноэкранный горизонтальный модуль для подсчёта фишек по столам
- **Результат стола** = Actual chips − Baseline (триггер `trg_calculate_table_result`)
- Вкладки: Active Players, Client Tracker, Table Tracker

### 4. Players — Игроки (`/players`)
- Реестр игроков: имя, никнейм, телефон, фото, тип (slots/table/mix)
- Статусы: active, blacklist
- Теги и группы
- Карты игроков (ручные и RFID)
- Экономика: total_drop, total_cashout, real_result (view `player_economy`)

### 5. Expenses — Расходы (`/expenses`)
Расходы кассы за смену: еда, алкоголь, такси, отель, перелёт, другое. Требуют одобрения менеджера. Привязаны к shift_id и player_id.

### 6. Finance — Финансовый контроль (`/finance`)
Офисный модуль для управления денежным потоком:

#### 6.1 Dashboard
Обзор балансов кошельков и ключевых финансовых метрик.

#### 6.2 Daily Review
Ежедневная сверка итогов:
- **Tables Result** — автоматически из `cash_result` закрытой смены
- **Slots Result** — ручной ввод
- **Expenses** — из одобренных расходов кассы
- **Net Income** = Tables + Slots − Expenses
- **Confirm Day** → создаёт `daily_result` транзакцию в леджере + трансфер в сейф
- **Equalize Float** — после подтверждения сравнивает наличные в кассе с целевым `cage_float` и предлагает перевод для выравнивания

#### 6.3 Wallets — Кошельки
10 леджерных кошельков:
| Кошелёк | Назначение |
|---------|-----------|
| `main_cash` | Операционный кеш кассы |
| `office_safe` | Основной сейф офиса |
| `cage_slot` / `cage_table` | Слоты и столы |
| `mobile_money` | Mpesa, Tigo, Halo, AirTell |
| `bank_account` | Банковские счета |
| `rent_reserve` | Резерв на аренду |
| `license_reserve` | Резерв на лицензии |
| `tax_reserve` | Резерв на налоги |
| `other_reserve` | Прочие резервы |

Балансы управляются исключительно через иммутабельный леджер (`wallet_transactions`) и триггер `update_wallet_balances`. Защита от овердрафта через `check_wallet_balance` (кроме `daily_result`, `collection`, `adjustment`).

#### 6.4 Expenses (офисные)
20 категорий расходов в 5 группах: Operating, Fixed, Government, Tech, Other.

#### 6.5 Budget
Бюджетное планирование по месяцам:
- Категории с маппингом на типы расходов
- Периоды с блокировкой (`enforce_budget_lock` триггер)
- Actual и Reserved рассчитываются динамически из леджера

#### 6.6 Cash Count
Физический пересчёт наличных:
- Единая сетка для всех кошельков и валют
- Авто-заполнение из последнего snapshot
- Расхождение = Physical − Expected (из леджера)
- Корректировка через `adjustment` транзакцию

### 7. Pit — Игровой зал (`/pit`)
- **Breaklist** — сетка назначений дилеров по таймслотам и столам
- **Attendance** — ежедневная посещаемость дилеров
- **Employee** — реестр дилеров: категория (trainee→pit_boss), зарплата, контракты
- **Rota** — расписание смен (M/N/A/S/E/L)

### 8. Staff — Персонал (`/staff`)
Аналогично Pit, но для не-дилерского персонала: security, cashier, bartender, hostess, waiter, cleaner, IT, HR.

### 9. Groups — Группы игроков (`/groups`)
Группировка игроков для аналитики и управления.

### 10. Reports (`/reports`)
Отчёты по операциям, финансам, игрокам.

### 11. Stats (`/stats`)
Статистика и аналитика: тренды, графики, сводки.

### 12. Logs (`/logs`)
Полный аудит-трейл всех операций. Категории: transaction, edit, lock, expense, player, system, breaklist, pit.

### 13. Admin (`/admin`)
Только для менеджеров:
- Настройки казино (время смен, breaklist lock, tables open)
- Управление `cage_float` (целевой кеш кассы)
- Управление фишками и float
- Создание пользователей (через Edge Function `create-user`)

---

## Ядро системы (Триггеры и бизнес-логика)

| Компонент | Назначение |
|-----------|-----------|
| `update_wallet_balances` | Автоматическое обновление балансов кошельков при каждой транзакции |
| `check_wallet_balance` | Защита от овердрафта (кроме исключений) |
| `trg_calculate_table_result` | Автоматический расчёт результата стола: closing − opening |
| `enforce_budget_lock` | Запрет изменений бюджета в заблокированном периоде |
| `validate_chip_consistency` | Проверка: сумма фишек ≤ системного baseline |
| Уникальный индекс `(casino_id, business_date)` | Защита от дублирования daily_result |

---

## Финансовая модель

### Расчёт дохода
Доход = дельта между закрытием и открытием смены для наличных, мобильных денег и банков.
**Фишки не учитываются** — они постоянно в обороте кассы и столов.

### Потоки при закрытии дня
```
Закрытие смены (Cage)
  └→ cash_result = Buy-ins − Cashouts
  
Daily Review (Finance)
  └→ Net = cash_result + slots − expenses
  └→ Транзакция: daily_result → main_cash
  └→ Трансфер: main_cash → office_safe
  
Equalize Float
  └→ Сравнение: физический кеш vs cage_float target
  └→ Трансфер: office_safe ↔ main_cash (при расхождении)
```

### Валюты
Система поддерживает мультивалютность: TZS (основная), USD, EUR. Курсы задаются при открытии смены и хранятся в `shifts.exchange_rates`.

---

## Структура базы данных (ключевые таблицы)

### Операционные
| Таблица | Содержание |
|---------|-----------|
| `casinos` | Настройки казино, cage_float |
| `profiles` | Привязка user → casino, display_name |
| `user_roles` | Роли пользователей (отдельная таблица!) |
| `user_credentials` | PIN и RFID для аутентификации |
| `shifts` | Смены: opening/closing данные, результаты |
| `transactions` | Buy-in/Cashout операции |
| `expenses` | Расходы кассы |
| `gaming_tables` | Столы: float, деноминации, статус |
| `chip_inventory` / `chip_baseline` / `chip_snapshots` | Учёт фишек |
| `cash_counts` | Подсчёт кеша при смене |

### Финансовые
| Таблица | Содержание |
|---------|-----------|
| `financial_wallets` | 10 кошельков с балансами |
| `wallet_transactions` | Иммутабельный леджер |
| `daily_summaries` | Дневные итоги |
| `cash_count_snapshots` | Физические пересчёты |
| `budget_periods` / `budget_categories` / `budget_items` | Бюджет |

### Игроки и персонал
| Таблица | Содержание |
|---------|-----------|
| `players` / `player_tags` / `player_cards` / `player_groups` | Игроки |
| `casino_visits` | Визиты |
| `client_sessions` | Игровые сессии |
| `dealers` / `dealer_attendance` | Дилеры |
| `staff_members` / `staff_attendance` / `staff_rota` | Персонал |
| `breaklist` / `breaklist_logs` | Назначения |
| `pit_rota` | Расписание дилеров |
| `activity_logs` | Аудит |

---

## Безопасность

- **RLS** на всех таблицах — данные изолированы по `casino_id`
- **Роли** хранятся в отдельной таблице `user_roles` (не в profiles!)
- **SECURITY DEFINER** функция `has_role()` предотвращает рекурсию RLS
- **Иммутабельность** — удаление запрещено на большинстве таблиц
- **Manager Override** — логируется каждая активация
- **Edge Functions** (`create-user`, `verify-manager`) — серверная валидация

---

## Развёртывание

- Frontend: Lovable (автоматический деплой)
- Backend: Lovable Cloud (Supabase-powered)
- Миграции: `supabase/migrations/` (автоматическое применение)
- Edge Functions: `supabase/functions/` (автоматический деплой)
