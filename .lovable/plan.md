# Что нужно, чтобы всё заработало

Чтобы я смог реально чинить локальный сервер и видеть данные — нужны три блока. Первый делаете вы (один раз, ~10 минут), остальное беру на себя.

---

## Блок 1. Включить удалённый доступ к локальному серверу Arusha
**Делаете вы, один раз.** Без этого я слепой к локальной базе и не могу проверить ни Breaklist, ни Player Statistics на реальных данных.

1. **Создать Cloudflare-туннель** (бесплатно)
   - Зайти на `https://one.dash.cloudflare.com` → Networks → Tunnels → **Create a tunnel** → Cloudflared → имя `arusha-local` → Save.
   - Тип Docker → скопировать **значение токена** (длинная base64-строка после `--token`).
2. **Привязать поддомен**
   - В том же мастере, шаг "Public Hostname": Subdomain `local-arusha`, Domain `casinosystem.app`, Type `HTTP`, URL `nginx:80` → Save.
3. **Закрыть Access-политикой** (чтобы туннель не торчал в открытый интернет)
   - Zero Trust → Access → Applications → **Add an application** → Self-hosted → Domain `local-arusha.casinosystem.app` → Policy `Emails` → ваш email → Save.
4. **Запустить на сервере Arusha** (одна команда, под root):
   ```
   sudo casino-update --enable-remote
   ```
   Скрипт спросит токен из шага 1, запишет в `.env`, поднимет контейнер `cloudflared`. Через 30 секунд `https://local-arusha.casinosystem.app` уже работает (после логина через Cloudflare Access).
5. **Прислать мне в чат подтверждение**: "туннель поднят" + один скриншот, что страница логина CMS открывается.

---

## Блок 2. Дать мне минимальный доступ для диагностики
После того как туннель работает — мне нужно:
- **Тестовый аккаунт** на локальном сервере с ролью `super_admin` (логин + пароль в чат — пароль одноразовый, сразу после поменяете).
- **Подтверждение**, что в локальной БД есть хотя бы одна смена с дилерами, расставленными по столам (для Breaklist) и хотя бы один игрок с историей bet/in/out (для Player Statistics). Если нет — я могу попросить вас за минуту сесть/встать тестового игрока за стол.

Без этих двух пунктов я могу только смотреть схему БД и код — но не воспроизвести баги на реальных данных.

---

## Блок 3. Что я сделаю сам, как только Блоки 1–2 готовы

### 3.1 Breaklist — отметки времени (где стоит дилер)
- Проверю `BreaklistGrid.tsx` против реальных данных из `dealer_positions` / `pit_assignments`.
- Уточню SQL-запрос источника: на Cloud (premier) данные есть, на Arusha — нет → значит проблема либо в sync, либо в RLS по `casino_id`, либо в самом хуке (`use-dealers.ts` / `use-pit-prefetch.ts`).
- Чиню в одном месте → бамп `package.json` patch → один `sudo casino-update`, и Arusha получает фикс.

### 3.2 Player Statistics — bet/in/out не виден под super_admin
- Проверю `PlayerStatistics.tsx` + хук `use-players.ts` / `use-visits.ts`.
- Высокая вероятность: `canSeePlayerFinancials()` в `role-access.ts` либо `useBusinessDayFilter()` режут данные. Super_admin должен видеть всё — если режет, это регрессия.
- Параллельно проверю, почему "нет других пользователей": скорее всего `user_roles` или `user_casino_access` на локальной БД пустые → значит sync seed не доехал или фильтр по `activeCasinoId` слишком жёсткий.

### 3.3 Закрепить результат
- Все фиксы — через миграции + bump версии, как требует core-правило.
- Никаких ручных SQL/docker-команд вам — всё через `sudo casino-update`.

---

## Технические детали (для разработчика)

- Туннель: `cloudflared` контейнер в `deploy/docker-compose.yml` под профилем `with-tunnel`, активируется через `--enable-remote` (уже реализовано в прошлой итерации, версия 1.3.86).
- Сценарий доступа: Cloudflare Access → JWT → nginx → cms-frontend / postgrest (порт 80 внутри docker-сети `cms-net`).
- Диагностика будет вестись через DevTools на `https://local-arusha.casinosystem.app` + чтение логов `docker compose logs cms-sync` (через тот же туннель/SSH при необходимости).
- Бамп `package.json` patch обязателен на каждый backend-фикс (правило из памяти).

---

## TL;DR для вас

1. Создать Cloudflare-туннель + Access policy (~10 мин по инструкции выше).
2. На сервере: `sudo casino-update --enable-remote`, ввести токен.
3. Прислать мне: подтверждение работы туннеля + тестовый super_admin аккаунт на локальном сервере.
4. Дальше я чиню Breaklist и Player Statistics сам, без вашего участия.

Если шаг 1 (Cloudflare-аккаунт / Access) звучит сложно — скажите, я распишу его пошагово со скриншотами того, куда кликать.