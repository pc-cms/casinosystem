
# Premier Club — Brand-Accurate Landing + Auth + Registration

Rebuild `club.*` subdomain as a player-facing brand experience using the Premier Casino brand book. Replaces the current bare OTP screen with a cinematic landing, a polished OTP login, and a self-service registration flow — all in the official brand identity.

## Brand System (from Guideline 2025)

| Token | Hex | Use |
|---|---|---|
| `brand-red` | `#A0000D` | Predominant background |
| `brand-red-2` | `#D00D13` | Hover / accent red |
| `brand-magenta` | `#EE49C3` | Gradient accent only |
| `brand-soft-gold` | `#E8C688` | Type & accents on dark |
| `brand-dark-gold` | `#A68E61` | Type & accents on light |
| `brand-light-blue` | `#B1EFFF` | Inverted backgrounds / chip |
| `brand-ink` | `#0a0a0a` | Deep contrast |

**Fonts**: Faberge (display headings — already loaded as `/fonts/Faberge-*.otf`) + Inter (body — already loaded). Aquawax FX is paywalled; we approximate with Inter as documented in the brand book's intent (clean modern sans).

**Signature pattern**: SVG of concentric rings + dotted halo over dark-red background (matches pages 21-23 of the guide).

**Slogans used**:
- Hero: "Premium gaming in Tansania"
- Sub-hero: "Only for those who dare"
- Footer mark: "Subtle. Seductive. Prestigious."

**Logo**: reuse `/public/arusha-premier-logo.svg` (already in project, same elephant+chip mark).

## Scope

### 1. Routing (`src/App.tsx`)
Inside the existing `__club__` subdomain block:
- `/` → **ClubLanding** (new public marketing page)
- `/club` → redirect to `/`
- `/club/login` → redesigned OTP login (existing logic, new look)
- `/club/register` → new 3-step registration wizard
- `/club/wallet | /shop | /tickets` — unchanged behavior, inherit new theme tokens

### 2. ClubLanding (`/`)
Single-scroll mobile-first page on dark-red brand canvas with dotted pattern overlay.

1. **Hero** — fullscreen `#A0000D` with concentric-rings SVG, elephant logo top-center, Faberge headline `PREMIER CLUB`, gold tagline "Premium gaming in Tansania", and two CTAs:
   - Primary: **Join the Club** → `/club/register` (soft-gold filled)
   - Ghost: **Sign In** → `/club/login` (gold outline)
2. **Manifesto strip** — italic Faberge "Only for those who dare." over dot pattern.
3. **Member Benefits** — 4 glass-on-red cards with gold icons: Cashback, Promo Codes, Lottery Tickets, Exclusive Shop.
4. **How it works** — 3 numbered gold steps: Register → Play → Redeem, with hairline gold connectors.
5. **Network** — 4 gold pill badges: Arusha · Mwanza · Dodoma · Mbeya.
6. **Footer** — small Faberge "Subtle. Seductive. Prestigious.", © 2025 Premier Casino.

### 3. ClubLogin (`/club/login`) — restyled
Same `clubApi.sendOtp`/`verifyOtp` logic. New look:
- Dark-red canvas + dot pattern.
- Centered black glass card with soft-gold hairline border (1px `#E8C688`/40%).
- Faberge headline "Welcome back" in soft gold.
- Phone step → 6-digit OTP step with large monospace input.
- Secondary link "New here? Create an account" → `/club/register`.

### 4. ClubRegister (`/club/register`) — NEW
Wizard, single glass card, gold-on-red:
1. **Phone** → `club-send-otp` (reused).
2. **Verify** (6-digit) → `club-verify-otp`. If `player_exists` → `/club/wallet`. Else next step.
3. **Profile** — First name, Last name, Date of birth (18+ guard), ID number (optional), preferred branch (Arusha / Mwanza / Dodoma / Mbeya). Submit → new edge function `club-register-player`.
4. **Done** — gold check, "Welcome to Premier Club" + button to wallet.

**New edge function `club-register-player`**:
- Auth: club session token (`verifyClubToken` from `_shared/club-token.ts`).
- Validates: 18+ DOB, unique phone, optional unique ID, valid branch slug.
- Creates `players` row (`verification_status='pending'`, `source='self_registration'`, `preferred_casino_id`).
- Ensures `club_accounts` row.
- Returns the player.

No new tables — uses existing `players`, `club_accounts`, `club_otp_codes`.

### 5. Theme isolation
- New `.club-theme` block in `index.css` declaring the brand tokens (HSL) — does not touch global CMS theme.
- `ClubLayout` wraps content in `<div className="club-theme">`. Header/bottom-nav hidden on `/` and `/club/register`.
- Reusable `ClubBackdrop` component renders the concentric-rings + dot SVG (no extra deps).
- Faberge already loaded globally via `index.css`.

## Technical Section

### Files to create
- `src/pages/club/ClubLanding.tsx`
- `src/pages/club/ClubRegister.tsx`
- `src/components/club/ClubBackdrop.tsx` — SVG dot/rings pattern.
- `src/components/club/ClubCard.tsx` — black-glass card with gold hairline.
- `supabase/functions/club-register-player/index.ts`
- Migration: SECURITY DEFINER RPC `club_self_register(_phone, _first, _last, _dob, _id, _casino_slug)` invoked by the edge function with service role; keeps RLS strict on `players`.

### Files to edit
- `src/App.tsx` — add `/` (landing) + `/club/register` routes inside `__club__` branch.
- `src/pages/club/ClubLayout.tsx` — hide chrome on landing & register; wrap with `.club-theme`.
- `src/pages/club/ClubLogin.tsx` — restyle with brand tokens, add "Create account" link.
- `src/lib/club-api.ts` — add `register(payload)`.
- `index.css` — append `.club-theme` block with brand HSL tokens + `.club-pattern` utility.
- `package.json` — patch bump.

### Out of scope
- KYC document upload (we just set `verification_status='pending'`).
- Push notifications, native PWA install prompt copy changes.
- Restyling `/club/wallet`, `/club/shop`, `/club/tickets` deep visuals (they inherit new tokens automatically; no layout changes).

## Verification
- Visit `club.casinosystem.app` → brand-accurate landing renders (dark red, Faberge, elephant logo, dot pattern).
- "Join the Club" → 3-step register → creates `players` + `club_accounts` → redirects to wallet.
- "Sign In" → existing OTP works.
- Other subdomains (`arusha.*`, `mwanza.*`, root admin) unchanged.
- `bun vitest run` green.
