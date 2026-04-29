## Player Profile Page — Extended Stats

Replace the modal-based player view with a dedicated page at `/players/:id`. The Players list shows extended stats inline; clicking a row navigates to a full profile page with a header (photo left, info right) and 5 tabs.

### 1. New route & navigation
- Add route `/players/:id` → `src/pages/PlayerProfile.tsx` in `src/App.tsx`.
- In `src/pages/Players.tsx`: replace `setSelectedPlayerId` + `PlayerEditDialog` with `navigate(\`/players/${player.id}\`)`. Remove the dialog usage on this page.
- Add extra columns to the Players list: visits count (lifetime), last visit, total time played, total bet — sourced from `player_economy` view + an aggregated query on `casino_visits` and `client_sessions`.

### 2. Player profile page layout
- Use `PageShell` + `PageHeader` (back button via title row).
- Header card: photo on the **left** (large, ~160px), info on the **right** — full name, nickname, category badge, status, ID number, phone, birth date, registered casino badge, lifetime KPIs (visits / total time / total bet / net result).
- Below header: shadcn `Tabs` with 5 tabs.

### 3. Tabs

**Tab 1 — Info & History**
- Full personal info block (read/edit per role — reuse logic from `PlayerEditDialog`).
- Notes/messages timeline (existing `player_notes` flow extracted into a sub-component).
- Lifetime stats card: total visits, total hours, avg session, last visit, registered date.
- Visits history table: date, casino, check-in, check-out, duration, position.

**Tab 2 — Statistics (Tables / Slots + period total)**
- Period filter (date range presets).
- Two sections: **Tables** (from `client_sessions` grouped by table) and **Slots** (from `player_economy` slot rows or future `slot_sessions`; if absent today, render empty-state placeholder).
- Per-row: sessions count, hands, total bet, avg bet, duration, net result.
- Footer total row for the selected period.

**Tab 3 — Connections (Groups)**
- Current groups: list from `group_members` where `left_at is null`.
- Group history: all `group_members` rows with joined/left timestamps.
- Linked players inside each group (clickable → their profile).

**Tab 4 — Lotteries / Raffles (history)**
- Empty state placeholder + a note "module coming soon" — schema does not exist yet. Plan to add tables `lotteries`, `lottery_entries`, `raffle_draws` later.

**Tab 5 — Tickets (upcoming)**
- Same: placeholder until lottery schema exists. Show "no upcoming tickets".

### 4. Reused / extracted components
- Extract from `PlayerEditDialog.tsx`:
  - `PlayerInfoForm` — editable personal fields with role gating.
  - `PlayerNotes` — notes list + add-note form.
- Keep `PlayerEditDialog` for places that still use it (cage `PlayerSearch`, etc.) — it can internally render the same sub-components.

### 5. Data hooks (new)
- `usePlayer(id)` — single player + cards + tags.
- `usePlayerVisits(id)` — all `casino_visits` joined with casino name.
- `usePlayerSessions(id, range)` — `client_sessions` with table info, filtered by date.
- `usePlayerGroups(id)` — current + historical `group_members`.
- `usePlayerLifetimeStats(id)` — aggregates visits + sessions for header KPIs.

### 6. Out of scope (this iteration)
- Lottery / raffle DB schema and ticketing — placeholders only.
- Slot session detail (no dedicated table yet) — uses `player_economy` if available, otherwise empty.

### Technical notes
- Keep all queries scoped by RLS (already casino-scoped). For Super Admin / Surveillance with multi-casino access, queries return cross-casino data automatically.
- Negative results styled with `cms-amount-negative`, positive with `cms-amount-positive`.
- Mobile: tabs scroll horizontally; header stacks photo on top.
