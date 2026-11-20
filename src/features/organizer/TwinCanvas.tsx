import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type PointerEvent } from 'react'
import { BoxGeometry, Color, Group, InstancedMesh, MeshLambertMaterial, Object3D } from 'three'
import type { Seat } from '../../lib/api/types'
import { rowIndex } from '../../lib/seats'

const COLORS: Record<string, string> = {
  available: '#81d9ff',
  held: '#ffc35c',
  booked: '#4a5568',
  blocked: '#1e2533',
  selected: '#d5ff73',
}

/** Seats laid out on a raked arc. Positions are computed once; colours update in place. */
function Seats({ seats }: { seats: Seat[] }) {
  const ref = useRef<InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const ids = seats.map((s) => s.id).join(',')
  const { geometry, material } = useMemo(() => ({ geometry: new BoxGeometry(0.55, 0.45, 0.55), material: new MeshLambertMaterial() }), [])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  // Layout: once per seat set.
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    seats.forEach((s, i) => {
      const r = rowIndex(s.row)
      const theta = ((s.col - 10.5) / 22) * 1.5
      const radius = 7 + r * 0.95
      o.position.set(Math.sin(theta) * radius, 0.25 + r * 0.35, Math.cos(theta) * radius - 6)
      o.rotation.set(0, theta, 0)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout depends on the seat ids only
  }, [ids])

  // Colours: on every data update, without re-rendering the scene graph.
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new Color()
    seats.forEach((s, i) => mesh.setColorAt(i, c.set(COLORS[s.heldByMe ? 'selected' : s.status] ?? '#ffffff')))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    invalidate()
  }, [seats, invalidate])

  return <instancedMesh ref={ref} args={[geometry, material, seats.length]} />
}

export default function TwinCanvas({ seats, label }: { seats: Seat[]; label: string }) {
  const group = useRef<Group>(null)
  const drag = useRef<{ x: number; rot: number } | null>(null)
  const inv = useRef<() => void>(() => {})
  const onDown = (e: PointerEvent<HTMLDivElement>) => { drag.current = { x: e.clientX, rot: group.current?.rotation.y ?? 0 } }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !group.current) return
    group.current.rotation.y = drag.current.rot + (e.clientX - drag.current.x) * 0.006
    inv.current()
  }
  return (
    <div className="twin-canvas" role="img" aria-label={label} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null }} onPointerLeave={() => { drag.current = null }}>
      <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 9, 17], fov: 45 }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} onCreated={({ invalidate, camera }) => { inv.current = invalidate; camera.lookAt(0, 1, 0) }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 10, 6]} intensity={1.4} />
        <group ref={group}>
          <mesh position={[0, 0.6, -8.5]}>
            <boxGeometry args={[9, 1.2, 2.2]} />
            <meshLambertMaterial color="#7065ff" />
          </mesh>
          <Seats seats={seats} />
        </group>
      </Canvas>
    </div>
  )
}
