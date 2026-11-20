import { useEffect, useState } from 'react'

/**
 * Decides when the heavy WebGL chunk may load.
 * - Capable desktops (fine pointer, ≥768px, ≥4 cores, no Save-Data): once the page is idle.
 * - Phones / low-power / Save-Data: only after the visitor interacts (scroll, touch, key),
 *   so the first paint and the booking UI never compete with shader compilation.
 * Until then the CSS stage fallback is shown.
 */
export function useWebGLReady(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; hardwareConcurrency?: number }
    const capable =
      window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)').matches &&
      (nav.hardwareConcurrency ?? 4) >= 4 &&
      !nav.connection?.saveData
    let idleHandle = 0
    const go = () => setReady(true)
    const events = ['pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }))
    const onLoad = () => {
      if (!capable) return
      if ('requestIdleCallback' in window) idleHandle = window.requestIdleCallback(go, { timeout: 2500 })
      else idleHandle = setTimeout(go, 600) as unknown as number
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => {
      events.forEach((e) => window.removeEventListener(e, go))
      window.removeEventListener('load', onLoad)
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle)
      clearTimeout(idleHandle)
    }
  }, [])
  return ready
}
