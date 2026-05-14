## Goal

Allow editing player **Status** (Normal / Gold / Platinum / Diamond) and **Tags** directly from the player profile, and render tags in the short cashier card (PlayerInfoCard) right under the IN/OUT log as big ~15 px emojis. CCTV (surveillance) maintains its own separate row of tags.

---

## 1. Database — split tags into two layers

Add a `source` column to `player_tags` so the same player can carry two independent rows of tags (operational vs. surveillance):

- `source TEXT NOT NULL DEFAULT 'floor'` with check constraint `IN ('floor','cctv')`
- Drop the old `UNIQUE (player_id, tag)` and replace with `UNIQUE (player_id, tag, source)` so the same emoji can exist once on the floor row and once on the CCTV row.
- Update the "max 5 tags" trigger to count per `(player_id, source)` instead of per player (each row can hold up to 5).
- Backfill existing rows with `source = 'floor'` (CCTV-created rows are unknown historically — leaving them as floor is acceptable).

### RLS rewrite for `player_tags`

INSERT / DELETE policies replaced with:

- **Floor row (`source = 'floor'`)**: allowed for `super_admin`, `manager`, `floor_manager`, `finance_manager`. (Removes the current `pit` write access — per the request, only the listed roles may edit.)
- **CCTV row (`source = 'cctv'`)**: allowed for `surveillance` and `super_admin`.
- SELECT stays global (already is).

### Category change auditing

`players.category` updates today require `manager`. Broaden the existing UPDATE policy / add an RPC `set_player_category(_player_id, _category)` (SECURITY DEFINER) that allows `super_admin`, `manager`, `floor_manager`, `finance_manager` to change the category. Surveillance is **not** allowed to change category (only tags) — explicit per request: CCTV operates only on the second tag row.

Auto-bump `package.json` patch version (backend change).

---

## 2. UI — Player Profile (`src/pages/PlayerProfile.tsx`)

Inline editor in the header area, visible only to roles with permission.

- **Status (category)** — small inline `Select` next to `CategoryBadge` with the four options. Disabled for users without permission. Saves immediately, optimistic update.
- **Tags** — clickable chip strip beside `FlagBadges`. Click toggles a tag on/off (insert/delete). Conflicts and the 5-tag cap surface as toast errors from the existing DB triggers.
- For surveillance users, the editor writes to `source='cctv'` and shows only the CCTV row as editable. For the other listed roles, the editor writes `source='floor'`.

Two visual rows of tags wherever tags are shown on the profile:

```text
Tags (floor):     👑 💎 ⚠️
CCTV:             👁️ 🕵️
```

Empty rows render a muted placeholder (`—`) so the structure stays predictable.

---

## 3. UI — Short cashier card (`src/components/cage/PlayerInfoCard.tsx`)

Add the requested tag block **directly under the IN/OUT shift transactions**:

```text
[ Shift Transactions list ]
─────────────────────
Tags     👑 💎 ⚠️       ← floor row, ~15 px
CCTV     👁️ 🕵️          ← surveillance row, ~15 px, muted label
```

- Use `FlagBadges` with a new `size="lg15"` variant rendering at `text-[15px]` (request: "большими смайлами PX 15").
- Two-row layout, both always rendered (CCTV row hidden if there are no CCTV tags AND viewer is not surveillance, to avoid visual noise on the cashier screen).

This card is read-only — no editing UI here. Editing happens on the Player Profile page.

---

## 4. UI — `PlayerPreviewHeader` (the slide-in preview)

Already shows tags as a single row. Update to:
- Render two rows (floor, CCTV) in the same slot, mirroring the cashier card.
- No edit controls here — keep the preview informational. Editing remains on `/players/:id`.

---

## 5. Hook layer

Extend `useCreatePlayerNote`-style hooks in `use-player-profile.ts`:

- `useUpdatePlayerCategory()` — calls the new RPC, invalidates `["player", id]` and `["players"]`.
- `useTogglePlayerTag()` — INSERT or DELETE on `player_tags` with the correct `source` based on the caller's role (resolved client-side from `useAuth().roles`; surveillance → `'cctv'`, otherwise `'floor'`). Invalidates `["player", id]` and the realtime players query.

The existing `usePlayer` query already pulls `player_tags(*)`. Add `tag, source` to the select so consumers can group by source.

---

## 6. Helpers

- `src/lib/player-tags.ts`: add helper `splitTagsBySource(tags: {tag, source}[])` returning `{ floor: string[], cctv: string[] }`.
- `src/components/player/FlagBadges.tsx`: add a `size` prop (`sm | base | lg15`) instead of the current `compact` boolean (kept as alias for back-compat).

---

## Roles matrix (final)

| Role            | Edit category | Edit floor tags | Edit CCTV tags |
|-----------------|:-------------:|:---------------:|:--------------:|
| super_admin     | ✅            | ✅              | ✅             |
| manager         | ✅            | ✅              | ❌             |
| floor_manager   | ✅            | ✅              | ❌             |
| finance_manager | ✅            | ✅              | ❌             |
| surveillance    | ❌            | ❌              | ✅             |
| pit             | ❌            | ❌              | ❌             |
| cashier         | ❌            | ❌              | ❌             |
| reception       | ❌            | ❌              | ❌             |
| hr              | ❌            | ❌              | ❌             |

---

## Out of scope

- No changes to the blacklist flow.
- No new tag definitions — existing `PLAYER_TAGS` palette stays.
- Other surfaces showing tags (Reception list, Tables, Active Players, etc.) keep their current single-row rendering until we decide they need the CCTV split too.

## Files touched

- `supabase/migrations/<new>.sql` — schema + RLS + RPC
- `src/hooks/use-player-profile.ts` — new mutations, extend select
- `src/lib/player-tags.ts` — split helper
- `src/components/player/FlagBadges.tsx` — size variants
- `src/pages/PlayerProfile.tsx` — inline category select + tag editor + two rows
- `src/components/player/PlayerPreviewHeader.tsx` — two rows
- `src/components/cage/PlayerInfoCard.tsx` — two-row tag block under IN/OUT
- `package.json` — version bump
