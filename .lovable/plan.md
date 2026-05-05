## Goal
Allow CCTV (`surveillance`) role to open **Table Results** in read-only mode, with full Week / Month / Year preset switching, but locked to the **current calendar year** (no access to past years, no Custom range outside the year).

## Context
- `/table-results` is currently restricted to `super_admin`, `manager`, `finance_manager` (`src/App.tsx` `ROUTE_ROLES`, `src/components/layout/AppSidebar.tsx`).
- The page (`src/pages/TableResults.tsx`) is purely a read-only report — no edit/save/delete actions exist. So "view-only" is automatic.
- Presets are: Week / Month / Year / Custom. We will keep Week / Month / Year for surveillance and clamp all anchors to the current year.

## Changes

1. **`src/App.tsx`** — add `"surveillance"` to the `/table-results` entry in `ROUTE_ROLES`.

2. **`src/components/layout/AppSidebar.tsx`** — add `"surveillance"` to the `roles` array of the `Table Results` nav item so it shows in their sidebar.

3. **`src/pages/TableResults.tsx`** — surveillance-only restrictions:
   - Read `roles` via `useAuth()`. Compute `isSurveillanceOnly = roles.includes("surveillance") && !roles.some(r => ["manager","super_admin","finance_manager"].includes(r))`.
   - When `isSurveillanceOnly`:
     - Hide the **Custom** preset button (still allow Week / Month / Year).
     - If user lands with `preset === "custom"`, force back to `"month"`.
     - Clamp `weekAnchor`, `monthAnchor`, `yearAnchor` to the **current calendar year**:
       - Year picker: show only the current year (single button, no list of past years).
       - Month picker: only months of the current year selectable.
       - Week picker: disable dates outside the current year in the Calendar `disabled` prop.
     - Hide the XLSX export button (optional — keep it as it's still read-only data of the same rows already on screen). Default: keep export enabled.

## Out of scope
- No DB / RLS changes — `daily_results` SELECT is already allowed for surveillance via casino-scoped policies. If a runtime check shows RLS blocks reads, add a SELECT policy in a follow-up.
- No new module-permission key — `/table-results` already maps to the `reports` module (`src/lib/route-module-map.ts`).
