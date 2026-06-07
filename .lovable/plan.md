## Goal
Add premium motion infrastructure to the existing project without touching routes, styling, or deployment. Deliver reusable animation primitives ready for the upcoming landing redesign.

## Packages
Install (runtime deps):
- `motion` (Motion for React, successor to framer-motion)
- `gsap`
- `@gsap/react` (peer of `react`, provides `useGSAP` hook)

Skip `three` / `@react-three/fiber` / `@react-three/drei` per instruction.

`package.json` updates automatically via `bun add`. Version bump not required (no backend change).

## Reduced-motion strategy
Single shared hook `src/lib/motion/usePrefersReducedMotion.ts` that wraps `window.matchMedia('(prefers-reduced-motion: reduce)')` with a subscription. Every component below early-returns to a static render when it returns `true` — no opacity/transform animations, no GSAP timelines.

GSAP is registered once in `src/lib/motion/gsap.ts`:
```ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };
```

## Components (all under `src/lib/motion/`)

1. **`SectionReveal.tsx`** — wraps children in a Motion `<m.div>` that fades + translates up on viewport enter (`whileInView`, `viewport={{ once: true, amount: 0.2 }}`). Props: `as`, `delay`, `y` (default 24), `className`. Static `<div>` when reduced-motion.

2. **`StaggerContainer.tsx`** — Motion parent with `variants` that stagger children by `staggerChildren` (default 0.08s). Exports companion `StaggerItem` with matching child variants (fade + 16px y). Reduced-motion: plain wrapper.

3. **`AnimatedCard.tsx`** — Motion card with idle float (subtle), hover lift (`whileHover={{ y: -4, scale: 1.01 }}`), tap press, and entrance fade. Props pass through `className`, `onClick`. Honors reduced-motion (renders plain `<div>` with hover via CSS class only).

4. **`ParallaxScreenshot.tsx`** — Wraps an `<img>` (or arbitrary child) in a Motion element that translates Y based on scroll progress using `useScroll` + `useTransform`. Props: `src`, `alt`, `offset` (default 40px), `className`. Reduced-motion: static image, no transform.

5. **`ScrollFlow.tsx`** — GSAP-based pinned scroll sequence using `useGSAP` + `ScrollTrigger`. Accepts an array of step refs/children and orchestrates fade/translate between them as the user scrolls past the container. Props: `children` (each step rendered in its own slot), `pin` (boolean, default false), `scrub` (default 0.5). Reduced-motion: renders children stacked vertically, no ScrollTrigger created.

Barrel export: `src/lib/motion/index.ts` re-exports all five plus the hook.

## Verification
- Build runs automatically; confirm no TS or bundler errors.
- No existing imports change, no route or layout edits.
- New code is tree-shakeable; nothing imported globally yet.

## Out of scope
- Applying the components to the landing page (next step).
- Any visual/CSS token changes.
- 3D / WebGL libraries.
