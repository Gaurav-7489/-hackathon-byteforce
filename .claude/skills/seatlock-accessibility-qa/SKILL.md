---
name: seatlock-accessibility-qa
description: Accessibility and interaction QA for SeatLock. Use when testing or reviewing keyboard-only booking, screen-reader announcements, focus management, WCAG 2.2 AA contrast, dialogs, touch targets, mobile pan/zoom, reduced motion, Lighthouse scores, or writing Vitest/Playwright tests for the booking flow.
---

# SeatLock Accessibility QA

## Must-pass flows (keyboard only, then 360px touch)
1. Login: labelled inputs, inline errors linked via `aria-describedby`, wrong-password message in `role="alert"`, submit disabled + spinner while pending.
2. Events: search/date filters reachable by Tab; cards are links with meaningful names; skeletons announce loading.
3. Seat map: one Tab stop into the grid (roving tabindex), Arrow keys move between seats (skipping aisle gaps), Space/Enter toggles, focus ring always visible (`--focus-ring`). Each seat's accessible name = row, number, price, state. Fifth-seat attempt explains the 4-seat limit in a live region.
4. Conflicts / lost seats / poll removals announced via `aria-live="polite"` (assertive only for hold expiry).
5. AI assistant: prompt labelled, chips are buttons, progress + result announced, suggestions labelled "AI-generated", "Use these seats" is explicit — nothing auto-selects or books.
6. Checkout: countdown readable as text, 1-minute warning announced once, expiry returns to the map with a message. Confirm/Back reachable.
7. Success & bookings: ticket readable without animation; cancel uses an accessible dialog (Radix) that traps and restores focus.

## Standards
- Text contrast ≥ 4.5:1 (check on `/design`, both themes). Non-text indicators ≥ 3:1.
- Targets ≥ 44×44px (`--seat-size`). Seat map supports pinch/pan + Zoom in/out/Reset buttons.
- Every icon-only button has `aria-label`. Status never by colour alone.
- `prefers-reduced-motion`: no parallax, scroll-scrub or tilt; functionality unchanged.
- No horizontal page scroll at 360/768/1280 (seat map viewport excepted).

## Tooling
- Unit/integration: Vitest + Testing Library (`npm test`, files `src/**/*.test.tsx`).
- E2E: Playwright (`npm run test:e2e`, `e2e/`) — include one full keyboard-only booking.
- Lighthouse on `/events` (target Perf 85+, A11y 90+) against `npm run build && npm run preview`. Report measured numbers only — never invent scores.
