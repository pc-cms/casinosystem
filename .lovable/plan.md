## Status of items 1–4

After audit, **items 1 and 3 are already complete** in the current codebase:

- **#1 TOTP-only redeem** — `cashier-redeem-by-qr` only calls `verifyClubToken` (HMAC + `exp`). `club-wallet` issues a fresh 60s `redeem_token` per poll. No permanent QR token path exists.
- **#3 IssueTicketDialog** — `src/components/cage/IssueTicketDialog.tsx` exists (118 lines) and is wired into `ActiveShiftView.tsx:393`.

So only **#2 and #4** are real work.

---

## #2 — AM Performance dashboard

New page `src/pages/admin/AmPerformancePage.tsx` at route `/admin/am-performance`.

**Access:** `RoleGuard` for `account_manager | finance_manager | super_admin`. AM sees only their own data; FM/super_admin can pick any AM.

**Data sources (all existing tables):**
- `am_budget_ledger` (granted, top_up, cashback, reversal) — issued credits per AM
- `promo_grants` (status, source, am_id, player_id) — active vs expired
- `promo_redemptions` (player_id, amount, created_at) — actually used credits
- `casino_visits` (player_id, business_date) — converted visits
- `client_sessions.session_result` — NEP attributable to promo-touched players (linked via `am_budget_ledger.player_id`)

**Layout (PageShell + PageHeader + PageSection):**
1. **Filters bar**: AM picker (FM/admin only), casino picker, date range (default: this month).
2. **KPI strip (4 cards)**:
   - Budget topped up (TZS)
   - Credits issued (TZS) — sum of `reason='grant'` debits
   - Credits redeemed (TZS) — `promo_redemptions` for AM's players
   - Net Player Earnings (NEP) from AM players — sum of `session_result` for players who received a grant in the period
3. **Funnel card**: Players granted → Players who visited → Players who redeemed → Conversion %
4. **Per-player table** (DataTable): Player, Granted, Redeemed, Visits, Last visit, NEP, ROI (NEP / granted).
5. **CSV export** via existing `excel-export.ts`.

**Implementation:**
- One server-side RPC `am_performance_summary(_am_id, _casino_id, _from, _to)` returning JSON `{ kpis, funnel, players[] }`. Builds aggregates with single CTEs over the tables above. `SECURITY DEFINER`, `SET search_path = public`. Granted to `authenticated`.
- React Query hook `useAmPerformance({ amId, casinoId, from, to })` in the page file.
- Lazy route in `App.tsx`, sidebar link under PROMO → "AM Performance".

## #4 — Fix `use-weekly-bonus` test false-positive

The failing test (`src/test/business-logic.test.ts` regex match on `use-weekly-bonus.ts:101`) flags the optimistic `qc.setQueryData(key, list)` as a "write without RLS scope". It's an in-memory cache update, not a DB write.

**Fix:** Update the test's regex/whitelist to skip optimistic `qc.setQueryData` / `qc.cancelQueries` lines (look for `queryClient`/`qc.` prefix), so legit DB writes are still flagged. No production code changes.

## #3 (verification only)

Audit `IssueTicketDialog` once more in build mode:
- confirm RPC `cashier_issue_lottery_ticket` exists in DB and grants are correct
- confirm payment_method handling (cash vs credits)
- otherwise no changes

## Version bump

`package.json` patch bump → `1.3.261` (new RPC + new page = backend change).

## Out of scope

- Lottery draw / winner workflow
- FM top-ups for house fund / campaign budgets
- Push/SMS notifications
- DB Scaling 3 Years (still deferred per memory)
