## Цель

Заменить текущую таблицу `Active Players` визуальной **картой столов** в стиле floor management. Каждый стол — карточка с компактным списком сидящих игроков, hover показывает полные имена, клик открывает диалог управления посадкой и пересадкой. Drag & drop карточек игроков между столами на десктопе, кнопка Move в диалоге для тача.

## UX

```text
┌─ Active Players · Floor Map ──────── [search] [filters] ─┐
│                                                          │
│ ┌─ AR/BJ ──────────┐  ┌─ Poker ──────────┐               │
│ │ ┌─ AR1 ─┐ ┌─ AR2─┐│  │ ┌─ P1 ─┐ ┌─ P2 ─┐               │
│ │ │ J.D 50│ │empty ││  │ │ M.K  │ │ A.B  │               │
│ │ │ M.K100│ │      ││  │ │ T.N  │ │      │               │
│ │ │+1 more│ │      ││  │ └──────┘ └──────┘               │
│ │ └───────┘ └──────┘│  └──────────────────┘               │
│ └───────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
```

- Карточка стола: имя стола, игра, счётчик `N players`, до 3-4 игроков превью (категория-цветной dot + инициалы + avg bet).
- Hover на карточке стола → tooltip со всем списком игроков и их avg bet.
- Hover на игроке → tooltip с полным именем, временем сессии, dropR.
- Клик на стол → диалог `TableSeatingDialog`.
- Закрытые столы (`status='closed'`) показываются disabled / приглушённо, посадка заблокирована.

## Диалог TableSeatingDialog

`ResponsiveDialog` с заголовком `<TableName> · <Game>`. Внутри:

1. **Currently seated** — список текущих игроков стола: имя, категория, avg bet, время игры. У каждого: `Edit bet`, `Move →`, `Stop session`.
2. **Add player** — поиск среди игроков-чек-инов, не сидящих за столом; ниже — поиск по всем активным игрокам (триггерит check-in + посадку, использует существующий `guardCheckIn`).
3. **Move from another table** — выпадающий список других столов с игроками, выбор игрока + новый avg bet.

Все мутации повторно используют существующие хуки из `ActivePlayers.tsx`: `placeAtTable`, `changeTable`, плюс новый `stopSession` (update `client_sessions.stopped_at`).

## Drag & Drop

- Используем нативный HTML5 DnD (минимальная зависимость, без новых пакетов).
- Игрок-чип `draggable`, переносит `playerId` через `dataTransfer`.
- Карточка стола — drop target. На drop открывается компактный inline-prompt avg bet → вызывает `changeTable`.
- На тач-устройствах drag отключён (определяем `'ontouchstart' in window`), используется кнопка Move в диалоге.

## Фильтры в шапке

Сохраняем существующие: search, category filter. Убираем фильтр type (`table/mix/slots`) — карта показывает только gaming tables. Игроки type=`slots`/`mix` без активной сессии не отображаются на этом виде (по решению пользователя).

## Технические детали

- **Файлы**:
  - переписать `src/components/pit/ActivePlayers.tsx` → новый Floor Map layout (рендер сетки столов).
  - новый `src/components/pit/FloorTableCard.tsx` — карточка стола с превью игроков, drop target.
  - новый `src/components/pit/TableSeatingDialog.tsx` — диалог с tab/секциями Seated / Add / Move.
  - новый `src/components/pit/SeatedPlayerChip.tsx` — draggable чип игрока с tooltip.
- **Данные**: используем уже подгружаемые `players`, `gaming_tables`, `client_sessions`, `casino_visits`, `player_tags`. Группировка `activeSessionsByTable` через `useMemo`.
- **Realtime**: ничего не меняем — уже есть `refetchInterval: 15000` на `client_sessions`/`casino_visits`.
- **Mutations**: переиспользуем `placeAtTable`, `changeTable`, `checkOut`, добавляем `stopSession` (по образу `changeTable`'s stop branch).
- **Layout**: PageShell + PageHeader (icon `LayoutGrid`), сетка столов через flex/grid, две колонки `AR/BJ` и `Poker` как на странице `/tables` для консистентности.
- **Mobile**: одна колонка, карточки столов по ширине; bottom drawer вместо dialog (через `ResponsiveDialog`).
- **Empty seats**: пустой стол показывает плейсхолдер `· · ·` и подпись `No players` (в стиле grid-placeholders).
- **Категории**: цветной dot слева от имени по `CategoryBadge` цвету.
- **Closed tables**: `opacity-50`, drop disabled, клик показывает toast «Table is closed».
- **Старая таблица**: полностью заменяется. Если понадобится откат — берём из git-истории.

## Что НЕ меняется

- БД, RPC, RLS, триггеры — без изменений.
- Логика `guardCheckIn`, blacklist, cross-casino concurrency — переиспользуется как есть.
- Маршрут `/active-players` остаётся, меняется только содержимое.
- Reception / In-Casino модули не затрагиваются.
