## Plan: Legal pages & footer for Premier Club

### 1. Create 3 new pages
Under `src/pages/club/legal/`:
- `PrivacyPolicy.tsx` — full Privacy Policy text (sections 1–13)
- `DataProtection.tsx` — full Personal Data Protection Policy (sections 1–15)
- `ResponsibleGaming.tsx` — full Responsible Gaming Policy (sections 1–13)

Each page:
- Uses the Club gold-on-red theme (same `GOLD`/`GOLD_DEEP` palette + `ClubBackdrop` + `font-faberge` headings as `ClubLanding`/`ClubLayout`).
- Mobile-first single column, max-w-xl, scrollable.
- Top bar with back link → `/` (or `history.back()`).
- Renders headings (`h1`/`h2`) and paragraphs from a structured constant; bullet lists where the source uses lists.
- Effective Date: June 2026.

### 2. Routes in `src/App.tsx`
Add lazy imports + routes in BOTH route blocks (club subdomain block ~line 511 and main block ~line 490):
- `/club/privacy` → `PrivacyPolicy`
- `/club/data-protection` → `DataProtection`
- `/club/responsible-gaming` → `ResponsibleGaming`

### 3. Shared footer component
Create `src/components/club/ClubFooter.tsx`:
- Text: *"Premier Club is operated by Joker Casino LTD, trading as Premier Casino. Membership is subject to verification, responsible gaming rules and applicable laws of Tanzania."*
- Three links: **Privacy Policy** · **Personal Data Protection** · **Responsible Gaming**
- Gold styling, separators between links, centered, small caps.

### 4. Mount footer
- In `ClubLanding.tsx`: replace the current minimal `<footer>` with `<ClubFooter />`.
- In `ClubLayout.tsx`: add `<ClubFooter />` at bottom of `<main>` (above the fixed bottom tab nav, with extra bottom padding so it isn't hidden).
- In `ClubLogin.tsx` and `ClubRegister.tsx`: append `<ClubFooter />` at the bottom of the page (these are standalone routes).

### 5. Version bump
Bump `package.json` from `1.3.286` → `1.3.287` (frontend-only, but keeps version indicator fresh).

### Files touched
- NEW: `src/pages/club/legal/PrivacyPolicy.tsx`
- NEW: `src/pages/club/legal/DataProtection.tsx`
- NEW: `src/pages/club/legal/ResponsibleGaming.tsx`
- NEW: `src/components/club/ClubFooter.tsx`
- EDIT: `src/App.tsx` (lazy imports + 6 route entries)
- EDIT: `src/pages/club/ClubLanding.tsx` (footer)
- EDIT: `src/pages/club/ClubLayout.tsx` (footer above tabbar)
- EDIT: `src/pages/club/ClubLogin.tsx`, `ClubRegister.tsx` (footer)
- EDIT: `package.json`

No DB / backend changes.
