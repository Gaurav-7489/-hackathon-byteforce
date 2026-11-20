/**
 * Lightweight 3D seat views for the cinema hall and the intercity coach,
 * driven by the live seat API.
 *
 * Performance notes
 * - frameloop="demand": nothing renders unless the camera moves, a seat changes
 *   or a short animation runs. An idle page costs ~0 GPU.
 * - All seats are ONE InstancedMesh; seated people are two more (solid + ghost);
 *   pins one more. A handful of draw calls in total, Lambert materials only.
 * - No network textures, no shadows, no post-processing.
 * - This module (and three.js) is lazy-loaded only on a seat-map page.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Seat } from '../lib/api/types'
import { hash, type Layout } from './data'

export type View = 'overview' | 'top' | 'seat'

export interface SceneProps {
  layout: Layout
  seats: Seat[]
  selected: ReadonlySet<string>
  suggested: ReadonlySet<string>
  lost: ReadonlySet<string>
  view: View
  focusId: string | null
  people: boolean
  screenTitle: string
  onPick: (seatId: string) => void
  onHover: (seatId: string | null, x: number, y: number) => void
}

export const SEAT_COLORS = {
  free: '#e9eee5',
  women: '#f5b3c6',
  recliner: '#b9cdf0',
  held: '#ff6b3d',
  booked: '#56605a',
  mine: '#2fbf71',
  blocked: '#2a2f2c',
  selected: '#f2b705',
  ai: '#7d72ff',
  lost: '#ff3b30',
}

type Key = keyof typeof SEAT_COLORS

const SHIRTS = ['#e4572e', '#29335c', '#f3a712', '#669bbc', '#a8c686', '#c1121f', '#6a4c93', '#1982c4', '#ff924c', '#8ac926', '#ffca3a', '#f2f2f2', '#3a86ff', '#ef476f']
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673a']

/* ------------------------------------------------------------------ Camera */

interface Orbit {
  theta: number
  phi: number
  radius: number
  target: Vector3
}

const PRESETS: Record<Layout['mode'], Record<'overview' | 'top', Orbit>> = {
  cinema: {
    overview: { theta: 0.38, phi: 0.95, radius: 18.5, target: new Vector3(0, 0.6, 2.4) },
    top: { theta: 0, phi: 0.1, radius: 20, target: new Vector3(0, 0, 1.6) },
  },
  bus: {
    overview: { theta: 0.55, phi: 0.7, radius: 13, target: new Vector3(0, 0.2, 0.6) },
    top: { theta: 0, phi: 0.06, radius: 12, target: new Vector3(0, 0, 0.6) },
  },
}

function Rig({ layout, view, focus, ctrl }: { layout: Layout; view: View; focus: number | null; ctrl: { orbit: Orbit; dragging: boolean } }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  const el = useThree((s) => s.gl.domElement)
  const tmp = useMemo(() => ({ pos: new Vector3(), look: new Vector3(), curLook: new Vector3(), first: true }), [])

  // Reset the orbit whenever the preset or venue changes.
  useEffect(() => {
    if (view !== 'seat') {
      const p = PRESETS[layout.mode][view]
      ctrl.orbit = { ...p, target: p.target.clone() }
    }
    invalidate()
  }, [view, layout, ctrl, invalidate])

  // Drag to orbit, wheel / pinch to zoom. Listeners live on the canvas only.
  useEffect(() => {
    let lastX = 0
    let lastY = 0
    let down = false
    const pointers = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      down = true
      lastX = e.clientX
      lastY = e.clientY
    }
    const onMove = (e: PointerEvent) => {
      if (!down || !pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        if (pinch) ctrl.orbit.radius = MathUtils.clamp(ctrl.orbit.radius * (pinch / d), 5, 30)
        pinch = d
        invalidate()
        return
      }
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      if (Math.abs(dx) + Math.abs(dy) < 1) return
      ctrl.dragging = true
      ctrl.orbit.theta -= dx * 0.006
      ctrl.orbit.phi = MathUtils.clamp(ctrl.orbit.phi - dy * 0.005, 0.05, 1.45)
      invalidate()
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
      if (pointers.size === 0) {
        down = false
        // Let the click handler see that this gesture was a drag, then reset.
        setTimeout(() => (ctrl.dragging = false), 0)
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      ctrl.orbit.radius = MathUtils.clamp(ctrl.orbit.radius * (1 + Math.sign(e.deltaY) * 0.08), 5, 30)
      invalidate()
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [el, ctrl, invalidate])

  useFrame((_, delta) => {
    const seat = focus !== null ? layout.seats[focus] : undefined
    let fov = 42
    if (view === 'seat' && seat) {
      const lift = layout.mode === 'cinema' ? 1.4 : 1.25
      tmp.pos.set(seat.x, seat.y + lift, seat.z + 0.3)
      if (layout.mode === 'cinema') tmp.look.set(seat.x * 0.15, 3.4, -8)
      else tmp.look.set(seat.x * 0.4, 0.95, -7)
      fov = 62
    } else {
      const o = ctrl.orbit
      tmp.look.copy(o.target)
      tmp.pos.set(Math.sin(o.phi) * Math.sin(o.theta), Math.cos(o.phi), Math.sin(o.phi) * Math.cos(o.theta)).multiplyScalar(o.radius).add(o.target)
    }
    const a = tmp.first ? 1 : 1 - Math.exp(-7 * Math.min(delta, 0.1))
    tmp.first = false
    camera.position.lerp(tmp.pos, a)
    tmp.curLook.lerp(tmp.look, a)
    camera.lookAt(tmp.curLook)
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = MathUtils.lerp(camera.fov, fov, a)
      camera.updateProjectionMatrix()
    }
    // Keep rendering only while the camera is still settling.
    if (camera.position.distanceToSquared(tmp.pos) > 1e-5 || tmp.curLook.distanceToSquared(tmp.look) > 1e-5 || Math.abs(camera.fov - fov) > 0.05) invalidate()
  })
  return null
}

/* ------------------------------------------------------------------- Seats */


/* ------------------------------------------------------------------- Seats */

const POP_MS = 520
const PING_MS = 1500
const PING_POOL = 10
const PEOPLE_MS = 700

function seatGeometry() {
  const parts = [
    new BoxGeometry(0.5, 0.12, 0.46).translate(0, 0.26, 0),
    new BoxGeometry(0.5, 0.56, 0.1).translate(0, 0.54, 0.21),
    new BoxGeometry(0.07, 0.16, 0.42).translate(-0.26, 0.36, 0.02),
    new BoxGeometry(0.07, 0.16, 0.42).translate(0.26, 0.36, 0.02),
    new BoxGeometry(0.3, 0.2, 0.3).translate(0, 0.1, 0.02),
  ]
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}

/** A seated figure facing -z: thighs on the seat, torso against the back. */
function bodyGeometry(withHead: boolean) {
  const parts: BufferGeometry[] = [
    new BoxGeometry(0.34, 0.12, 0.34).translate(0, 0.38, -0.06),
    new BoxGeometry(0.36, 0.44, 0.2).translate(0, 0.62, 0.1),
    new BoxGeometry(0.08, 0.34, 0.1).translate(-0.22, 0.6, 0.02),
    new BoxGeometry(0.08, 0.34, 0.1).translate(0.22, 0.6, 0.02),
    new BoxGeometry(0.3, 0.3, 0.1).translate(0, 0.2, -0.2),
  ]
  if (withHead) parts.push(new SphereGeometry(0.13, 12, 10).translate(0, 0.97, 0.1))
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!
  parts.forEach((p) => p.dispose())
  return g
}

interface SeatsProps extends SceneProps {
  ctrl: { dragging: boolean }
}

function keyFor(seat: Seat | undefined, layoutTags: string[], tier: string, selected: ReadonlySet<string>, suggested: ReadonlySet<string>, lost: ReadonlySet<string>): Key {
  if (!seat) return 'free'
  if (lost.has(seat.id)) return 'lost'
  if (selected.has(seat.id) || seat.heldByMe) return selected.has(seat.id) ? 'selected' : 'free'
  if (seat.status === 'booked') return seat.mine ? 'mine' : 'booked'
  if (seat.status === 'held') return 'held'
  if (seat.status === 'blocked') return 'blocked'
  if (suggested.has(seat.id)) return 'ai'
  if (layoutTags.includes('Women only')) return 'women'
  if (tier === 'recliner') return 'recliner'
  return 'free'
}

function Seats({ layout, seats, selected, suggested, lost, people, onPick, onHover, ctrl }: SeatsProps) {
  const ref = useRef<InstancedMesh>(null)
  const bodyRef = useRef<InstancedMesh>(null)
  const headRef = useRef<InstancedMesh>(null)
  const ghostRef = useRef<InstancedMesh>(null)
  const pinRef = useRef<InstancedMesh>(null)
  const pingRefs = useRef<(Mesh | null)[]>([])
  const invalidate = useThree((s) => s.invalidate)
  const n = layout.seats.length
  const geometry = useMemo(seatGeometry, [])
  const material = useMemo(() => new MeshLambertMaterial({ color: '#ffffff' }), [])
  const bodyGeo = useMemo(() => bodyGeometry(false), [])
  const ghostGeo = useMemo(() => bodyGeometry(true), [])
  const headGeo = useMemo(() => new SphereGeometry(0.13, 14, 12).translate(0, 0.97, 0.1), [])
  const personMat = useMemo(() => new MeshLambertMaterial({ color: '#ffffff' }), [])
  const ghostMat = useMemo(() => new MeshBasicMaterial({ color: SEAT_COLORS.held, transparent: true, opacity: 0.38, depthWrite: false }), [])
  const pinGeo = useMemo(() => new ConeGeometry(0.16, 0.38, 14).rotateX(Math.PI).translate(0, 1.55, 0.05), [])
  const pinMat = useMemo(() => new MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  const pingGeo = useMemo(() => new CylinderGeometry(0.06, 0.24, 2.4, 10, 1, true).translate(0, 1.2, 0), [])
  const pingMats = useMemo(
    () => Array.from({ length: PING_POOL }, () => new MeshBasicMaterial({ color: SEAT_COLORS.held, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })),
    [],
  )
  const anim = useMemo(
    () => ({ start: new Float64Array(n), born: new Float64Array(n), prev: new Array<Key>(n).fill('free'), hovered: -1, pings: Array.from({ length: PING_POOL }, () => ({ start: 0 })), nextPing: 0, active: false, init: false }),
    [n],
  )
  const o = useMemo(() => new Object3D(), [])
  const c = useMemo(() => new Color(), [])
  const byIndex = useMemo(() => {
    const arr: (Seat | undefined)[] = new Array(n)
    for (const s of seats) {
      const i = layout.index.get(s.id)
      if (i !== undefined) arr[i] = s
    }
    return arr
  }, [seats, layout, n])

  useEffect(
    () => () => {
      for (const d of [geometry, material, bodyGeo, ghostGeo, headGeo, personMat, ghostMat, pinGeo, pinMat, pingGeo, ...pingMats]) d.dispose()
    },
    [geometry, material, bodyGeo, ghostGeo, headGeo, personMat, ghostMat, pinGeo, pinMat, pingGeo, pingMats],
  )
  // People and pins never steal clicks from the seats.
  useLayoutEffect(() => {
    for (const m of [bodyRef.current, headRef.current, ghostRef.current, pinRef.current]) if (m) m.raycast = () => {}
  }, [])

  const keys = layout.seats.map((s, i) => keyFor(byIndex[i], s.tags, s.tier, selected, suggested, lost))

  const writeSeat = (i: number, now: number) => {
    const s = layout.seats[i]!
    const t = (now - anim.start[i]!) / POP_MS
    const pop = t >= 0 && t < 1 ? Math.sin(t * Math.PI) : 0
    const k = keys[i]
    const raised = k === 'selected' || k === 'ai' ? 0.08 : k === 'blocked' ? -0.12 : 0
    o.position.set(s.x, s.y + raised + pop * 0.22, s.z)
    o.rotation.set(0, 0, 0)
    o.scale.set(s.scale * (1 + pop * 0.12), (k === 'blocked' ? 0.7 : 1) + pop * 0.25, 1 + (s.scale - 1) * 0.35)
    o.updateMatrix()
    ref.current!.setMatrixAt(i, o.matrix)
  }

  const writeColor = (i: number) => {
    c.set(SEAT_COLORS[keys[i]!])
    if (i === anim.hovered && (keys[i] === 'free' || keys[i] === 'selected' || keys[i] === 'women' || keys[i] === 'recliner' || keys[i] === 'ai')) c.lerp(new Color('#ffffff'), 0.5)
    ref.current!.setColorAt(i, c)
  }

  /** Seated people (booked), ghosts (held by others) and pins (yours + AI). */
  const writePeople = (now: number) => {
    const body = bodyRef.current
    const head = headRef.current
    const ghost = ghostRef.current
    const pin = pinRef.current
    if (!body || !head || !ghost || !pin) return false
    let nb = 0
    let ng = 0
    let np = 0
    let animating = false
    for (let i = 0; i < n; i++) {
      const s = layout.seats[i]!
      const k = keys[i]
      if (people && (k === 'booked' || k === 'mine')) {
        const t = Math.min(1, (now - anim.born[i]!) / PEOPLE_MS)
        if (t < 1) animating = true
        const e = 1 - Math.pow(1 - t, 3)
        const h = hash(s.id)
        o.position.set(s.x, s.y + (1 - e) * 0.9, s.z)
        o.rotation.set(0, ((h % 7) - 3) * 0.03, 0)
        o.scale.setScalar(Math.max(0.001, e) * (0.92 + (h % 5) * 0.03))
        o.updateMatrix()
        body.setMatrixAt(nb, o.matrix)
        head.setMatrixAt(nb, o.matrix)
        body.setColorAt(nb, c.set(k === 'mine' ? SEAT_COLORS.selected : SHIRTS[h % SHIRTS.length]!))
        head.setColorAt(nb, c.set(SKIN[(h >>> 4) % SKIN.length]!))
        nb++
      } else if (people && k === 'held') {
        o.position.set(s.x, s.y, s.z)
        o.rotation.set(0, 0, 0)
        o.scale.setScalar(0.95)
        o.updateMatrix()
        ghost.setMatrixAt(ng++, o.matrix)
      }
      if (k === 'selected' || k === 'ai' || k === 'lost') {
        o.position.set(s.x, s.y, s.z)
        o.rotation.set(0, 0, 0)
        o.scale.setScalar(1)
        o.updateMatrix()
        pin.setMatrixAt(np, o.matrix)
        pin.setColorAt(np, c.set(SEAT_COLORS[k]))
        np++
      }
    }
    body.count = nb
    head.count = nb
    ghost.count = ng
    pin.count = np
    for (const m of [body, head, ghost, pin]) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    return animating
  }

  // Sync colours and kick off pop / ping / sit-down animations for changed seats.
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const now = performance.now()
    for (let i = 0; i < n; i++) {
      const k = keys[i]!
      if (anim.init && anim.prev[i] !== k) {
        anim.start[i] = now
        anim.active = true
        if (k === 'booked' || k === 'mine') anim.born[i] = now
        if (k === 'held' || k === 'booked') {
          const p = anim.nextPing++ % PING_POOL
          anim.pings[p]!.start = now
          const m = pingRefs.current[p]
          if (m) {
            const s = layout.seats[i]!
            m.position.set(s.x, s.y + 0.3, s.z)
            pingMats[p]!.color.set(k === 'booked' ? '#9fe0b8' : SEAT_COLORS.held)
          }
        }
      } else if (!anim.init) anim.born[i] = -1e9
      anim.prev[i] = k
      writeColor(i)
      writeSeat(i, anim.init ? now : -1e9)
    }
    anim.init = true
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    if (writePeople(now)) anim.active = true
    invalidate()
  })

  useFrame(() => {
    if (!anim.active || !ref.current) return
    const now = performance.now()
    let still = false
    for (let i = 0; i < n; i++) {
      if (now - anim.start[i]! < POP_MS + 32) {
        writeSeat(i, now)
        still = true
      }
    }
    ref.current.instanceMatrix.needsUpdate = true
    if (writePeople(now)) still = true
    anim.pings.forEach((p, idx) => {
      const m = pingRefs.current[idx]
      const t = (now - p.start) / PING_MS
      if (!m) return
      if (t >= 0 && t < 1) {
        m.visible = true
        m.scale.set(1, 0.4 + t * 0.9, 1)
        pingMats[idx]!.opacity = 0.55 * (1 - t) * (1 - t)
        still = true
      } else m.visible = false
    })
    anim.active = still
    if (still) invalidate()
  })

  const idAt = (i: number | undefined) => (i === undefined || i < 0 ? null : (layout.seats[i]?.id ?? null))

  const hover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const i = e.instanceId ?? -1
    if (i !== anim.hovered) {
      const prev = anim.hovered
      anim.hovered = i
      if (prev >= 0) writeColor(prev)
      if (i >= 0) writeColor(i)
      if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true
      const k = keys[i]
      document.body.style.cursor = i >= 0 && (k === 'free' || k === 'women' || k === 'recliner' || k === 'ai' || k === 'selected') ? 'pointer' : ''
      invalidate()
    }
    onHover(idAt(i), e.nativeEvent.clientX, e.nativeEvent.clientY)
  }
  const leave = () => {
    const prev = anim.hovered
    anim.hovered = -1
    if (prev >= 0 && ref.current) {
      writeColor(prev)
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    }
    document.body.style.cursor = ''
    onHover(null, 0, 0)
    invalidate()
  }
  useEffect(() => () => void (document.body.style.cursor = ''), [])

  return (
    <>
      <instancedMesh
        ref={ref}
        args={[geometry, material, n]}
        frustumCulled={false}
        onPointerMove={hover}
        onPointerOut={leave}
        onClick={(e) => {
          e.stopPropagation()
          if (ctrl.dragging || e.delta > 6 || e.instanceId === undefined) return
          const id = idAt(e.instanceId)
          if (id) onPick(id)
        }}
      />
      <instancedMesh ref={bodyRef} args={[bodyGeo, personMat, n]} frustumCulled={false} />
      <instancedMesh ref={headRef} args={[headGeo, personMat, n]} frustumCulled={false} />
      <instancedMesh ref={ghostRef} args={[ghostGeo, ghostMat, n]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={pinRef} args={[pinGeo, pinMat, 12]} frustumCulled={false} />
      {pingMats.map((m, i) => (
        <mesh key={i} ref={(el) => void (pingRefs.current[i] = el)} geometry={pingGeo} material={m} visible={false} renderOrder={2} />
      ))}
    </>
  )
}

/* -------------------------------------------------------------- Environments */

function radialTexture(inner: string, outer: string) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new CanvasTexture(cv)
}

function textTexture(text: string, opts: { w: number; h: number; bg?: string; color: string; font: string; sub?: string }) {
  const cv = document.createElement('canvas')
  cv.width = opts.w
  cv.height = opts.h
  const ctx = cv.getContext('2d')!
  if (opts.bg) {
    const g = ctx.createLinearGradient(0, 0, 0, opts.h)
    g.addColorStop(0, opts.bg)
    g.addColorStop(1, '#d9d2bd')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, opts.w, opts.h)
  }
  ctx.fillStyle = opts.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = opts.font
  ctx.fillText(text, opts.w / 2, opts.sub ? opts.h * 0.45 : opts.h / 2)
  if (opts.sub) {
    ctx.font = `600 ${Math.round(opts.h * 0.07)}px system-ui, sans-serif`
    ctx.globalAlpha = 0.6
    ctx.fillText(opts.sub, opts.w / 2, opts.h * 0.68)
  }
  const t = new CanvasTexture(cv)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

function useDisposable<T extends { dispose: () => void }>(make: () => T, deps: unknown[] = []): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  const v = useMemo(make, deps)
  useEffect(() => () => v.dispose(), [v])
  return v
}

/** Row letters / numbers as flat sprites beside each row — one tiny texture each. */
function RowLabels({ layout, x, color }: { layout: Layout; x: (row: number) => number; color: string }) {
  const rows = useMemo(() => {
    const m = new Map<number, { y: number; z: number }>()
    for (const s of layout.seats) if (!m.has(s.row)) m.set(s.row, { y: s.y, z: s.z })
    return [...m.entries()]
  }, [layout])
  const textures = useMemo(() => rows.map(([r]) => textTexture(layout.rowLabels[r]!, { w: 64, h: 64, color, font: '800 44px system-ui, sans-serif' })), [rows, layout, color])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])
  return (
    <>
      {rows.map(([r, p], i) => (
        <sprite key={r} position={[x(r), p.y + 0.55, p.z]} scale={[0.42, 0.42, 1]}>
          <spriteMaterial map={textures[i]} transparent depthWrite={false} />
        </sprite>
      ))}
    </>
  )
}

function Cinema({ layout, title }: { layout: Layout; title: string }) {
  const glow = useDisposable(() => radialTexture('rgba(255,244,214,0.6)', 'rgba(255,244,214,0)'))
  const screen = useDisposable(() => textTexture(title.toUpperCase(), { w: 1024, h: 420, bg: '#fbf6e6', color: '#1d2a22', font: '800 110px system-ui, sans-serif', sub: 'NOW SHOWING · ALL EYES THIS WAY' }), [title])
  const rows = useMemo(() => {
    const m = new Map<number, { y: number; z: number }>()
    for (const s of layout.seats) if (!m.has(s.row)) m.set(s.row, { y: s.y, z: s.z })
    return [...m.values()]
  }, [layout])
  const stepRef = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = stepRef.current
    if (!mesh) return
    const o = new Object3D()
    let i = 0
    for (const r of rows)
      for (const x of [-3.05, 3.05]) {
        o.position.set(x, r.y + 0.02, r.z + 0.35)
        o.updateMatrix()
        mesh.setMatrixAt(i++, o.matrix)
      }
    mesh.instanceMatrix.needsUpdate = true
  }, [rows])

  return (
    <group>
      <color attach="background" args={['#131a17']} />
      <hemisphereLight args={['#fff6e0', '#26302b', 1.5]} />
      <directionalLight position={[0, 7, -9]} intensity={1.7} color="#fff3da" />
      <directionalLight position={[4, 9, 12]} intensity={0.7} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 2]}>
        <planeGeometry args={[30, 34]} />
        <meshLambertMaterial color="#1d2521" />
      </mesh>
      {rows.map((r, i) =>
        r.y > 0 ? (
          <mesh key={i} position={[0, r.y / 2 - 0.005, r.z + 0.1]}>
            <boxGeometry args={[13.5, r.y, i >= 11 ? 1.45 : 1.02]} />
            <meshLambertMaterial color="#26302b" />
          </mesh>
        ) : null,
      )}
      <instancedMesh ref={stepRef} args={[undefined, undefined, rows.length * 2]}>
        <boxGeometry args={[0.18, 0.03, 0.06]} />
        <meshBasicMaterial color="#f2b705" toneMapped={false} />
      </instancedMesh>
      {[-7.4, 7.4].map((x) => (
        <mesh key={x} position={[x, 2, 3]}>
          <boxGeometry args={[0.3, 4, 24]} />
          <meshLambertMaterial color="#212a26" />
        </mesh>
      ))}
      <mesh position={[0, 3.6, -8]}>
        <planeGeometry args={[13, 5.4]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.6, -8.05]}>
        <planeGeometry args={[13.6, 6]} />
        <meshBasicMaterial color="#2a2f2c" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, -5.2]}>
        <planeGeometry args={[16, 8]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <RowLabels layout={layout} x={(r) => (r >= 11 ? -6.2 : -6.0)} color="#f2b705" />
    </group>
  )
}

function Bus({ layout }: { layout: Layout }) {
  const shadow = useDisposable(() => radialTexture('rgba(20,26,22,0.38)', 'rgba(20,26,22,0)'))
  const L = 10.8
  const zc = 0.55
  return (
    <group>
      <color attach="background" args={['#e6e9e2']} />
      <hemisphereLight args={['#ffffff', '#b9c2b6', 1.5]} />
      <directionalLight position={[5, 10, 6]} intensity={1.3} />
      {/* ground + contact shadow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.56, zc]}>
        <planeGeometry args={[60, 60]} />
        <meshLambertMaterial color="#d9ddd5" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.55, zc]}>
        <planeGeometry args={[6, 15]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      {/* lane markings */}
      {[-6, -2, 2, 6].map((z) => (
        <mesh key={z} rotation-x={-Math.PI / 2} position={[2.6, -0.545, z + zc]}>
          <planeGeometry args={[0.12, 2]} />
          <meshBasicMaterial color="#f7f8f4" />
        </mesh>
      ))}
      {/* chassis + floor */}
      <mesh position={[0, -0.25, zc]}>
        <boxGeometry args={[2.6, 0.5, L]} />
        <meshLambertMaterial color="#f7f8f4" />
      </mesh>
      <mesh position={[0, 0.005, zc]}>
        <boxGeometry args={[2.44, 0.01, L - 0.16]} />
        <meshLambertMaterial color="#2c332f" />
      </mesh>
      {/* aisle runner */}
      <mesh position={[0, 0.012, zc - 0.4]}>
        <boxGeometry args={[0.36, 0.005, L - 1.4]} />
        <meshLambertMaterial color="#3c4540" />
      </mesh>
      {/* side walls, cut away at window height; door gap front-left */}
      <mesh position={[1.27, 0.45, zc]}>
        <boxGeometry args={[0.06, 0.9, L]} />
        <meshLambertMaterial color="#f7f8f4" />
      </mesh>
      <mesh position={[-1.27, 0.45, zc + 0.7]}>
        <boxGeometry args={[0.06, 0.9, L - 1.4]} />
        <meshLambertMaterial color="#f7f8f4" />
      </mesh>
      {/* brand stripe */}
      {[1.305, -1.305].map((x) => (
        <mesh key={x} position={[x, 0.1, zc + (x < 0 ? 0.7 : 0)]}>
          <boxGeometry args={[0.012, 0.14, x < 0 ? L - 1.4 : L]} />
          <meshLambertMaterial color="#f2b705" />
        </mesh>
      ))}
      {/* tinted glass band */}
      {[1.27, -1.27].map((x) => (
        <mesh key={x} position={[x, 1.2, zc + (x < 0 ? 0.7 : 0)]}>
          <boxGeometry args={[0.03, 0.6, x < 0 ? L - 1.4 : L]} />
          <meshLambertMaterial color="#8fb4c7" transparent opacity={0.14} depthWrite={false} />
        </mesh>
      ))}
      {/* rear wall */}
      <mesh position={[0, 0.7, zc + L / 2 - 0.03]}>
        <boxGeometry args={[2.6, 1.4, 0.06]} />
        <meshLambertMaterial color="#eef0ea" />
      </mesh>
      {/* dashboard + windshield */}
      <mesh position={[0, 0.45, zc - L / 2 + 0.35]}>
        <boxGeometry args={[2.5, 0.9, 0.5]} />
        <meshLambertMaterial color="#2c332f" />
      </mesh>
      <mesh position={[0, 1.25, zc - L / 2 + 0.1]} rotation-x={-0.12}>
        <boxGeometry args={[2.5, 0.9, 0.03]} />
        <meshLambertMaterial color="#8fb4c7" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {/* driver (right-hand drive) */}
      <mesh position={[0.72, 0.3, -3.95]}>
        <boxGeometry args={[0.5, 0.6, 0.5]} />
        <meshLambertMaterial color="#47504b" />
      </mesh>
      <mesh position={[0.72, 0.95, -4.35]} rotation-x={-1.1}>
        <torusGeometry args={[0.2, 0.03, 8, 24]} />
        <meshLambertMaterial color="#1b201d" />
      </mesh>
      <RowLabels layout={layout} x={() => -1.75} color="#0f1a14" />
      {/* wheels */}
      {[
        [1.3, -3.4],
        [-1.3, -3.4],
        [1.3, 3.9],
        [-1.3, 3.9],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x!, -0.42, z! + zc - 0.55]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.42, 0.42, 0.3, 20]} />
          <meshLambertMaterial color="#1b201d" />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------- Canvas */


/* ------------------------------------------------------------------- Canvas */

export default function Scene3D(props: SceneProps) {
  const ctrl = useMemo(() => ({ orbit: { ...PRESETS[props.layout.mode].overview }, dragging: false }), [props.layout.mode])
  const maxDpr = typeof window !== 'undefined' && window.innerWidth < 768 ? 1.5 : 2
  const focus = props.focusId ? (props.layout.index.get(props.focusId) ?? null) : null
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, maxDpr]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 42, near: 0.1, far: 120, position: [0, 12, 20] }}
      style={{ touchAction: 'none' }}
      aria-hidden="true"
    >
      {props.layout.mode === 'cinema' ? <Cinema layout={props.layout} title={props.screenTitle} /> : <Bus layout={props.layout} />}
      <Seats {...props} ctrl={ctrl} />
      <Rig layout={props.layout} view={props.view} focus={focus} ctrl={ctrl} />
    </Canvas>
  )
}
