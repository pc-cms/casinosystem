
## Цели

1. Цвета фишек — изменения должны мгновенно применяться у всех пользователей казино (без перезагрузки и кнопок «force update»).
2. Управление пользователями — нормальный интерфейс-таблица вместо обрезанной модалки, с понятным созданием/редактированием и поддержкой 2-3 ролей на одного пользователя.
3. Структурная проблема «правлю одну роль — ломается другая» — решается выделением роле-специфичных view-компонентов с явными границами.

---

## 1. Realtime для цветов фишек

**Проблема.** `useChipColors` кэшируется на 5 минут (`staleTime`) и не подписан на изменения. Поэтому Pit/Cashier видят старые цвета пока не перезайдут.

**Решение (без новых таблиц, без триггеров).**
- Включить realtime на таблице `chip_color_settings` (миграция: `ALTER PUBLICATION supabase_realtime ADD TABLE chip_color_settings; ALTER TABLE chip_color_settings REPLICA IDENTITY FULL;`).
- В `use-chip-colors.ts` добавить `useEffect` с подпиской на канал `chip_color_settings:{casinoId}` событий `INSERT/UPDATE/DELETE`, который вызывает `qc.invalidateQueries(['chip_color_settings', casinoId])`.
- Снять `staleTime: 5min` (оставим дефолт), чтобы инвалидация всегда тянула свежее.
- Аналогично подписаться на `chip_baseline` и `chip_initial_baseline` если они тоже видны другим — проверим по `prefetchPitData` (только цвета сейчас в скоупе).

Никаких кнопок «force update» — обновление приходит само в течение 1-2 секунд.

---

## 2. Управление пользователями

**Проблема.** Сейчас `UsersAndRoles` — одна страница: верх — селекторы для назначения роли существующему юзеру, ниже — таблица, отдельно — обрезанная модалка `Create User` (max-w-sm). Редактирование роли = удалить + добавить через кнопки-иконки. Неудобно.

**Что меняем (без переписывания backend — `create-user` edge function уже принимает массив ролей):**

### 2.1 Новая страница `/admin/users` (выделяем из таба)
Структура:
- **Заголовок** + кнопка `+ New User` (открывает большой `ResponsiveDialog`, не `max-w-sm`).
- **Поиск/фильтр** (по имени, по роли, по казино — для super_admin/FM).
- **Таблица** (DataTable) с колонками:
  - Display Name + login (мелким шрифтом)
  - Casino (для super_admin/FM)
  - Roles — chips (бейджи всех ролей пользователя)
  - Created at
  - Actions: **Edit** (карандаш), **Permissions** (только для super_admin), **Reset password**, **Deactivate**

### 2.2 Диалог создания/редактирования (один компонент `UserEditorDialog`)
- Размер `lg` (через `ResponsiveDialog` — на мобильном автоматически Drawer, как требует дизайн-система).
- Поля: Login (только при создании, фикс), Display Name, Password (только при создании / при reset), Casino (только super_admin), **Roles — мультиселект чекбоксами** в две колонки (как уже сделано), Module Permissions кнопка переход в существующий `UserPermissionsDialog`.
- Сохранение: для нового — вызов `create-user` edge function с `roles: string[]` (уже поддерживается). Для редактирования — diff текущих ролей и применение `INSERT/DELETE` в `user_roles` (нужен новый RPC `update_user_roles(_user_id uuid, _roles app_role[])` чтобы атомарно: проверка прав caller + delete missing + insert new — миграция).

### 2.3 Несколько ролей одному юзеру — да, поддерживается
БД уже устроена правильно: таблица `user_roles` с `unique(user_id, role)` позволяет любое количество ролей. Функция `has_role()` работает по OR. Все RLS-политики уже OR-ятся через `has_role`. Просто UI это не показывал нормально — теперь показывает.

Caveat: некоторые места в коде определяют «основную роль» (например, для редиректа после логина или для иконок в сайдбаре). Проверим `useAuth`/`auth-context.tsx` — `roles: string[]` уже массив, так что критично только то, как UI выбирает «главную». Если есть приоритет (manager > pit > cashier > …), оставим как есть. Если есть проверки `roles[0] === 'pit'` — поправим на `roles.includes('pit')`.

---

## 3. Структурная проблема «правлю одну роль — ломается другая»

**Корневая причина.** `src/pages/Admin.tsx` — 993 строки, всё в одном файле. UI решает «что показывать» через ветви `if (isSuperAdmin) { ... } else if (isManager) { ... }` внутри одних и тех же таблиц/диалогов. Меняешь колонку «для менеджера» — задеваешь super-admin-сценарий потому что они физически разделяют JSX. Это не проблема БД (БД уже разделяет права через RLS + `has_role`). Это проблема **архитектуры компонентов**.

**Принцип фикса.** Каждая роль получает **свой view** — отдельный файл/компонент. Общие куски — вынесены в маленькие presentational-компоненты, не в «умные» с условиями.

**Конкретный рефакторинг** (без изменения БД, кроме п. 2.2 RPC):

```
src/pages/Admin.tsx   →  тонкий «роутер табов»: выбирает какие табы показать на основе ролей
src/components/admin/
  ├── tabs/
  │   ├── UsersTab.tsx           (новая большая страница из п.2)
  │   ├── CasinosTab.tsx         (только super_admin)
  │   ├── CasinoAccessTab.tsx    (только super_admin)
  │   ├── LocalServersTab.tsx    (только super_admin)
  │   ├── NetworkTab.tsx         (только super_admin)
  │   ├── ScheduleTab.tsx        (manager + super_admin)
  │   ├── TablesTab.tsx          (manager + super_admin)
  │   ├── FloatTab.tsx           (manager + super_admin)
  │   ├── ChipColorsTab.tsx      (manager + super_admin)
  │   └── BrandingTab.tsx        (только super_admin)
  ├── users/
  │   ├── UsersTable.tsx
  │   ├── UserEditorDialog.tsx
  │   ├── UserFiltersBar.tsx
  │   └── hooks.ts               (useProfiles, useAllRoles, useUpdateUserRoles)
  └── (existing: BrandingSettings, ChipColorSettings, …)
```

`Admin.tsx` после рефакторинга — это просто:
```tsx
const tabs = [
  isSuperAdmin && { value: "casinos", label: "Casinos", Component: CasinosTab },
  isSuperAdmin && { value: "access", label: "Casino Access", Component: CasinoAccessTab },
  ...,
  { value: "users", label: "Users & Roles", Component: UsersTab },
].filter(Boolean);
```
Никаких внутренних `if (isSuperAdmin)` внутри таблиц/диалогов. Компонент таба отвечает только за свою роль.

**Гарантия изоляции.** После рефакторинга: добавляешь поле в `UsersTab` → задеть `CasinosTab` физически нельзя, это другой файл. Менеджер видит только табы из своего фильтра — super_admin-табы вообще не монтируются.

---

## Технические детали (для разработчика)

### Миграция (одним файлом, версия `package.json` патч-бамп)
```sql
-- Realtime для цветов фишек
ALTER TABLE public.chip_color_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chip_color_settings;

-- Атомарный апдейт ролей пользователя
CREATE OR REPLACE FUNCTION public.update_user_roles(_user_id uuid, _roles app_role[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  -- Manager может править только юзеров своего казино
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    IF (SELECT casino_id FROM profiles WHERE user_id = _user_id)
       <> (SELECT casino_id FROM profiles WHERE user_id = auth.uid()) THEN
      RAISE EXCEPTION 'cross-casino edit forbidden';
    END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role <> ALL(_roles);
  INSERT INTO public.user_roles(user_id, role)
    SELECT _user_id, unnest(_roles)
    ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
```

### Realtime подписка в `use-chip-colors.ts`
```tsx
useEffect(() => {
  if (!casinoId) return;
  const ch = supabase
    .channel(`chip_colors:${casinoId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'chip_color_settings', filter: `casino_id=eq.${casinoId}` },
      () => qc.invalidateQueries({ queryKey: ['chip_color_settings', casinoId] })
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [casinoId, qc]);
```

### Уже существующее, что НЕ трогаем
- Таблица `user_roles`, enum `app_role`, функция `has_role()`, RLS-политики — корректны.
- `create-user` edge function — уже принимает `roles: string[]`.
- `UserPermissionsDialog` — оставляем как есть, просто открываем из новой таблицы.
- Авто-бамп `package.json` (patch) — выполнится автоматически из-за миграции.

---

## Что увидит пользователь после внедрения

1. Меняешь цвет фишки в админке — у Pit/Cashier на других устройствах цвет обновляется через 1-2 секунды без перезагрузки.
2. Заходишь в `Admin → Users & Roles` — нормальная таблица с поиском, кнопка `+ New User` открывает большой удобный диалог. Можно поставить юзеру 2-3 роли (galочками), отредактировать существующего, увидеть его роли как бейджи.
3. Когда я в будущем что-то меняю в админке для одной роли — это физически не может задеть другую, потому что у каждой роли свой компонент-таб.
