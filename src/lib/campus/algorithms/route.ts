import { EDGES, METRES_PER_UNIT, NODES, type MapEdge, type MapNode } from '../data'

export interface Route {
  nodes: MapNode[]
  edges: MapEdge[]
  metres: number
  minutes: number
  usesStairs: boolean
}

const nodeById = new Map(NODES.map((n) => [n.id, n]))
const dist = (a: MapNode, b: MapNode) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Dijkstra over the illustrative campus path graph. `stepFree` removes edges
 * with stairs. Walking speed 1.3 m/s (1.0 m/s on the accessible route).
 * Demo geometry — not survey-grade routing.
 */
export function findRoute(from: string, to: string, stepFree: boolean): Route | null {
  const start = nodeById.get(from)
  const goal = nodeById.get(to)
  if (!start || !goal) return null
  const usable = EDGES.filter((e) => !(stepFree && e.stairs))
  const adj = new Map<string, { to: string; edge: MapEdge; w: number }[]>()
  for (const e of usable) {
    const a = nodeById.get(e.a)
    const b = nodeById.get(e.b)
    if (!a || !b) continue
    const w = dist(a, b)
    adj.set(e.a, [...(adj.get(e.a) ?? []), { to: e.b, edge: e, w }])
    adj.set(e.b, [...(adj.get(e.b) ?? []), { to: e.a, edge: e, w }])
  }
  const best = new Map<string, number>([[from, 0]])
  const prev = new Map<string, { node: string; edge: MapEdge }>()
  const open = new Set([from])
  while (open.size) {
    let cur = ''
    let curD = Infinity
    for (const id of open) {
      const d = best.get(id) ?? Infinity
      if (d < curD) { curD = d; cur = id }
    }
    open.delete(cur)
    if (cur === to) break
    for (const n of adj.get(cur) ?? []) {
      const nd = curD + n.w
      if (nd < (best.get(n.to) ?? Infinity)) {
        best.set(n.to, nd)
        prev.set(n.to, { node: cur, edge: n.edge })
        open.add(n.to)
      }
    }
  }
  if (!best.has(to)) return null
  const nodes: MapNode[] = []
  const edges: MapEdge[] = []
  let c: string | undefined = to
  while (c) {
    nodes.unshift(nodeById.get(c)!)
    const p = prev.get(c)
    if (p) edges.unshift(p.edge)
    c = p?.node
  }
  const metres = Math.round((best.get(to) ?? 0) * METRES_PER_UNIT)
  return { nodes, edges, metres, minutes: Math.max(1, Math.round(metres / (stepFree ? 1.0 : 1.3) / 60)), usesStairs: edges.some((e) => e.stairs) }
}

export const routePath = (r: Route) => r.nodes.map((n, i) => `${i ? 'L' : 'M'}${n.x} ${n.y}`).join(' ')
