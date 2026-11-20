import type { Transition, Variants } from 'motion/react'

/**
 * Shared motion language. Component-level interactions use Motion with these
 * presets; section-level choreography uses GSAP (see hooks/useGsapReveal).
 */
export const spring = {
  /** Buttons, seats — crisp, no visible overshoot. */
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.6 } satisfies Transition,
  /** Cards, panels. */
  soft: { type: 'spring', stiffness: 260, damping: 28 } satisfies Transition,
  /** Bottom sheets, drawers. */
  sheet: { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 } satisfies Transition,
  /** Ticket reveal — slight elastic settle. */
  elastic: { type: 'spring', stiffness: 170, damping: 16, mass: 0.9 } satisfies Transition,
} as const

export const duration = { instant: 0.12, fast: 0.18, base: 0.26, panel: 0.36, page: 0.52 } as const
export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
  emphasis: [0.16, 1, 0.3, 1],
} as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
}

export const stagger = (step = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step } },
})
