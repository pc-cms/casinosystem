План изменений:

1. **Reports: Daily → Daily diff**
   - Переименовать вкладку `Daily` в `Daily diff`.
   - Оставить внутренний ключ `daily`, чтобы существующие ссылки `?tab=daily` не сломались.

2. **Исправить Daily diff формулы**
   - Вынести расчёт Daily diff в единый backend RPC, чтобы не ловить лимит 1000 строк и не считать месяцы неполно.
   - Для Player Result использовать окно **13:00 EAT → 05:00 EAT следующего дня**:
     - `buy` / `in` = cash-in игрока;
     - `cashout` / `out` = cashout игрока;
     - `Player Result = Cashout − Cash-in`;
     - исключать `cancelled_at IS NOT NULL`.
   - `Drop (R)` и `Cash In` считать в том же окне 13:00 → 05:00 через существующую NEP/drop split логику, чтобы числа были в одном временном контуре.
   - `Result` брать только из канонического `shifts.tables_result` по закрытым live shifts за business day.
   - `Diff` привести к прямому сравнению: **`Result + Player Result`**. Miss Chips оставить отдельной колонкой, не вычитать из Diff.
   - Для будущих business-day snapshots добавить тот же Daily diff блок, чтобы снимок закрытого дня совпадал с Reports.

3. **Cashless report после Expenses**
   - Добавить вкладку `Cashless` сразу после `Expenses` в Reports.
   - Сделать read-only отчёт по диапазону дат из общего фильтра Reports.
   - Показать KPI: Deposit, Withdrawal, Net, Pending, Records.
   - Добавить разбивку по провайдерам и таблицу истории.
   - Фильтры: Source `All / Live / Slots`, Provider, Direction, Status, Search.
   - Сортировки: Date, Source, Provider, Direction, Player, Amount, Status.
   - Источник данных: `cashless_transactions`, с поддержкой большой глубины через range-query по `business_date` и увеличенный лимит.

4. **Технически**
   - Добавить migration с RPC и `GRANT EXECUTE`.
   - Обновить `Reports.tsx` и добавить отдельный компонент `CashlessReport`.
   - Переиспользовать существующие форматтеры дат/денег и semantic design tokens.
   - Bump `package.json` patch: `1.3.230 → 1.3.231`.