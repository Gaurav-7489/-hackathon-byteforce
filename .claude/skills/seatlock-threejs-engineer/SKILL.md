---
name: seatlock-threejs-engineer
description: Three.js / React Three Fiber engineering for SeatLock's procedural concert-venue scene. Use when building, optimising or debugging the WebGL stage scene, camera choreography, lighting, particles, the view-from-seat preview, quality scaling, GPU cleanup or the non-WebGL fallback.
---

# SeatLock Three.js Engineer

## Location & ownership
- All 3D code lives in `src/three/`. Scenes are loaded with `React.lazy` + dynamic `import()` so `three`/`@react-three/fiber` stay in their own chunk (see `advancedChunks` in `vite.config.ts`).
- Never import `src/three/*` from login, checkout, success or bookings routes.

## Scene concept
One persistent procedural venue: stage platform, LED wall, curved seating tiers (InstancedMesh), additive spotlight cones, haze particles. No external models, textures or paid assets — everything procedural, colours taken from tokens (`#7065FF` indigo, `#81D9FF` ice, `#D5FF73` lime accents).

## Camera
- Discovery: camera progress driven by a ref updated from GSAP ScrollTrigger + damped pointer parallax. Do not set React state per frame — mutate refs in `useFrame`.
- Seat preview (optional): camera placed at a selected seat looking at the stage; purely decorative and synchronised from selection.

## Performance contract
1. `dpr={[1, 1.5]}` cap; lower further on weak GPUs (adaptive quality).
2. Pause rendering (`frameloop="never"` or skip work) when the canvas is off-screen (IntersectionObserver) or the tab is hidden.
3. Dispose geometries/materials/textures you create manually; R3F disposes JSX-owned ones on unmount.
4. Instancing over many meshes; few lights (fake volumetrics with gradient shaders instead of real shadows).
5. Mount after first paint/idle so LCP is text, not WebGL. Content is interactive before the scene loads.

## Fallback & accessibility
- Detect WebGL (`canvas.getContext('webgl2') || getContext('webgl')`); if unavailable or on context loss, render the CSS gradient/beam fallback.
- Under `useReducedMotion()`: static camera, no particle drift.
- Canvas is `aria-hidden`; it never carries information or controls. The real seat map remains an accessible DOM grid — never replace seat buttons with meshes.
