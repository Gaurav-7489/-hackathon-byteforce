# SeatLock

**The intelligent campus experience platform.** Discover, coordinate, book, attend and manage student events: live seat maps, 5-minute holds, conflict recovery, an AI seat assistant that **suggests but never books** — plus 20 campus-intelligence features for students and organizers.

> Frontend-only. Everything runs in the browser against an in-browser mock API. Simulations are labelled as such in the UI; see [Limitations](#limitations--honest-disclosures).

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

**Demo logins (mock mode):** student `student@seatlock.dev` / `seatlock123` · organizer `organizer@seatlock.dev` / `organizer123` (presentation roles only).

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

## Campus intelligence — the 20 features

All features share **one authoritative inventory** (the mock API in `src/lib/api/mock/server.ts`) and **one local campus store** (`src/lib/campus/store.ts`, Zod-validated, BroadcastChannel tab sync). Algorithms are pure and deterministic (`src/lib/campus/algorithms/`), so they're unit-tested and replayable.

| # | Feature | Where | What it does |
|---|---|---|---|
| 01 | Smart Buddy Seating | Event page → Smart seat tools → **Buddies** | Group size ≤ 4, per-seat budget, same-row/adjacent preferences, demo invite links. Compares up to 3 arrangements (contiguous → front/back split → nearest cluster), highlights on the map, selects only on “Select these seats”. Never holds. |
| 02 | FairQueue | High-demand events (Synthwave Convocation), Organizer → **Load lab** | Waiting room with position, wait range, queue token, 10-min booking window, expiry + rejoin, offline grace, duplicate-tab detection (BroadcastChannel). Lab compares FairQueue (lottery window, merged duplicates, 4-seat cap) vs FCFS for 100 seeded students. |
| 03 | Accessibility-first matching | Smart tools → **Access**, Profile | Wheelchair/companion spaces, step-free rows, exits, quiet zones, obstructions and restrooms come from typed organizer metadata (`src/lib/campus/data.ts`), never inferred. Map markers + screen-reader labels. No medical data requested. |
| 04 | AutoRescue | Hold/poll conflicts on the seat map | Keeps valid seats, ranks up to 3 replacements by proximity, price difference, group adjacency and access needs, explains each, one-click manual swap. Never auto-confirms. |
| 05 | Campus navigation | `/campus` | Original SVG campus, building search, Dijkstra routes with a step-free option, distance/time, gate advice, seat-section guidance, arrival reminders. |
| 06 | Verified ticket exchange | `/bookings` → Return | Tiered return policy, one-time return (server-side duplicate guard), seats routed to the waitlist first, exchange history. No resale marketplace. |
| 07 | Predictive waitlist | Sold-out event (Campus Unplugged), `/waitlist` | Join, position, released-seat offers reserved for 2 minutes, accept → real 5-min hold → checkout, decline/expiry reassigns. Chance shown as a labelled demo estimate (Poisson on simulated history). |
| 08 | Budget planner | Smart tools → **Budget** | Budget, tickets, tier, travel, food → total, remaining, warnings, affordable seats, cheaper alternative, per-person summary. |
| 09 | QuietZone | Smart tools → **Quiet** | Organizer quiet zones, simulated noise estimate from listed speakers, live crowding, exits, personal space — each recommendation explained. |
| 10 | SafeExit | `/campus?tab=safety` | Exits, step-free exits, assembly points, organizer instructions, illustrative plan with nearest-exit arrows, high-contrast mode. Prominently marked “not an approved evacuation plan”. |
| 11 | Schedule conflicts | `/schedule`, event page banner | Weekly classes, exams, commitments, `.ics` import, full/partial overlap detection, clash-free alternatives, export bookings to `.ics`. |
| 12 | Group expense split | Success page, `/bookings` → Split | Equal / by seat / custom (whole rupees, remainder-safe), validation, settled status, outstanding balance, copy payment requests. No payments. |
| 13 | AI Event Matchmaker | `/discover` | Explainable scoring (interests, categories, budget, time of day, history, schedule) with reasons and cautions; hands a pre-filled prompt to the existing seat assistant. |
| 14 | SeatView preview | Smart tools → **View**, 3D preview | Two-seat comparison: distance, angle, rake, listed obstructions, top-down sightline sketch; “Preview in 3D” moves the existing lazy 3D camera. Labelled approximation. |
| 15 | No-show recovery | Organizer → **No-shows** | Simulated check-ins, deadline, accessibility-seat protection, eligible preview, release → waitlist first, recovered capacity. |
| 16 | Crowd heatmap | Organizer → **Crowd**, `/campus` gate card | Minute-by-minute queue model per gate (T−60…T+30), play/scrub, redirect share, alternative-gate tip. Labelled simulated. |
| 17 | Offline ticket vault | `/tickets`, offline banner | Tickets saved locally, opens offline via the cached app shell, online/offline status, explicit “not proof of entry / not validated”. |
| 18 | Opportunity pass | `/pass` | Workshops, talks, volunteering, attendance history, milestones, skills, exportable summary, demo certificates watermarked “not issued by an authorized organizer”. |
| 19 | Companion matching | `/buddies` | Off by default, fictional anonymous profiles, compatibility reasons, requests with simulated replies, block/report, privacy toggles. Never shows seats, location, contacts or schedules. |
| 20 | Digital twin | Organizer → **Overview / Digital twin / Seats / Waitlist** | Live counts, occupancy, conflicts, pipeline, accessibility availability, Holt forecast, all-event occupancy; accessible 2D grid + optional instanced 3D (`frameloop="demand"`, colour-only updates); scenarios (rush, cancellations, block seats). |

### Demo path for the new features (≈5 min)

1. **Neon Monsoon** → Smart tools → Buddies → *Show on map* → *Select these seats* (4 together under ₹300).
2. **Access / Quiet / Budget / View** tabs on the same page; then Demo → *Force conflict* → Hold to see AutoRescue's ranked options.
3. **Synthwave Convocation** → FairQueue waiting room → *Presenter: skip to the front*.
4. **Campus Unplugged** (sold out) → *Join for 1 seat* → `/waitlist` → *Simulate a cancellation* → accept the offer → checkout.
5. `/schedule` add a commitment tonight 18:30–19:30 → Neon Monsoon shows the clash.
6. Bookings → *Split* and *Return*; `/tickets` with DevTools offline.
7. Sign in as the organizer → `/organizer`: Overview, Digital twin (3D), Crowd (*Play arrivals*), No-shows (move the clock past the deadline → *Release*), Load lab.

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

Measured locally on the production build (`vite preview`), headless Chromium, 20 Nov 2026, after the campus-intelligence work:

| Check | Result |
|---|---|
| `tsc -b` (strict) | ✅ passes, zero `any` |
| Vitest | ✅ 42 / 42 — the original 17 plus 25 for buddy seating, accessibility matching, QuietZone, view estimates, AutoRescue ranking, budget, schedule overlaps + `.ics`, splits, matchmaker, waitlist chance, return policy, FairQueue vs FCFS, load-sim seat conservation, crowd model, no-show policy, forecast, step-free routing, store schema |
| Playwright e2e | ✅ 17 / 17 with retries off: the 8 original specs plus buddy seating (highlight ≠ select, never holds), wheelchair-space matching, FairQueue room, schedule clash, sold-out → waitlist offer → checkout, organizer dashboards + no-show release, book → verified return → history, offline vault, ranked AutoRescue |
| Console errors / horizontal overflow | 0 on all 12 primary routes at 1360 px and Pixel 5 |
| Lighthouse (mobile preset, signed in) | `/events` 96 · `/events/neon-monsoon` 100 · `/discover` 100 · `/campus` 100 · `/tickets` 100 · `/bookings` 99 performance; **100 accessibility and 100 best practices on all six**; LCP 1.0–1.6 s, CLS ≤ 0.078, TBT ≤ 180 ms |
| Initial JS | ≈150 KB gzip (entry 104 KB + React 46 KB); every new screen and the 3D twin are separate lazy chunks |

Known flakiness by design: the mock fails ~1 in 20 requests and the assistant reports “overloaded” ~1 in 20 times, so an individual e2e run can hit those paths; the config keeps one retry. Scores from a deployed URL may differ — re-run Lighthouse against the deployment.

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

## Performance engineering

- **Route-level splitting** for every screen (16 lazy routes) and **component-level** lazy loading for Smart tools, the nav sheet, organizer panels, the 3D twin and the 3D preview. Only one WebGL context exists at a time.
- **Smart prefetch:** event cards warm the detail chunk on hover/focus (skipped on Save-Data / 2G); the offline-vault chunk is warmed at idle so it opens without signal.
- **Network:** in-flight GET de-duplication, 20 s timeouts (AbortController), capped exponential backoff for idempotent reads only — holds/confirms/returns are **never retried automatically**. Seat polling already pauses in hidden tabs.
- **Low-end mode:** Profile → *Reduce visual effects* (auto-on for Save-Data or ≤ 2 GB devices) disables WebGL, blur and decorative animation via one `data-effects` attribute.
- **Rendering:** React Compiler; seats animate with CSS only; the twin recolours instances in place and renders on demand; charts are plain SVG.
- **PWA:** service worker v2 caches the app shell and hashed assets, never API responses; versioned caches; an update toast on new deploys.

## Limitations & honest disclosures

- **No backend.** Seat locking, queues, waitlists, returns and check-ins are simulated in the browser. BroadcastChannel/`storage` sync is same-browser only — not multi-device or server-authoritative consistency.
- **FairQueue** demonstrates the experience and algorithm; browser code cannot stop real bots or guarantee fairness without server-issued tokens and rate limits.
- **Tickets** in the vault are local copies with a placeholder QR — not signed, not validated, no anti-replay protection.
- **Safety plans, crowd levels, noise estimates, seat views and waitlist chances** are illustrative or simulated and labelled in the UI. They are not approved evacuation guidance, sensor data or acoustic measurements.
- **Roles** (student/organizer) are for presentation only. Local storage is not a secure database; only non-sensitive demo data is stored.
- With `VITE_API_BASE_URL` set, mock-only features (waitlist offers, organizer analytics, FairQueue) show a notice instead of fake behaviour.
- Real load balancing belongs to the host/CDN/backend; the static build is CDN-friendly (hashed assets, immutable caching, SPA rewrites for Vercel/Netlify).

## Project layout

```
src/
  lib/campus/     campus data, Zod-validated store, engine (waitlist/exchange/reminders), algorithms/
  features/       smart-tools, fair-queue, event-extras, expense-split, organizer (twin, panels, load lab)
  components/ui/  shared primitives (toggle, segmented, stats, sparkline, bars, sim badge)
  lib/api/        typed client, zod schemas, errors, mock adapter (+ AI intent engine)
  lib/            theme/auth/hold contexts, seats logic, motion tokens, formatting
  components/     SeatMap, AiAssistant, Ticket, EventCard, Poster, dialogs, shell
  routes/         one lazy chunk per screen
  three/          procedural R3F venue, scene store, CSS fallback
  styles/         tokens, base, components, layout
e2e/              Playwright specs     docs/component-sources.md   provenance & licences
.claude/skills/   seatlock-design-director · motion-engineer · threejs-engineer · accessibility-qa
```
