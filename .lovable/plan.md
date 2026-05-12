## Цель
Сделать матрицу доступов удобной и предсказуемой: сразу видно что у пользователя реально включено (роль + override), плюс отдельный редактор дефолтов роли, чтобы не править каждого юзера руками. Полная визуальная унификация.

## Что меняем

### 1. Per-user диалог `UserPermissionsDialog` (то что открывается у Тараса)
Сейчас: показывает только override-чекбоксы, role default спрятан в badge "default" — непонятно что включено.

Делаем 5 колонок с явными состояниями:

```text
Module          | Role default          | View | Write | Day depth | Reset
────────────────┼───────────────────────┼──────┼───────┼───────────┼──────
Dashboard       | ✓ View · 7d (manager) | [✓]  | [ ]   | [7d ▾]    | ↺
Cage            | ✓ View+Write · all    | [✓]  | [✓]   | [all ▾]   | ↺
Admin Panel     | ✗ no access           | [ ]  | [ ]   | [today ▾] | ↺
```

- Слева от каждой строки — **реальный baseline роли** (View/Write/horizon), берётся из `role_module_defaults` напрямую (новый запрос по `profile.primary_role`).
- Справа — текущее **эффективное значение** после override (как и сейчас), но с цветной подсветкой:
  - серый = inherit (default)
  - синий = override совпал с дефолтом (бессмысленный override → авто-чистится при Save)
  - оранжевый = override отличается от дефолта
- Шапка диалога: badge с ролью пользователя ("Tarass — Manager") + кнопка "Edit role defaults →" (открывает редактор роли, см. п.2).
- Summary внизу: `12 modules from role · 3 overrides`.

### 2. Новый редактор Role Defaults
Новая вкладка в Admin → Users & Roles → "Role Defaults" (или отдельный sub-tab).

UI: матрица **роли × модули**, по тем же 4 колонкам (View / Write / Day depth) на каждую роль. Редактируется напрямую `role_module_defaults`. Доступно только super_admin.

Сценарий: меняем horizon у `manager.players` с `today` → `30d` — применяется ко всем менеджерам мгновенно (через invalidate `effective_module_perms`).

Также добавляем preset-кнопки в шапке роли:
- "Today only" / "7 days" / "30 days" / "All time" — bulk-set day_horizon на все модули роли.
- "View only" / "View + Write" — bulk write toggle.

### 3. Унификация дизайна
- Per-user диалог и редактор role defaults используют **один и тот же компонент** `<PermissionMatrix>` (рендерит группы Operations/Players/Finance/Reports/System, одинаковые колонки, одинаковые шрифты/высоты).
- Шапки: `PageHeader` + `date` (как везде).
- Календари / select horizon — единый `<HorizonSelect>` компонент с фиксированным набором (Today / 7d / 30d / All).
- Кнопки: один primary `Save`, outline `Cancel`, ghost `↺` reset, согласно design system rules.
- Density-aware (`comfort` для админки).
- Финансовая видимость по-прежнему role-locked, отдельная подсказка в футере (не редактируется).

### 4. Технические детали
- Добавить хук `useRoleModuleDefaults(role)` + `useSetRoleModuleDefaults()` (CRUD в `role_module_defaults`, доступ — super_admin only через RLS).
- В `UserPermissionsDialog` добавить запрос `useRoleModuleDefaults(user.primary_role)` чтобы показать колонку baseline.
- При Save в per-user диалоге автоматически удалять override-строки, где значения совпадают с role default (чтобы не плодить мусор).
- На изменение `role_module_defaults` инвалидируем `my-effective-perms`, `user-effective-perms`, `user-module-overrides` глобально.
- Никаких изменений RPC `effective_module_perms` — она уже мерджит правильно.

## Файлы
- `src/hooks/use-module-permissions.ts` — добавить `useRoleModuleDefaults`, `useSetRoleModuleDefaults`.
- `src/components/admin/PermissionMatrix.tsx` — новый общий компонент.
- `src/components/admin/UserPermissionsDialog.tsx` — переписать на `PermissionMatrix` + baseline колонка + ссылка на role defaults.
- `src/components/admin/RoleDefaultsEditor.tsx` — новый, для super_admin.
- `src/pages/Admin.tsx` — новая вкладка "Role Defaults" (только super_admin).
- Миграция не нужна — таблицы уже есть.

## Что НЕ трогаем
- Бизнес-логику financial visibility (role-locked).
- RPC `effective_module_perms`.
- Sidebar gating логику.
