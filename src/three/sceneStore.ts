/**
 * Mutable, React-free state for the 3D world. DOM code (GSAP ScrollTrigger,
 * pointer handlers) writes here; the R3F scene reads it inside useFrame, so
 * scroll never triggers React renders.
 */
export const sceneStore = {
  /** 0..1 hero scroll progress — camera eases forward/down as the hero leaves. */
  progress: 0,
  /** 0..1 featured-chapter progress — camera dives to a seat-eye view; LED wall shifts hue. */
  featured: 0,
  /** -1..1 pointer position (raw; the scene smooths it). */
  pointerX: 0,
  pointerY: 0,
  /** Featured event hue in HSL degrees. */
  hue: 258,
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v))

export function setPointer(x: number, y: number): void {
  sceneStore.pointerX = clamp(x)
  sceneStore.pointerY = clamp(y)
}
