## Plan

**1. Global container 1280px → 1600px**
`src/components/layout/AppLayout.tsx` line 54: `max-w-7xl` → `max-w-[1600px]`. Gives all pages +320px on FullHD/27".

**2. Full-width data-grid routes**
Same file, expand `FULL_WIDTH_ROUTES`:
```
/table-results, /pit, /staff, /floor, /player-statistics,
/incidents, /table-tracker, /tables/analytics,
/business-days, /logs, /bank-checks
```
These render edge-to-edge (only `p-3 sm:p-4` padding).

**3. Density toggle in sidebar bottom panel**
`src/components/layout/AppSidebar.tsx`:
- Expanded panel (~line 645): add icon button between theme toggle and refresh — `Rows3`/`Rows2` lucide icon, click toggles between Comfort and Compact via `useDensity().setMode()`.
- Collapsed panel (~line 480): mirror the same button in the icon column with tooltip "Density".

Full 4-mode selector (Auto/Comfort/Compact/Touch) stays in Profile dialog.

**4. Slightly larger fonts in Comfort**
`src/index.css`: in the `[data-density="comfort"]` block bump base font-size by ~1px (e.g. 14px → 15px) and slightly increase row/input height tokens. Compact and Touch unchanged.

### Files
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/index.css`

### Not touched
- PageHeader, Profile dialog, sidebar width, Compact/Touch styles, individual pages.