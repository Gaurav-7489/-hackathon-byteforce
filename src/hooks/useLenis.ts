import { useEffect } from 'react'
import { useReducedMotion } from './useMediaQuery'

/**
 * Smooth scrolling for editorial routes only (event discovery). Lenis is
 * driven by GSAP's ticker so ScrollTrigger and Lenis share one rAF loop.
 * Never mounted on seat-map, checkout, dialogs or forms.
 */
export function useLenis(enabled = true) {
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!enabled || reduced) return
    let disposed = false
    let cleanup = () => {}
    void Promise.all([import('lenis'), import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
        if (disposed) return
        gsap.registerPlugin(ScrollTrigger)
        const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, syncTouch: false, anchors: true })
        lenis.on('scroll', ScrollTrigger.update)
        const raf = (t: number) => lenis.raf(t * 1000)
        gsap.ticker.add(raf)
        gsap.ticker.lagSmoothing(0)
        cleanup = () => {
          gsap.ticker.remove(raf)
          lenis.destroy()
        }
      },
    )
    return () => {
      disposed = true
      cleanup()
    }
  }, [enabled, reduced])
}
