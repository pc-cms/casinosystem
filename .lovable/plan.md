## Two separate issues

### 1. "Closures по 5 штук" в `/business-days`

**Причина:** в `useBusinessDayHistory` (`src/hooks/use-business-day-history.ts:61`) для super_admin фильтр по `casino_id` **не применяется** — поэтому подгружаются закрытия по всем 5 казино сети и показываются вперемешку (5 одинаковых строк на каждую дату).

Это противоречит Core-правилу проекта:
> ALL modules + ALL roles (incl. super_admin/FM/surveillance) see only the current subdomain's casino. Cross-casino visibility lives ONLY on `premier` subdomain.

**Исправление:**
- В `useBusinessDayHistory` всегда фильтровать по `useCasino().activeCasinoId` (а не по `auth.casinoId` и не делать bypass для super_admin).
- Исключение — `isSummaryMode` (premier subdomain): тогда показывать все казино и добавить колонку/badge с названием казино в `BusinessDays.tsx`, чтобы 5 строк на дату были визуально разнесены.
- Опционально: на не-premier сабдоменах группировать счётчик `74 closures` по casino_id текущего сабдомена (станет ~15).

### 2. "Невозможно отменить транзакцию"

RPC `cancel_transaction` (текущая версия в БД) отклоняет запрос в трёх случаях:
1. Роль не `cashier` и не `super_admin` → `Only cashier or super admin can cancel transactions`.
2. Смена, к которой относится транзакция, уже закрыта (`shifts.closed_at IS NOT NULL`) → `Cannot cancel: shift is already closed`.
3. Транзакция уже отменена.

UI `CancelTransactionDialog` доступен только в `ActiveShiftView` (активная смена кассира), но текст ошибки и реальное поведение на закрытой смене / у не-кассира пользователя дают одну и ту же фразу «невозможно отменить» — непонятно, какой именно случай.

**Чтобы починить правильно, нужен ответ на 1 вопрос ниже.** После ответа план таков:

- Если хочется разрешить отмену **Manager / Floor Manager** (с manager-override) — обновить RPC: добавить роли `manager`, `floor_manager` в whitelist, и проверять `managerOverride` через переданный параметр (или просто разрешить роли).
- Если транзакция в **закрытой смене**, и её всё-таки нужно отменить — добавить ветку «сторнирующая транзакция» (audit-only) вместо `UPDATE` оригинала, согласно immutable-data principle. Это уже другой паттерн (как Player Chip Adjustments).
- Если ошибка идёт у самого кассира на активной смене — нужны логи (точный текст ошибки из toast) — добавлю ясные сообщения с кодами в RPC.

### Технические детали

**Файлы:**
- `src/hooks/use-business-day-history.ts` — убрать `isSuper` bypass, использовать `useCasino().activeCasinoId`.
- `src/pages/BusinessDays.tsx` — для premier subdomain показать `CasinoBadge` в каждой строке.
- `supabase/migrations/<new>.sql` — обновление RPC `cancel_transaction` (после уточнения сценария).

**Версия:** patch bump после миграции.
