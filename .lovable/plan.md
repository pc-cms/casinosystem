## Проблема

`PageShell` использует `space-y-4` (margin-top на всех детях кроме первого). В `WeeklyBonus.tsx` и `MonthlyTips.tsx` первым ребёнком внутри `<PageShell>` стоит блок `<style>{`@media print { … }`}</style>`, поэтому `<PageHeader>` оказывается вторым ребёнком и получает лишний `margin-top: 1rem`. В Live / Floor / Club Poker такого `<style>` нет — `PageHeader` идёт первым и липнет к верху. Отсюда разная высота шапок между вкладками.

## Решение

Перенести `<style>`-блок так, чтобы он не был первым ребёнком `PageShell` и не сдвигал `PageHeader`. Самый чистый вариант — обернуть style в фрагмент после header, либо перенести его в нижнюю часть страницы (он применяется только к `@media print`, позиция в DOM не важна).

### Файлы и изменения

1. **`src/pages/WeeklyBonus.tsx`** — переместить блок `<style>{@media print …}</style>` (строки ~225–246) из положения «сразу под `<PageShell>`» в положение «после `<PageHeader>`» (или в самый конец `PageShell`, перед закрывающим тегом). Поведение печати не меняется.

2. **`src/pages/MonthlyTips.tsx`** — аналогично: переместить аналогичный `<style>`-блок ниже `<PageHeader>`.

### Проверка

После изменения визуально сверить отступ сверху у всех 5 вкладок Tips & Bonuses (Weekly Bonus, Monthly Tips, Live Game Tips, Floor Tips, Club Poker Tips) — должен быть одинаковый. Печать (Ctrl+P) на Weekly Bonus / Monthly Tips должна по-прежнему применять компактные print-стили.

### Bump

Чисто косметическая UI-правка — версию в `package.json` не бампим (правило Auto Version Bump касается только backend-изменений).
