import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { StageFallback } from './StageFallback'
import { AdaptiveQuality, Venue, type SeatTarget } from './Venue'
import './stage.css'

export interface StageCanvasProps {
  mode: 'world' | 'seat'
  seat?: SeatTarget | null
  hue?: number
  className?: string
  paused?: boolean
  /** When given, the canvas is exposed as an image with this label; otherwise decorative. */
  label?: string
}

let webglSupport: boolean | null = null
function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    webglSupport = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglSupport = false
  }
  return webglSupport
}

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }
}
const reducedQuery = '(prefers-reduced-motion: reduce)'
const subscribeReduced = subscribeMedia(reducedQuery)

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => mo.disconnect()
}
const readTheme = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

function subscribeVisibility(cb: () => void) {
  document.addEventListener('visibilitychange', cb)
  return () => document.removeEventListener('visibilitychange', cb)
}

export default function StageCanvas({ mode, seat = null, hue = 258, className, paused = false, label }: StageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(true)
  const [ready, setReady] = useState(false)
  const [lost, setLost] = useState(false)
  const [supported] = useState(hasWebGL)
  const [maxDpr] = useState(() => (window.innerWidth < 768 ? 1.5 : 1.75))
  const [quality] = useState(() => ({ level: window.innerWidth < 768 ? 0.5 : 1 }))
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false)
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'dark' as const)
  const docVisible = useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => true)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const active = onScreen && docVisible && !paused
  const frameloop = !active ? 'never' : reduced ? 'demand' : 'always'
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const }

  if (!supported || lost) {
    return (
      <div className={`stage-canvas ${className ?? ''}`} {...a11y}>
        <StageFallback />
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={`stage-canvas ${className ?? ''}`} data-ready={ready || undefined} {...a11y}>
      <StageFallback className="stage-canvas-poster" />
      <Canvas
        className="stage-canvas-gl"
        frameloop={frameloop}
        dpr={[1, maxDpr]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true }}
        camera={{ fov: 46, near: 0.1, far: 120, position: [0, 11, 25] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            setLost(true)
          })
          requestAnimationFrame(() => setReady(true))
        }}
        tabIndex={-1}
      >
        <Venue mode={mode} seat={seat} hue={hue} theme={theme} reduced={reduced} quality={quality} />
        {!reduced && <AdaptiveQuality maxDpr={maxDpr} quality={quality} />}
      </Canvas>
    </div>
  )
}
