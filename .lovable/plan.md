## Goal

Глобальное правило: на casino-домене (`arusha.`, `mwanza.`, `dodoma.`, `mbeya.`) **все модули и все роли** видят данные ТОЛЬКО этого казино. Сетевая (cross-casino) видимость остаётся ровно в двух местах:

1. Домен `premier.casinosystem.app` — сводка для Super Admin / Finance Manager / Surveillance.
2. На любом casino-домене — раздел **Admin → Network panels** (Network Health, Server Push, межсайтовый Sync) у Super Admin. Сам список **Users & Roles** — тоже per-domain.

## Что меняется

### 1. Per-domain data filter (ядро)

`src/lib/casino-context.tsx`
- Сегодня для super_admin / finance_manager / surveillance включается «глобальный» режим вне зависимости от субдомена. Меняем правило:
  - `isSummaryMode` — оставляем только при `detectedSlug === "__premier__"` для super_admin / finance_manager / surveillance.
  - На любом casino-субдомене эти роли получают `activeCasinoId = casino, найденный по slug`. `overrideCasinoId(activeCasinoId)` уже распространит это в auth-context, и все хуки (`use-players`, `use-shift`, `use-tables`, `use-finance`, `use-payroll`, `use-staff`, `use-expenses`, `use-cage-transfers`, `use-bank-checks`, `use-attendance-monthly`, `use-business-day-history`, `use-dealers`, `use-incidents`, `use-import-reports` …) автоматически начнут отдавать данные одного казино.
  - `accessibleCasinos` для премьер-ролей всё ещё грузим целиком (нужны для свитчера и для лейблов).

### 2. Хуки, где сейчас явный «role-bypass»

Заменить логику `isSuperOrFM ? "все" : activeCasinoId` → **всегда** `activeCasinoId` (а в premier-summary — отдельная ветка по `isSummaryMode`):
- `src/components/admin/users/users-hooks.ts` → `useUsersProfiles`
- `src/pages/Admin.tsx` → запрос `all-profiles` (используется в network-панелях; оставляем «все» только при `isSummaryMode`, иначе фильтр по `activeCasinoId`)
- `src/hooks/use-transfers.ts` → межказиновские трансферы остаются «все» только в premier; на домене Arusha показываем переводы, где `from_casino_id = arusha OR to_casino_id = arusha`.

### 3. Users & Roles — per-domain

`src/components/admin/users/users-hooks.ts` + `UsersTab.tsx`:
- `useUsersProfiles` всегда фильтрует по `activeCasinoId`, кроме premier.
- На premier-домене — текущее поведение «все казино».
- Колонка **Casino** скрывается на casino-домене (она избыточна, всё равно одно казино) и показывается только в premier-режиме.

### 4. Группировка пользователей с мульти-доступом (CCTV кейс)

Сейчас, если у surveillance-юзера в `user_casino_access` 4 казино, а в `profiles.casino_id` — primary, на премьере он показывается 1 раз, на Arusha-домене — 1 раз (только если primary совпал). Реальная проблема пользователя: в каком-то списке он дублируется.

Меняем `useUsersProfiles`:
- Грузим за один заход:
  - `profiles` (по правилу выше),
  - `user_casino_access` (только для тех же `user_id`).
- Возвращаем массив `Profile & { casino_ids: string[] }` — **уникальные** строки на user.
- Фильтр «принадлежит этому казино» применяем как:
  `primary_casino_id === activeCasinoId || casino_ids.includes(activeCasinoId)`.
  Это значит, surveillance с доступом к Arusha будет виден на Arusha-домене, даже если его primary — Mwanza. И ровно одной строкой.
- В `UsersTab` колонка Casino (только на premier) показывает primary жирным + остальные через запятую. На casino-домене колонка скрыта.

### 5. Sidebar / индикаторы

`src/components/layout/AppSidebar.tsx`:
- Лейбл «All Casinos» оставляем только на premier. На casino-домене у super_admin тоже показываем имя текущего казино (никакого «All Casinos» вне premier).

### 6. Что НЕ трогаем

- Network Health Panel, Server Push, Inter-Casino Sync — это и есть «общая информация» Admin'а; остаются как есть (читают все казино).
- Finance Summary Dashboard — живёт только в premier-режиме.
- Edge functions, RLS, миграции — без изменений: серверные политики и так разрешают super_admin/FM кросс-доступ; мы просто перестаём этим пользоваться в UI.
- Пагинации, бизнес-день, цвета, формы — не трогаем.

## Технические заметки

- Один общий helper в `casino-context.tsx`: `effectiveScope: "single" | "summary"`. Это явно проще, чем держать `hasGlobalAccess` + `isSummaryMode` параллельно. Все «обходы» удаляются из вызывающих хуков и заменяются на `activeCasinoId`.
- `useUsersProfiles` переписать на 2 запроса (`profiles` + `user_casino_access`) и схлопывание в Map. Возврат: `Array<Profile & { casino_ids: string[] }>`. Тип расширяется в том же файле.
- Тесты: `src/test/access-matrix.test.ts` — пробежать глазами; добавить кейс «super_admin на arusha видит только arusha».

## Файлы, которые правим

- `src/lib/casino-context.tsx`
- `src/components/admin/users/users-hooks.ts`
- `src/components/admin/users/UsersTab.tsx`
- `src/pages/Admin.tsx` (запрос профилей)
- `src/hooks/use-transfers.ts`
- `src/components/layout/AppSidebar.tsx` (лейбл)
- `package.json` — bump patch (поведение фильтрации = backend-relevant правило).

## Out of scope

Любые изменения в RLS, edge functions, миграциях, бизнес-логике модулей.
