## What I'll change

### 1. `/guests` — row click + Edit button (Player-Tracker behavior)

In `src/pages/Guests.tsx`:
- Make the entire `<tr>` clickable. Clicking anywhere on the row calls `selectPlayer(r.playerId)` — opens the existing `PlayerPreviewHeader` sticky panel, exactly as Player Tracker (`PlayerStatistics.tsx`) does.
- Add `cursor-pointer` and active-row tint when this player is the selected one.
- Existing inner controls (Check-In, Check-Out) keep their `e.stopPropagation()` so they don't trigger the row click.
- Replace the eye `<Eye />` icon button with a labeled **Edit** button (small `outline`, with `Pencil` icon). It navigates to Reception with the player pre-selected: `navigate('/reception?edit=<playerId>')`.

In `src/pages/Reception.tsx`:
- Read `?edit=<playerId>` from the URL on mount. If present, fetch that player and run the existing `handleSelectPlayer(p)` flow (the same the search currently uses), so the user lands directly in the inline edit/update form — no extra screen built.
- Clear the param after handling so refreshes don't loop.

### 2. Notes panel inside `PlayerPreviewHeader` (works everywhere)

In `src/components/player/PlayerPreviewHeader.tsx`:
- Add a collapsible **Notes** section at the bottom of the expanded header (toggle button "Notes (N)" next to the existing controls; opens an inline area).
- Reuse the existing `NotesPanel` UI from `PlayerProfile.tsx` — extract it into `src/components/player/PlayerNotesPanel.tsx` so both `PlayerProfile` and `PlayerPreviewHeader` share one component.
- Posting permissions: the existing list `pit | manager | floor_manager | surveillance | super_admin` plus **`reception`** (RLS already allows it — confirmed in DB). No migration needed.
- Because `PlayerPreviewHeader` is already mounted on `/guests`, `/reception`, `/blacklist`, `/players/stats`, and all CCTV/Tags screens that use it, Notes will automatically appear on all of them — including the Tags views the user mentioned.

### 3. No DB / backend changes

- RLS on `player_notes` already permits `reception` to insert (verified). 
- No new tables, no migrations, no edge functions, no version bump.

## Technical notes

- Files touched:
  - `src/pages/Guests.tsx` — row-level `onClick`, replace Eye → Edit, navigate to `/reception?edit=`.
  - `src/pages/Reception.tsx` — read `?edit=` query param on mount and auto-select player.
  - `src/components/player/PlayerPreviewHeader.tsx` — add collapsible Notes section + posting form.
  - `src/components/player/PlayerNotesPanel.tsx` — new shared component extracted from `PlayerProfile.tsx`.
  - `src/pages/PlayerProfile.tsx` — swap inline `NotesPanel` for the shared import, add `reception` to `canPost` roles for consistency.

- Design system: uses existing `Button` outline/ghost variants, `Textarea`, `Badge`. No raw `h-*`, no new wrappers.
- Mobile: Notes panel collapses by default to keep the sticky header compact.

## Out of scope

- No new tag-management UI in Reception (only Notes were requested).
- No edits to RLS or schema.
- No changes to the Player Tracker page itself.
