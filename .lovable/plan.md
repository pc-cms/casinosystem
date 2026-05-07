# Incidents — three fixes

## 1. Edit must allow Time + Photo (add/replace/remove)

**Current behavior.** `useUpdateIncidentFollowup` only patches `outcome / points / comments`. A DB trigger (`incidents_lock_immutable_fields` or similar) blocks any other column. Edit row UI shows only those three fields.

**Change.**

- DB migration: relax the immutability trigger to also allow `incident_time` and `photo_url` to change after insert. Date, dealer, manager, incident text, etc. stay locked.
- `IncidentFollowupPatch` type: add `incident_time?: string` and `photo_url?: string | null`.
- `IncidentRow` editor:
  - Time → `<Input type="time">` bound to local state (default `i.incident_time.slice(0,5)`).
  - Photo cell becomes interactive while `editing`:
    - If photo present → thumbnail with X to remove (sets `photo_url = null`).
    - If absent (or removed) → camera button that opens file picker, uploads to `incident-photos` bucket via existing `compressImage` + `supabase.storage` flow, and sets `photo_url = publicUrl`.
  - Save sends all five fields (outcome, points, comments, incident_time, photo_url).
- Auto-bump `package.json` patch version (DB trigger changed).

## 2. Tables dropdown empty during entry

**Cause.** `tableOptions` filters `gamingTables` by `status === "open"`. Outside of open Pit hours every table is `closed`, so the datalist is empty and the user falls back to typing manually.

**Change.** Show all non-archived gaming tables, sorted by name. Open status should not gate the autocomplete — incidents may legitimately be logged for any table.

```ts
const tableOptions = useMemo(
  () => (gamingTables as any[])
    .filter(t => !t.is_archived)
    .map(t => t.name)
    .sort(),
  [gamingTables],
);
```

## 3. Saved incidents ordered incorrectly

**Cause.** Query orders by `incident_date desc, incident_time desc`. When two rows share both date and time (common — same minute, no seconds entered) Postgres breaks the tie unpredictably, so newly-saved rows can appear below older ones.

**Change.** Add `created_at desc` as a stable tiebreaker in `useIncidents`:

```ts
.order("incident_date", { ascending: false })
.order("incident_time", { ascending: false })
.order("created_at",   { ascending: false })
```

This keeps chronological ordering by user-entered time, and within identical times the most recently saved row appears first.

## Files touched

- `supabase/migrations/<new>.sql` — relax incidents immutability trigger (allow `incident_time`, `photo_url`).
- `src/hooks/use-incidents.ts` — extend `IncidentFollowupPatch`; add `created_at` sort.
- `src/pages/Incidents.tsx` — drop `status === "open"` filter on tables; add Time + Photo editors to `IncidentRow`.
- `package.json` — patch bump.
