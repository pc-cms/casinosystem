## Update footer/copyright text (system pages only, excluding Club)

Replace legacy copyright/branding text on system surfaces. Club App (`club.*` routes, `ClubFooter`, `ClubLanding`, `ClubLogin`, `ClubRegister`, legal pages using ClubFooter) stays untouched.

### Changes

1. **`src/pages/Login.tsx`** (CMS default login)
   - Under "Casino Management System" subtitle add: `by Amaell Group LLC`
   - Replace footer `© 2025` → `© 2026 Amaell Group LLC. All rights reserved.`

2. **`src/pages/Landing.tsx`** (root marketing site)
   - Replace `© {new Date().getFullYear()} CasinoSystem. All rights reserved.` → `© 2026 Amaell Group LLC. All rights reserved.`

### Not touched
- `src/components/club/ClubFooter.tsx`
- `src/pages/club/*` (ClubLanding, ClubLogin, ClubRegister, etc.)
- Legal pages (they render ClubFooter)

### Version
Cosmetic UI only — no version bump.
