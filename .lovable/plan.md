
# Density System (Comfort / Compact / Touch)

Variant **C**: роль задаёт дефолт, пользователь может переопределить через тумблер. Сохраняем выбор в localStorage per-user.

## 1. Density provider

Новый файл `src/lib/density.tsx`:
- Тип `Density = "comfort" | "compact" | "touch"`.
- `DensityProvider` оборачивает app в `App.tsx` (рядом с `ThemeProvider`).
- Источник дефолта:
  - `pointer: coarse` (touch-устройство) → `touch`
  - роль `cashier` / `pit` → `compact`
  - роль `manager` / `finance_manager` / `super_admin` / `hr` / `reception` / `surveillance` → `comfort`
- Override — `localStorage["cms.density"]` (`auto` | `comfort` | `compact` | `touch`). Дефолт `auto`.
- Применение: `document.documentElement.dataset.density = effective`.

## 2. CSS-токены плотности

В `src/index.css` (`@layer base`) добавить переменные, переключаемые `[data-density="..."]`:
```
:root { --density-row: 2.25rem; --density-input: 2.25rem; --density-btn: 2.25rem;
        --density-px: 0.75rem; --density-py: 0.5rem; --density-gap: 0.5rem;
        --density-text: 0.875rem; }
[data-density="compact"] { --density-row:1.75rem; --density-input:2rem; --density-btn:2rem;
        --density-px:0.5rem; --density-py:0.25rem; --density-gap:0.375rem; --density-text:0.8125rem; }
[data-density="touch"]   { --density-row:2.75rem; --density-input:2.75rem; --density-btn:2.75rem;
        --density-px:1rem;   --density-py:0.625rem; --density-gap:0.625rem; --density-text:0.9375rem; }
```

## 3. Подключение к design-system

Минимально-инвазивно (без переписывания компонентов):
- `DataTable` — высота строки `style={{height:'var(--density-row)'}}`.
- `FormGrid` / `PageShell` — `gap: var(--density-gap)`.
- `Input`, `Button` (shadcn `ui/input.tsx`, `ui/button.tsx` — default size) — `h-[var(--density-input)]`, `px-[var(--density-px)]`, `text-[length:var(--density-text)]`.
- `ResponsiveDialog` body padding через `var(--density-px)`.

Важно: меняем только `default` size. Явные `size="sm"` / `size="lg"` остаются как есть (печать, иконочные кнопки).

## 4. UI переключатель

`src/components/DensityToggle.tsx` — segmented control из 4 опций:
`Auto · Comfort · Compact · Touch`. Подсказывает текущий effective когда выбран Auto.

Размещение: в **профиле пользователя** (см. п.5), рядом с переключателем темы.

## 5. Профиль пользователя в сайдбаре

Сейчас в `AppSidebar` нет ссылки на профиль. Добавить:
- Внизу сайдбара (над `LogoutButton`) — кнопка с email + ролью, открывает `ResponsiveDialog` "Profile".
- Содержимое диалога:
  - Имя/email/роль (read-only).
  - **Theme**: Light / Dark (использует существующий `useTheme`).
  - **Density**: Auto / Comfort / Compact / Touch.
  - **Change password** — форма (current → new → confirm) через `supabase.auth.updateUser({ password })`.
- В мобильном `MobileHeader` — та же кнопка профиля.

## 6. Memory

Обновить `mem://index.md` Core: добавить строку про density tokens + per-role default.
Создать `mem://design/density-system` с описанием токенов и правил применения.

## Технические детали

Файлы создать:
- `src/lib/density.tsx`
- `src/components/DensityToggle.tsx`
- `src/components/UserProfileDialog.tsx`

Файлы править:
- `src/App.tsx` — обернуть в `DensityProvider`.
- `src/index.css` — токены density + правки `cms-*` где нужно.
- `src/components/ui/input.tsx`, `src/components/ui/button.tsx` — default size через CSS-переменные.
- `src/components/layout/AppSidebar.tsx` — кнопка профиля + проброс в Mobile header.
- `src/components/ui/data-table.tsx` (или где задаётся высота строки) — `var(--density-row)`.
- `mem://index.md`, новый `mem://design/density-system`.

Без миграций БД, без edge functions — версию НЕ бампим.
