## Единый стандарт статистики игрока

Везде, где показывается статистика **конкретного игрока** (Player Profile, Player Statistics, Player Visits Breakdown, Players list, Groups, Reports → Players/Groups), переходим на одну прозрачную модель:

```text
Result = Cashout − Drop          ← чистая игра
Total  = Result − Comps − Expenses   ← с учётом подарков/расходов казино на игрока
```

Знак — **с точки зрения игрока**:
- `+` (зелёный) → игрок выиграл / казино потеряло
- `−` (красный) → игрок проиграл / казино заработало

Финансовые модули казино (Daily Review, Cage, Wallets, Finance Summary, Cash Reconciliation) **не трогаем** — там по-прежнему перспектива казино.

## Текущая каша (что чиним)

| Файл | Сейчас | Перспектива |
|---|---|---|
| `Players.tsx` | `result = cashout − drop`, `realResult = cashout − drop − comps` | Игрок ✓ |
| `Groups.tsx` | `result = cashout − drop`, `realResult = result − expenses` | Игрок ✓ |
| `Reports.tsx` (players, groups) | `cashout − drop` | Игрок ✓ |
| `PlayerProfile.tsx` | `realResult = drop − cashout − comps` | **Казино — ломаем** |
| `PlayerVisitsBreakdown.tsx` | `result = drop − out − comps` | **Казино — ломаем** |
| `PlayerStatistics.tsx` | `result = inDrop − out` | **Казино — ломаем** |
| `player_economy` view (DB) | `real_result = cashout − drop − comps` | Игрок ✓ (но смешивает) |

## Изменения

### 1. Колонки везде: `Drop · Cashout · Result · Comps · Expenses · Total · Hold%`

Колонка **Result** — только чистая игра (`Cashout − Drop`).
Колонка **Total** — итог с компсами и расходами (`Result − Comps − Expenses`).
Comps и Expenses — отдельные нейтральные столбцы (без зелёного/красного).
Hold% — оставляем как метрику казино (`(Drop − Cashout − Comps) / Drop`).

### 2. Frontend

**`src/pages/PlayerProfile.tsx`**
- Lifetime KPIs: добавить `result = cashout − drop` (зелёный/красный), переименовать «Real result» → **Total** = `result − comps`. (`expenses` и `comps` сейчас в БД одно и то же — `expenses` таблица; см. п. 4.)
- Period summary: то же самое — две метрики `Result` и `Total`.
- Не использовать `economy.real_result` напрямую — пересчитывать на клиенте, чтобы знак был очевиден.
- Таблица визитов и развёртка по транзакциям — считать `result = out − in` для каждой строки.

**`src/components/player/PlayerVisitsBreakdown.tsx`**
- Заменить `result(a) = drop − out − comps` на две функции:
  - `result(a) = a.out − a.drop`
  - `total(a) = result(a) − a.comps`
- Добавить колонку **Total** рядом с Result во все три уровня (месяц / неделя / день) и в строку итогов.

**`src/pages/PlayerStatistics.tsx`**
- Заменить `result = inDrop − out` на `result = out − inDrop`.
- Цветовая логика остаётся (`>0` зелёный, `<0` красный) — теперь работает правильно для игрока.

**`src/pages/Players.tsx`** и **`src/pages/Groups.tsx`**
- Уже считают правильно. Только переименовать в UI: `Real Result` → **Total**, чтобы термин был единым.

**`src/pages/Reports.tsx`**
- Players tab и Groups tab: добавить колонку **Total** = `Result − Comps − Expenses` (сейчас в Groups есть `realResult`, но без отдельного Total-заголовка). Переименовать.

### 3. Hold %

Формула остаётся `(Drop − Cashout − Comps) / Drop` — это всегда показатель удержания казино, цвет нейтральный или по знаку (положительный hold = казино удерживает, нормально).

### 4. Backend (одна миграция)

`player_economy` view сейчас отдаёт `real_result = cashout − drop − comps` — это смешанная метрика. Чтобы клиент мог разделять Result и Total, **расширяем view** двумя полями (старое поле оставляем для обратной совместимости):

```sql
CREATE OR REPLACE VIEW public.player_economy
WITH (security_invoker = true) AS
SELECT 
  p.id AS player_id, p.casino_id, p.first_name, p.last_name, p.nickname, p.status,
  COALESCE(buy.total, 0)  AS total_drop,
  COALESCE(cash.total, 0) AS total_cashout,
  COALESCE(exp.total, 0)  AS total_expenses,
  -- NEW: чистый результат игрока (cashout − drop)
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0)                         AS result,
  -- NEW: total с учётом expenses/comps
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0) - COALESCE(exp.total, 0) AS total,
  -- LEGACY (то же самое что total): оставляем чтобы не сломать старых потребителей
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0) - COALESCE(exp.total, 0) AS real_result
FROM public.players p
LEFT JOIN LATERAL (SELECT SUM(amount) AS total FROM public.transactions WHERE player_id = p.id AND type = 'buy')     buy  ON true
LEFT JOIN LATERAL (SELECT SUM(amount) AS total FROM public.transactions WHERE player_id = p.id AND type = 'cashout') cash ON true
LEFT JOIN LATERAL (SELECT SUM(amount) AS total FROM public.expenses     WHERE player_id = p.id AND approved = true)  exp  ON true;
```

### 5. Терминология (для документации и тултипов)

- **Drop** — сумма Cash-In игрока
- **Cashout** — сумма Cash-Out игрока
- **Result** = Cashout − Drop (чистая игра)
- **Comps / Expenses** — расходы казино на игрока
- **Total** = Result − Comps − Expenses (итог с учётом подарков)
- **Hold %** — метрика казино, считается всегда `(Drop − Cashout − Comps) / Drop`

Bump версии до **1.0.36**. Обновлю memory `mem://features/player-management` (или создам `mem://features/player-stats-formula`) с этой формулой как канонической, чтобы в будущем не плодить варианты.

## Проверка

1. Игрок: Drop 100k, Cashout 50k → Result `−50 000` (красный), Total `−50 000`.
2. Игрок: Drop 100k, Cashout 150k, Comps 10k → Result `+50 000` (зелёный), Total `+40 000` (зелёный).
3. Daily Review / Cage / Wallets — без изменений, цифры те же.
4. Hold% — без изменений.
