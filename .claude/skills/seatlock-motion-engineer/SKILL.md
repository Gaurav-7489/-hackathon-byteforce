---
name: seatlock-motion-engineer
description: Motion and animation engineering for SeatLock. Use when adding or reviewing animation, transitions, GSAP timelines/ScrollTrigger, Lenis smooth scroll, Motion (motion/react) springs, React ViewTransition, drag/sheet physics, or reduced-motion behaviour anywhere in the SeatLock app.
---

# SeatLock Motion Engineer

## Division of labour
- **Motion (`motion/react`)** — component-level: buttons, cards, panels, sheets, ticket reveal, AI panel, selection feedback. Use presets from `src/lib/motion.ts`: `spring.snappy` (buttons/seats), `spring.soft` (cards/panels), `spring.sheet` (bottom sheets), `spring.elastic` (ticket reveal only), plus `duration`, `ease`, `fadeUp`, `stagger()`.
- **GSAP + ScrollTrigger** — section-level choreography on `/events` only (hero reveal, staggered type, pinned featured sequence, 3D camera progress). Use `useGSAP`/`gsap.context()` and always revert on unmount.
- **React `<ViewTransition>`** — event card → detail poster (shared `name`), seat-state changes and summary updates. Updates must happen inside `startTransition`.
- **CSS tokens** — `--dur-instant/fast/base/panel/page`, `--ease-out/in-out/emphasis` in `src/styles/tokens.css`.
Never let GSAP and Motion animate the same property on the same element.

## Lenis
- Only via `src/hooks/useLenis.ts`, only on the discovery route (`/events`). Driven by `gsap.ticker`, synced to `ScrollTrigger.update` — one rAF loop.
- Never on seat map, checkout, success, bookings, dialogs or forms. Scrollable inner panels get `data-lenis-prevent`.

## Timing budget
Button 100–180ms · seat 120–200ms · card 180–280ms · panel 250–400ms · page 350–600ms. Booking feedback is immediate; never gate state on an animation finishing.

## Hard rules
1. Seat buttons: no magnetic, tilt, pointer-follow or bouncy effects; a short scale/opacity/colour change at most. A seat must never move away from the pointer.
2. Magnetic/tilt only on large CTAs and cards, only when `(hover: hover) and (pointer: fine)` (`useFinePointer`).
3. Animate only `transform`, `opacity`, `filter`, `clip-path` in loops. No layout-thrashing properties.
4. Respect `useReducedMotion()` (`src/hooks/useMediaQuery.ts`): disable parallax, scroll scrubbing, tilt and decorative loops; keep instant state changes. CSS already zeroes durations under `prefers-reduced-motion`.
5. Clean up every listener, ticker callback, timeline and ScrollTrigger on unmount.
6. Decorative sequences must never delay reaching the seat map — keep a visible skip/CTA.
