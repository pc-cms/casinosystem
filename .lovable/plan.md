# Premier Club — Final Implementation Plan (v3)

## Decisions locked in this round
- **Spend order**: FIFO by `expires_business_date` (nearest first) → permanent wallet last.
- **AM budget**: per-casino wallet, topped up by Finance Manager; no cross-casino transfer. Issuance blocked when balance insufficient.
- **Verification bonus**: paid from **House Promo Fund** (separate ledger), never touches AM budget. Configurable amount per casino + per active campaign.
- **Promo codes**: flexible — each code/campaign has `code_active_from`, `code_active_until`, and `grant_lifetime_mode = lifetime | days_after_redeem | fixed_business_date`. Per-player limit + global cap. Reports required.

---

## 1. Roles & Auth
- New role: `account_manager` (network-wide, premier-only, sees finances).
- Club PWA auth: phone-only via Beem Africa (OTP). Existing players linked by phone.

## 2. Verification (Two-step)
- Reception verify → player immediately `verified` + verification bonus auto-credited (if active house campaign exists).
- AM audit queue: confirms or **rejects** → ledger reversal of bonus.
- Club path: AI pre-check (Gemini) → AM confirms.
- After `verified`: profile fully locked, only AM may edit (via SMS OTP for phone).

## 3. Promo Wallet & Grants
- **One wallet balance per player** = SUM(active grants).
- **Grant** = single credit issuance with own `expires_business_date` (business-day based).
- Sources: `verification_bonus`, `manual_am`, `cashback`, `campaign`, `code_redeem`, `reversal`, `expiry_writeoff`.
- Redemption at cage: FIFO across grants by nearest expiry → wallet-permanent grants last.
- Promo affects Drop/NEP; **does not** touch cashier `cash_result`.
- Cron `promo-expire` daily 07:00 EAT: moves expired grants → `expired` + writeoff ledger row.

## 4. Funding Sources (three independent pools)
| Pool | Funded by | Spent on |
|------|-----------|----------|
| **House Promo Fund** (per casino) | FM top-up | verification bonuses, house campaigns |
| **AM Budget** (per casino per AM) | FM top-up | manual AM grants, cashback, AM-funded codes |
| **Campaign Budget** (per campaign) | FM top-up at create | campaign-driven auto-grants |

Each pool has immutable ledger (`*_ledger`). Issuance debits the chosen pool; insufficient → **hard block** with clear error.

## 5. Promo Campaigns
`/admin/promo-campaigns` (AM + super_admin + FM):
- Fields: name, scope (`reception_verify | club_verify | code | manual`), funding_source (`house | am_budget | campaign_budget`), per_player_amount, grant_lifetime config, dates, active flag, total cap.
- At trigger time matching active campaign issues a grant from its funding source.

## 6. Promo Codes (Instagram etc.)
`promo_codes`:
- `code`, `campaign_id`, `amount`
- `code_active_from`, `code_active_until` (when the code itself can be redeemed)
- `grant_lifetime_mode`: `lifetime` | `days_after_redeem (N)` | `fixed_business_date`
- `per_player_limit`, `max_uses_total`, `current_uses`
- Player enters code in Club PWA → creates grant with computed `expires_business_date`.

## 7. Cashback
- Manual AM operation: opens player, sees loss for period (week/month), enters % or amount, system creates grant from AM budget.
- Logged: who/when/where/source.

## 8. Cashier Promo IN
- New "Promo IN" panel in `ActiveShiftView` (both cages).
- Cashier scans permanent QR + enters TOTP from PWA → debits grants FIFO → issues promo chips (chip_color flagged `is_promo=true`, DB blocks cash-out) or slot credit.
- Edge fn `redeem-promo` does all atomicity.

## 9. QR/TOTP
- **Permanent QR** = `player_id` (signed).
- **TOTP** generated in PWA (RFC 6238, 30s window, 6 digits), shared secret stored encrypted, validated server-side in `redeem-promo`.

## 10. KYC Queue (`/admin/kyc`)
- "Pending Club" (AI pre-checked) + "Reception Audit" (post-review).
- AM can REJECT reception verification → bonus reversed via ledger.
- AI: existing `LOVABLE_API_KEY` + `google/gemini-2.5-pro`.

## 11. Club PWA
- Same Vite SPA, lazy-loaded layout on `club.casinosystem.app` subdomain.
- Routes: `/login`, `/onboarding`, `/dashboard` (wallet + grants list + expiry), `/qr`, `/codes`, `/profile`.
- App name: **Premier Club**.

## 12. Reports (new)
- `/reports/promo-issuance` — by source, by AM, by casino, by campaign, by period.
- `/reports/promo-redemptions` — where/when/cashier/cage/amount/grant breakdown.
- `/reports/promo-expiry` — written off + by reason.
- `/reports/promo-codes` — per code: activations, by player, by period.
- `/reports/am-budget` — top-ups vs spend per AM per casino.
- `/reports/cashback` — issuance log.

## 13. Database (single P1 migration)

```text
New tables:
  club_accounts(player_id, phone, totp_secret_enc, created_at)
  club_otp_codes(phone, code_hash, expires_at, used)
  kyc_reviews(player_id, source, status, ai_result, am_user_id, ...)
  promo_grants(id, player_id, amount, remaining, source, source_ref,
               funding_pool, funding_pool_ref,
               issued_business_date, expires_business_date NULL,
               status, created_at)
  promo_wallet_ledger(grant_id, delta, reason, business_date, created_by, ...) IMMUTABLE
  promo_redemptions(id, player_id, cage_id, cashier_id, amount,
                    grant_breakdown JSONB, created_at)
  promo_campaigns(id, name, scope, funding_source, amount, grant_lifetime_mode,
                  grant_lifetime_days, grant_fixed_date, active_from, active_until,
                  total_cap, used_amount, active)
  promo_codes(id, code, campaign_id, amount, code_active_from, code_active_until,
              grant_lifetime_mode, grant_lifetime_days, grant_fixed_date,
              per_player_limit, max_uses_total, current_uses)
  promo_code_redemptions(code_id, player_id, grant_id, business_date)
  am_budgets(am_user_id, casino_id, balance) UNIQUE(am_user_id, casino_id)
  am_budget_ledger(am_user_id, casino_id, delta, reason, ref, created_by) IMMUTABLE
  house_promo_fund(casino_id, balance)
  house_promo_ledger(casino_id, delta, reason, ref, created_by) IMMUTABLE

Players extension:
  verification_status enum('unverified','verified','rejected')
  verified_at, verified_by, am_reviewed_at, am_reviewed_by, locked_at

chip_color_settings:
  is_promo bool + DB trigger blocking cash-out of promo chips

Triggers:
  - wallet balance recompute on grant/ledger change
  - profile lock: UPDATE on verified player allowed only to AM
  - ledger immutability (no UPDATE/DELETE)
  - funding pool debit on grant insert; raise on insufficient balance
  - chip emission: promo chips never enter cash_result
```

## 14. Edge Functions
- `send-otp`, `verify-otp` (Beem)
- `club-register`, `club-link-existing`
- `redeem-promo` (QR+TOTP, FIFO debit, atomic)
- `redeem-code` (validate code window + limits, create grant)
- `kyc-ai-precheck` (Gemini)
- `am-issue-grant`, `am-issue-cashback`, `am-reject-verification`
- `fm-topup-am-budget`, `fm-topup-house-fund`, `fm-topup-campaign`
- Cron: `promo-expire` 07:00 EAT

## 15. Secrets to add (P1)
- `BEEM_API_KEY`, `BEEM_SECRET_KEY`, `BEEM_SENDER_ID`
- `CLUB_TOTP_SECRET_KEY` (server-side encryption key for TOTP secrets)

## 16. Phasing
- **P1** — DB schema (single migration) + AM role + secrets + edge fns scaffolding. No UI.
- **P2** — Club PWA shell + Beem OTP login + onboarding.
- **P3** — KYC AI pre-check + `/admin/kyc` queue.
- **P4** — Permanent QR + TOTP + Promo IN panel in both cages.
- **P5** — AM tools (manual grant, cashback, reject), FM top-up screens, Promo Campaigns, Promo Codes.
- **P6** — All 6 reports.

## 17. Out of scope
- Auto-merge of duplicate players (manual via AM only).
- Per-rule auto-cashback (manual only).
- Separate Cashier "Out" entity (existing buy-in inverse covers it).

---

**Next step on approval**: start P1 (DB migration + AM role + Beem secrets + edge-function scaffolds).