import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  FogExp2,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildVenueSeats, seatEye, STAGE_CENTER } from './layout'
import { sceneStore } from './sceneStore'
import { beam, haze, ledWall } from './shaders'

export interface SeatTarget {
  rowIndex: number
  col: number
  totalRows: number
  totalCols: number
}

export interface VenueProps {
  mode: 'world' | 'seat'
  seat: SeatTarget | null
  hue: number
  theme: 'light' | 'dark'
  reduced: boolean
  /** Shared mutable quality knob (0 low … 1 high) written by AdaptiveQuality. */
  quality: { level: number }
}

const PALETTE = {
  dark: { fog: '#080b13', seat: '#2a3346', ambient: 0.35 },
  light: { fog: '#f8f9fc', seat: '#8f9bb3', ambient: 0.9 },
}
const INDIGO = new Color('#7065ff')
const ICE = new Color('#81d9ff')
const LIME = new Color('#d5ff73')

/* ------------------------------------------------------------------ Camera */

const OVERVIEW = { pos: new Vector3(0, 11, 25), look: new Vector3(0, 1.5, -8) }
const HERO_END = { pos: new Vector3(0, 7.5, 19), look: new Vector3(0, 2.2, -9) }
const SEAT_EYE = { pos: new Vector3(0, 2.7, 2.6), look: new Vector3(0, 3.4, -12) }

function CameraRig({ mode, seat, reduced }: Pick<VenueProps, 'mode' | 'seat' | 'reduced'>) {
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const tmp = useMemo(
    () => ({ pos: new Vector3(), look: new Vector3(), curLook: OVERVIEW.look.clone(), eye: new Vector3(), at: new Vector3(), px: 0, py: 0, first: true }),
    [],
  )

  useEffect(() => {
    invalidate()
  }, [seat, mode, invalidate])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (mode === 'seat' && seat) {
      seatEye(seat, tmp.eye, tmp.at)
      tmp.pos.copy(tmp.eye)
      tmp.look.copy(tmp.at)
    } else if (mode === 'seat') {
      tmp.pos.set(0, 9, 21)
      tmp.look.copy(OVERVIEW.look)
    } else {
      const p = MathUtils.smootherstep(sceneStore.progress, 0, 1)
      const f = MathUtils.smootherstep(sceneStore.featured, 0, 1)
      tmp.pos.lerpVectors(OVERVIEW.pos, HERO_END.pos, p).lerp(SEAT_EYE.pos, f)
      tmp.look.lerpVectors(OVERVIEW.look, HERO_END.look, p).lerp(SEAT_EYE.look, f)
    }
    if (!reduced) {
      tmp.px = MathUtils.damp(tmp.px, sceneStore.pointerX, 3, dt)
      tmp.py = MathUtils.damp(tmp.py, sceneStore.pointerY, 3, dt)
      const k = mode === 'seat' ? 0.35 : 1.2
      tmp.pos.x += tmp.px * k
      tmp.pos.y += tmp.py * k * 0.5
    }
    const snap = reduced || tmp.first
    tmp.first = false
    const a = snap ? 1 : 1 - Math.exp(-(mode === 'seat' ? 3.2 : 4.5) * dt)
    camera.position.lerp(tmp.pos, a)
    tmp.curLook.lerp(tmp.look, a)
    camera.lookAt(tmp.curLook)
    if (camera instanceof PerspectiveCamera) {
      const fov = mode === 'seat' ? 58 : 46 + sceneStore.featured * 10
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = snap ? fov : MathUtils.damp(camera.fov, fov, 4, dt)
        camera.updateProjectionMatrix()
      }
    }
  })
  return null
}

/* ----------------------------------------------------------------- Seating */

function Seating({ theme }: { theme: 'light' | 'dark' }) {
  const ref = useRef<InstancedMesh>(null)
  const seats = useMemo(buildVenueSeats, [])
  const { geometry, material } = useMemo(() => {
    const back = new BoxGeometry(0.52, 0.5, 0.1).translate(0, 0.45, 0.2)
    const base = new BoxGeometry(0.52, 0.14, 0.44).translate(0, 0.2, 0)
    const g = mergeGeometries([back, base]) ?? base
    back.dispose()
    if (g !== base) base.dispose()
    // Per-instance glow: "available" seats light up softly.
    const glow = new Float32Array(seats.length)
    seats.forEach((s, i) => {
      const lit = (i * 7919) % 29 === 0 || (s.tier < 3 && (i * 31) % 17 === 0)
      glow[i] = lit ? 1.6 : 0
    })
    g.setAttribute('aGlow', new InstancedBufferAttribute(glow, 1))
    const m = new MeshLambertMaterial({ color: '#ffffff' })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;')
    }
    return { geometry: g, material: m }
  }, [seats])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    const c = new Color()
    const base = new Color(PALETTE[theme].seat)
    seats.forEach((s, i) => {
      o.position.copy(s.position)
      o.rotation.set(0, s.rotationY, 0)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      const lit = (i * 7919) % 29 === 0 || (s.tier < 3 && (i * 31) % 17 === 0)
      if (lit) c.copy(i % 3 === 0 ? LIME : ICE)
      else c.copy(base).offsetHSL(0, 0, (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.04 - s.tier * 0.006)
      mesh.setColorAt(i, c)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [seats, theme])

  return <instancedMesh ref={ref} args={[geometry, material, seats.length]} frustumCulled={false} />
}

/* ------------------------------------------------------------------- Stage */

function Stage({ hue, reduced }: { hue: number; reduced: boolean }) {
  const led = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: ledWall.vertex,
        fragmentShader: ledWall.fragment,
        uniforms: { uTime: { value: 3 }, uHue: { value: hue / 360 }, uIntensity: { value: 1 } },
        toneMapped: false,
      }),
    [],
  )
  const ledGeo = useMemo(() => new PlaneGeometry(17, 6.4), [])
  useEffect(
    () => () => {
      led.dispose()
      ledGeo.dispose()
    },
    [led, ledGeo],
  )

  useFrame((_, delta) => {
    const u = led.uniforms
    if (!u.uTime || !u.uHue) return
    if (!reduced) u.uTime.value += Math.min(delta, 0.1)
    // Featured chapter shifts the wall to the featured event's hue.
    const target = MathUtils.lerp(hue, sceneStore.hue, MathUtils.smoothstep(sceneStore.featured, 0.1, 0.6)) / 360
    u.uHue.value = reduced ? target : MathUtils.damp(u.uHue.value as number, target, 3, Math.min(delta, 0.1))
  })

  return (
    <group position={[STAGE_CENTER.x, 0, STAGE_CENTER.z]}>
      <mesh position={[0, -0.1, -1.2]}>
        <boxGeometry args={[19, 1.1, 6.5]} />
        <meshLambertMaterial color="#141a28" />
      </mesh>
      {/* Emissive lip along the stage edge */}
      <mesh position={[0, 0.47, 2.07]}>
        <boxGeometry args={[19, 0.05, 0.05]} />
        <meshBasicMaterial color={LIME} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.2, 2.08]}>
        <boxGeometry args={[19, 0.012, 0.012]} />
        <meshBasicMaterial color={INDIGO} toneMapped={false} />
      </mesh>
      <mesh geometry={ledGeo} material={led} position={[0, 4.1, -4.3]} />
      {/* Truss */}
      <mesh position={[0, 8.6, -1]}>
        <boxGeometry args={[20, 0.18, 0.18]} />
        <meshLambertMaterial color="#2a3346" />
      </mesh>
      {[-9.5, 9.5].map((x) => (
        <mesh key={x} position={[x, 4.2, -1]}>
          <boxGeometry args={[0.18, 8.8, 0.18]} />
          <meshLambertMaterial color="#2a3346" />
        </mesh>
      ))}
      <pointLight position={[0, 4, 1]} color={INDIGO} intensity={40} distance={26} decay={1.6} />
      <pointLight position={[-7, 6, 2]} color={ICE} intensity={18} distance={20} decay={1.6} />
      <pointLight position={[7, 6, 2]} color={INDIGO} intensity={18} distance={20} decay={1.6} />
    </group>
  )
}

/* ------------------------------------------------------------------- Beams */

const BEAMS = [
  { x: -6.5, color: INDIGO, phase: 0 },
  { x: -2.2, color: ICE, phase: 1.7 },
  { x: 2.2, color: INDIGO, phase: 3.1 },
  { x: 6.5, color: ICE, phase: 4.4 },
]

function Beams({ reduced, theme }: { reduced: boolean; theme: 'light' | 'dark' }) {
  const geometry = useMemo(() => new ConeGeometry(2.6, 13, 40, 1, true).translate(0, -6.5, 0), [])
  const materials = useMemo(
    () =>
      BEAMS.map(
        (b) =>
          new ShaderMaterial({
            vertexShader: beam.vertex,
            fragmentShader: beam.fragment,
            uniforms: { uColor: { value: b.color.clone() }, uOpacity: { value: 0.32 } },
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            side: DoubleSide,
            fog: false,
          }),
      ),
    [geometry],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      materials.forEach((m) => m.dispose())
    },
    [geometry, materials],
  )
  useEffect(() => {
    materials.forEach((m) => {
      if (m.uniforms.uOpacity) m.uniforms.uOpacity.value = theme === 'dark' ? 0.32 : 0.22
    })
  }, [materials, theme])

  const group = useRef<Group>(null)
  const t = useRef(2)
  useFrame((_, delta) => {
    if (!reduced) t.current += Math.min(delta, 0.1)
    const g = group.current
    if (!g) return
    g.children.forEach((child, i) => {
      const b = BEAMS[i]
      if (!b) return
      child.rotation.z = Math.sin(t.current * 0.35 + b.phase) * 0.38 + (b.x > 0 ? 0.12 : -0.12)
      child.rotation.x = 0.55 + Math.sin(t.current * 0.27 + b.phase * 1.3) * 0.12
    })
  })

  return (
    <group ref={group} position={[0, 8.5, STAGE_CENTER.z - 1]}>
      {BEAMS.map((b, i) => (
        <mesh key={b.x} geometry={geometry} material={materials[i]} position={[b.x, 0, 0]} renderOrder={2} />
      ))}
    </group>
  )
}

/* -------------------------------------------------------------------- Haze */

const HAZE_MAX = 900

function Haze({ reduced, quality, theme }: { reduced: boolean; quality: { level: number }; theme: 'light' | 'dark' }) {
  const ref = useRef<Points>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const { geometry, material } = useMemo(() => {
    const g = new BufferGeometry()
    const pos = new Float32Array(HAZE_MAX * 3)
    const seed = new Float32Array(HAZE_MAX)
    for (let i = 0; i < HAZE_MAX; i++) {
      const r = Math.random
      pos[i * 3] = (r() - 0.5) * 30
      pos[i * 3 + 1] = r() * 11
      pos[i * 3 + 2] = STAGE_CENTER.z - 4 + r() * 26
      seed[i] = r()
    }
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    const m = new ShaderMaterial({
      vertexShader: haze.vertex,
      fragmentShader: haze.fragment,
      uniforms: { uTime: { value: 4 }, uSize: { value: 5 }, uPixelRatio: { value: 1 }, uColor: { value: new Color('#b9c4ff') } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    })
    return { geometry: g, material: m }
  }, [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  useEffect(() => {
    if (material.uniforms.uPixelRatio) material.uniforms.uPixelRatio.value = dpr
    if (material.uniforms.uColor) (material.uniforms.uColor.value as Color).set(theme === 'dark' ? '#b9c4ff' : '#7065ff')
  }, [material, dpr, theme])

  useFrame((_, delta) => {
    if (!reduced && material.uniforms.uTime) material.uniforms.uTime.value += Math.min(delta, 0.1)
    geometry.setDrawRange(0, Math.round(HAZE_MAX * (0.35 + 0.65 * quality.level)))
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}

/* --------------------------------------------------------------- Atmosphere */

function Atmosphere({ theme }: { theme: 'light' | 'dark' }) {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.fog = new FogExp2(PALETTE[theme].fog, theme === 'dark' ? 0.03 : 0.022)
    return () => {
      scene.fog = null
    }
  }, [scene, theme])
  return (
    <>
      <ambientLight intensity={PALETTE[theme].ambient} color={theme === 'dark' ? '#8890b8' : '#ffffff'} />
      <hemisphereLight args={['#7065ff', '#080b13', theme === 'dark' ? 0.5 : 0.7]} />
      <directionalLight position={[0, 14, -4]} intensity={theme === 'dark' ? 0.6 : 1.2} color="#c9d2ff" />
    </>
  )
}

/** Floor plane so seat silhouettes read against something in light mode. */
function Floor({ theme }: { theme: 'light' | 'dark' }) {
  const ref = useRef<Mesh>(null)
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 4]}>
      <planeGeometry args={[80, 60]} />
      <meshLambertMaterial color={theme === 'dark' ? '#0b0f19' : '#e9ecf4'} />
    </mesh>
  )
}

/* ----------------------------------------------------------- Adaptive DPR */

export function AdaptiveQuality({ maxDpr, quality }: { maxDpr: number; quality: { level: number } }) {
  const setDpr = useThree((s) => s.setDpr)
  const acc = useRef({ frames: 0, time: 0, dpr: maxDpr })
  useFrame((_, delta) => {
    const a = acc.current
    if (delta > 0.25) return // tab switch / hitch — ignore
    a.frames++
    a.time += delta
    if (a.frames < 90) return
    const avg = a.time / a.frames
    a.frames = 0
    a.time = 0
    if (avg > 1 / 45) {
      quality.level = Math.max(0, quality.level - 0.35)
      if (a.dpr > 1) {
        a.dpr = Math.max(1, a.dpr - 0.25)
        setDpr(a.dpr)
      }
    } else if (avg < 1 / 58 && quality.level < 1) {
      quality.level = Math.min(1, quality.level + 0.1)
    }
  })
  return null
}

export function Venue({ mode, seat, hue, theme, reduced, quality }: VenueProps) {
  return (
    <>
      <Atmosphere theme={theme} />
      <CameraRig mode={mode} seat={seat} reduced={reduced} />
      <Floor theme={theme} />
      <Stage hue={hue} reduced={reduced} />
      <Seating theme={theme} />
      <Beams reduced={reduced} theme={theme} />
      <Haze reduced={reduced} quality={quality} theme={theme} />
    </>
  )
}
