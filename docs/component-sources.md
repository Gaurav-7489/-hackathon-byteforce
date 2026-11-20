# Component & asset provenance

Last reviewed: 2026-11-20. Licences below were verified from each package's `package.json` `license` field in `node_modules` at the installed version.

## Summary

- **All UI components in `src/` are original code written for SeatLock** — buttons, fields, cards, seat map, AI assistant, ticket, dialogs' styling, icons (`src/components/Icon.tsx`, hand-drawn 24px stroke paths) and the logo.
- **No components were copied or adapted from 21st.dev, Skiper UI, Dribbble, MotionSites or Higgsfield.** These sites were used only as general inspiration references for composition, hierarchy and motion principles. No source code, templates, screenshots or assets were taken from them.
- **No paid, Pro, licence-key-gated or watermarked components or templates** are used.
- **No AI-generated or stock media.** Event posters are procedural SVG generated from per-event hue/motif data; the 3D venue (`src/three/`) is procedural geometry and shaders; login stage lighting is pure CSS.
- Accessible primitives come from Radix (MIT) and are styled with SeatLock tokens.

## Third-party libraries

| Package | Version | Licence | Used for | Attribution required |
|---|---|---|---|---|
| react, react-dom | 19.3.1 | MIT | UI runtime (Actions, useOptimistic, ViewTransition, Activity…) | Licence notice in distributed source |
| react-router | 7.14.0 | MIT | Routing, lazy route chunks | Licence notice |
| motion | 14.14.0 | MIT | Component-level springs, AnimatePresence, drag/sheets | Licence notice |
| gsap | 3.15.1 | GreenSock Standard "no charge" licence (https://gsap.com/standard-license) | Section choreography, ScrollTrigger | Free for this use; keep licence reference |
| @gsap/react | 2.1.2 | Same GSAP Standard licence | `useGSAP` hook with automatic cleanup | As above |
| lenis | 1.3.27 | MIT | Smooth scrolling on `/events` only | Licence notice |
| three | 0.187.0 | MIT | WebGL venue scene | Licence notice |
| @react-three/fiber | 9.8.2 | MIT | React renderer for three.js | Licence notice |
| @radix-ui/react-dialog | 1.3.1 | MIT | Accessible confirmation dialogs | Licence notice |
| @radix-ui/react-tabs | 1.2.1 | MIT | Upcoming/Past tabs in My bookings | Licence notice |
| sonner | 2.0.8 | MIT | Success/failure toasts | Licence notice |
| zod | 4.6.7 | MIT | Runtime validation of API responses | Licence notice |
| @fontsource-variable/inter | 5.3.0 | OFL-1.1 | UI typeface (self-hosted) | Font licence travels with the files |
| @fontsource-variable/space-grotesk | 5.3.0 | OFL-1.1 | Display typeface (self-hosted) | Font licence travels with the files |

Dev-only tooling (Vite, TypeScript, Babel + babel-plugin-react-compiler, Vitest, Testing Library, Playwright) is not shipped to users.

## Original component register

| Component / asset | Location | Origin |
|---|---|---|
| Design tokens | `src/styles/tokens.css` | Original |
| Buttons, chips, badges, fields, alerts, skeletons, state panels | `src/styles/components.css` | Original |
| Icon set | `src/components/Icon.tsx` | Original SVG paths |
| Logo, PWA icons | `src/components/Logo.tsx`, `public/icon*.svg` | Original |
| Login stage lighting | `src/routes/login.css` | Original CSS |
| `/design` token page | `src/routes/Design.tsx` | Original |
| Offline page + service worker | `public/offline.html`, `public/sw.js` | Original |
| Event posters, seat map, AI assistant, ticket, 3D venue | `src/components/`, `src/three/` | Original |

## Policy for future additions

Before adding any external component: identify the source, confirm the licence permits this use, record attribution needs, check dependencies and React 19 compatibility, adapt it to the tokens, remove unused code, test accessibility, and add a row to the tables above.
