## Changes

### 1. Remove Incidents from Pit sidebar
`src/components/layout/AppSidebar.tsx` line 60 — drop `"pit"` from the Incidents nav entry roles. Pit users no longer see the Incidents button. Other roles (super_admin, manager, finance_manager, surveillance) keep access. Existing route stays accessible if visited directly (no permission change), only the menu chip is hidden.

### 2. Fix sticky Date/Time smearing on horizontal scroll
In `src/pages/Incidents.tsx` the two left-pinned columns (Date, Time) currently use a single class string for both header and body cells. On scroll the columns sliding underneath bleed through because:
- Header `<thead>` row has `bg-muted/60` (translucent) and the sticky `th` inherits that look.
- Body sticky `td` uses `bg-background` which is solid in theory but sits at `z-20`, same stacking as nothing else, so border/hover overlays appear to leak.

Fix:
- Split the helpers into two variants:
  - `stickyDateHead` / `stickyTimeHead` → `sticky left-0 z-30 bg-muted` (fully opaque, matches header band).
  - `stickyDateBody` / `stickyTimeBody` → `sticky left-0 z-30 bg-background` (already opaque) and add an explicit `shadow-[1px_0_0_0_hsl(var(--border))]` on the Time column so the seam stays clean while scrolling.
- Bump `z-index` from `z-20` to `z-30` so nothing in the body can overlap.
- Apply the head variants in the `<thead>` row and the body variants in both the draft row and `IncidentRow` (pass the new pair via the existing props).

### 3. Enlarge journal text ~30%
Currently the table is `text-xs` (12px) with `py-1.5` rows and `text-[10px]` headers. Bump uniformly:
- Table base: `text-xs` → `text-sm` (14px); for the bigger 30% feel, also bump cell padding `py-1.5` → `py-2.5` and `px-2` → `px-3`.
- Header row: `text-[10px]` → `text-xs` and `py-2` → `py-2.5`.
- Badges (`violation_type`): `text-[10px]` → `text-xs`.
- `cellInput` constant: `h-8 ... text-xs` → `h-10 ... text-sm` so inline inputs match the larger row height.
- Row Edit/Save/Cancel buttons: `h-7 w-7` → `h-9 w-9`, `text-[10px]` → `text-xs`.
- Increase column widths proportionally to keep things from wrapping mid-word: multiply each `COLS.*` value by ~1.25 (round to nearest 5px) and bump table `minWidth` from `1800px` to `2250px`.

No data, RPC, or RLS changes. Header (PageHeader date navigator) is untouched.
