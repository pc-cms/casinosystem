## Проблема

Фронт и БД переключают бизнес-день в разное время:

- **БД**: `business_day_closures` (ручное закрытие Pit/Manager **или** авто-закрытие в 11:00 EAT) → RPC `get_current_business_date` возвращает новую дату сразу.
- **Фронт**: legacy `getBusinessDate()` из `src/lib/business-day.ts` — hardcoded fallback на **13:00 EAT**.

Результат: между моментом закрытия дня (например, 09:30 ручное или 11:00 авто) и 13:00 EAT все дешборды/страницы показывают старые данные «текущего дня», хотя в БД день уже сменился. В 11:00 пользователь видит «обнуление» некоторых блоков, потому что часть запросов уже идёт по новой дате (через `useBusinessDayFilter` → RPC), а часть — по старой (через `getBusinessDate()`).

Хук `useEffectiveBusinessDate()` уже существует в `src/hooks/use-business-day-closure.ts` и корректно ходит в RPC. Нужно перевести все операционные surface'ы на него.

## Что меняем

### 1. Dashboard (главная цель)

`src/pages/Dashboard.tsx` — заменить:
```ts
const businessDate = getBusinessDate();
```
на:
```ts
const { data: serverBusinessDate } = useEffectiveBusinessDate();
const businessDate = serverBusinessDate || getBusinessDate();
```

Все нижележащие хуки (`useTransactions`, `useExpenses`, `useTableTracker`, `useChipSnapshots`, `useStaffRotaRange`, `useCashless`, `useClientSessionsTotalBet`) автоматически переключатся на новую дату.

### 2. Операционные страницы (та же замена)

- `src/pages/Tables.tsx` (строки 35, 52)
- `src/pages/TableTracker.tsx` (48)
- `src/pages/TablesAnalytics.tsx` (80)
- `src/pages/Expenses.tsx` (58)
- `src/pages/Cashless.tsx` (55)
- `src/pages/Groups.tsx` (23)
- `src/pages/PlayerStatistics.tsx` (44)
- `src/pages/Reception.tsx` (101)
- `src/pages/Pit.tsx` (68) — `Pit.tsx:856` уже правильно использует `effectiveBusinessDate`
- `src/pages/Staff.tsx` (86) — `Staff.tsx:918` уже использует `effectiveBusinessDate`
- `src/components/BusinessDayBanner.tsx` (31)
- `src/components/cage/PlayerInfoCard.tsx` (22)
- `src/components/cage/CageHistoryView.tsx` (38)
- `src/components/cage/ActivePlayersList.tsx` (22)
- `src/components/cage/ActiveShiftView.tsx` (89)
- `src/components/cage/CloseShiftDialog.tsx` (75)
- `src/components/pit/ActivePlayers.tsx` (24)
- `src/components/layout/PageHeader.tsx` (48) — date prop helper

Везде паттерн один:
```ts
const { data: serverDate } = useEffectiveBusinessDate();
const today = serverDate || getBusinessDate();
```

### 3. Хуки/утилиты (НЕ трогаем)

- `src/lib/business-day.ts` — `getBusinessDate()` остаётся как fallback (без сети, мгновенный).
- `src/hooks/use-business-day-filter.ts` — уже корректно использует RPC.
- `src/hooks/use-transactions.ts:71`, `use-visits.ts:18`, `use-prefetch.ts:54`, `use-table-lifecycle.ts:165`, `lib/pit-prefetch.ts:22` — используют `getBusinessDate()` как **default параметра**, когда вызывающий не передал дату. Оставляем — вызывающие компоненты теперь будут передавать корректную дату из `useEffectiveBusinessDate()`.
- `src/test/business-logic.test.ts` — тесты, не трогаем.

### 4. FinanceDashboard

`src/components/finance/FinanceDashboard.tsx` использует `new Date().toISOString().slice(0,10)` (UTC), а не `getBusinessDate()`. Это отдельный баг (UTC ≠ EAT), но **в эту задачу не входит** — финансовые дешборды работают по календарной дате, не по бизнес-дню. Если хочешь — отдельной задачей.

## Поведение после фикса

- Pit/Manager закрывает день вручную в 09:30 → `business_day_closures` insert → RPC возвращает новую дату → через ≤60 сек (`refetchInterval`) Dashboard и все операционные страницы показывают пустой новый день (старый ушёл в `/business-days`).
- Авто-закрытие в 11:00 EAT → то же поведение, без рассинхрона до 13:00.
- Если RPC временно недоступен → fallback на `getBusinessDate()` (legacy 13:00) — поведение как сейчас.

## Технические детали

- `useEffectiveBusinessDate()`: `staleTime: 60_000`, `refetchInterval: 60_000` — задержка переключения до 1 минуты, что приемлемо.
- На первом рендере `data` будет `undefined` → fallback на `getBusinessDate()` → UI не мигает.
- Версия `package.json` — патч-бамп **не нужен** (нет backend changes, только клиент).

## Файлы изменены

~17 файлов, везде одинаковая 2-строчная замена. Без миграций, без RPC, без edge functions.