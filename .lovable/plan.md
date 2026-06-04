## Next batch — Lottery + AM Budget + Cashier Ticket Issuance

Continuing Phase 5/6 of Premier Club. Three focused pieces:

### 1. Lottery ticket purchase (Club PWA + RPC)
- New RPC `club_buy_lottery_ticket(lottery_id, qty, casino_id)`:
  - Validate lottery `status='open'` and `draw_date >= today`.
  - FIFO debit from `promo_grants` (reuse same pattern as `redeem_promo_fifo` / `club_place_shop_order`).
  - Insert N rows into `lottery_tickets` with auto-generated ticket numbers (sequential per lottery, zero-padded).
  - Write `promo_wallet_ledger` row with reason `lottery_purchase` and ref = lottery_id.
  - Respect daily casino spend cap (`club_daily_spend_limits`).
- Edge function `club-buy-ticket` calling the RPC (uses `_shared/club-token.ts`).
- `src/lib/club-api.ts` → add `buyTicket(lottery_id, qty, casino_id)`.
- `src/pages/club/ClubTickets.tsx` → add qty input + Buy button per lottery; show "My tickets" list (numbers + draw date) below.

### 2. Cashier "Issue ticket" panel (in-cage sales)
- New `IssueTicketDialog` component (sibling of `PromoInDialog`) in `src/components/cage/`.
- Player search → pick open lottery → qty → confirms cash payment (cashier collects cash and presses Issue).
- Calls a new RPC `cashier_issue_lottery_ticket(player_id, lottery_id, qty, payment_method)` that:
  - Inserts tickets directly (no promo wallet debit; cash-paid).
  - Records into `cashless_transactions` or a dedicated `lottery_tickets.payment_method` field (`cash` | `credits`).
  - Audit row in `activity_logs`.
- Add button into `ActiveShiftView` next to the existing "Promo IN" button.

### 3. AM "My Budget" page (`/admin/am-budget`)
- Lazy route, `RoleGuard` for `account_manager | super_admin | finance_manager`.
- Per-casino balance cards (read `am_budgets` for current AM × all accessible casinos).
- Ledger table (`am_budget_ledger`) with filters: casino, date range, reason (top_up / grant / cashback / reversal).
- Running balance column + totals (issued, topped-up, current).
- CSV export via existing `excel-export.ts`.
- Wire into AppSidebar under Admin / Promo section.

### 4. Wiring
- `App.tsx` — three new lazy routes (`am-budget`, plus any missing).
- `package.json` — bump to `1.3.256` (DB + edge fn changes).

### Out of scope this batch
- FM top-up screens for AM budget / house fund / campaign budgets — next batch.
- `/reports/promo-codes`, `/reports/promo-expiry`, `/reports/cashback`, `/reports/am-budget` — next batch.
- Permanent QR + TOTP redemption (Phase 4) — still pending, after FM top-ups.

Proceed?
