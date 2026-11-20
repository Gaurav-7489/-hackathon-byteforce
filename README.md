# SeatLock

A cinematic, accessible seat-booking app for campus events: live seat maps, 5-minute holds, conflict recovery, and an AI seat assistant that **suggests but never books**.

React 19.3 · TypeScript (strict) · Vite 8 + React Router 7 · React Compiler · Motion · GSAP + ScrollTrigger · Lenis · Three.js / React Three Fiber · Radix · Sonner · Zod (mini)

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production build (React Compiler on)
npm run preview
npm test               # Vitest unit/component tests
npm run test:e2e       # Playwright end-to-end (builds + serves on :4180)
```

**Demo login (mock mode):** `student@seatlock.dev` / `seatlock123`

### Connecting the organizer API

The PDF lists the organizer endpoints but not a base URL, so the app ships with a **fetch-compatible in-browser mock adapter** (`src/lib/api/mock/`). It reproduces the stated conditions: 2–3 s latency, ~1 in 20 random failures, other students holding and booking seats, 5-minute hold expiry.

To use the real API, set the base URL. Nothing else in the app changes:

```bash
cp .env.example .env.local
# VITE_API_BASE_URL=https://organizer-mock.example.com
```

Every response is validated with Zod schemas in `src/lib/api/types.ts`. If the organizer's field names differ, adapt them **only** in `src/lib/api/client.ts`. The AI client accepts NDJSON, SSE (`data:` lines) or plain JSON. When the real URL is set, the mock and the Demo panel are removed from the UI.

---

## Screens

| # | Screen | Route | Highlights |
|---|---|---|---|
| 1 | Login | `/login` | Inline validation, wrong-password alert, `useFormStatus` loading button, CSS-only stage lighting (no WebGL) |
| 2 | Event list | `/events` | Three.js venue hero, GSAP scroll chapters, search + date filters (`useTransition`), skeletons, procedural SVG posters |
| 3 | Event details + seat map | `/events/:id` | DOM seat grid (5 states, colour **and** icon/pattern), stage, legend, ≤4 seats, live total, polling, pan/pinch zoom, AI assistant, 3D view-from-seat |
| 4 | Checkout | `/checkout` | Server-clock 5-min countdown ring, 1-min warning, auto-return on expiry, Confirm/Back/Cancel (with confirmation) |
| 5 | Booking success | `/success` | Animated 3D-tilt ticket, seat details, QR placeholder, Add to calendar (.ics), View my bookings |
| 6 | My bookings | `/bookings` | Upcoming/Past tabs, optimistic cancel + confirmation dialog, empty states |
| – | Design tokens | `/design` | Live token values, contrast ratios, motion curves, seat states, components |

## Compulsory React 19 feature map

| Feature | Where |
|---|---|
| Actions + `useActionState` | Login `src/routes/Login.tsx:40` · Hold seats `src/routes/EventDetail.tsx:308` · Confirm booking `src/routes/Checkout.tsx:46` |
| `useFormStatus` | `src/components/SubmitButton.tsx:14`, used by all three forms |
| `useOptimistic` | Seat selection `src/routes/EventDetail.tsx:157` (re-checked against the server, rolls back when taken) · Cancellation `src/routes/Bookings.tsx:49` (rolls back on failure) |
| Suspense + `use()` | Event list `src/routes/Events.tsx:237` · Seat map + event `src/routes/EventDetail.tsx:142-143` · Bookings `src/routes/Bookings.tsx:46`. Stable promises come from `src/lib/resource.ts` |
| Error boundaries | `src/components/ErrorBoundary.tsx`, wrapping the event grid, featured section, event header, seat map, 3D preview and bookings separately, each with Retry |
| `useTransition` | Search and date filters `src/routes/Events.tsx:73` (the input stays urgent; filtering is a transition) |
| `ViewTransition` | Event card → detail poster morph `src/components/EventCard.tsx:48` ↔ `src/routes/EventDetail.tsx:72` · Seat-state changes `src/components/SeatMap.tsx:298` · Selection list `src/routes/EventDetail.tsx:419` |
| React Compiler | `vite.config.ts:7` (`babel-plugin-react-compiler` 1.0). The one manual `useMemo` (`EventDetail.tsx`, 3D seat prop) has a comment explaining why |
| Modern patterns | `ref` as a prop: `SubmitButton.tsx:9` · Context as provider: `src/lib/theme.tsx:54`, `src/lib/auth.tsx:51` · `<title>`/`<meta>` rendered from components on every route |
| TypeScript strict | `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`); zero `any` in `src/` and `e2e/` |
| **Bonus** | `useEffectEvent` (seat polling, `EventDetail.tsx:217`) · `<Activity>` keeps the AI conversation alive while hidden (`EventDetail.tsx:449`) · hidden-tab retention (polling pauses and resyncs) · installable PWA + offline page (`public/`) · animated ticket · voice input (Web Speech API) · assistant request refinement ("cheaper", "closer") |

## Seat map behaviour (PDF §3)

- **Five states** (`src/components/seatmap.css`):
  - available: outline
  - selected: lime with ✓
  - held by others: amber stripes with a clock icon
  - booked: solid with ✕
  - blocked: crosshatch with ⊘
- Every seat's `aria-label` also states its status.
- **Seat limit:** a fifth seat is refused with a toast, an inline message and a screen-reader announcement.
- **Live updates:** availability polls every 4 s (`useEffectEvent`). A selected seat that someone else takes is removed, highlighted, explained, and a nearby alternative is offered.
- **Optimistic taps:** selection is instant; the server re-check happens in the background.
- **Hold conflict (409):** the other seats are kept, the lost seat is highlighted, and a **Swap in** button offers the nearest free alternative (`src/lib/seats.ts`).
- **Keyboard:** a `role="grid"` with roving tabindex. Arrows / Home / End move, Space or Enter selects, `+`/`-` zoom, and the focus ring is always visible. The map pans to keep the focused seat in view.
- **Mobile:**
  - Pan and pinch-zoom with light inertia, plus Zoom in / out / Reset buttons.
  - Touch devices start at 1:1, so seats are **44×44 px**.
  - `touch-action: none` applies to the map only.
- **Hold timer:**
  - Uses the server clock offset and resyncs when the tab becomes visible.
  - Warns at 1 minute.
  - On expiry, returns to the map with a message and re-selects the seats that are still free.

## AI Seat Assistant (PDF §6)

- **Interface:**
  - Prompt box, suggestion chips (Near stage, Aisle, Cheapest, 4 in a row, Best view, Under ₹300) and voice input.
  - Streaming progress with a **Stop** button and an **8 s timeout**.
  - Hinglish is understood ("do seats stage ke paas, 300 se kam").
- **Request:** sends live availability and prices as context, plus the last few turns for refinement.
- **Validation:** every suggested seat must exist and be selectable now, and there can be at most 4. Dropped seats are explained.
- **Student stays in control:**
  - Suggestions are labelled **AI-generated** and highlighted on the map with a dashed ring.
  - Nothing is selected until the student presses **Use these seats**.
  - Nothing is ever held automatically.
- **Failures:** timeouts and errors keep manual selection fully usable. Updates go through a polite live region.

## Design & motion system

- **Identity:**
  - "A venue before the lights come up": dark-first, with indigo `#7065FF`, ice `#81D9FF` and lime `#D5FF73` accents.
  - Fonts are Space Grotesk (display) and Inter (UI).
  - Light theme is included. The theme follows the device on first visit and remembers the user's choice.
- **Tokens:** `src/styles/tokens.css`, rendered live on `/design`.
- **Motion layers:**
  - **GSAP** for section choreography: hero reveal, ScrollTrigger camera, pinned headliner sequence.
  - **Motion** for components: springs from `src/lib/motion.ts`, tilt cards, layout pills, sheets, ticket reveal.
  - **ViewTransition** for route and seat-state changes.
  - **CSS** for seat feedback, so 200 buttons never pay for JS animation.
- **Lenis:** runs on `/events` only, driven by GSAP's ticker. It is never mounted on the seat map, checkout, dialogs or forms.
- **3D** (`src/three/`):
  - Procedural venue: instanced seating, LED-wall shader, volumetric beams, haze.
  - Lazy-loaded with capped DPR and adaptive quality. It pauses when off-screen or the tab is hidden, and falls back to CSS when WebGL is unavailable.
  - Capable desktops start it at idle. Phones and Save-Data users get the CSS stage until their first interaction.
  - It is never required for booking.
- **Reduced motion:** honoured everywhere, including static 3D frames, no pinning, no tilt and no inertia.

## Verification

The following was measured locally on the production build (`vite preview`), headless Chromium, 20 Nov 2026:

| Check | Result |
|---|---|
| `tsc -b` (strict) | ✅ passes |
| Vitest | ✅ 17 / 17 (seat logic, AI parsing/validation, mock API contract, seat-map keyboard + labels) |
| Playwright e2e | ✅ 8 / 8 with retries off. Covers login validation, **keyboard-only booking**, 5th-seat block, hold conflict + swap, AI suggest → use, AI timeout fallback, bookings tabs, and mobile checks (no horizontal scroll, ≥44 px seats, sticky hold bar). The cancel dialog and success ticket were checked in exploratory screenshot runs, not by an automated assertion |
| Lighthouse, `/events`, mobile preset | Performance **95–98**, Accessibility **100** |
| Lighthouse, `/events`, desktop preset | Performance **100**, Accessibility **100**, Best Practices **100** |
| Horizontal overflow at 360 / 390 / 1280 px | 0 px on every route checked |

Scores from a deployed URL may differ. Re-run Lighthouse against the deployment.

## Deployment

`vercel.json` and `netlify.toml` are included (SPA rewrites, immutable asset caching). Import the repo into Vercel or Netlify. Optionally set `VITE_API_BASE_URL`.

## 8-minute demo script

1. **(0:00) Login.** Submit empty to show inline errors, try a wrong password, then sign in.
2. **(0:45) Event list.**
   - Scroll the 3D hero into the "What's on" chapter.
   - Type in search to show it stays instant, then tap a date filter.
   - Scroll on into the pinned headliner sequence: the camera dives to a seat.
3. **(2:00) On a phone:** open an event (poster morph). Pinch and pan the map, tap 2 seats, try a 5th to show the block.
4. **(3:00) Conflict.** Open **Demo → Force conflict on next hold**, press Hold. The lost seat is highlighted, the others are kept; tap **Swap in**.
5. **(4:00) AI.**
   - Tap "Under ₹300": streaming steps, an AI-generated card, seats highlighted on the map.
   - Refine with "Cheaper", then press **Use these seats**.
   - Optionally use **Demo → AI: slow next reply** to show the 8 s timeout fallback.
6. **(5:15) Checkout.**
   - Show the countdown ring and confirm. (**Demo → Next hold lasts 75 s** shows the 1-minute warning and the expiry return.)
   - On the ticket: tilt it, Add to calendar, then View my bookings and cancel with confirmation.
7. **(6:30) Keyboard-only booking.** Tab to an event card, press Enter, use the arrow keys plus Space to pick seats, Tab to Hold, Enter, then Enter on Confirm.
8. **(7:30) `/design`.** Show the tokens and seat states, toggle light/dark, then wrap up.

## Project layout

```
src/
  lib/api/        typed client, zod schemas, errors, mock adapter (+ AI intent engine)
  lib/            theme/auth/hold contexts, seats logic, motion tokens, formatting
  components/     SeatMap, AiAssistant, Ticket, EventCard, Poster, dialogs, shell
  routes/         one lazy chunk per screen
  three/          procedural R3F venue, scene store, CSS fallback
  styles/         tokens, base, components, layout
e2e/              Playwright specs     docs/component-sources.md   provenance & licences
.claude/skills/   seatlock-design-director · motion-engineer · threejs-engineer · accessibility-qa
```
