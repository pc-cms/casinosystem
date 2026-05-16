## План: локальный сервер должен стартовать как рабочее казино, без исторического мусора

### 1. Исправить критический вход в локальную админку
- Убрать конфликт двух bootstrap-админов: старый `admin@local / Welcome6407!` больше не должен создаваться.
- Локальный super admin должен создаваться как `superadmin@cms.local / superadmin`.
- Обязательно создавать/обновлять `profiles` для superadmin с `casino_id` локального placeholder casino.
- Обязательно выдавать `super_admin` роль в `user_roles`.
- Это должно работать и на fresh install, и при `sudo casino-update`.

### 2. Разделить два режима локального сервера

```text
A) Standalone casino
   Установка -> baseline структура -> superadmin -> создать пользователей -> заполнить floats/staff -> работать

B) Clone from Arusha/Cloud
   Установка -> superadmin -> кнопка initial/full sync -> подтянуть структуру + нужные данные конкретного casino
```

### 3. Расширить static baseline seed для Standalone режима
Добавить в `deploy/postgres/init/20-seed-defaults.sql` идемпотентные данные, которые не являются историей:
- Placeholder casino `Local Casino` / `local`.
- Role/module permissions matrix как в текущей системе.
- Финансовые wallets с нулевыми балансами.
- Chip color settings.
- Standard gaming tables с нулевыми floats/opening data, без персональных данных.
- Finance budget categories / global categories, но без periods/items/transactions.
- Tag conflicts / системные справочники, если UI зависит от них.
- Node identity baseline для sync.

Не сидить:
- players, visits, transactions, shifts, cash counts, reports, closures, breaklists, rota, attendance, employees/staff, photos/documents, activity history, budgets periods/items, wallet transactions.

### 4. Сделать Server Identity нормальным первым шагом
- UI должен позволять переименовать placeholder casino, slug/code/name/timezone без необходимости Cloud sync.
- При сохранении identity локальная `casinos` запись должна обновляться в БД, а не только `.env`.
- После смены slug/name frontend restart остается, но данные уже совпадают с `CASINO_ID`.

### 5. Сделать создание пользователей предсказуемым
- `create-user` должен на локальном сервере создавать пользователя с выбранной ролью и текущим casino_id.
- Пользователь с ролью `pit`, `cashier`, `reception`, `manager` сразу получает свои страницы через `role_module_defaults`.
- Проверить, что обычные роли видят placeholder/renamed casino через `profiles.casino_id` и RLS.

### 6. Расширить sync-слой для “полного клона структуры”
Сейчас sync outbox не покрывает всю структуру. Нужно добавить baseline/business-structure tables в репликацию:
- `casinos`, `gaming_tables`, `chip_color_settings`, `financial_wallets`, `budget_categories`, `role_module_defaults`, возможно `user_module_permissions`, `profiles`, `user_roles`, `user_casino_access`.
- Оставить историю/операционные данные синхронизируемыми только когда явно нужен full clone.
- Для свежего standalone baseline не тянуть людей/историю автоматически.

### 7. Добавить “Initial Full Sync / Clone Casino” как явную кнопку
В Admin → Peers/Server Identity:
- Кнопка для super_admin: “Clone casino from peer”.
- Выбор casino из peer/Cloud.
- Перед запуском предупреждение: можно остановить работу на 3 минуты.
- Sync должен подтянуть структуру casino: tables, users/roles/access, finance categories, chip colors, wallets, settings.
- Исторические данные, персонал, игроки, фото, отчеты — не подтягивать по умолчанию, если не выбран режим full historical clone.

### 8. Обновить installer/update pipeline
- Убедиться, что `20-seed-defaults.sql` реально попадает в `public/install`, `public/install.sh`, release tarball и применяется после schema dump.
- На `sudo casino-update` повторно применять baseline seed идемпотентно.
- После backend/sql/sync изменений bump patch version.

### 9. Проверка после реализации
- Проверить SQL на идемпотентность: повторный seed не должен дублировать rows.
- Проверить локальный login flow: `superadmin / superadmin` → Admin открывается.
- Проверить создание manager/cashier/reception/pit и доступ к их страницам.
- Проверить, что standalone local не содержит demo people/history.
- Проверить, что standard tables и finance/chip baseline существуют сразу после install.