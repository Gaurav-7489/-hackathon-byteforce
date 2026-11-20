# SeatLock

Lock the exact **cinema** or **bus** seat you want, in a live 3D view.

- **Sign in (`/login`)** — two steps: choose Cinema or Bus, then sign in.
- **Cinema (`/book/cinema`)** — a 196-seat hall in 3D: Classic, Prime and Recliner tiers, showtime picker, view from your seat.
- **Bus (`/book/bus`)** — a 45-seat 2+2 coach in 3D: window / aisle / rear bench, women-only rows, departure picker.
- **Live** — other shoppers lock, buy and release seats while you watch (3D pops, live feed, KPIs, fill-rate trend).
- **Hold** — up to 6 seats lock to you for 5 minutes, then pay and get a booking code.
- **2D map** — keyboard and screen-reader friendly fallback, used automatically without WebGL.

Demo login (built-in mock API): `student@seatlock.dev` / `seatlock123`.

## Run

```bash
npm install
npm run dev
```

```bash
npm run build
```

```bash
npm test
```

```bash
npm run test:e2e
```

Set `VITE_API_BASE_URL` to use a real API (only `POST /auth/login` is called); leave it empty for the in-browser mock.

## Performance

- Route-level code splitting; three.js and the scene load only on a booking page (prefetched while choosing on the sign-in screen).
- Every seat is one `InstancedMesh` (one draw call) with per-instance colour.
- `frameloop="demand"`: the canvas renders only when the camera moves, a seat changes or an animation runs.
- No model or texture downloads; hovering a seat updates the tooltip without React re-renders.

## Layout

```
src/
  App.tsx              routes: /login, /book/:mode
  booking/
    data.ts            seat layouts, listings, live-market simulation (pure)
    useLiveInventory.ts
    Scene3D.tsx        react-three-fiber cinema + bus scenes (lazy)
    lk.css             design tokens for the light "ledger" look
  routes/
    Onboard.tsx        sign-in flow
    Book.tsx           booking page (3D/2D map, KPIs, tiers, basket, feed)
  lib/                 auth + API client (login) + mock
```
