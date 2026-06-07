## Goal

Replace the current dark cinematic "command-center" skin of `src/pages/Landing.tsx` with a Dreelio-inspired light premium look (sky gradient + soft clouds + huge black grotesque headings + black pill buttons + tilted product mockups + marquee logos), while keeping ALL existing business content: modules, operators, pricing tiers, supported languages, contact form, footer copyright.

Only the landing route is affected. Nothing inside the app (cashier, pit, finance, admin) changes. No backend, DB, or auth changes — pure presentation.

## Visual direction (locked)

- **Palette (light)**: background gradient `#dbeafe → #eff6ff → #fef3e8` (sky blue fading to warm cream at the bottom of each section). Surfaces white `#ffffff` with 1px `#e5e7eb` borders. Text near-black `#0a0a0a`, secondary `#52525b`. Single accent `#0a0a0a` (Dreelio uses black, not a colored accent). Soft cloud SVGs floating behind hero and section transitions.
- **Type**: Inter Tight via Google Fonts (heading 600–700, body 400–500). H1 7–8rem desktop, tight tracking `-0.04em`. No serif.
- **Buttons**: fully-rounded pill (`border-radius: 999px`), solid black primary with white text, outlined ghost secondary on light backgrounds.
- **Mockups**: real CMS screenshots displayed in tilted 3D perspective (`rotateX(12deg) rotateY(-6deg)`), soft drop shadow, no chrome.
- **Motion**: subtle fade-up on scroll, marquee auto-scroll, hover lift on cards. Existing `StaggerContainer` motion lib reused.

## Section structure (top → bottom)

1. **SiteHeader** — light glassy bar, Casino System wordmark, nav links (Modules · Why custom · Pricing · Contact), black pill CTA "Book a demo".
2. **Hero** — eyebrow chip, huge H1 ("Run your land-based casino like a Tier-1 operator"), 2-line subhead, dual pill CTAs ("Book a demo" / "See modules"), then a tilted dashboard screenshot below.
3. **OperatorsStrip** — infinite marquee with current operator wordmarks (Casino Royal Sal Cabo Verde, Napoleons Casinos & Restaurants, Rainbow Casino Birmingham, Casino de Spa, Portomaso Casino). Two-row reversed direction like Dreelio.
4. **BuiltForLandBased** — alternating row: text left ("Pit, Cage & Reception in one operating system"), tab chips (Pit · Cage · Reception · Tables · Analytics), tilted mock right.
5. **FinancialControl** — reverse alternating row: tilted mock left, text right ("Track every chip, every cash desk, every shift"), tab chips (Wallets · Cash Count · Budget · Monthly · Audit).
6. **ModulesGrid** — bento grid of all existing modules from current `ModulesGrid.tsx` (Pit, Cage, Reception, Tables, Players, Finance, POS, HR, Surveillance, Promo). Mixed-size cards on white with subtle shadow.
7. **Integrations / Languages strip** — circular logo grid (5 currencies + supported languages icons) styled like Dreelio's integration grid; copy "Speaks your language. Settles in your currency."
8. **WhyCustom** — three quiet cards: "Built around land-based ops", "Per-casino data isolation", "On-prem or cloud, your choice".
9. **IntegrationProcess** — 4-step timeline (Discovery → Bootstrap → Training → Go-live) styled as quiet numbered rows.
10. **Pricing** — keep current tier content/numbers (Starter / Growth / Network), restyled as 3 white pill-cornered cards, black pill CTA inside each.
11. **Testimonials** — 3–4 quote cards with operator title (no fake photos; use initials avatar in muted disc, since memory says no fake people). Quotes pulled from existing `OperatorsStrip` quotes if present, else short generic operator quotes.
12. **AboutCMS** — short manifesto block restated for light theme.
13. **ContactForm** — light card, same fields and submission wiring as current form.
14. **SiteFooter** — light footer, copyright `©2026 Amaell Group LLC. All Rights Reserved.`.

## Files touched

Rewrite in place (no new top-level route, no project reset):
- `src/pages/landing/landing.css` — new light tokens, sky gradient, cloud SVG layers, pill button class, marquee keyframes, tilt mockup utility, font import.
- `src/pages/landing/components/BackdropLayers.tsx` — replace dark glow with sky gradient + drifting cloud SVGs.
- `src/pages/landing/components/SiteHeader.tsx` — light glass bar, black pill CTA.
- `src/pages/landing/components/Hero.tsx` — new H1 + dual pills + tilted hero mock.
- `src/pages/landing/components/OperatorsStrip.tsx` — convert to two-row marquee.
- `src/pages/landing/components/BuiltForLandBased.tsx` — alternating feature row #1.
- New `src/pages/landing/components/FinancialFeature.tsx` — alternating feature row #2.
- `src/pages/landing/components/ModulesGrid.tsx` — restyle as light bento.
- New `src/pages/landing/components/IntegrationsLanguages.tsx` — circle grid.
- `src/pages/landing/components/WhyCustom.tsx`, `IntegrationProcess.tsx`, `Pricing.tsx`, `AboutCMS.tsx`, `ContactForm.tsx`, `SiteFooter.tsx` — restyle to light tokens; content unchanged.
- New `src/pages/landing/components/Testimonials.tsx` — quote cards with initial avatars.
- `src/pages/Landing.tsx` — add the two new sections in the order above; drop `ProductScreens.tsx` and `SolutionsGrid.tsx` (their content is absorbed into the new feature rows + modules bento).
- 1 hero mockup image (tilted dashboard) generated and stored under `src/assets/landing/` (replaces unused old dark hero asset).

Routing, i18n provider, language switcher, and existing form submission wiring stay as is.

## Technical notes

- Font added via `<link>` in `landing.css` `@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap')`; scoped to `.landing-root` so it does not leak into the app shell (memory rule: app keeps its current density tokens).
- All colors are landing-local CSS variables under `.landing-root`; tailwind semantic tokens in the rest of the app are untouched.
- Reuses existing motion utils (`StaggerContainer`) — no new motion library.
- Build expected to pass; no TS API surface changes.

## Out of scope

- App theme, dark mode toggle, density tokens, sidebar, auth screens.
- Memory rule update — the previously stored "dark cinematic" preference will be superseded by this turn; memory file will be updated to reflect the new locked direction after the build is approved.
- No new copy invented for operators/pricing/modules — content stays as it is today.
