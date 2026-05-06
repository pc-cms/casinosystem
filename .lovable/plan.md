## Problem

In Incidents form, pit bosses (Zuhura, Suenancy, Emiliana — dealers with `is_pit_boss=true`) are being merged into the **Manager** dropdown. They are NOT managers. They are pit personnel with their own rota/attendance, already excluded from the Breaklist.

Per spec: pit bosses must appear ONLY under `Department = Pit` → `Employee` column in Incidents.

## Root cause

`src/pages/Incidents.tsx` line 141:
```ts
managers: [...new Set([...STANDING_MANAGERS, ...pitBosses])].sort(),
```
This pollutes the Manager list with pit bosses.

## Fix

Single change in `src/pages/Incidents.tsx`:

1. Line 141 — drop `pitBosses` merge. Manager list = `STANDING_MANAGERS` only:
   ```ts
   managers: [...STANDING_MANAGERS].sort(),
   ```
2. Keep `pitBosses` in the returned object (still used at line 154–156 for `department=pit` Employee dropdown).
3. Update the comment at line 137 to remove the misleading note.

## Verification

- Manager dropdown contains only Peter, Taras, Daniyar.
- With Department = Pit, Employee dropdown lists today's rota'd pit bosses (Zuhura/Suenancy/Emiliana).
- Breaklist already excludes pit bosses (`BreaklistGrid.tsx:122`) — no change needed.
- Pit Rota/Attendance already separate (`Pit.tsx:787, 1092`) — no change needed.

No DB / migration changes. No version bump (UI-only fix).
