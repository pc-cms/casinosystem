
## Логика — три кнопки

**Chip Count** (есть, не меняем)
- Снапшот текущего состояния столов в `chip_snapshots`. Не влияет на закрытие.
- Первый Chip Count смены = автозаполнение из `chip_baseline` (стартовые флоты), Pit правит только то, что отличается.

**Close Table** — модалка по столам (одна на все столы)
- Пит проходит столы по очереди, по каждому жмёт **Save** → следующий стол.
- **Предзаполнение**: инпуты подгружаются из последнего `chip_snapshots` этого стола за смену; если снапшотов нет — из `chip_baseline`.
- Save для стола: пишет `gaming_tables.closing_chips` + `closing_result` + добавляет запись в `chip_snapshots` (для аудита и для следующего Chip Count). **Стол визуально помечается как "Closed" в модалке** (галочка), но `status` остаётся `open`.
- Reopen внутри модалки — только через **Manager Access** (`ManagerOverrideDialog`). Очищает `closing_chips`/`closing_result` для этого стола, можно посчитать заново.
- Когда **все столы в смене имеют `closing_result`** — становится активной кнопка **"Tables Close"** в шапке модалки. Жмём → ставит `gaming_tables.status='closed'` всем столам разом → закрывает модалку. С этого момента Cage видит готовые результаты.
- Если хотя бы один стол ещё не посчитан — кнопка дизейблена с подсказкой "X tables remaining".

**Close Shift** (Cashier, существующее) — без изменений в Pit. Cashier подтверждает финальный возврат флотов и пишет shift result.

### Ключевая разница с предыдущим планом
Никаких "draft" сущностей, никаких новых полей в БД. Используем существующие `gaming_tables.closing_chips` и `closing_result` ровно как сейчас, просто меняем UX: одна модалка-визард по всем столам вместо bulk-сетки, с предзаполнением из последнего snapshot.

---

## Структура Pit (финал)

Sidebar:
```text
Pit
├── Breaklist
├── Tables          ← здесь три кнопки: Chip Count | Close Table | (Tables Close)
├── Table Tracker
├── Player Tracker
├── Active Players
├── Rota
└── Attendance
```

Employee List убран из Pit, переезжает в HR.

Кнопки на странице Tables (шапка):
- **Chip Count** (outline) — открывает существующий count UI в режиме snapshot.
- **Close Table** (default) — открывает новую модалку-визард.
- **Open All** (outline) — как сейчас, для повторного открытия закрытых столов в начале смены.

---

## Технические задачи

1. **`src/components/tables/CloseTableWizard.tsx`** (новый) — модалка-визард:
   - Левая колонка: список столов смены с галочкой "посчитан / не посчитан" + кликом перейти к любому.
   - Правая часть: текущий стол — read-only baseline сверху, инпуты по деноминалам (предзаполнены из последнего snapshot или baseline), live `Result = Σ(actual − baseline) × denom`.
   - Кнопки: `Save & Next`, `Save`, `Reopen` (требует Manager Access если уже сохранён).
   - Шапка: прогресс `3 / 8 tables counted` + кнопка `Tables Close` (активна когда `counted === total`).

2. **`use-table-lifecycle.ts`**:
   - `useSetSingleTableResult({ tableId, closing_chips, closing_result })` — атомарно update `gaming_tables` + insert в `chip_snapshots` для аудита.
   - `useReopenSingleTable(tableId)` — clear `closing_chips`/`closing_result` (для случая «пересчитать»).
   - `useCloseAllTables` уже есть — переиспользуем для финального "Tables Close".

3. **`Tables.tsx`** — заменить текущий двойной режим (`save` / `result`) на три явные кнопки. Старый общий dialog убрать; Chip Count оставить как есть в режиме snapshot.

4. **`Pit.tsx`** — убрать вкладку Employee, добавить недостающие (если нет) Rota/Attendance/Breaklist как уже существующие маршруты. Применить `PitShell`.

5. **PWA Pit**:
   - `public/manifest-pit.json` — отдельный установщик.
   - В `index.html` swap `<link rel="manifest">` по pathname `/pit`.
   - `src/components/pit/PitShell.tsx` — `InstallPWAButton` + `NetworkStatusIndicator` + `prefetchPitData` при монтировании.
   - `src/lib/pit-prefetch.ts` — warm cache: dealers, tables, baseline, текущий месяц rota/attendance, сегодняшние breaklist/tracker/visits/sessions.

6. **Offline хуки** — добавить `offlineMutation` обёртку:
   - `useSetPitRota`, `useDeletePitRota`, `useSetDealerAttendance` (`use-dealers.ts`)
   - `useStartSession`/`useStopSession`/`useUpdateSession` (вынести в `use-visits.ts`)
   - `useCheckIn`/`useCheckOut`/`useUpdatePosition` (`use-visits.ts`)
   - `useBatchChipSnapshot` (`use-chips.ts`)
   - `useSetSingleTableResult`, `useReopenSingleTable`, `useOpenTable`, `useOpenAllTables`, `useCloseAllTables` (`use-table-lifecycle.ts`)
   - `useAddPlayerTag`, `useRemovePlayerTag` (`use-players.ts`)
   - Insert-операции (snapshots/sessions/visits) — генерим `id: crypto.randomUUID()` на клиенте → идемпотентность при повторе sync.

7. **`AppSidebar.tsx`** — обновить меню Pit.

8. **HR**: перенос Employee List на `/staff` (он уже есть как `Staff.tsx`) — проверить что HR-роль имеет доступ, Pit — нет.

### Памяти после реализации
- `mem://features/live-game-operations` — Pit имеет три кнопки Chip Count / Close Table / Tables Close. Close Table = визард по столам с предзаполнением из последнего snapshot, Reopen через Manager Access. Tables Close активна только когда все столы посчитаны.
- `mem://features/table-closing-persistence` — обновить: closing_chips/closing_result пишутся per-table через визард, status='closed' выставляется только финальной кнопкой Tables Close.
- Employee management — только HR.
- Pit — устанавливаемая PWA с warm cache.

### Миграции БД
Не требуются.
