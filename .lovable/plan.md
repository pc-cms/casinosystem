## Player Statistics — Drop / IN / OUT как суммы

### Что меняется в столбцах
| Столбец | Сейчас | Будет |
|---|---|---|
| **Drop** | Сумма всех CASH IN за день (`buy`+`in`) | NEP **Drop R** за день (только внешний кеш, рециркулированные выигрыши исключены) |
| **In** | Кол-во транзакций (1, 2…) | **Сумма CASH IN** за день (TZS) |
| **Out** | Кол-во транзакций | **Сумма CASH OUT** за день (TZS) |
| C In / C Out / Result | без изменений | без изменений |

Result-формула не меняется: `(out + chipOut) − (cashIn + chipIn)`. Drop теперь чисто аналитический столбец и в Result не входит (как и сейчас — Result считается из `out − inDrop`, где `inDrop` сейчас = total cash-in; после правки переменная просто переименуется в `cashIn`, значение то же).

### Backend
Добавить batch RPC `compute_players_drop_split(_casino_id uuid, _from timestamptz, _to timestamptz)` → `(player_id uuid, drop_r bigint, drop_recycled bigint)`. Логика та же, что в существующих `compute_player_drop_split` / `compute_tables_drop_split`, но возвращает строку на каждого игрока, у которого был cash-in в окне. Это один запрос вместо N — критично для страницы со 100+ игроков.

Версия `package.json` бампается автоматически (новый RPC = backend change).

### Frontend (`src/pages/PlayerStatistics.tsx`)
1. Подключить новый хук `usePlayersDropSplit(windowStart, windowEnd)` в `src/hooks/use-drop-split.ts` (Map<player_id, dropR>).
2. В `rows` добавить поле `dropR = playersDropSplit.get(v.player_id) ?? 0`. Переименовать `inDrop` → `cashIn` для ясности.
3. Шапка / порядок столбцов: `№ / Name / Entry / Left / Pos / Bet / Drop / In / Out / C In / C Out / Result` (как уже есть).
4. Ячейки:
   - `Drop` → `<Money value={r.dropR} />` (вместо cash-in суммы)
   - `In` → `<Money value={r.cashIn} />` (вместо `r.inCount`)
   - `Out` → `<Money value={r.out} />` (вместо `r.outCount`)
5. Total-строка: `Drop` = Σ dropR, `In` = Σ cashIn, `Out` = Σ out.
6. Сортировка: ключи `inDrop` → `dropR`, `inCount` → `cashIn` (числовая), `outCount` → `out` (числовая).
7. Тултипы: Drop = «Drop R — external cash only (NEP)», In = «Total cash in», Out = «Total cash out».
8. Min-width у `In`/`Out` поднять с 50px до 110px (чтобы суммы не резались, как сейчас у Drop).

### Не трогаем
- Player Card (PlayerPreviewHeader) — там уже "Cash In (mo)" корректен.
- Логика Result, Chip Transfers, шапка PageHeader, фильтры.
