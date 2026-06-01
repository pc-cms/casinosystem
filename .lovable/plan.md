# Fix: восстановить формулу Cash Desk Result для Slots

## Что произошло

В миграции `20260601173505` при добавлении `ace_fills` я случайно переписал саму формулу `cash_desk_result` в `compute_slots_shift_balance_from_row`:

**Было (канон, мигр. 20260601140421 + `src/lib/cage-balance.ts`):**
```
CDR = ClosingCash + Expenses − AddFloat + Collection
    + LG_Out − LG_In + TipsCdPayout
```

**Стало (сломано):**
```
CDR = ΔCash + Expenses + Collection − AddFloat
    + LG_Out − LG_In + CashlessOut − CashlessIn
```

Три ошибки:
1. `closing_cash` → `delta_cash` ⇒ баланс уехал ровно на `opening_cash` (это и есть «+1M от открытия», который виден в отчёте).
2. Удалён `tips_cd_payout` — выплаты типов перестали возвращаться в CDR, баланс уезжает на сумму выплат.
3. Добавлены `cashless_in/out` — их по канону в CDR нет (cashless — отдельный информативный блок).

Видно на скрине: `Balance ≈ −1M` стабильно почти на каждой смене — это именно `−opening_cash`.

## Что чиню

Один новый миграционный файл, который:

1. Переписывает `compute_slots_shift_balance_from_row` так, чтобы:
   - CDR-формула вернулась к канону (`closing_cash + expenses − add_float + collection + lg_out − lg_in + tips_cd_payout`).
   - При этом сохраняются добавленные поля `ace_fills` и `slots_result = system_result − ace_fills` (это единственная новая логика, которая нужна).
   - Подтягиваю `v_tips_cd_payout_day/_evening` из `cage_slots_tips_cd_payouts` как было раньше.
   - JSON-выхлоп содержит и старые ключи (`tips_cd_payout`, `cashless_balance`, `cashless_final`, `slots_result_derived`), и новый `ace_fills`, чтобы ничего во фронте не отвалилось.
2. Триггеры `trg_persist_slots_shift_balance` и `trg_cs_recompute_self` оставляю как сейчас (они корректно слушают `ace_fills`, просто пересчитывают через исправленную функцию).
3. Бэкфилл: пройтись по всем `cage_slots_shifts` и пересчитать `cash_desk_result`, `balance`, `slots_result`, `cards_miss`, `actual_cage_result`, `difference_amount` исправленной формулой — это лечит уже сохранённые «сломанные» числа в Closings/истории/отчётах.

## Что НЕ трогаю

- `src/lib/cage-balance.ts` (фронтовый канон) — уже правильный.
- UI шага закрытия и Closings — формулы там корректные, проблема чисто в БД.
- `package.json` — патч-bump (бэкенд-изменение).

## Файлы

- `supabase/migrations/<new>.sql` — fix функции + бэкфилл.
- `package.json` — bump.
