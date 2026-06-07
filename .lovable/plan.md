## Goal

Fully redesign the visual layer of the existing `casinosystem.app` landing (root `/` → `src/pages/Landing.tsx`) into a dark, cinematic, enterprise command-center experience. Preserve all business content, the 11 sections, EN/ES/RU dictionaries, the `consultation_requests` table, the `send-consultation` edge function, and the motion primitives already in `src/lib/motion/`.

## Scope

In scope: `src/pages/Landing.tsx`, everything under `src/pages/landing/`, generated visual assets, `index.html` `<head>` metadata, language-default fix.

Out of scope: CMS app code, routing, auth, backend schema, edge functions, deployment, any non-landing page.

## Key fixes vs current build

1. **Kill white dashboard mockups.** Delete `MockupFrame` light-card style + the 4 light `hero-dashboard/feature-*.jpg` assets. Replace with dark "command panel" composites (dark navy/graphite panels with thin gold/teal rules, tabular data, sparkline-style SVG, no real screenshots).
2. **Default language = EN, no auto-detect.** `LandingI18nProvider` currently reads `navigator.language` → remove. Default to `"en"`. Only persist after manual `setLang` click.
3. **Full visual rewrite.** New `landing.css` token set: near-black `#07090C` base, graphite surfaces, deep navy accents, muted gold `#C9A24C`, emerald `#2FB67C`, teal `#3FB8A6`, steel `#6E8AA8`. Inter + tabular-nums for numerics. Thin 1px borders `rgba(255,255,255,0.06)`, subtle inner glow, no shadows-on-white.
4. **Cinematic background system.** Fixed layered backdrop: faint grid (SVG, 32px), two slow radial gold/teal washes, hair-thin data-flow lines, optional grain. Section-numbered eyebrows (`§ 01 / HERO`).
5. **Motion.** Wire existing `SectionReveal`, `StaggerContainer`, `AnimatedCard`, `ParallaxScreenshot`, `ScrollFlow` into the new components. Integration section uses GSAP `ScrollTrigger` pinned sequence (already available via `ScrollFlow`). All effects honor `prefers-reduced-motion`.

## Section-by-section rebuild

```text
01 CommandHero          asymmetric: copy left, dark command-panel composite right
                        floating module nodes (Cage/Pit/Finance/…) orbiting central panel
                        CTAs: Request Consultation / Explore Modules
02 BuiltForLandBased    horizontal operational matrix (10 ops areas) on dark grid
03 CoreModules          9 dark cards w/ module code (CGE-01, PIT-02…), icon, hover gold border
04 CustomizedFor…       split: text left / stacked configuration layer cards right
05 IntegrationFlow      GSAP pinned scroll, 6 steps, animated connecting line + active state
06 RealOperational      dark "DarkScreenshotFrame" composites (NOT white screenshots)
07 OperatorsStrip       monochrome logo strip on dark panel (reuse existing PNGs, invert/tone)
08 PricingPanel         2 dark enterprise panels, gold price, no SaaS tier vibe
09 SolutionsGrid        6 dark solution cards, global tone
10 AboutCMS             editorial dark block, Amaell only in footer
11 RequestConsultation  dark form, fields: Name / Company / Email or WhatsApp / Message
Footer                  ©2026 Amaell Group LLC. All Rights Reserved.
```

## New / replaced files

- Rewrite: `landing.css`, all 11 section components, `MockupFrame` → `DarkPanel` + `DarkScreenshotFrame`, `SiteHeader` (dark glass, EN/ES/RU pill switcher), `SiteFooter`, `LandingI18nProvider` (no auto-detect), `Landing.tsx` (add fixed `BackdropLayers`).
- New: `BackdropLayers.tsx`, `ModuleNode.tsx`, `CommandPanel.tsx` (composable dark UI mock), `SectionLabel.tsx`.
- New generated visuals: `src/assets/landing/command-hero.jpg` (dark cinematic control-room composition, premium) + 5 dark mock framings for section 06. Generated via `imagegen` premium for hero, fast for the rest. Delete obsolete `hero-dashboard.jpg`, `feature-cage/finance/staff.jpg`.
- Operator logos: keep existing files; render via CSS `filter: brightness(0) invert(1); opacity:.55` so all 6 read as a balanced monochrome strip. (Sourcing real official logos requires fetching external sites — flagging as a follow-up; current generated marks remain as fallback so the strip is never broken.)
- Update `index.html` title/description/keywords per spec.

## Copy / i18n

All copy in `en.ts`/`es.ts`/`ru.ts` already matches the spec. Adjustments only: add section codes (01–11) and the new "Built for Land-Based Casinos" 10-item ops list if missing; verify pricing strings, hero subline, supporting line, and form placeholder match spec verbatim.

## Verification before finishing

- Build passes (auto).
- Visual sweep at 1440 / 1024 / 390 via preview — no horizontal scroll, no white panels, hero reads as command center.
- Reduced-motion toggle: animations disabled, layout still complete.
- Fresh load in a Russian/Spanish browser locale → UI stays English until user clicks RU/ES.
- Form submit still hits `send-consultation` edge function (no contract change).

## Explicitly NOT doing

- No new routes, no SPA-to-multi-page split (kept single-page with anchors, structured for future split).
- No Three.js, no R3F, no video backgrounds, no particles.
- No backend, auth, or DB changes.
- No changes to the operational CMS app behind subdomains.
