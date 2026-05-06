## Plan: единый стиль маленьких кнопок в нижней панели сайдбара

**Файл:** `src/components/layout/AppSidebar.tsx`

### Expanded sidebar (~612–697)
Удалить большие кнопки `Manager Active` / `Manager` / `Hide sidebar` и отдельный бейдж `Manager ↑`. Заменить на:

- **Строка 1:** имя пользователя (clickable → Profile) + индикатор сети.
- **Строка 2:** ряд равных иконок `flex-1 h-7`:
  - `🛡 Manager Access` (только для не-nativeManager). Когда `managerOverride.active` — фон `bg-primary/20`, текст `text-primary`, бордер `border-primary/40` (золотой акцент). Клик: активировать/деактивировать.
  - `☀/🌙 Theme`
  - `▭ Density` (Rows2/Rows3)
  - `⟳ Reload`
  - `⎋ Logout`
  - `‹‹ Collapse` (если `onToggle` есть)

### Collapsed sidebar (~485 после Profile)
Добавить `Manager Access` иконку (`ShieldCheck`, `w-10 h-10`) сразу после Profile с тем же стилем подсветки primary при активном override. Tooltip справа.

### Не трогаем
- Верх сайдбара, навигацию, ManagerOverrideDialog, mobile.