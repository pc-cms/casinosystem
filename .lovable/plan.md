## Goal

Strict separation of two cashier desks:

- **`cashier`** (existing) = Live Game cashier. Keeps current Cage access, **loses** Cage Slots.
- **`cashier_slots`** (new) = Slots cashier. Sees **only** Cage Slots + Expenses. No Live Cage, no Cashless, no Reception.

Two roles, two people, two modules. The enum value `cashier` stays as the alias for live game (no mass rename), only a new value is added.

## Module access matrix (after change)

| Module      | cashier (live) | cashier_slots | manager | finance_manager | surveillance |
|-------------|:--------------:|:-------------:|:-------:|:---------------:|:------------:|
| `cage`      | write (today)  | —             | read    | read            | read         |
| `cage_slots`| **— (removed)**| **write (today)** | read | read         | read         |
| `cashless`  | write          | —             | write   | read            | —            |
| `expenses`  | write          | **write**     | write   | write           | —            |

Other cashier defaults (none beyond the above) remain unchanged. `super_admin` keeps full access automatically.

## Technical changes

### 1. DB migration

```sql
-- New enum value
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'cashier_slots';

-- Remove cage_slots from live cashier defaults
DELETE FROM role_module_defaults
 WHERE role = 'cashier' AND module_key = 'cage_slots';

-- Seed defaults for cashier_slots
INSERT INTO role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  ('cashier_slots', 'cage_slots', true, true,  'today'),
  ('cashier_slots', 'expenses',   true, true,  'today')
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_write = EXCLUDED.can_write,
      day_horizon = EXCLUDED.day_horizon,
      updated_at = now();
```

No RLS rewrites needed — existing policies that allow `has_role(uid,'cashier')` for cage stay as-is. For cage_slots, audit policies that gate on `'cashier'` and add `'cashier_slots'` alongside.

### 2. RLS audit for slots tables

Inspect every policy on `cage_slots_*` tables. Wherever a write/view policy currently checks `has_role(uid,'cashier')`, replace with `has_role(uid,'cashier') OR has_role(uid,'cashier_slots')` (or just `cashier_slots` if write must move fully). Strict reading: writes on `cage_slots_*` should be limited to `cashier_slots`, `manager`, `super_admin`; live `cashier` loses write on those tables to match the menu hiding.

### 3. Frontend code

- `src/pages/CageSlots.tsx` — `canTransact` switches from `cashier` to `cashier_slots`.
- `src/pages/Cage.tsx`, `src/components/cage/ActiveShiftView.tsx` — no change (still `cashier`).
- `src/lib/role-access.ts`, `src/lib/auth-context.tsx`, `src/lib/density.tsx`, `src/components/admin/users/users-hooks.ts`, `src/components/admin/FloatManagement.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/pit/CloseBusinessDayButton.tsx`, `src/hooks/use-business-day-filter.ts`, `src/hooks/use-prefetch.ts`, `src/hooks/use-staff.ts`, `src/pages/Incidents.tsx`, `src/App.tsx` — add `cashier_slots` to role lists where appropriate (default route, density=compact, business-day filter, sidebar visibility, business-day close button, staff cashier filter). `cashier_slots` should behave like `cashier` for: density compact, today-only horizon, no access to lifetime player financials, ability to close business day from Cage Slots screen.
- `getDefaultRoute()` in `App.tsx` — add branch: `cashier_slots`-only user → `/cage-slots`.
- Admin user editor — new role appears automatically once enum is updated and types regenerated.

### 4. Memory

Update `mem://features/cage-operations` and the Core block in `mem://index.md`: "Cage is `cashier` only (Live Game). Cage Slots is `cashier_slots` only. Managers/Finance/Surveillance read-only on both."

### 5. Version bump

Patch-bump `package.json` (backend change).

## Out of scope

- No rename of existing `cashier` enum value.
- No data migration of existing 5 cashier users — they stay Live Game cashiers. Slots cashiers must be created fresh in Admin → Users.
- No UI rename of the "Cashier" label to "Cashier Live Game" (can be done later if desired).
