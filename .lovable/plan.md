## Tips dialogs — semantics, employee selector, colors

### 1. `TipsDialog` (`src/components/cage/TipsDialog.tsx`)

**Employee selector for Tips Poker (new)**
- Add `kind === "tips_poker"` branch that mounts `EmployeeCombobox` (see below).
- Source: `useDealers()` → filter `is_active && !is_pit_boss` (includes dealer / inspector / trainee categories). Sort by name.
- Same field `tips_recipient_employee_id` is written on submit. Submit disabled until selected.

**Searchable Employee selector for Tips Poker AND Tips Floor**
- Replace plain `<Select>` with a `Popover + Command` combobox (typeahead by first letters/digits, like player search). Single shared inline `EmployeeCombobox` component declared at top of `TipsDialog.tsx`:
  - Props: `value`, `onChange`, `items: {id,name,sub?}[]`, `placeholder`.
  - Renders selected name as trigger button; opens `Command` with `CommandInput` + `CommandList` + `CommandItem`s; filter on name (case-insensitive includes).
- Tips Floor keeps its existing `useStaffMembers()` source.
- Tips Live keeps no selector.

**Tips Live — cash treated as income (chip→cash exchange, but cash is income)**
- Keep current chip→cash semantics (`amount > 0`, chips JSONB), keep `Record Tip · Cash to Hand Out`.
- Update subtitle to reflect: *"Chips → cash. Cash counted as income; goes into Monthly Tips pool."* (UI copy only — no DB trigger change needed; `tips_live` is already excluded from `cash_result`/`tables_result` triggers and is naturally surfaced as positive income in Monthly Tips).

**Tips Poker / Tips Floor — no balance impact (unchanged)**
- Current code already excludes these types from balance triggers. Confirmed in migrations. No backend changes.

**Submit guard**
- `tips_poker` now also requires `employeeId`; mirror existing `tips_floor` check.

### 2. `ActiveShiftView.tsx` — colored buttons

Replace the three identical `variant="outline"` Tips buttons with semantic-token tinted variants (no raw colors):
- **Tips Live** — emerald tint (`bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25`).
- **Tips Poker** — amber tint (`bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25`).
- **Tips Floor** — sky tint (`bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40 hover:bg-sky-500/25`).
- Keep `variant="outline" size="sm"` envelope so density/system rules still apply; tint added via `className`. Icons unchanged (`Gift` / `Coins` / `UserCheck`).

### Files touched
- `src/components/cage/TipsDialog.tsx` — combobox component, poker selector, copy.
- `src/components/cage/ActiveShiftView.tsx` — colored Tips buttons.

### Out of scope
- No DB / RLS / trigger / edge changes (no version bump).
- No changes to Monthly Tips / Live Game Tips / Floor Tips / Club Poker Tips report tabs.
- No `tips_recipient_employee_id` schema change (column already exists).
- No change to balance / cash_result math.
