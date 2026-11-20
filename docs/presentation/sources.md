# SeatLock pitch: sources and evidence

Deck: [`SeatLock-Hackathon-Pitch.pptx`](SeatLock-Hackathon-Pitch.pptx) (8 slides, 16:9, editable, with speaker notes). There is also a PDF copy: [`SeatLock-Hackathon-Pitch.pdf`](SeatLock-Hackathon-Pitch.pdf), which shows the videos as still frames.

The evidence below comes from `main` at commit `1b330a3` (20 Nov 2026). All links point to `main`. In the Status column:

- **Implemented**: it runs in the app.
- **Simulated**: it runs, but on demo data that the browser generates.
- **Prototype limit**: the app does not do this yet.

Base URL: `https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/`

## How the screenshots were made

- Every screenshot is a genuine capture of the app. We built `main` with `npm run build`, served it with `vite preview`, and drove it with Playwright (Chromium, WebGL through SwiftShader, 1440×900 at 2× scale; phone shots use the Pixel 7 profile).
- We could not reach the Vercel deployment from the build sandbox because its network policy refused the host. So the screenshots come from a local production build of the same commit, not from the live URL. Check the live link in a browser before presenting.
- Raw captures are in `screenshots/`. The cropped versions used on the slides are in `assets/`. Video stills are in `video-stills/`. The two QR codes are `assets/qr-repo.png` and `assets/qr-live.png`.
- Tests passed on the same commit: `npm test` gave 15/15 Vitest tests, and `npm run test:e2e` gave 8/8 Playwright tests (7 desktop, 1 phone).

## Claims and visuals

| Slide | Claim or visual | Source | Status |
|---|---|---|---|
| 1 | Cinema and bus seat booking, live 3D | [README.md](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/README.md), [src/booking/Scene3D.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/booking/Scene3D.tsx) | Implemented |
| 1, 7 | 196 cinema seats (11 rows × 16 + 2 recliner rows × 10) | [src/booking/data.ts#L70](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/booking/data.ts#L70) | Implemented (demo layout) |
| 1, 7 | 45 bus seats (10 rows × 4 + a rear bench of 5) | [src/booking/data.ts#L126](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/booking/data.ts#L126) | Implemented (demo layout) |
| 1 | Promo films `bus.mp4`, `cinema.mp4` (embedded in the deck) | [public/media/](https://github.com/Gaurav-7489/-hackathon-byteforce/tree/main/public/media) | The team says they made these with Google Flow. The frames carry a Veo watermark, which fits that. The phone UI in `bus.mp4` is AI-generated and is not the app. |
| 2 | Three users, last two seats, 3:00 | Illustrative scenario | No external statistics are used |
| 2, 4, 7 | 5-minute hold; expiry releases the seats (HTTP 410) | [mock/server.ts#L13](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/api/mock/server.ts#L13), [#L290](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/api/mock/server.ts#L290) | Implemented (mock API) |
| 2, 4, 7 | 1–4 seats per booking | [src/lib/seats.ts#L3](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/seats.ts#L3), [mock/server.ts#L251](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/api/mock/server.ts#L251) | Implemented |
| 2, 7 | Live refresh every 2.5 s (5 s when the live demo is off); pauses in hidden tabs | [src/routes/EventPage.tsx#L426](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/EventPage.tsx#L426) | Implemented |
| 2, 4, 5 | A conflict keeps the other seats and offers "Swap in" with the nearest seat | [EventPage.tsx#L643](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/EventPage.tsx#L643), [mock/server.ts#L267](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/api/mock/server.ts#L267), [e2e/booking.spec.ts#L55](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/e2e/booking.spec.ts#L55) | Implemented and tested |
| 3 | Five seat states with colour and icon, plus AI suggestions | [src/components/SeatMap.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/components/SeatMap.tsx), [README "Seat map behaviour"](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/README.md#seat-map-behaviour) | Implemented |
| 3 | 3D hall and coach, people in booked seats, Overview / Top / From-seat cameras | [src/booking/Scene3D.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/booking/Scene3D.tsx) | Implemented |
| 3 | 44 px touch targets, no horizontal scroll on phones | [e2e/mobile.spec.ts](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/e2e/mobile.spec.ts) | Implemented and tested |
| 3, 6 | English/Hindi voice through the Web Speech API (`hi-IN`) | [src/lib/speech.ts](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/speech.ts), [src/lib/i18n.ts](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/i18n.ts) | Implemented (depends on browser support) |
| 4 | Flow: choose, discover, select, hold, confirm, ticket, manage | `src/routes/` ([Onboard](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/Onboard.tsx), [Browse](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/Browse.tsx), [EventPage](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/EventPage.tsx), [Checkout](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/Checkout.tsx), [Success](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/Success.tsx), [Bookings](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/Bookings.tsx)), [e2e/booking.spec.ts#L17](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/e2e/booking.spec.ts#L17) | Implemented and tested |
| 4 | "Confirm and pay" is a demo confirmation | [src/routes/Checkout.tsx#L190](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/Checkout.tsx#L190) | Prototype limit: no payment gateway |
| 4 | The QR code on the ticket is a placeholder | [src/components/Ticket.tsx#L27](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/components/Ticket.tsx#L27) | Prototype limit |
| 4 | Add to calendar (.ics) and cancel with confirmation | [src/lib/format.ts#L35](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/format.ts#L35), [src/routes/Bookings.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/Bookings.tsx) | Implemented |
| 5 | 20 smart features | [src/features/catalog.ts](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/features/catalog.ts) | Implemented as tools |
| 5 | Where the features appear: list page 5, seat page 12, My tickets 5, organizer panel 3 | `ToolButton` uses in [Browse.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/Browse.tsx), [EventPage.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/EventPage.tsx), [Bookings.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/Bookings.tsx), [AppLayout.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/components/AppLayout.tsx) (commit `1b330a3`) | Implemented |
| 5 | AI Seat Assistant suggests seats but never books; 8 s timeout | [src/components/AiAssistant.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/components/AiAssistant.tsx), [mock/ai.ts#L92](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/api/mock/ai.ts#L92), [e2e/booking.spec.ts#L71](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/e2e/booking.spec.ts#L71) | Implemented. The recommender is rule-based and runs in the browser. It is not an LLM. |
| 5 | AutoRescue | [features/tools.tsx#L304](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/features/tools.tsx#L304), plus the swap flow above | Implemented |
| 5 | Smart Buddy Seating | [tools.tsx#L132](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/features/tools.tsx#L132) | Implemented on live seat data |
| 5 | Accessibility-First Matching | [tools.tsx#L244](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/features/tools.tsx#L244) | Implemented on live seat data |
| 5 | Offline Ticket Vault (saved in localStorage, plus an online/offline indicator) | [tools.tsx#L945](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/features/tools.tsx#L945) | Implemented on the device. The duplicate-scan check at the gate is not implemented. |
| 5 | FairQueue (token, queue position) | [tools.tsx#L217](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/features/tools.tsx#L217) | Simulated: no server-issued tokens |
| 5 | Predictive Waitlist (rank, chance) | [tools.tsx#L430](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/features/tools.tsx#L430) | Simulated |
| 5 | Digital Twin and crowd heatmap | [tools.tsx#L1100](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/features/tools.tsx#L1100), [#L914](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/features/tools.tsx#L914) | The twin reads mock seat states. Demand forecasts and gate counts are simulated. |
| 6 | React 19.3, React Router 7, Three.js 0.187, @react-three/fiber 9, Zod 4, Vite 8, Vitest 5, Playwright 1.65, TypeScript 5.9 | [package.json](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/package.json) | Installed |
| 6, 7 | React Compiler; `three` in its own chunk | [vite.config.ts](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/vite.config.ts) | Implemented |
| 6, 7 | Lazy routes and a lazy 3D scene | [src/App.tsx#L45](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/App.tsx#L45), [EventPage.tsx#L45](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/EventPage.tsx#L45) | Implemented |
| 6 | PWA: service worker and offline page | [public/sw.js](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/public/sw.js), [public/manifest.webmanifest](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/public/manifest.webmanifest) | Implemented |
| 6 | Four custom Claude skills in the repo | [.claude/skills/](https://github.com/Gaurav-7489/-hackathon-byteforce/tree/main/.claude/skills) (design director, Three.js engineer, accessibility QA, motion engineer) | Present in the repo |
| 6 | Claude Code used for development | Commit authors and `Claude-Session` trailers in the [Git history](https://github.com/Gaurav-7489/-hackathon-byteforce/commits/main) | Verified |
| 6 | Vercel deployment config | [vercel.json](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/vercel.json) | Config present. The live URL is team-provided and could not be checked from the sandbox. |
| 6 | Not listed on purpose | GSAP, Framer Motion/Motion, Lenis, Next.js, a production database | None of these is in `package.json` |
| 7 | Typed client with Zod parsing; `VITE_API_BASE_URL` switches to a real API | [src/lib/api/client.ts](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/api/client.ts), [src/lib/api/types.ts](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/api/types.ts) | Implemented |
| 7 | In-browser mock API: 2–3 s latency, about 5% (1 in 20) failures, forced conflicts | [mock/server.ts#L101](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/api/mock/server.ts#L101), [#L210](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/lib/api/mock/server.ts#L210) | Simulated, by design |
| 7 | Optimistic seat picks with rollback | [EventPage.tsx](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/routes/EventPage.tsx) (`useOptimistic`) | Implemented |
| 7 | One InstancedMesh for all seats; renders only on change (`frameloop="demand"`) | [Scene3D.tsx#L6](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/booking/Scene3D.tsx#L6) | Implemented |
| 7 | Keyboard seat grid, reduced motion | [e2e/booking.spec.ts#L37](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/e2e/booking.spec.ts#L37), [src/styles/tokens.css#L153](https://github.com/Gaurav-7489/-hackathon-byteforce/blob/main/src/styles/tokens.css#L153) | Implemented and tested |
| 7 | 15 Vitest unit tests, 8 Playwright end-to-end tests | [src/test/](https://github.com/Gaurav-7489/-hackathon-byteforce/tree/main/src/test), [e2e/](https://github.com/Gaurav-7489/-hackathon-byteforce/tree/main/e2e) | All passing locally on `1b330a3` |
| 7 | Real multi-user guarantees need an authoritative backend | The mock runs per browser and stores state in localStorage | Prototype limit |
| 8 | Timeline: 11 commits on 20 Nov 2026 (IST) | [Commit history](https://github.com/Gaurav-7489/-hackathon-byteforce/commits/main): `381ac42` first commit; `2c77ec0` booking core (Gaurav Bhardwaj); `5a437b5` co-authored by `ankit-00007`; `f00f557` 3D scenes; `bde43ab` full brief; `64c4d59` redesign; `fd36c35` 20 features; `1b330a3` tools placed in the journey | Verified from git |
| 8 | Next steps | Our own roadmap. It follows from the prototype limits above. | Planned |

## External statistics

None. The deck uses an illustrative scenario and no industry numbers, so there is nothing external to cite.

## Rebuilding the deck

The scripts in `build/` regenerate everything:

1. `capture-*.cjs` take the Playwright screenshots. Run them against `vite preview` on port 4180.
2. `crops.py` makes the slide crops.
3. `deck.js` and `icons.js` build the `.pptx` with pptxgenjs. They need `pptxgenjs`, `sharp`, `simple-icons`, `lucide-static` and `qrcode`.
