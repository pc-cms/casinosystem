Проверка показала две разные вещи:

1. Права Pit на `breaklist` в базе есть. Политика INSERT разрешает `pit` и `manager` писать строки своего casino_id. То есть это не CCTV-проблема и не запрет Surveillance.
2. В интерфейсе Breaklist сейчас явно отключено автозаполнение BR:

```text
// Parent controls (Refresh/Accept) are no longer auto-filling BR — disabled.
onRegisterRefresh?.(() => {});
onRegisterAccept?.(() => {});
```

Поэтому от Pit “Брейк не заполняется”: кнопки/коллбеки есть в структуре страницы, но фактически они зарегистрированы как пустые функции. Ручной клик по одной клетке должен работать, но массовое/автоматическое заполнение Break сейчас отключено.

План исправления:

1. Вернуть заполнение Breaklist от Pit
   - В `BreaklistGrid` восстановить рабочую логику для `Refresh` / `Accept` вместо пустых функций.
   - Заполнение будет создавать `BR` только в пустых клетках.
   - Не трогать уже занятые клетки: столы, инспекторы, sick, training, sorting, closing.
   - Не трогать locked-клетки без manager-доступа.
   - Pit Bosses по-прежнему не попадают в Breaklist grid.

2. Вернуть/подключить кнопки управления в Pit header
   - В `Pit.tsx` проверить и восстановить кнопки `Refresh` / `Accept` для вкладки Breaklist, чтобы они реально вызывали `breaklistRefreshRef.current()` и `breaklistAcceptRef.current()`.
   - Оставить текущий zoom-контроль.
   - Для Surveillance эти действия не должны быть доступны как write-action; CCTV остаётся read-only.

3. Защитить запись от тихих ошибок
   - В `useSetBreaklistCell` после ошибки показывать реальную причину в toast/log, а не только общий `Sync error`.
   - После успешной записи инвалидировать/обновлять query `breaklist`, чтобы данные не оставались только в optimistic cache.
   - Если запись ушла offline, оставить текущую write-and-sync модель.

4. Уточнить роль `TR`, `SRT`, `CLS`
   - Сейчас UI предлагает `TR`, `SRT`, `CLS`, но enum `dealer_role` в базе содержит только: `AR`, `AR1`, `AR1c`, `AR1i`, `ARc`, `ARi`, `BJ`, `BJi`, `BR`, `P`, `Pi`, `S`.
   - Поэтому при выборе `TR/SRT/CLS` база может отказывать с invalid enum value.
   - Исправление: либо убрать эти кнопки из UI, либо миграцией добавить их в enum. Так как проект придерживается ручного аудита и эти роли уже видны в UI, я предлагаю добавить enum-значения `TR`, `SRT`, `CLS` миграцией.
   - Это backend change, значит после миграции будет patch bump версии package.json.

5. Проверить RLS без расширения прав CCTV
   - Оставить `surveillance` только SELECT для `breaklist`.
   - Не добавлять CCTV insert/update.
   - Pit/Manager остаются единственными ролями, кто может заполнять Breaklist.

6. Проверка после внедрения
   - Pit-пользователь на сегодняшнем business day видит сотрудников из Rota M/N/E.
   - Нажатие ручного `BR` пишет одну клетку.
   - `Refresh/Accept` заполняет пустые клетки `BR` согласно логике, не перетирая существующие назначения.
   - Ошибки RLS/enum больше не маскируются общим сообщением.

Файлы, которые будут изменены:
- `src/components/pit/BreaklistGrid.tsx`
- `src/pages/Pit.tsx`
- `src/hooks/use-dealers.ts`
- `supabase/migrations/...sql` для enum `dealer_role`, если подтверждаем `TR/SRT/CLS`
- `package.json` patch version bump из-за backend change