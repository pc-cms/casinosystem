---
name: Design tokens v2 (June 2026 redesign tour)
description: Consolidated visual decisions — gold palette, 12px radius, 17px body, 320px sidebar, 40/32/28 input heights, muted-modern status, two modal widths
type: design
---

Locked tokens (do not re-propose alternatives):

- Brand: Gold (Faberge), `--primary: 38 55% 72%` light / `38 60% 65%` dark.
- Radius: `--radius: 0.75rem` (12px). All `rounded-md`/`rounded-lg` resolve from this.
- Body text: 17px at `density=comfort` (default for ALL roles).
- Density default: `comfort` for everyone. Cashier/Pit override → Profile dialog.
- Input heights (canonical, exposed as CSS vars):
  - `--h-form`  40px  → forms, dialogs, page headers
  - `--h-table` 32px  → inline-editable table cells
  - `--h-grid`  28px  → dense grids (rota, breaklist, tracker)
- Sidebar: 320px expanded / 40px icon rail / 320px mobile drawer.
- Status palette: muted-modern (`--success 152 45% 38%`, `--warning 38 78% 48%`, `--danger 0 65% 50%`, `--info 210 70% 48%`).
- Contrast tier: hybrid — AA in light (muted-foreground L=36%), AAA in dark (foreground L=96%, muted-foreground L=70%).
- Borders: keep gold (`--border 38 40% 78%` light / `38 35% 32%` dark).
- Fonts: Inter (sans), JetBrains Mono (mono), Faberge/Cinzel (brand serif via `.font-faberge`).
- Modals: ONLY two widths via `<ResponsiveDialog size>`:
  - `form`  → 560px (cancel, notes, quick grant, password)
  - `table` → 880px (open/close table, slots, chip count, cage tx, promo/AM grant, redeem, stock count)
  Legacy `sm|md|lg|xl|2xl|3xl|4xl` aliased automatically; `full` keeps 95vw.
- Numbers: `formatMoneyFull` (space separator) + `formatMoneyCompact` (K/M/B). Use `<MoneyCell>` in tables; `useMoneyMode("table-id")` provides Full/Compact toggle persisted in localStorage.
- Scroll rule: never both axes. `PageShell` has `overflow-x-clip`; wide tables manage their own H-scroll inside container.
- Dashboards: bento grid (1×1 / 2×1 / 1×2 / 2×2) with user-resizable tiles (future tour).
- DataTable column types (future tour): `text|name|money|int|time|date|status|actions` with auto-fit min/max widths.
