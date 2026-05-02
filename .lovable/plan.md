## Chip Transfer (CHIP IN ↔ CHIP OUT) — парные транзакции, влияющие на NEP

### Концепция

Когда фишка пересекает границу «игрок ↔ игрок» вне кассы — это эквивалентно cash-операции для NEP, но **без движения денег в кассе**. Pit фиксирует передачу как **парную** запись: один игрок отдаёт (CHIP OUT), другой получает (CHIP IN), на одну и ту же сумму.

### Семантика для NEP

| Запись | Эффект на NEP игрока | Аналог |
|---|---|---|
| **CHIP IN** (получил) | `NEP += amount` | как `buy` |
| **CHIP OUT** (отдал) | `NEP -= amount` | как `cashout` |

Пересчёт **Drop R / Drop V / Recycled** идёт по той же формуле NEP-split (`src/lib/nep-split.ts`) — Chip In при отрицательном NEP уйдёт в **Recycled**, как обычный buy.

### Пример (закрытие «дыры»)

Player A отдал фишку 1M Player B, B пошёл в кассу за cashout 1M:

| Шаг | A: NEP | B: NEP | B: Drop R |
|---|---|---|---|
| Pit фиксирует transfer | −1M | +1M | 0 |
| B → cashout 1M | −1M | 0 | 0 |

Результат: A в минусе на 1M (унёс фишку), B чисто 0, никакого «фейк-плюса» и никакого ложного Drop R.

### База данных

Новая таблица `chip_transfers`:

```
id uuid PK
casino_id uuid NOT NULL
shift_id uuid NOT NULL              -- auto-fill из открытой смены
table_id uuid NULL                  -- опционально, где произошло
pair_id uuid NOT NULL               -- общий ID для двух связанных строк
direction text NOT NULL CHECK (direction IN ('in','out'))
player_id uuid NOT NULL
counterparty_player_id uuid NOT NULL  -- обязательно (парность)
amount bigint NOT NULL CHECK (amount > 0)
chips jsonb NULL                    -- опц. разбивка по номиналам
note text DEFAULT ''
operator_id uuid NOT NULL
created_at timestamptz DEFAULT now()
```

**RLS:**
- INSERT: `pit OR manager`, `casino_id = get_user_casino_id(auth.uid())`, `operator_id = auth.uid()`
- SELECT: казино-пользователи свои; super_admin/FM глобально; surveillance read-only по доступным
- UPDATE/DELETE: запрещены (immutable trigger как у `transactions`)

**Триггеры:**
1. `validate_chip_transfer` — проверки: сумма > 0, два игрока разные, оба существуют в этом казино, shift открыт, парная запись с тем же `pair_id` создаётся атомарно.
2. `prevent_chip_transfer_modify` — block UPDATE/DELETE.
3. `auto_log_chip_transfer` — пишет в `activity_logs` (`category='player'`, action `CHIP_TRANSFER_IN/OUT`).
4. `sync_attach('chip_transfers')` — для multi-casino sync engine.
5. `ensure_visit_on_chip_transfer` — если у игрока нет открытого визита сегодня, создать (как `ensure_visit_on_transaction`), чтобы он попал в Player Statistics.

### Атомарность парной записи

Через RPC `create_chip_transfer_pair(from_player, to_player, amount, table_id, chips, note)` — внутри транзакции INSERT обеих строк с одним `pair_id = gen_random_uuid()`. Если одна падает — обе откатываются. RPC доступна `pit` и `manager`.

Альтернатива (отбрасываем): два отдельных INSERT с клиента — риск рассинхрона при падении сети между запросами.

### NEP-split: расширение

`src/lib/nep-split.ts` уже принимает массив транзакций и считает NEP. Меняем его сигнатуру так, чтобы на вход шёл **унифицированный поток событий**: `{ created_at, type: 'in'|'out', amount }`. Отдельный helper мерджит `transactions` + `chip_transfers` (CHIP IN → 'in', CHIP OUT → 'out') и сортирует по времени.

Затронутые места (используют сейчас сырые транзакции для NEP):
- `src/components/pit/ActivePlayers.tsx` (`playerSplits` useMemo)
- `src/hooks/use-drop-split.ts`
- `src/components/player/PlayerVisitsBreakdown.tsx`
- `src/pages/Dashboard.tsx`, `src/pages/Tables.tsx`
- `src/pages/PlayerProfile.tsx`

Все они переходят на единый helper `mergeFinancialEvents(transactions, chipTransfers)` → `nepSplit(events)`.

### UI

**1. ChipTransferDialog (новый компонент)** — `ResponsiveDialog` (mobile = bottom drawer):
- From player (текущий игрок, locked)
- To player (autocomplete по присутствующим в казино сегодня; toggle «Show all players» с предупреждением)
- Direction radio: `Give chips out` / `Receive chips in` (определяет, кто `from`/`to`)
- Amount (number-input + быстрые кнопки 100k / 500k / 1M)
- Optional note
- Submit → RPC `create_chip_transfer_pair` через `offlineMutation`

**2. Точки входа («везде»):**
- **Floor Map → SeatedPlayerChip** (`src/components/pit/SeatedPlayerChip.tsx` / в `TableSeatingDialog`) — пункт меню «Chip Transfer» рядом со «Stop session» / «Change avg bet».
- **Player Statistics** (`src/pages/PlayerStatistics.tsx`) — иконка `ArrowLeftRight` в строке игрока (видна pit/manager). Открывает диалог с pre-filled `from = player`.
- **Player Profile** (`src/pages/PlayerProfile.tsx`) — кнопка в action-баре «Chip Transfer» + новый раздел истории Chip Transfers (lifetime).

**3. Player Statistics: новые колонки** (только для `canSeePlayerFinancials`):

```
| Player | Pos | Entry | Exit | Avg | In | Out | Chip In | Chip Out | Chip Δ | Result |
```

- **Chip In/Out** — суммы за сегодня (визит)
- **Chip Δ** = ChipIn − ChipOut, окрашен `cms-amount-positive/negative`
- **Result** теперь = `(In + ChipIn) − (Out + ChipOut)` — единый итог через NEP

**4. Player Profile / PlayerVisitsBreakdown** — добавить lifetime суммы Chip In, Chip Out, Chip Δ в существующий breakdown; список последних chip-transfers с counterparty.

### Что НЕ затрагивается

- **Касса** (cash counts, wallets, financial reconciliation) — chip_transfers не пишут в `transactions`, не двигают кошельки
- **Chip inventory / conservation law** — фишки физически в казино, просто сменили владельца, ничего не меняется
- **Shift close, daily review, expenses, miss chips** — никаких эффектов
- **Drop V со столов (Table Tracker)** — без изменений

### Файлы

**Новые:**
- `supabase/migrations/<ts>_chip_transfers.sql` — таблица, RLS, триггеры, RPC `create_chip_transfer_pair`, `sync_attach`
- `src/hooks/use-chip-transfers.ts` — `useChipTransfers(date?)`, `useCreateChipTransferPair()`
- `src/components/player/ChipTransferDialog.tsx`
- `mem://features/chip-transfers` — правила и связь с NEP

**Изменяются:**
- `src/lib/nep-split.ts` — обобщить до event-stream + добавить `mergeFinancialEvents()`
- `src/hooks/use-drop-split.ts` — подмешать chip_transfers
- `src/pages/PlayerStatistics.tsx` — 3 новые колонки + кнопка ChipTransfer + Result через NEP
- `src/pages/PlayerProfile.tsx` + `src/components/player/PlayerVisitsBreakdown.tsx` — lifetime Chip In/Out/Δ + история
- `src/components/pit/ActivePlayers.tsx` — `playerSplits` через единый helper
- `src/components/pit/SeatedPlayerChip.tsx` (или меню в `TableSeatingDialog.tsx`) — пункт «Chip Transfer»
- `src/pages/Dashboard.tsx`, `src/pages/Tables.tsx` — пересчёт Drop через единый helper
- `src/integrations/supabase/types.ts` — авто

### Оффлайн / Sync

- RPC `create_chip_transfer_pair` идёт через `offlineMutation` с типом `rpc` (или мы делаем два INSERT в одной выкладке — но безопаснее RPC). Для оффлайна — допускаем два связанных INSERT с одним `pair_id`, валидация парности на чтение (warning если одиночка > 5 минут).
- `sync_capture_change` через стандартный `sync_attach('chip_transfers')` подхватит автоматически в multi-casino topology.

### Memory

- Новый `mem://features/chip-transfers` (Operations) — правила парности, влияние на NEP, доступ pit/manager.
- Обновить `mem://features/nep-drop-split` — добавить ссылку на chip_transfers как часть event-stream.
- Core-rule добавить: «Chip Transfer = парная транзакция (CHIP IN ↔ CHIP OUT), влияет на NEP/Drop, не влияет на кассу/инвентарь».
