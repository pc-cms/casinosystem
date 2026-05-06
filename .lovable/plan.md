## Player Statistics: Header & Total Row Styling

### What
Update the Player Statistics table header and total row for stronger visual hierarchy.

### Changes

#### 1. Column headers (шапка)
- Background: `bg-muted` → `bg-gray-800` (dark band so white text reads clearly in both light/dark themes)
- Text color: `text-muted-foreground` → `text-white`
- Size: `text-xs` → `text-sm`
- Weight: `font-semibold` → `font-bold`
- Update all sticky `<th>` cells to use matching dark background (`bg-gray-800`)

#### 2. Total row (итоги)
- Background: `bg-muted` → `bg-amber-100 dark:bg-amber-950` (gold fill)
- Text color for label/count cells: `text-muted-foreground` → `text-amber-950 dark:text-amber-100`
- Update all sticky `<td>` cells in the total row to matching gold background
- Keep existing semantic colors (green/red) on financial figures — they remain readable on pale/dark gold
- Preserve the existing gold inset `boxShadow` on sticky total cells

### Files
- `src/pages/PlayerStatistics.tsx` — lines 656–729 (header `<thead>` and total `<tr>`)
