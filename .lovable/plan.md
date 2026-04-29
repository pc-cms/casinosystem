# Player Statistics — Audit & Recommendations

This is an analysis report only. Nothing will be changed until you approve.

## 1. What we have today

**Header KPIs**
Visits · Total time · Total IN · Result · Last visit · Registered.

**Tab "Info & History"**
Notes timeline + visits table with: Date, Casino, Check-in, Check-out, Duration, Position, Total IN, Result. Period totals in footer.

**Tab "Statistics"**
Per-table grid: Position / Total duration / Total IN / Total OUT / Result + period totals. Slots — placeholder.

**Tab "Connections"** — group history.
**Lotteries / Tickets** — placeholders.

**Data sources**
- `casino_visits` (check-in/out, position)
- `transactions` (buy / cashout, table_id)
- `client_sessions` (avg_bet, total_bet, hands_played, duration) — currently empty in DB
- `player_economy` view (lifetime totals) — not yet used on profile
- `player_notes`, `player_tags`, `group_members`

## 2. Gaps and problems

### Critical
1. **`client_sessions` is empty (0 rows)** — Pit Tracker either isn't writing or writes elsewhere. The "Statistics" duration column will always be near zero. Either we wire Pit Tracker to insert sessions, or we drop "duration" from Statistics until it's fed.
2. **Buy/Cashout totals don't include `expenses`** (comp / gift) — `expenses` table has `player_id`. House result on player level should be `IN − OUT − comps`.
3. **No "Average bet" / "Hands"** — both exist in `client_sessions` but not surfaced.
4. **No theoretical win / hold %** — the standard casino KPI `Theo = avg_bet × hands × house_edge × time` is missing. Without it, ranking players is impossible.
5. **No lifetime KPIs from `player_economy`** — we recompute on the client. Should use the view (it's authoritative and matches what the rest of the app shows).

### Important
6. **No frequency metrics**: visits per month, avg session length, longest streak, days since last visit, churn flag (no visit > N days).
7. **No session-level breakdown** inside Statistics (only per-table). User can't see *individual* sessions to investigate anomalies.
8. **No game-type split** (BJ / Roulette / Poker). `gaming_tables.game` exists.
9. **No shift / business-day analytics** — when does this player come (M/N/E/L), which weekday, peak hour. Useful for marketing & host scheduling.
10. **No casino split** for multi-casino players (Total IN per location).
11. **No currency awareness** — totals are summed across currencies. Transactions don't carry currency, but cage operations do; this needs a clarifying decision.
12. **Slots tab empty** — slots aren't tracked per-session today; we could at least show `expenses`-based slot top-ups if those flow through cage.

### Nice-to-have
13. **Visit heatmap** (weekday × hour) — quick visual rhythm.
14. **Trend sparklines** on KPIs (last 12 weeks).
15. **Comparison to player's own average** ("this period: −18% vs avg").
16. **Group attribution**: when player came with a group, mark the row.
17. **Documents/photos count** under Info.
18. **Last 5 notes** preview directly in header card (high-signal flags).

## 3. Proposed new metrics

### Header (lifetime, from `player_economy` + visits)
- **Drop** (lifetime IN)
- **Cashout** (lifetime OUT)
- **Comps** (lifetime expenses tagged to player)
- **Real result** (Drop − Cashout − Comps) with positive/negative coloring
- **Hold %** = Result / Drop (color-coded)
- **Visits**, **Total time**, **Avg session**, **Days since last visit**
- **First visit** / **Member since**

### Tab 1 "Info & History" — keep + add
Per visit add: **Avg bet**, **Hands**, **Theo win**, **Comps**, **Hold %**.
Add summary row: **vs personal average** indicator.

### Tab 2 "Statistics" — restructure into sub-views
**By table (existing)** — add columns: Sessions, Hands, Avg bet, Theo, Hold %.
**By game type** — Game / Sessions / Duration / Drop / Result / Hold %.
**By casino** — for multi-casino players.
**By weekday + hour heatmap** — visual rhythm.
**Sessions list (raw)** — collapsible, last 50, with table, dealer if available, avg bet, hands, duration, in/out.

### Tab 3 "Connections" — extend
Add: number of co-visits with each linked player, shared sessions on same table.

## 4. Suggested layout

```text
┌─ Header (photo · identity · 8 KPIs · phone/birth/type/status) ─────┐
│                                                                    │
├─ Tabs ──────────────────────────────  [Day Week Month Year Custom]┤
│ Info │ Statistics │ Connections │ Lotteries │ Tickets             │
└────────────────────────────────────────────────────────────────────┘

Statistics tab:
┌─ Summary strip (period): Drop · Cashout · Comps · Result · Hold% ─┐
├─ By table (current grid + Hands, Avg bet, Theo) ──────────────────┤
├─ By game type ────────────────────────────────────────────────────┤
├─ By casino (only if >1) ──────────────────────────────────────────┤
├─ Heatmap weekday × hour ──────────────────────────────────────────┤
└─ Sessions (raw, collapsible) ─────────────────────────────────────┘
```

## 5. Technical notes

- Use `player_economy` view for lifetime numbers (single source of truth).
- Add hook `usePlayerExpenses(playerId, range)` for comps.
- Add hook `usePlayerEconomy(playerId)` reading the view.
- Pull `gaming_tables.game` in the existing transactions/sessions queries to enable game-split.
- Heatmap = pure client aggregation over `casino_visits` (no schema change).
- Hold % formula: `(IN − OUT − comps) / IN`; show "—" when IN = 0.
- Theo win needs a `house_edge` per game — not in DB. Either hard-code defaults (BJ 0.5%, Roulette 2.7%, etc.) or add a table `game_settings(game, house_edge)`. Recommend the latter.
- No DB migration needed for items 1–11 except: `expenses.player_id` already exists; optional `game_settings` table for Theo.
- Performance: expand `usePlayerTransactions` limit (currently 2000) — players with long history can blow past this. Add server-side date filter when range is set.

## 6. Questions before implementation

1. **Slots scope** — should slots be tracked at all in v1, or do we ship table-only and revisit when slot tracking exists?
2. **Theo / house edge** — add `game_settings` table now, or hard-code defaults in `lib/casino-edges.ts`?
3. **Comps** — confirm that `expenses` with `player_id` set are the right source of "comps given to this player".
4. **Currency** — for now sum everything as one number, or split by currency? (Transactions table has no currency column today.)
5. **Priority** — which subset do you want first? Suggested order: (A) header lifetime from `player_economy` + comps + hold%, (B) per-table extra columns (hands, avg bet), (C) game-split, (D) heatmap, (E) raw sessions list, (F) connections enrichment.

After your answers I'll trim this to a concrete build plan and start implementing.
