---
name: seatlock-design-director
description: Visual design authority for the SeatLock booking app. Use when designing, restyling or reviewing any SeatLock screen, component, layout, typography, colour, theme (light/dark) or responsive behaviour, or when adapting a third-party component into the SeatLock design system.
---

# SeatLock Design Director

Identity: "a premium venue before the lights come up" — dark, cinematic, precise, never neon-gaming.
Dark theme is the signature; light theme must be equally finished.

## Sources of truth
- Tokens: `src/styles/tokens.css` (colours, type, spacing, radius, shadows, motion, z-layers). Never hard-code values a token covers.
- Base + shared components: `src/styles/base.css`, `src/styles/components.css` (`.btn*`, `.chip`, `.badge*`, `.input`, `.field*`, `.card`, `.glass`, `.alert[data-tone]`, `.state-panel`, `.skeleton`, `.dialog`).
- Layout: `src/styles/layout.css`. Route-specific CSS lives next to the route (`src/routes/*.css`).
- `/design` (`src/routes/Design.tsx`) renders live token values — add every new token there.

## Rules
1. Fonts: `--font-display` (Space Grotesk) for headings and editorial moments; `--font-ui` (Inter) for everything transactional; `--font-mono` for codes, timers, prices in tables.
2. Oversized editorial type (`--text-display`) only on discovery/marketing surfaces. Checkout, seat map and forms use compact `--text-sm`–`--text-xl`.
3. Accents are controlled: `--brand` for primary action, `--ice` for information/available, `--lime` for selection/success moments. No gradient soup; one gradient per view max.
4. Text contrast ≥ 4.5:1 — use `--text`, `--text-2`, `--text-3`, `--brand-text` (verified on /design).
5. Seat states always pair colour with icon/pattern (available outline, selected lime+check, held amber stripes+clock, booked muted+×, blocked crosshatch+ban, AI dashed ring+sparkle).
6. Every screen designs loading (skeleton), empty, error (with Retry) and success states.
7. Responsive at 360 / 768 / 1280. No horizontal scroll except inside the seat map viewport. Touch targets ≥ 44px.
8. Every route sets `<title>` (and `<meta name="description">` where useful) from JSX.
9. Original work only: inspiration sites (21st.dev, Skiper UI, Dribbble, MotionSites, Higgsfield) are reference, not source. Log any adapted component in `docs/component-sources.md` with licence.

## Review checklist
Hierarchy obvious in 3 seconds? Spacing on the 4px grid? Both themes checked? Text clipping at 360px? Generic-looking card? Fix before shipping.
