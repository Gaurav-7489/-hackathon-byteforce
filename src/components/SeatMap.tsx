import { useEffect, useRef, useState, ViewTransition, type KeyboardEvent, type PointerEvent as RPointerEvent, type WheelEvent } from 'react'
import type { Seat } from '../lib/api/types'
import { money } from '../lib/format'
import { effectiveStatus, neighbour, rowIndex, STATUS_LABEL, type Direction } from '../lib/seats'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { Icon, type IconName } from './Icon'
import './seatmap.css'

const STATUS_ICON: Record<string, IconName | null> = {
  available: null,
  selected: 'check',
  held: 'clock',
  booked: 'x',
  blocked: 'ban',
}

const KEY_DIR: Record<string, Direction> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end',
}

interface Props {
  seats: Seat[]
  selected: ReadonlySet<string>
  suggested: ReadonlySet<string>
  lost: ReadonlySet<string>
  onToggle: (seat: Seat) => void
  /** Imperative focus target (e.g. after "Use these seats"). */
  focusSeatId?: string | null
}

interface View { x: number; y: number; s: number }
const MIN_S = 0.5
const MAX_S = 2.2

export function SeatMap({ seats, selected, suggested, lost, onToggle, focusSeatId }: Props) {
  const reduced = useReducedMotion()
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const view = useRef<View>({ x: 0, y: 0, s: 1 })
  const [scale, setScale] = useState(1)
  const [focusId, setFocusId] = useState<string | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; startDist: number; startS: number; lastT: number; vx: number; vy: number }>({ moved: false, startDist: 0, startS: 1, lastT: 0, vx: 0, vy: 0 })
  const inertia = useRef(0)

  const rows = [...new Set(seats.map((s) => s.row))].sort((a, b) => rowIndex(a) - rowIndex(b))
  const maxCol = Math.max(0, ...seats.map((s) => s.col))
  const rovingId = focusId ?? seats.find((s) => s.status === 'available')?.id ?? seats[0]?.id ?? null

  const apply = (smooth = false) => {
    const el = canvasRef.current
    if (!el) return
    el.style.transition = smooth && !reduced ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
    el.style.transform = `translate3d(${view.current.x}px, ${view.current.y}px, 0) scale(${view.current.s})`
  }

  /** Keep the map on-screen: centre it when it fits, otherwise limit panning to its edges. */
  const clamp = () => {
    const vp = viewportRef.current
    const c = canvasRef.current
    if (!vp || !c) return
    const pad = 40
    const axis = (pos: number, content: number, viewport: number) =>
      content + pad * 2 <= viewport ? (viewport - content) / 2 : Math.min(pad, Math.max(viewport - content - pad, pos))
    view.current.x = axis(view.current.x, c.offsetWidth * view.current.s, vp.clientWidth)
    view.current.y = axis(view.current.y, c.offsetHeight * view.current.s, vp.clientHeight)
  }

  const zoomTo = (s: number, cx?: number, cy?: number, smooth = true) => {
    const vp = viewportRef.current
    if (!vp) return
    const next = Math.min(MAX_S, Math.max(MIN_S, s))
    const px = cx ?? vp.clientWidth / 2
    const py = cy ?? vp.clientHeight / 2
    const k = next / view.current.s
    view.current.x = px - (px - view.current.x) * k
    view.current.y = py - (py - view.current.y) * k
    view.current.s = next
    clamp()
    apply(smooth)
    setScale(next)
  }

  const reset = (smooth = true) => {
    const vp = viewportRef.current
    const c = canvasRef.current
    if (!vp || !c) return
    // Touch: 1:1 so every seat is a ≥44px target. Fine pointer: fit the width (never below 70%).
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const fit = (vp.clientWidth - 16) / c.offsetWidth
    view.current.s = coarse ? 1 : Math.min(1, Math.max(0.7, fit))
    view.current.x = (vp.clientWidth - c.offsetWidth * view.current.s) / 2
    view.current.y = 0
    clamp()
    apply(smooth)
    setScale(view.current.s)
  }

  useEffect(() => {
    reset(false)
    const vp = viewportRef.current
    if (!vp) return
    const ro = new ResizeObserver(() => { clamp(); apply() })
    ro.observe(vp)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(inertia.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only layout
  }, [])

  /** Keep the keyboard-focused seat inside the viewport. */
  const reveal = (id: string) => {
    const vp = viewportRef.current
    const el = vp?.querySelector<HTMLElement>(`[data-seat="${id}"]`)
    if (!vp || !el) return
    const vr = vp.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    const m = 24
    let dx = 0
    let dy = 0
    if (er.left < vr.left + m) dx = vr.left + m - er.left
    else if (er.right > vr.right - m) dx = vr.right - m - er.right
    if (er.top < vr.top + m) dy = vr.top + m - er.top
    else if (er.bottom > vr.bottom - m) dy = vr.bottom - m - er.bottom
    if (dx || dy) {
      view.current.x += dx
      view.current.y += dy
      clamp()
      apply(true)
    }
  }

  useEffect(() => {
    if (!focusSeatId) return
    setFocusId(focusSeatId)
    reveal(focusSeatId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the requested id only
  }, [focusSeatId])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = KEY_DIR[e.key]
    if (dir && rovingId) {
      e.preventDefault()
      const next = neighbour(seats, rovingId, dir)
      if (next) {
        setFocusId(next.id)
        const btn = viewportRef.current?.querySelector<HTMLButtonElement>(`[data-seat="${next.id}"]`)
        btn?.focus({ preventScroll: true })
        reveal(next.id)
      }
      return
    }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(view.current.s * 1.25) }
    if (e.key === '-') { e.preventDefault(); zoomTo(view.current.s / 1.25) }
  }

  // ---- Pointer pan / pinch (touch + mouse). Plain wheel scrolls the page. ----
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    cancelAnimationFrame(inertia.current)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    gesture.current.moved = false
    gesture.current.lastT = performance.now()
    gesture.current.vx = 0
    gesture.current.vy = 0
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      if (a && b) {
        gesture.current.startDist = Math.hypot(a.x - b.x, a.y - b.y)
        gesture.current.startS = view.current.s
      }
    }
  }

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    if (!gesture.current.moved && Math.hypot(dx, dy) < 6 && pointers.current.size === 1) return
    if (!gesture.current.moved) {
      gesture.current.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const vp = viewportRef.current?.getBoundingClientRect()
      if (a && b && vp) {
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        zoomTo((gesture.current.startS * dist) / (gesture.current.startDist || dist), (a.x + b.x) / 2 - vp.left, (a.y + b.y) / 2 - vp.top, false)
      }
      return
    }
    const now = performance.now()
    const dt = Math.max(1, now - gesture.current.lastT)
    gesture.current.vx = dx / dt
    gesture.current.vy = dy / dt
    gesture.current.lastT = now
    view.current.x += dx
    view.current.y += dy
    clamp()
    apply()
  }

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0 || !gesture.current.moved || reduced) return
    // Gentle inertia: exponential decay, stops quickly so control stays precise.
    let vx = gesture.current.vx * 16
    let vy = gesture.current.vy * 16
    const step = () => {
      vx *= 0.9
      vy *= 0.9
      if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) return
      view.current.x += vx
      view.current.y += vy
      clamp()
      apply()
      inertia.current = requestAnimationFrame(step)
    }
    inertia.current = requestAnimationFrame(step)
  }

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return // trackpad pinch arrives as ctrl+wheel
    e.preventDefault()
    const vp = viewportRef.current?.getBoundingClientRect()
    if (!vp) return
    zoomTo(view.current.s * Math.exp(-e.deltaY * 0.01), e.clientX - vp.left, e.clientY - vp.top, false)
  }

  // Native wheel listener must be non-passive to prevent browser zoom.
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const block = (e: globalThis.WheelEvent) => { if (e.ctrlKey) e.preventDefault() }
    vp.addEventListener('wheel', block, { passive: false })
    return () => vp.removeEventListener('wheel', block)
  }, [])

  const onSeatClick = (seat: Seat) => {
    if (gesture.current.moved) return // a drag, not a tap
    setFocusId(seat.id)
    onToggle(seat)
  }

  return (
    <div className="seatmap">
      <div className="seatmap-toolbar">
        <div className="seatmap-zoom" role="group" aria-label="Map zoom">
          <button type="button" className="icon-btn" onClick={() => zoomTo(view.current.s / 1.25)} disabled={scale <= MIN_S + 0.01} aria-label="Zoom out"><Icon name="zoomOut" /></button>
          <span className="seatmap-scale num" aria-live="polite">{Math.round(scale * 100)}%</span>
          <button type="button" className="icon-btn" onClick={() => zoomTo(view.current.s * 1.25)} disabled={scale >= MAX_S - 0.01} aria-label="Zoom in"><Icon name="zoomIn" /></button>
          <button type="button" className="icon-btn" onClick={() => reset()} aria-label="Reset map view"><Icon name="expand" /></button>
        </div>
        <p className="seatmap-help">Drag or pinch to move the map. With a keyboard, use the arrow keys and press Space to pick a seat.</p>
      </div>

      <div
        ref={viewportRef}
        className="seatmap-viewport"
        data-lenis-prevent
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div ref={canvasRef} className="seatmap-canvas" style={{ ['--cols' as string]: maxCol + 1 }}>
          <div className="stage" aria-hidden="true">
            <svg viewBox="0 0 600 70" preserveAspectRatio="none" className="stage-svg">
              <defs>
                <linearGradient id="stage-g" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--brand)" stopOpacity="0.55" />
                  <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M10 8 Q300 -10 590 8 L560 52 Q300 36 40 52 Z" fill="url(#stage-g)" stroke="var(--brand)" strokeWidth="1.5" />
            </svg>
            <span className="stage-label">STAGE</span>
          </div>
          <p className="sr-only" id="stage-note">The stage is at the top of the map, in front of row {rows[0]}.</p>

          <div role="grid" aria-label="Seat map" aria-describedby="stage-note" aria-rowcount={rows.length} className="seat-grid" onKeyDown={onKeyDown}>
            {rows.map((row, r) => (
              <div role="row" key={row} className="seat-row" aria-rowindex={r + 1}>
                <span className="row-label" aria-hidden="true">{row}</span>
                {seats.filter((s) => s.row === row).map((seat) => {
                  const status = effectiveStatus(seat, selected)
                  const icon = STATUS_ICON[status]
                  const isAi = suggested.has(seat.id)
                  const isLost = lost.has(seat.id)
                  const label = `${seat.id}, row ${seat.row} seat ${seat.number}${seat.isAisle ? ', aisle' : ''}, ${money(seat.price)}, ${STATUS_LABEL[status]}${isAi ? ', AI suggestion' : ''}${isLost ? ', just taken' : ''}`
                  return (
                    <div role="gridcell" key={seat.id} style={{ gridColumn: seat.col + 2 }}>
                      <ViewTransition update="seat-update" default="none">
                        <button
                          type="button"
                          data-seat={seat.id}
                          data-status={status}
                          data-ai={isAi || undefined}
                          data-lost={isLost || undefined}
                          className="seat"
                          tabIndex={seat.id === rovingId ? 0 : -1}
                          aria-label={label}
                          aria-pressed={status === 'selected'}
                          aria-disabled={status === 'booked' || status === 'blocked' || status === 'held' ? true : undefined}
                          onFocus={() => setFocusId(seat.id)}
                          onClick={() => onSeatClick(seat)}
                        >
                          {icon ? <Icon name={icon} size={16} /> : <span className="seat-num" aria-hidden="true">{seat.number}</span>}
                          {isAi && <span className="seat-ai-dot" aria-hidden="true"><Icon name="sparkle" size={10} /></span>}
                        </button>
                      </ViewTransition>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SeatLegend() {
  const items: { status: string; label: string; icon: IconName | null }[] = [
    { status: 'available', label: 'Available', icon: null },
    { status: 'selected', label: 'Your pick', icon: 'check' },
    { status: 'held', label: 'Held by others', icon: 'clock' },
    { status: 'booked', label: 'Booked', icon: 'x' },
    { status: 'blocked', label: 'Blocked', icon: 'ban' },
  ]
  return (
    <ul className="legend" aria-label="Seat legend">
      {items.map((i) => (
        <li key={i.status}>
          <span className="seat seat-swatch" data-status={i.status} aria-hidden="true">{i.icon && <Icon name={i.icon} size={12} />}</span>
          {i.label}
        </li>
      ))}
      <li>
        <span className="seat seat-swatch" data-status="available" data-ai aria-hidden="true" />
        AI suggestion
      </li>
    </ul>
  )
}
