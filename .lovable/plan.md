# Slots Tips CD: переход на реальный cash-out

## Что меняем
Сейчас Tips CD — это просто log-запись, деньги остаются в кассе, формула «искусственно» вычитает `tipsCd`. Переводим на модель Live Cage: **Tips CD = реальная cash-out транзакция** из кассы. До закрытия смены кассир дважды нажимает кнопку выплаты — отдельно за дневной (13:00–21:10) и вечерний (21:11–05:00) бакеты. Деньги физически выходят из кассы → closing cash естественно ниже → формула чище.

## UI: шапка активной смены слотов
Заменить текущую секцию ввода Tips CD на две большие кнопки:

```text
[ Cash Out Day Tips  TZS 240 000 ]   [ Cash Out Evening Tips  TZS 0 ]
   collected · paid: —                     collected · not yet
```

- Каждая кнопка показывает **collected** = сумма tips_cd записей за свой бакет.
- При нажатии открывается мини-диалог: предзаполненная сумма = collected, кассир может **отредактировать на ФАКТИЧЕСКУЮ выплату** (если докладывал свои — ставит больше), опционально note.
- Подтверждение создаёт `cage_slots_transactions` запись:
  - `kind = 'tips_cd_payout'`, `direction = 'out'`
  - `amount = entered_amount`
  - `bucket = 'day' | 'evening'` (новая колонка)
- После выплаты бакет помечается `paid` (по существованию payout-транзакции на эту смену+bucket) — кнопка дизейблится, показывает выплаченную сумму и кнопку «Reopen» (Manager Access only) на случай ошибки.

## Backend
- Миграция: `ALTER TABLE cage_slots_transactions ADD COLUMN bucket text` (nullable, проверка `bucket IN ('day','evening')` только когда `kind='tips_cd_payout'`).
- Новый `kind = 'tips_cd_payout'` в существующем enum/check.
- Существующие записи `cage_slots_tips_cd` остаются как **лог-журнал собранных чаевых** (для отчёта «сколько заработали»). Никаких удалений.
- RPC / триггер `computeSlotsShiftBalance` и DB snapshot:
  - `tips_cd_payout` транзакции уже учтены в `cash_desk_result` через ΔCash (cash-out уменьшает expected cash) — отдельной строки не нужно.
  - **Убираем `- v_tips_cd`** из формулы balance в `cage-balance.ts` и в БД-функции.
  - Новая формула: `Balance = CDR − SystemResult − CardsMiss`.
- Отчёт по чаевым (`/reports/floor-tips` и monthly tips) продолжает читать `cage_slots_tips_cd` для отображения «сколько собрано Day/Evening», + добавляется колонка «Paid out» из транзакций.

## UI: форма закрытия смены / отчёт
- Блок «Tips CD» в Closing/Review:
  - Day: Collected / Paid out / Δ (если докладывали — Δ показывается как «manager top-up»).
  - Evening: то же.
  - Total tips paid out (информационно).
- Большая плитка `Tips CD (-)` из текущего макета **удаляется** (двойной минус больше не нужен).
- Shift Balance остаётся одиночным крупным числом, формула в подписи: `CDR − SystemResult − CardsMiss`.

## Валидация при закрытии
При попытке Close Shift, если есть незакрытые tips_cd записи в каком-либо бакете без соответствующего payout — мягкий warning «Day tips not paid out yet. Proceed anyway?» (не блок, т.к. может быть смена без чаевых вообще).

## Файлы

**Frontend**
- `src/components/cage-slots/ActiveSlotsShiftView.tsx` — заменить секцию tips_cd на две кнопки + диалог; удалить плитку Tips CD из шапки результата.
- `src/hooks/use-slots-tips-cd.ts` — добавить хук `useCashOutSlotsTipsCd({ bucket, amount, note })`, который создаёт транзакцию. Поправить вводящие в заблуждение комментарии.
- `src/lib/cage-balance.ts` (`computeSlotsShiftBalance`) — убрать `- tipsCd`, обновить описание.
- `src/components/cage-slots/SlotsConsolidatedReport.tsx` — добавить колонки Collected/Paid per bucket.

**Backend**
- Миграция: `cage_slots_transactions.bucket` + допуск нового `kind`.
- Обновить DB-функцию snapshot/balance: убрать вычитание tips_cd.
- Bump `package.json` (backend change).

## Не делаем
- Live cage (tips_live/poker/floor) — не трогаем, там модель уже корректная.
- Удаление существующих tips_cd записей или транзакций — нет.
- Автоматическое распределение по бакету по времени — bucket определяется кнопкой, которую нажал кассир (не по `created_at` записи).
