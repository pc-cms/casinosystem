## Account Manager + Club — Final Module Plan

### 1. Trusted-player verification (AM bypass KYC)

New tab in AM workspace: **Trusted Players**.
- AM picks a player → "Mark as Trusted" → required reason text (≥10 chars) → record:
  - `players.verification_status = 'verified'`
  - `players.verified_source = 'am_trusted'`
  - `players.verified_by_user = <am>`, `verified_at = now()`
  - Row inserted in `kyc_reviews` with `decision='trusted_bypass'`, `notes=<reason>` for audit.
- Same tab lists every player with `verified_source='am_trusted'`; AM can **Revoke** (back to `unverified`, audit row).
- Only role `account_manager` sees this tab (not manager/floor_manager/finance).

### 2. AM scope — single global role

- `account_manager` is **always network-wide**. Login from any subdomain (Premier / Arusha / Mwanza / on-prem) gives identical workspace.
- Drop the idea of per-casino AM. No `account_manager_premier` role.
- RLS update: queries scoped on `casino_id` are bypassed when `has_role(auth.uid(),'account_manager')` (read-only across all casinos for AM-owned tables: players, kyc_reviews, promo_grants, player_crm, club_accounts, lotteries, shop_orders).
- Write paths (verify/revoke, promo grant, segment edit) still require AM role — no casino filter.
- Sidebar: `account_manager` sees only the **AM Workspace** section (no Pit/Cage/Finance).

### 3. Merge CRM under AM Workspace

- Move `/crm/players` → `/am/players` (and route alias). Hooks/tables untouched (`player_crm`, `useCrmPlayers`, segments, hosts, tags).
- New AM sidebar:
  - **Players** (ex-CRM table, full network)
  - **KYC Queue** (club-app submissions, pending)
  - **Verified by Reception** (Reception-source, revocable)
  - **Trusted Players** (AM-bypass, revocable)
  - **Not Verified** (all unverified+pending)
  - **Promo Campaigns** (existing)
  - **Lotteries** (existing)
  - **Shop Orders** (existing)
- Remove duplicate "CRM" top-level entry; old `/crm/*` routes 301-redirect to `/am/*`.

### 4. Verified scope = Club App only

Codify as core memory rule:
- `verification_status` controls **only**: login to `club.casinosystem.app`, shop checkout, lottery ticket purchase, promo redemption inside Club App.
- Does **NOT** affect: Pit registration, Player Card visibility, NEP accrual, statistics, blacklist, table tracker, reception search.
- Unverified player from Reception "Save": card issued, plays normally, appears in stats. Club App login shows profile + persistent "Get verified" banner. No shop / no lottery / no redeem until verified (by Reception, AM trusted, or club-app KYC approval).

### 5. Club domain confirmation

- `club.casinosystem.app` = single Club PWA, network-wide.
- Reads home casino from `players.home_casino_id`, syncs visits/promo/balance across all casinos via existing sync engine.
- Promo rules already in DB: `promo_grants` (per-casino, per-player, expiring/non-expiring), `promo_codes` (one-time per player, casino-scoped), `lotteries` (per-casino draw date, ticket cap per player). No schema change.

---

### Technical changes

**Migration**
```sql
-- 1. extend verified_source enum
ALTER TYPE player_verified_source ADD VALUE IF NOT EXISTS 'am_trusted';

-- 2. RPC am_trust_player(_player uuid, _reason text)
--    SECURITY DEFINER, asserts has_role(auth.uid(),'account_manager'),
--    sets verification_status='verified', verified_source='am_trusted',
--    inserts kyc_reviews row with decision='trusted_bypass'.

-- 3. RPC am_revoke_verification(_player uuid, _reason text)
--    Sets verification_status='unverified', clears verified_source,
--    audit row in kyc_reviews decision='revoked'.

-- 4. Add account_manager bypass to RLS on:
--    players, player_crm, kyc_reviews, promo_grants, promo_codes,
--    promo_redemptions, lotteries, lottery_tickets, shop_orders, club_accounts.
--    Pattern: USING (casino_id = ... OR has_role(auth.uid(),'account_manager'))
```

**Frontend**
- `src/pages/admin/KycReviewsPage.tsx` → rename/move to `src/pages/am/AmWorkspace.tsx` with tabs (Players, KYC Queue, Verified by Reception, Trusted, Not Verified, Promo, Lottery, Shop).
- Add `TrustedPlayersTab` component with Mark/Revoke + reason dialog.
- `src/pages/crm/CrmPlayers.tsx` → move under `/am/players`, keep code.
- `src/components/AppSidebar.tsx` → new "Account Manager" section visible to `account_manager` role only; hide all other sections for that role.
- Route redirects `/crm/* → /am/*`, `/admin/kyc-reviews → /am/kyc-queue`.
- `src/lib/casino-context.tsx` / hooks: when role is `account_manager`, queries pass `null` casino filter (or use new `useAmScope()` returning all casino ids).

**Memory updates**
- New core rule: "Verified flag controls Club App access only (login, shop, lottery, promo redeem). All operational surfaces ignore it."
- New core rule: "`account_manager` role is always network-wide regardless of subdomain. Single role, no per-casino variant."
- New memory `mem://features/am-trusted-players` — Trusted bypass flow, audit via kyc_reviews.
- Update `mem://features/access-matrix` row for `account_manager`.

**Out of scope**
- No SMS, no club-app limits change, no new promo rules, no new card-issuance gates.
- No removal of `player_crm` table — only route consolidation.

---

### Acceptance test checklist

1. AM logs in on `arusha.casinosystem.app` → sees players from Arusha, Mwanza, Premier.
2. AM marks Reception-unverified player as Trusted with reason → status becomes verified, appears in Trusted tab, audit row in kyc_reviews.
3. AM revokes → back to unverified, banner returns in Club App.
4. Unverified player can log in to Club App, sees balance/profile, cannot buy lottery ticket or place shop order (button disabled with "Verify to continue").
5. Reception-verified player has full Club access; AM can revoke and verify again.
6. Pit operator sees player card identically whether status is verified or unverified.
7. `account_manager` role has no access to Pit/Cage/Finance routes (403).
