## Plan: единый стиль маленьких кнопок (Manager Access + actions)

**Цель:** все нижние кнопки в одном стиле — маленькие иконки. `Manager Access` тоже становится иконкой `ShieldCheck`, выделена цветом `primary` (золотой) когда активна — короткий хинт через tooltip/title.

### Expanded sidebar (`src/components/layout/AppSidebar.tsx` ~612–700)

**Удалить** широкие кнопки `Manager Active` / `Manager` / `Hide sidebar` (full-width).

**Заменить** на единый ряд из 6 равных иконок (`flex-1 h-7`) сразу под именем:

```
Row 1:  [ Имя пользователя ………………… ]  ●network
Row 2:  [ 🛡 ] [ ☀ ] [ ▭ ] [ ⟳ ] [ ⎋ ] [ ‹‹ ]
         M.Acc Theme Dens Reload Logout Collapse
```

- `Manager Access`: иконка `ShieldCheck`, при `managerOverride.active` — `bg-primary/20 text-primary border border-primary/40` (золотой акцент). Не показывается для `nativeManager` (там и так Admin доступ). Клик: открыть dialog или deactivate.
- `Hide sidebar` (`ChevronsLeft`) добавляется в этот же ряд только если `onToggle` есть — иначе ряд из 5.

Отдельный `Manager ↑` бейдж под рядом — **удалить** (цвет иконки уже всё показывает).

### Collapsed sidebar (~475–533)

После Profile, добавить **Manager Access** иконку (`ShieldCheck`, `w-10 h-10`) с тем же стилем подсветки primary при активном override (для `!nativeManager`). Tooltip справа: `Manager Access` / `Manager Active — click to deactivate`.

Порядок в collapsed: Profile → **Manager Access** → Theme → Density → Reload → Logout → divider → Expand. Все одинаковые `w-10 h-10` — уже единый стиль.

### Файлы
- `src/components/layout/AppSidebar.tsx` — только нижняя панель (expanded + collapsed).

### Не трогаем
- ManagerOverrideDialog, auth-context, mobile-режим, верхнюю часть сайдбара.
