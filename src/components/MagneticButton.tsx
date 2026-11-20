import { motion, useMotionValue, useSpring } from 'motion/react'
import type { ComponentProps, PointerEvent } from 'react'
import { useFinePointer, useReducedMotion } from '../hooks/useMediaQuery'

/**
 * Magnetic call-to-action (editorial sections only — never used on seats or
 * form controls). Spring-follows the pointer a few px and springs back.
 */
export function MagneticLink({ children, strength = 0.28, ...rest }: ComponentProps<typeof motion.a> & { strength?: number }) {
  const fine = useFinePointer()
  const reduced = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.5 })
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.5 })
  const active = fine && !reduced
  const move = (e: PointerEvent<HTMLAnchorElement>) => {
    if (!active) return
    const r = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  return (
    <motion.a {...rest} style={{ x: sx, y: sy, ...rest.style }} onPointerMove={move} onPointerLeave={() => { x.set(0); y.set(0) }}>
      {children}
    </motion.a>
  )
}
