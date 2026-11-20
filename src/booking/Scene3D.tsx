/**
 * Lightweight 3D seat views for the cinema hall and the intercity bus.
 *
 * Performance notes
 * - frameloop="demand": nothing renders unless the camera moves, a seat changes
 *   or an animation is running. An idle page costs ~0 GPU.
 * - Every seat in the venue is ONE InstancedMesh (one draw call); status is
 *   per-instance colour. Props are a handful of boxes with Lambert materials.
 * - No textures from the network, no shadows, no post-processing.
 * - This module (and three.js) is lazy-loaded only when a booking page opens.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Layout, SeatStatus } from './data'

export type View = 'overview' | 'top' | 'seat'

export interface SceneProps {
  layout: Layout
  statuses: SeatStatus[]
  selected: Set<number>
  mine: Set<number>
  view: View
  focus: number | null
  onPick: (index: number) => void
  onHover: (index: number | null, x: number, y: number) => void
}

export const SEAT_COLORS = {
  free: '#dfe5da',
  women: '#f3bfd0',
  recliner: '#cfd9ec',
  locked: '#ff6b3d',
  sold: '#68716b',
  selected: '#f2b705',
  mine: '#2fbf71',
}

/* ------------------------------------------------------------------ Camera */

interface Orbit {
  theta: number
  phi: number
  radius: number
  target: Vector3
}

const PRESETS: Record<Layout['mode'], Record<'overview' | 'top', Orbit>> = {
  cinema: {
    overview: { theta: 0.42, phi: 0.98, radius: 19, target: new Vector3(0, 0.8, 2.2) },
    top: { theta: 0, phi: 0.12, radius: 21, target: new Vector3(0, 0, 1) },
  },
  bus: {
    overview: { theta: 0.55, phi: 0.72, radius: 14, target: new Vector3(0, 0.2, 0.6) },
    top: { theta: 0, phi: 0.06, radius: 12.5, target: new Vector3(0, 0, 0.6) },
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

const POP_MS = 520
const PING_MS = 1500
const PING_POOL = 10

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

function Seats({ layout, statuses, selected, mine, onPick, onHover, ctrl }: SceneProps & { ctrl: { dragging: boolean } }) {
  const ref = useRef<InstancedMesh>(null)
  const pingRefs = useRef<(Mesh | null)[]>([])
  const invalidate = useThree((s) => s.invalidate)
  const n = layout.seats.length
  const geometry = useMemo(seatGeometry, [])
  const material = useMemo(() => new MeshLambertMaterial({ color: '#ffffff' }), [])
  const pingGeo = useMemo(() => new CylinderGeometry(0.06, 0.24, 2.4, 10, 1, true).translate(0, 1.2, 0), [])
  const pingMats = useMemo(() => Array.from({ length: PING_POOL }, () => new MeshBasicMaterial({ color: SEAT_COLORS.locked, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })), [])
  const anim = useMemo(() => ({ start: new Float64Array(n), prev: new Array<string>(n).fill(''), hovered: -1, pings: Array.from({ length: PING_POOL }, () => ({ start: 0 })), nextPing: 0, active: false, init: false }), [n])
  const o = useMemo(() => new Object3D(), [])
  const c = useMemo(() => new Color(), [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      pingGeo.dispose()
      pingMats.forEach((m) => m.dispose())
    },
    [geometry, material, pingGeo, pingMats],
  )

  const keyFor = (i: number) => (mine.has(i) ? 'mine' : selected.has(i) ? 'selected' : statuses[i]!)

  const writeMatrix = (i: number, now: number) => {
    const s = layout.seats[i]!
    const t = (now - anim.start[i]!) / POP_MS
    const pop = t >= 0 && t < 1 ? Math.sin(t * Math.PI) : 0
    const raised = selected.has(i) || mine.has(i) ? 0.06 : 0
    o.position.set(s.x, s.y + raised + pop * 0.22, s.z)
    o.scale.set(s.scale * (1 + pop * 0.12), 1 + pop * 0.25, 1 + (s.scale - 1) * 0.35)
    o.updateMatrix()
    ref.current!.setMatrixAt(i, o.matrix)
  }

  const writeColor = (i: number) => {
    const s = layout.seats[i]!
    const k = keyFor(i)
    if (k === 'free') c.set(s.tags.includes('Women only') ? SEAT_COLORS.women : s.tier === 'recliner' ? SEAT_COLORS.recliner : SEAT_COLORS.free)
    else c.set(SEAT_COLORS[k as keyof typeof SEAT_COLORS])
    if (i === anim.hovered && (k === 'free' || k === 'selected')) c.lerp(new Color('#ffffff'), 0.45)
    ref.current!.setColorAt(i, c)
  }

  // Sync colours + kick off pop / ping animations for seats whose state changed.
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const now = performance.now()
    for (let i = 0; i < n; i++) {
      const k = keyFor(i)
      if (anim.init && anim.prev[i] !== k) {
        anim.start[i] = now
        anim.active = true
        if (k === 'locked' || k === 'sold') {
          const p = anim.nextPing++ % PING_POOL
          anim.pings[p]!.start = now
          const m = pingRefs.current[p]
          if (m) {
            const s = layout.seats[i]!
            m.position.set(s.x, s.y + 0.3, s.z)
            pingMats[p]!.color.set(k === 'sold' ? '#9aa39d' : SEAT_COLORS.locked)
          }
        }
      }
      anim.prev[i] = k
      writeColor(i)
      writeMatrix(i, anim.init ? now : -1e9)
    }
    anim.init = true
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  })

  useFrame(() => {
    if (!anim.active || !ref.current) return
    const now = performance.now()
    let still = false
    for (let i = 0; i < n; i++) {
      if (now - anim.start[i]! < POP_MS + 32) {
        writeMatrix(i, now)
        still = true
      }
    }
    ref.current.instanceMatrix.needsUpdate = true
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

  const hover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const i = e.instanceId ?? -1
    if (i === anim.hovered) {
      onHover(i, e.nativeEvent.clientX, e.nativeEvent.clientY)
      return
    }
    const prev = anim.hovered
    anim.hovered = i
    if (prev >= 0) writeColor(prev)
    if (i >= 0) writeColor(i)
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true
    document.body.style.cursor = i >= 0 && statuses[i] === 'free' ? 'pointer' : ''
    onHover(i >= 0 ? i : null, e.nativeEvent.clientX, e.nativeEvent.clientY)
    invalidate()
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
          onPick(e.instanceId)
        }}
      />
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

function useDisposable<T extends { dispose: () => void }>(make: () => T): T {
  const v = useMemo(make, [])
  useEffect(() => () => v.dispose(), [v])
  return v
}

function Cinema({ layout }: { layout: Layout }) {
  const glow = useDisposable(() => radialTexture('rgba(255,244,214,0.55)', 'rgba(255,244,214,0)'))
  const rows = useMemo(() => {
    const m = new Map<number, { y: number; z: number }>()
    for (const s of layout.seats) if (!m.has(s.row)) m.set(s.row, { y: s.y, z: s.z })
    return [...m.values()]
  }, [layout])
  // Aisle step lights: one instanced mesh, one draw call.
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
      <color attach="background" args={['#0d110f']} />
      <hemisphereLight args={['#fff6e0', '#1a1f1c', 1.25]} />
      <directionalLight position={[0, 7, -9]} intensity={1.6} color="#fff3da" />
      <directionalLight position={[4, 9, 12]} intensity={0.45} />
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 2]}>
        <planeGeometry args={[30, 34]} />
        <meshLambertMaterial color="#161b18" />
      </mesh>
      {/* stadium risers */}
      {rows.map((r, i) =>
        r.y > 0 ? (
          <mesh key={i} position={[0, r.y / 2 - 0.005, r.z + 0.1]}>
            <boxGeometry args={[13.5, r.y, i >= 11 ? 1.45 : 1.02]} />
            <meshLambertMaterial color="#1e2421" />
          </mesh>
        ) : null,
      )}
      <instancedMesh ref={stepRef} args={[undefined, undefined, rows.length * 2]}>
        <boxGeometry args={[0.18, 0.03, 0.06]} />
        <meshBasicMaterial color="#f2b705" toneMapped={false} />
      </instancedMesh>
      {/* walls */}
      {[-7.4, 7.4].map((x) => (
        <mesh key={x} position={[x, 2, 3]}>
          <boxGeometry args={[0.3, 4, 24]} />
          <meshLambertMaterial color="#1a201d" />
        </mesh>
      ))}
      {/* screen + light spill */}
      <mesh position={[0, 3.6, -8]}>
        <planeGeometry args={[13, 5.4]} />
        <meshBasicMaterial color="#f5f1e4" toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.6, -8.05]}>
        <planeGeometry args={[13.6, 6]} />
        <meshBasicMaterial color="#2a2f2c" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, -5.2]}>
        <planeGeometry args={[16, 8]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}

function Bus() {
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

export default function Scene3D(props: SceneProps) {
  const ctrl = useMemo(() => ({ orbit: { ...PRESETS[props.layout.mode].overview }, dragging: false }), [props.layout.mode])
  const maxDpr = typeof window !== 'undefined' && window.innerWidth < 768 ? 1.5 : 2
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, maxDpr]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 42, near: 0.1, far: 120, position: [0, 12, 20] }}
      style={{ touchAction: 'none' }}
      aria-hidden="true"
    >
      {props.layout.mode === 'cinema' ? <Cinema layout={props.layout} /> : <Bus />}
      <Seats {...props} ctrl={ctrl} />
      <Rig layout={props.layout} view={props.view} focus={props.focus} ctrl={ctrl} />
    </Canvas>
  )
}
