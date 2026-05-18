# Casino Management System (CMS) — Developer Onboarding

> Read this once before touching any code. Then keep `mem://index.md` open — it has all the per-feature nuances.

---

## TL;DR (30 seconds)

Multi-location **casino management system** for a chain of land-based casinos in Tanzania.

- **Frontend:** React 18 / Vite 5 / TypeScript 5 / Tailwind v3 / shadcn/ui / TanStack Query / React Router.
- **Backend:** Supabase (Postgres 15, Auth, Edge Functions on Deno, Storage, Realtime).
- **Business logic lives in the database** (Postgres triggers + RPC functions), not on the client.
- **Deployment topology:** Cloud Supabase is primary. Each casino optionally runs an **on-prem node** (Docker Compose) that syncs back to Cloud through a custom outbox/inbox engine.
- **Philosophy:** strict manual entry, no AI in business logic, immutable data, full audit, role-based isolation per casino subdomain.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind v3, shadcn/ui |
| State / Data | TanStack Query, React Context (auth, casino, density, theme) |
| Routing | React Router (subdomain-aware) |
| Backend | Supabase: Postgres 15, Auth, Edge Functions (Deno), Storage, Realtime |
| Business logic | **Postgres triggers + SECURITY DEFINER RPCs** |
| On-prem | Docker Compose: `postgres`, `postgrest`, `nginx`, `cms-sync`, `cms-updater`, `cloudflared` |
| Sync | Custom outbox/inbox engine, idempotent, `applying`-GUC loop prevention |
| PWA | `vite-plugin-pwa`, per-casino manifests, IndexedDB offline cache (24h) |
| Tests | Vitest (unit), Playwright (e2e) |

---

## Topology and routing

```text
                       Cloud Supabase (primary)
                                 ▲
                                 │ cms-sync (outbox/inbox, idempotent)
                ┌────────────────┼────────────────┐
                │                │                │
            Arusha            Dodoma           Mbeya       ← on-prem Docker nodes
           (LAN: cashiers, pit, reception)
                +
           Cloudflare Tunnel for remote dev access
```

**Subdomain-based casino isolation** (resolved in `src/lib/casino-context.tsx`):

| Hostname | Effect |
|---|---|
| `arusha.casinosystem.app` | `slug = arusha` → all hooks filter by Arusha's `casino_id` |
| `premier.casinosystem.app` | Cross-casino summary mode (super_admin / finance_manager only) |
| `casinosystem.app` | B2B landing page (no client login) |
| `local-arusha.casinosystem.app` | Cloudflare Tunnel into Arusha on-prem (debugging) |
| `arusha.local` / IP (on-prem) | `runtime-config.json` pins the slug for that physical box |

**Rule:** every data hook scopes by `useCasino().activeCasinoId`. **Never** bypass by role. Even `super_admin`, `finance_manager`, and `surveillance` only see the current subdomain's casino. Cross-casino visibility is exclusive to `premier` (`isSummaryMode`) and Admin → Network panels.

---

## Roles and access

Roles (stored in **separate** `user_roles` table — never on `profiles`, to prevent privilege escalation):

`cashier`, `pit`, `floor_manager`, `manager`, `reception`, `hr`, `finance_manager`, `surveillance`, `super_admin`

**Access resolution:**

- `has_role(uuid, app_role)` SECURITY DEFINER function — used in RLS policies (avoids recursive policy traps).
- Module visibility: `role_module_defaults` (baseline per role) + `user_module_permissions` (per-user override), resolved via `effective_module_perms` RPC.
- **Financial visibility** (`canSeePlayerFinancials` in `src/lib/role-access.ts`) is **role-locked** and not overridable per-user.
- **Manager Override** — session toggle requiring a manager password. Unlocks high-stakes actions (approve expenses, reopen tables, edit past rota, blacklist, close cage, close business day).
- **Floor Manager** has operational parity with manager but no financial surface access.
- **Operational Business-Day Scope:** Pit / Cashier / Reception see only the **current** business day on every list and report. Manager Override lifts this. Cashier and Reception **never** see lifetime player financials (KPIs / Visits / Stats / Tracker are hidden, layout unchanged). Implemented via `useBusinessDayFilter()` and `canSeePlayerFinancials()`.

Full matrix: `docs/ACCESS-MATRIX.md`.

---

## Business day

- Timezone strictly **Africa/Dar_es_Salaam (GMT+3)**.
- Opens automatically on the first operation of the day.
- Closed **manually** from Cage — button always visible to `cashier / manager / pit / finance / super_admin`; **manager password always required**.
- **Auto-close at 11:00 EAT** if forgotten.
- **Source of truth:** `useEffectiveBusinessDate()` → RPC `get_current_business_date` (reads `business_day_closures`). Legacy `getBusinessDate()` is **fallback only**.
- On close, a **full JSONB snapshot of 7 sections** is written to `business_day_closures` and surfaced at `/business-days` with role-gated per-field audit edits (`edit_business_day_snapshot` RPC).

---

## Module map

### Pit (Live Floor Operations)
- **Rota** — dealer / floor staff schedule by shift (M / N / E / L).
- **Breaklist** — 20-minute slots 18:00 → 05:00, dealer table positions (BR / D1 / I1 / …). **Pit Bosses (`is_pit_boss=true`) never appear in Breaklist** — only in Rota under their own section with a PB label.
- **Attendance** — 9h auto-fill **only** after `business_day_closures` row exists; the current open day is never auto-filled.
- **Active Players** — who is at which table, real-time.
- **Live Game Dealers** — dealer registry.
- **Floor Tables** — drag-and-drop player seating.

### Cage (Cashier)
- **Open / Close Shift** — 3-step wizard (Cash Count → Chip Count → Transfers).
- **Transactions** — Buy-in / Cash-out / Fill / Credit / Misc. All immutable; corrections require new transactions.
- **Chip Conservation Law:** `Initial = Locations + Floor + Miss`. Violation blocks shift close. Per-casino strict / observation toggle for legacy rollouts.
- **Chip Emission** — Manager-only baseline expansion.
- **Shift P&L = `shifts.tables_result`** (chip-based, latest snapshot vs baseline, − Fill + Credit). Kept in sync by DB trigger. `shift_result` is a **deprecated alias**.
- **Cash Desk Balance:** `CDR = ΔCash + Expenses + Collection − AddFloat + SlotsOut − SlotsIn` (no Miss); `Balance = CDR − Tables − Miss`.
- Cashier-only surface. Manager / Surveillance / Pit / Reception / HR / Finance see read-only history.

### Tables
- **Tables** — open / close, current chip stack.
- **Table Tracker** — hourly results (18:00 → 04:00), full arrow-key navigation.
- **Chip Count → Tracker bridge** — snapshot result auto-writes into the tracker hourly slot inside the HH:50 – HH+1:10 window.
- **Table Analytics** — `/tables/analytics`.
- **Live Table Result = ONLY the latest Chip Count snapshot vs baseline.** Never cumulative. Tracker is not used for P&L.
- Tables are **archived**, never physically deleted.

### Players (CRM)
- Unified terminology: **"Player"** (no Guest / Client). Ranks: `N` (Normal, lowest), `G`, `P`, `D`.
- **Cards:** CMS + 6-digit RFID. Cards and accounts are **never** deleted.
- **OCR registration** — non-destructive AI auto-fill, triggers duplicate check (exact ID match blocks; multi-tier fuzzy match warns).
- **Player Tracker** — Bet / In / Out / Drop with segmented total bet calculation on average bet edits.
- **NEP Drop Split:** `Drop R` (External) vs `Drop V` (Recycled + TT). Lifetime NEP per player neutralizes fake-drop from returned winnings.
- **Player Chip Adjustments** — audit-only chip in / out + comment from `PlayerPreviewHeader`. Pit / Manager only. Immutable. No cash or NEP impact. (Replaces deprecated `chip_transfers` UI; table still exists.)
- **Position History** — DB-trigger log of every position change (table / hall / slots) for whereabouts analytics.
- **Global Player Base** — network-wide sync, alerts, concurrency block (a player can only be in-casino at one location at a time).
- **Intelligence Model** — three layers: Category (D / P / G / N) + Flags + Notes.
- **Blacklist** — entry and financial block, Manager override, visual catalog mode.
- **Groups** — analytical-only, time-based financial period tracking.

### Financial Control
- **10 Wallets** ledger, trigger-controlled, negative daily profit is normal.
- **Global Categories** — unified budget / expense categories mapped to parent groups.
- **Budget** — per casino, `RESERVE` or `DIRECT_EXPENSE`, break-even point. Locked by default; immutable audit log for changes. Actual / Reserved computed dynamically from ledger.
- **Cash Count** — aggregates 6 liquid sources, delta-based editing.
- **Expenses** — filtered by business date, Target Casino / Player, override required.
- **Collections** — owner withdrawals, excluded from expenses, `MAIN_CASH` / `OFFICE_SAFE` only.
- **Daily Review** — pulls `cash_result`, automated earnings transfer, locks financial period.
- **Cage Float Equalization** — automated balancing between main safe and cage.
- **Inter-Casino Transfers** — dual-confirmation protocol.
- **Adjustments** — exclusive correction transaction type for Financial Director.
- **Reserve Control** — isolated physical money pools must match ledger balances.
- **Global Reconciliation:** `Expected Total (Ledger) − Real Total (Cash Count) = 0`.
- **Finance Summary** (premier only) — network-wide aggregated KPIs.
- **Income** is derived strictly from liquid net movement.

### HR / Staff Master / Payroll
- **Staff Master** — HR-owned, completely isolated from financials.
- Legacy `Employees` is migrating into Staff Master.
- **Payroll** — periods, bank export, settings. Computed from attendance + tips + bonus.

### Reports
- **Business Days** — JSONB snapshots, per-field audit edit. Role-gated EDIT (Finance = $$$, Manager = Pit).
- **Miss Chips Monthly** — `/reports/miss-chips`, month picker.
- **Table Results**, **Import Reports** (competitor OCR), **Activity Logs** (60-day minimum retention).

### CCTV / Surveillance
- Premier subdomain, read-only + tags / observations.
- Access restricted to employee photos, isolated by casino ID.

### Admin
- Users + Permissions matrix editor.
- Sync logs + Peers panel: **Upload** (Local → Cloud backfill via `sync_seed_from_existing`) and **Clone** (Cloud → Local wipe + replace via `sync_reset_outbox` + `cloud-seed-export` stream).
- Network panels.

---

## Architectural principles (read twice)

1. **Server-side financial computation.** UI sends raw inputs only. All authoritative financial values are computed by DB triggers / RPCs. Never trust client calculations.
2. **Immutability everywhere.** No deletions. Corrections via new transactions. Archival instead of physical delete (e.g. `gaming_tables`).
3. **DB triggers enforce business logic** — chip conservation, tag limits, uniqueness. Don't validate critical rules only on the client.
4. **No client-side admin checks.** Always go through `has_role()`. Never check admin status via `localStorage` / `sessionStorage` / hardcoded credentials.
5. **Validation triggers, not CHECK constraints**, for time-based validation. CHECK must be immutable; expressions like `expire_at > now()` will break restores.
6. **Offline-first cashier.** Binary online/offline model, write-and-sync, exponential backoff 1s → 16s, IndexedDB cache 24h. No adaptive mobile network strategies.
7. **Sync engine.** Outbox on source + idempotent inbox on destination + `applying`-GUC to prevent loops. Cloud is primary, on-prem is a durable peer with cursors. Exchange log via `peer-mesh /log`.
8. **Realtime.** Attach all handlers **before** `.subscribe()`. RLS on realtime tables is mandatory.
9. **Casino isolation.** Scope every query by `useCasino().activeCasinoId`. Don't widen by role.
10. **Business-day scope.** Pit / Cashier / Reception are current-day-only. Lift only via Manager Override.

---

## Design system (non-negotiable)

**Required wrappers:** `PageShell` + `PageHeader` + `PageSection` + `FormGrid` + `ResponsiveDialog` + `DataTable`.

- ❌ No manual `<h1>`, no raw `grid grid-cols-*` for forms, no manual `h-*` on inputs / buttons.
- ❌ No custom color classes (`bg-white`, `text-black`). Only semantic tokens from `src/index.css` (all colors in **HSL**).
- ✅ Financial colors: `cms-amount-positive` (profits) and `cms-amount-negative` (losses). Negative results are normal.
- ✅ Density tokens `--density-*` drive Input / Button / row heights via `[data-density="comfort|compact|touch"]`. Default by role: cashier / pit → `compact`, others → `comfort`, touch-pointer → `touch`. User override in Profile dialog.
- ✅ Date format **DD/MM/YYYY** everywhere, via `fmtDate` / `fmtDateTime` / `fmtDateOnly`. Never inline `YYYY-MM-DD` or `YYYY.MM.DD`.
- ✅ Number formatting: **SPACE** thousand separator (`1 250 000`), never comma.
- ✅ Currencies sorted desc: TZS, USD, EUR, GBP, KES. Chip denominations sorted desc in all grids / tables.
- ✅ Mobile uses bottom **Drawers**, not modals.
- ✅ One primary `default` button per surface. Outline for filters. Ghost for icons. Destructive for delete only.
- ✅ Role visibility hides content within the **same** shell — never changes layout.
- ✅ **English-only UI.** No Russian or other languages in any user-facing string.
- ✅ High-density grids use monospaced fonts and subtle dot (`·`) placeholders.
- ✅ Financial totals use `bigint` in the database.

---

## On-prem deployment

**Always via:**

```bash
curl -fsSL https://casinosystem.app/install | sudo bash -s -- <flags>
# or
sudo casino-update <flags>
```

Supported flags: `--update`, `--rebuild`, `--repair`, `--wipe`, `--reset`, `--reconfigure`, `--enable-remote`, `--disable-remote`.

**Never** give users raw `docker` / `psql` / SQL commands or ask them to edit files in `/opt/casino-system/deploy` directly. All fixes ship through the bootstrap from the repo.

`install.sh` sets `FRONTEND_VERSION` automatically; the local build must show the real version from `package.json`, never the literal `local`. The `· local` suffix in `VersionIndicator` marks on-prem builds.

**Auto-bump `package.json` patch version on any backend change without asking:** migrations, edge functions, RPC / RLS / triggers, storage, sync / cron. Skip for purely cosmetic UI tweaks.

---

## Classic foot-guns (do NOT do)

- ❌ Store roles on `profiles` (privilege escalation).
- ❌ Edit `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`, or project-level settings in `supabase/config.toml`.
- ❌ Modify `auth` / `storage` / `realtime` / `supabase_functions` / `vault` schemas.
- ❌ `ALTER DATABASE` statements in migrations.
- ❌ Sum `gaming_tables.closing_result` for P&L — use `shifts.tables_result`.
- ❌ Write `cash_result` into `daily_summaries.tables_result`.
- ❌ Use `getBusinessDate()` (fallback only) instead of `useEffectiveBusinessDate()`.
- ❌ Show Pit Bosses in the Breaklist grid.
- ❌ Auto-confirm email signups, or use anonymous sign-ups.
- ❌ Russian / other languages in UI strings.
- ❌ Hardcode admin checks on the client.

---

## Entry points for a new developer

1. `src/App.tsx` — routes.
2. `src/lib/auth-context.tsx` + `src/lib/casino-context.tsx` — who am I, which casino am I on.
3. `src/lib/role-access.ts` + `src/lib/route-module-map.ts` — what am I allowed to see.
4. `src/hooks/use-*.ts` — all domain hooks (TanStack Query).
5. `src/components/layout/` — design system wrappers.
6. `docs/ACCESS-MATRIX.md` — full role × module × depth matrix.
7. `mem://index.md` (project memory) — all business-logic nuances in one place.
8. `deploy/` — on-prem Docker stack.
9. `supabase/functions/` — edge functions (OCR, sync, parity, user mgmt).

---

## Glossary

| Term | Meaning |
|---|---|
| **Pit** | Live game floor — dealers, tables, rota, breaklist |
| **Cage** | Cashier desk — chips, cash, transfers, shift open/close |
| **Baseline** | Reference chip count at table open; result = current snapshot − baseline |
| **NEP** | Net Equivalent Play — true player exposure after recycled chips |
| **Drop R / V** | External vs Recycled drop (NEP split) |
| **Miss** | Unaccounted chips after shift close, finalized from Floor |
| **Float** | Fixed pool of cage chips; managed by Manager only |
| **Business day** | 05:00 EAT → 04:59:59 EAT next day; closed manually from Cage |
| **Manager Override** | Session toggle (password-gated) unlocking high-stakes actions |
| **Summary mode** | `premier` subdomain cross-casino view for super_admin / finance_manager |
