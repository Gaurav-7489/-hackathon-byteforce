# SeatLock

Lock the exact **cinema** or **bus** seat you want — live, in 3D — with an AI seat assistant that suggests but never books.

Built for the SeatLock UI hackathon brief (frontend track): React 19 + TypeScript (strict) + Vite + React Router, with an in-browser mock of the organizer API that reproduces its 2–3 s delays, seat conflicts and ~1-in-20 random failures.

Demo login: `student@seatlock.dev` / `seatlock123`

## Run

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run test:e2e
```

Set `VITE_API_BASE_URL` to the organizer API to use it instead of the built-in mock (the client parses every response with zod and accepts NDJSON, SSE or JSON from `/ai/assist`).

## Screens

| Brief | Route | What’s there |
| --- | --- | --- |
| 1. Login | `/login` | Two steps: choose Cinema or Bus, then sign in. Inline validation on blur, wrong-password message, pending button. |
| 2. Home | `/` | Two rows, one for **Bus** (yellow accent) and one for **Cinema** (cherry-red accent). Each row plays its own film (muted; tap *Sound* to hear it) over the venue photo. |
| 2b. Trips / shows | `/book/bus`, `/book/cinema` | One list per venue type: photo cards, seats left, search. No tabs or dashboards. |
| 3. Details + seat map | `/e/:id` | Poster hero, route timeline (bus), AI summary; **3D hall / coach** and accessible **2D seat map**; legend, up to 4 seats, live total, Hold seats; KPIs, fill-rate sparkline, availability by tier, live activity feed, AI assistant. |
| 4. Checkout | `/checkout` | Seats, price summary, 5-minute countdown ring (warns at 1 min, returns to the map on expiry), Confirm, Back, Cancel with confirmation. |
| 5. Success | `/success` | Animated ticket card, seat details, QR placeholder, Add to calendar (.ics), View my tickets. |
| 6. My bookings | `/bookings` | Upcoming / Past tabs, cancel confirmation dialog, empty states. |

## Seat map behaviour

- Five states with colour **and** icon/pattern: available (number), selected (check), held by others (stripes + clock), booked (person), blocked (crosshatch + ban). AI suggestions get a violet ring + sparkle.
- A fifth seat is refused with an explanation. Taps are optimistic (`useOptimistic`) and re-checked against live availability; if the seat was taken the selection rolls back and a nearby alternative is offered.
- Availability polls every 2.5 s (live demo) / 5 s, pauses in hidden tabs and refreshes on return. If a selected seat is taken it is removed and the user is told (toast + live region).
- Hold conflicts keep the other seats, highlight the lost seat and offer **Swap in &lt;nearest seat&gt;**.
- Keyboard: roving focus grid, arrow keys / Home / End move (skipping aisles), Space / Enter selects, `+`/`-` zoom, visible focus ring.
- Mobile: pan + pinch zoom on the 2D map with 44 × 44 px seats; a sticky hold bar above the tab bar.

## 3D views

`src/booking/Scene3D.tsx` (react-three-fiber, lazy-loaded):

- Cinema hall with stadium risers, aisle lights, row letters and the film title on the screen; intercity coach with a cut-away roof, driver, door, windows and row numbers.
- **People sit in booked seats** (randomised shirts and skin tones; they drop in when a seat is booked). Seats being held by others show a translucent ghost. Your picks and AI suggestions get floating pins.
- Overview / Top / **From seat** cameras; drag to orbit, scroll or pinch to zoom, click or tap a seat to pick it, hover tooltip.
- Performance: `frameloop="demand"` (renders only on change), one InstancedMesh for all seats and two for all people, Lambert materials, no network textures or shadows.

## Demo controls

The **Live demo** pill in the header turns the simulated crowd on/off — when on, other people hold and book seats every couple of seconds and you can watch them sit down in 3D. The sliders button opens: People in 3D, Fast network, Random failures, and one-shot triggers (conflict on next hold, 75 s hold, slow AI → 8 s timeout, stale AI seat), plus Reset demo data.

## Where each compulsory React feature is used

| Feature | Where |
| --- | --- |
| Actions + `useActionState` | Login — `src/routes/Onboard.tsx`; Hold seats — `src/routes/EventPage.tsx`; Confirm booking — `src/routes/Checkout.tsx` |
| `useFormStatus` | `src/components/SubmitButton.tsx` (used by all three forms) |
| `useOptimistic` | Seat selection — `EventPage.tsx` (`applyOptimistic`); cancellation — `src/routes/Bookings.tsx` (`markCancelled`) |
| Suspense + `use()` | Trip / show list — `src/routes/Browse.tsx` (`EventGrid`); details + seat map — `EventPage.tsx`; tickets — `Bookings.tsx`; promise cache in `src/lib/resource.ts` |
| Error boundaries | `src/components/ErrorBoundary.tsx` around the list, listing header, seat map, 3D view, AI assistant and tickets |
| `useTransition` | Search — `Browse.tsx`; seat re-check — `EventPage.tsx`; cancel — `Bookings.tsx` |
| `ViewTransition` | Poster morph card → detail (`EventCard.tsx` / `EventPage.tsx`), seat-state changes (`SeatMap.tsx`), summary list |
| React Compiler | `vite.config.ts` (`reactCompilerPreset`) — no manual `useMemo`/`useCallback` outside the 3D scene |
| Modern patterns | `ref` as a prop (`SubmitButton`), Context rendered as provider (`auth`, `theme`, `hold`, `demo`), `<title>`/`<meta>` from every route component |
| TypeScript strict | `tsconfig.json`; API responses typed and parsed with zod in `src/lib/api/types.ts` |
| Bonus | `useEffectEvent` (polling), `<Activity>` keeps the assistant alive when hidden on phones, hidden-tab retention, voice input, English / Hindi switch (`src/lib/i18n.ts`), UI sound effects (`src/lib/sound.ts`), assistant refinement chips, AI summaries, animated ticket, PWA + offline page |

Not done: **Next.js Server Components** (this is a Vite SPA; it would need a framework migration) and **fragment refs** (not available in the installed React 19.3 API).

## AI seat assistant

`src/components/AiAssistant.tsx` is a chat: you type (or speak), it replies with the seats it suggests, and nothing is selected until you press **Use these seats**. It calls only `POST /ai/assist` with current availability and prices, has Stop and an 8-second timeout, and validates every suggested seat (exists, available, ≤ 4). Suggestions are highlighted on the map and in 3D. Quick chips and refinement chips (Cheaper, Closer to front, Another option) follow each reply. The mock endpoint (`src/lib/api/mock/ai.ts`) understands English and common Hinglish (“do sasti seats saath mein”, “ek khidki wali seat aage”).

## Design

White base everywhere. The venue sets the accent: **bus = white + yellow**, **cinema = white + cherry red** (`[data-mode]` on `<html>`, see `src/styles/tokens.css`). A dark theme is still available from the header. Venue photos are used on home, cards and headers, with generated art as the fallback when an image cannot load.

### Videos

The home rows load `public/media/bus.mp4` and `public/media/cinema.mp4`. Drop your films there with those exact names. If a file is missing, the venue photo stays.

### Live demo

Click **Live demo** in the header. The panel opens and shows the organizer-API requests as they happen (method, path, status, time), with the controls for the crowd, network and failures.

One variable font (Archivo) — its width axis gives the condensed display type. Responsive at 360 / 768 / 1280 px with a bottom tab bar on phones. Reduced motion disables animations and view transitions.

## Layout

```
src/
  App.tsx                 routes + providers
  booking/                seat layouts (data.ts), 3D scene, mode art
  components/             layout, seat map, AI assistant, ticket, dialogs, toasts…
  lib/api/                typed client, zod schemas, mock server + AI + catalogue
  lib/                    auth, theme, hold, demo settings, seat rules, toasts
  routes/                 Onboard, Home, Browse, EventPage, Checkout, Success, Bookings
  styles/                 tokens, base, shared UI
```
