## Проблема

На страницах Finance вылетает `Cannot read properties of null (reading 'toLocaleDateString')`.

Причина — `src/lib/format-date.ts`:

```ts
const parts = (input: string | Date) => {
  const d = typeof input === "string"
    ? (input.length === 10 ? new Date(input + "T12:00:00Z") : new Date(input))
    : input;        // <-- если input === null → d === null
  const date = d.toLocaleDateString(...) // 💥
}
```

Когда из БД приходит строка с `business_date: null` / `created_at: null` / `closed_at: null` (например, незаполненная запись wallet_tx, money_change, audit), `fmtDate(null)` ломает рендер и вся страница падает в ErrorBoundary.

## План фикса (узко, без переделок страниц)

Сделать все хелперы форматирования дат null-safe.

### Файл: `src/lib/format-date.ts`

1. Расширить тип входа во всех `fmt*` функциях на `string | Date | null | undefined`.
2. В начале каждой функции (`fmtDate`, `fmtDateTime`, `fmtDateOnly`, `fmtTime`, `fmtWeekdayShort`, `fmtDayMonth`, `fmtDayMonthTime`, `fmtMonthYear`, `fmtDateLong`) добавить guard:
   ```ts
   if (input == null || input === "") return "—";
   ```
3. В `parts()` отдельно проверить: если `typeof input === "string"` и строка пустая/невалидная (`isNaN(d.getTime())`) — вернуть placeholder.
4. Возвращаемый placeholder — `"—"` (уже используется по проекту в таблицах).

### Что не трогаем

- Сами страницы Finance, компоненты, запросы — изменений не требуется.
- Логика форматирования валидных дат не меняется.
- Бэкенд, миграции, RPC — не затрагиваются (версия `package.json` не бампается).

### Проверка

- Открыть Finances Dashboard / Wallets / Money Change / Audit Log / Day Closing — страницы не должны падать даже при наличии `null`-дат.
- Валидные даты по-прежнему рендерятся в формате `DD/MM/YYYY` / `DD/MM/YYYY HH:mm`.
