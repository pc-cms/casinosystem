# Slots Cage — Transfers, Approval, объединённый экран

## 1. База (одна миграция)

Новая таблица `cage_slots_transfers` (immutable, как `cage_transfers`):

```text
id, casino_id, cage_slots_shift_id (FK → cage_slots_shifts)
transfer_type   text  -- 'fill' | 'collection' | 'lg_in' | 'lg_out'
direction       text  -- 'in' | 'out' (для дельты кассы)
amount          bigint
note            text
operator_id     uuid (cashier)
approved_by     uuid (manager — для collection требуется override)
-- кросс-кассовое подтверждение:
counterpart_shift_id uuid null  -- shift Live Game (когда lg_in/lg_out)
counterpart_transfer_id uuid null self-ref
requires_approval bool default false
approved_at     timestamptz null
approved_by_user uuid null  -- кто на принимающей стороне нажал Approve
created_at      timestamptz
```

Триггеры:
- `prevent_update`/`prevent_delete` (как у `cage_transfers`), кроме обновления только трёх полей подтверждения (`approved_at`, `approved_by_user`, `counterpart_transfer_id`).
- RLS: SELECT — все юзеры казино; INSERT — cashier/manager текущего казино; UPDATE — только в рамках approval (cashier/manager).
- При создании `lg_in`/`lg_out` автоматически создаётся «зеркало» в `cage_transfers` (у активной LG-смены) с `requires_approval=true`. Approve на любой стороне закрывает обе записи.

В `cage_transfers` добавить колонки `requires_approval`, `approved_at`, `approved_by_user`, `counterpart_slots_transfer_id`. Триггер `prevent_update` ослабить только для этих полей.

## 2. UI — Slots Cage

**Убираем** вкладку `Audit` (комментарии переезжают вниз карточкой только когда они есть).

**Объединяем** в одну вкладку **Closing** (вместо `result + closing + cards`):
```text
┌─────────────────────────────────────────────────────────┐
│ System Result [input]   Cards Open: N  Closing: [input] │
│ Difference: …            Miss value: TZS …              │
├─────────────────────────────────────────────────────────┤
│ CashCountGrid (TZS+Mobile+Banks │ USD+KES │ EUR+GBP)    │
└─────────────────────────────────────────────────────────┘
```
Одна `PageSection` сверху (Sys Res + Cards в одну строку, как KPI-полоса), ниже — существующий `CashCountGrid`.

**Новая вкладка `Transfers`** (по модели `cage/TransfersForm.tsx`):
- 4 типа: `Fill` (cash IN из safe), `Collect` (cash OUT в safe, manager override), `Cage LG IN` (приход из Live Game), `Cage LG OUT` (отправка в Live Game).
- Справа — список переводов смены с цветовыми чипами (как в LG).
- Для `lg_in`/`lg_out`: пока `approved_at IS NULL` показывается жёлтый чип `Pending` и (на принимающей стороне) кнопка **Approve** с manager override.

## 3. UI — Live Game Cage (`TransfersForm`)

В правом списке у строк `slots_in`/`slots_out` с `requires_approval=true AND approved_at IS NULL` показать кнопку **Approve** (manager override). После approve чип меняется на `Approved by …`.

## 4. Хуки

Новый файл `src/hooks/use-cage-slots-transfers.ts`: `useSlotsTransfers(shiftId)`, `useCreateSlotsTransfer()`, `useApproveTransfer()` (универсальный для обеих таблиц).

В `use-cage-transfers.ts` добавить `useApproveCageTransfer()`.

## Затрагиваемые файлы
- миграция (новая)
- `src/components/cage-slots/ActiveSlotsShiftView.tsx` — убрать Audit, объединить, добавить Transfers tab
- `src/components/cage/TransfersForm.tsx` — Approve-кнопка на pending строках
- `src/hooks/use-cage-slots-transfers.ts` — новый
- `src/hooks/use-cage-transfers.ts` — approve mutation
- bump версии в `package.json`

## Подтверждение
- ОК на этот объём (одна миграция + два cage-модуля)? Если хочешь скромнее — могу сделать без зеркалирования в `cage_transfers` (тогда approval будет жить только в slots-таблице и LG-кассир будет видеть pending в отдельной плашке).
