
# Casinosystem.app — Premium B2B Landing Redesign

Refactors the existing `src/pages/Landing.tsx` (root-domain catch-all route — preserved). No new framework. No template replacement. Authenticated app, subdomains, club app, POS — all untouched.

## 1. Information architecture

Single-page landing with anchored sections, structured so each section is a standalone component that can later be promoted to a route.

```
/  (Landing)
├─ <SiteHeader />          logo · Home · Modules · Solutions · Partners · About · Contacts · [EN/ES/RU] · [Request Consultation]
├─ <Hero />
├─ <BuiltForLandBased />
├─ <ModulesGrid />         9 modules
├─ <WhyCustom />
├─ <IntegrationProcess />  6 steps
├─ <ProductScreens />      featured + supporting frames
├─ <OperatorsStrip />      6 operator lockups
├─ <Pricing />             from $5,000 / from $340
├─ <SolutionsGrid />       6 cards
├─ <AboutCMS />
├─ <ContactForm />
└─ <SiteFooter />          ©2026 Amaell Group LLC.
```

Routes file: only `/` keeps catch-all `<Landing />`. Header anchors use `#modules`, `#solutions`, etc. — easy to lift into real routes later.

## 2. Design system (scoped to landing only — does not touch the operational CMS theme)

New CSS scope `.landing-root` in `src/pages/landing/landing.css` (imported only by Landing) defines its own tokens — keeps app `index.css` untouched.

Tokens:
- `--bg`: `#0B0D10` (graphite-black)
- `--surface`: `#11141A`
- `--surface-2`: `#171B22`
- `--border`: `rgba(255,255,255,0.08)`
- `--text`: `#E7EAEE`
- `--text-muted`: `#9AA2AD`
- `--accent-gold`: `#C9A24C` (muted)
- `--accent-teal`: `#3FB8A6` (emerald/teal)
- Font: **Inter** loaded from Google Fonts (preconnect) — applied only inside `.landing-root`.
- Light dashboard frames: white card with `--border` + soft shadow on dark bg.

No purple gradients, no blobs, no neon. Subtle 1px borders, generous whitespace (sections ≥ 96px vertical), max-width 1200px.

## 3. Internationalization (EN/ES/RU)

Lightweight, dependency-free.

- `src/pages/landing/i18n/` → `en.ts`, `es.ts`, `ru.ts` exporting a typed dictionary object with every string (hero, nav, module titles/descs, integration steps, pricing copy, form labels, footer).
- `src/pages/landing/i18n/LandingI18nProvider.tsx`: React context with `lang` state, `setLang`, and `t(path)` helper. Default `en`. Persists to `localStorage('landing.lang')`. Sets `<html lang>` via effect.
- `<LangSwitcher />` in header: EN / ES / RU pills.
- Professional human-tone translations for all three (not machine-style).

Scoped to landing only — does not affect the rest of the app.

## 4. Content

### Hero
H1: "Custom Casino System for Land-Based Casinos"
Sub: enterprise CMS line.
Supporting line.
Primary CTA → scrolls to `#contact` ("Request Consultation").
Secondary link → `#modules` ("Explore Modules").
Visual: composition of 1 large + 3 small light dashboard mockup frames using existing `src/assets/landing/*.jpg` (already in project). Each frame is a `<MockupFrame label="Dashboard">`, captions overlaid. Easy swap — frames driven by an array `HERO_SCREENS` at top of Hero.

### Modules grid (9)
Cage Operations · Pit & Table Management · Finance Control · Player Tracking · HR & Staff · Bar POS · Client Club App · Warehouse/Storage · Surveillance. Lucide line icons (Vault, LayoutGrid, Wallet, Users, BadgeCheck, Wine, Smartphone, Boxes, Eye). Copy verbatim from brief.

### Why Custom
8 bullet checkpoints in 2-col grid.

### Integration & Implementation
6 numbered steps with thin gold rule between.

### Product screenshots
`ProductScreens` reads from `SCREENS` array. Initially uses existing landing JPGs + placeholder frames labeled Dashboard / Cage / Pit / Finance / Player Tracking / Client Club App. Each item: `{ label, caption, src? }`. Missing `src` → renders a clean labeled empty frame.

### Operators We Work With
6 generated minimal monochrome lockups via `imagegen` (white/gold text + a tiny mark, transparent PNG, equal height). Saved to `src/assets/landing/operators/{slug}.png`. Strip is grayscale + 70% opacity, hover → 100%. Equal height row, wraps to 2 cols on mobile.
Operators: Premier Casino, Casino Royal Sal Cabo Verde, Napoleons Casinos & Restaurants, Rainbow Casino Birmingham, Casino de Spa, Portomaso Casino. No city callouts. None highlighted. Replaceable later.

### Pricing
Two cards, no plan ladder. "Enterprise implementation — from $5,000". "Monthly licensing — from $340". Fine-print note. CTA: Request Consultation.

### Solutions
6 cards from brief.

### About CMS
Short prose; Amaell Group LLC mentioned only in footer.

### Contact form
Fields: Name · Company · Email or WhatsApp · Message. Zod validation, `react-hook-form`, shadcn inputs styled to landing palette.

## 5. Consultation form backend (Lovable Cloud + email)

### DB migration
Table `public.consultation_requests`:
- `id uuid pk`, `name text`, `company text`, `contact text` (email or WhatsApp), `message text`, `language text`, `source_url text`, `user_agent text`, `created_at timestamptz`.
- GRANT INSERT to `anon` and `authenticated`; GRANT ALL to `service_role`.
- RLS: `INSERT` allowed to anon (`true`); SELECT only to `super_admin` via `has_role(auth.uid(),'super_admin')`.
- No update/delete policies.

### Edge function `send-consultation`
Server-side: input validation (zod), insert row with service role, then send email via **Lovable Emails** (`send-transactional-email`). New template `consultation-request` (React Email) sent to a configured recipient. Recipient address stored as runtime secret `CONSULTATION_RECIPIENT_EMAIL`.

Prerequisite check: Lovable Emails domain. If not yet configured, surface the email-setup dialog at run time and skip email send until it's ready (DB row still saved → no lead lost). The plan covers both states.

### Client wiring
Form submits to `send-consultation` via `supabase.functions.invoke`. Success → toast + replaces form with "We'll be in touch" panel. Failure → toast error, row may still have landed.

## 6. SEO + meta

Update `index.html`:
- `<title>`: "Custom Casino System for Land-Based Casinos | CMS"
- description, keywords from brief.
- Canonical = `https://casinosystem.app/`.
- OG title/description/url.
- Organization JSON-LD (Amaell Group LLC, sameAs left empty for now).
- Preconnect to fonts.gstatic.com / fonts.googleapis.com.

## 7. Component file layout

```
src/pages/Landing.tsx                       (replaced — composes sections)
src/pages/landing/
  landing.css                                (scoped tokens + Inter)
  i18n/{en,es,ru}.ts
  i18n/LandingI18nProvider.tsx
  data/modules.ts solutions.ts operators.ts pricing.ts screens.ts
  components/
    SiteHeader.tsx  LangSwitcher.tsx  Hero.tsx
    BuiltForLandBased.tsx  ModulesGrid.tsx  WhyCustom.tsx
    IntegrationProcess.tsx  ProductScreens.tsx  MockupFrame.tsx
    OperatorsStrip.tsx  Pricing.tsx  SolutionsGrid.tsx
    AboutCMS.tsx  ContactForm.tsx  SiteFooter.tsx
src/assets/landing/operators/*.png           (6 generated lockups)
supabase/functions/send-consultation/index.ts
supabase/functions/_shared/transactional-email-templates/consultation-request.tsx
```

## 8. Out of scope (explicit)

- No changes to `/login`, `/pos/login`, club app, subdomain CMS routing, auth, RLS on existing tables.
- No changes to global `index.css`/`tailwind.config.ts` tokens.
- No real operator logo scraping; lockups are visual placeholders the user can replace any time by dropping a file into `src/assets/landing/operators/`.
- No separate /modules /solutions /partners /about /contacts routes yet — anchors only. Lift later by importing the same section components into new route files.

## 9. Order of execution (build mode)

1. Migration + GRANT/RLS for `consultation_requests`.
2. Email infra check; scaffold transactional templates if missing; add `consultation-request` template; deploy.
3. `send-consultation` edge function; add secret `CONSULTATION_RECIPIENT_EMAIL`.
4. Landing scaffold: scoped CSS, i18n provider, dictionaries.
5. Section components + data files.
6. Generate 6 operator lockup PNGs (premium quality, transparent bg, white + muted gold).
7. Replace `src/pages/Landing.tsx` body to compose sections inside `<LandingI18nProvider>` with `.landing-root` wrapper.
8. Update `index.html` meta + JSON-LD.
9. Visual QA at 1440 / 1024 / 390 widths.
