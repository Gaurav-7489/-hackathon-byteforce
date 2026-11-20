/**
 * Physical seat layouts for the two venue types (cinema hall, intercity coach).
 * Shared by the mock API (which seeds live inventory from them) and the 3D
 * scene (which needs world positions). Pure data — no React, no three.js.
 */

export type Mode = 'cinema' | 'bus'

export interface Seat {
  id: string
  /** Row index from the front (screen / windshield). */
  row: number
  /** Column index inside its row, left to right. */
  col: number
  /** World-space position (metres) used by the 3D scene. */
  x: number
  y: number
  z: number
  /** Visual scale — recliners and sleepers are wider. */
  scale: number
  tier: string
  price: number
  tags: string[]
}

export interface Tier {
  id: string
  label: string
  price: number
  note: string
}

export interface Layout {
  mode: Mode
  seats: Seat[]
  tiers: Tier[]
  /** Rows shown in the 2D map: each entry is the seat index or null for a gap. */
  grid: (number | null)[][]
  rowLabels: string[]
  /** Seat id → index into `seats`. */
  index: Map<string, number>
}

/* ---------------------------------------------------------------- Seeded RNG */

export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

export function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

/* -------------------------------------------------------------------- Cinema */

const CINEMA_TIERS: Tier[] = [
  { id: 'classic', label: 'Classic', price: 180, note: 'Rows A–E' },
  { id: 'prime', label: 'Prime', price: 290, note: 'Rows F–K · best sightline' },
  { id: 'recliner', label: 'Recliner', price: 520, note: 'Rows L–M · powered' },
]

function buildCinema(): Layout {
  const seats: Seat[] = []
  const grid: (number | null)[][] = []
  const rowLabels: string[] = []
  const letters = 'ABCDEFGHIJKLM'
  let z = -3.4
  for (let r = 0; r < 13; r++) {
    const recliner = r >= 11
    const tier = recliner ? 'recliner' : r >= 5 ? 'prime' : 'classic'
    const price = CINEMA_TIERS.find((t) => t.id === tier)!.price
    const cols = recliner ? 10 : 16
    const pitch = recliner ? 0.95 : 0.62
    const aisleAfter = recliner ? [1, 7] : [3, 11]
    const gridRow: (number | null)[] = []
    const width = cols * pitch + aisleAfter.length * 0.7
    let x = -width / 2 + pitch / 2
    const y = r * 0.24
    for (let c = 0; c < cols; c++) {
      const id = `${letters[r]}${c + 1}`
      const tags: string[] = []
      if (c === 0 || c === cols - 1 || aisleAfter.includes(c) || aisleAfter.includes(c - 1)) tags.push('Aisle')
      if (r >= 6 && r <= 9 && c >= 4 && c <= 11 && !recliner) tags.push('Sweet spot')
      if (r === 0 && (c === 0 || c === 1)) tags.push('Wheelchair')
      seats.push({ id, row: r, col: c, x, y, z, scale: recliner ? 1.45 : 1, tier, price, tags })
      gridRow.push(seats.length - 1)
      x += pitch
      if (aisleAfter.includes(c)) {
        x += 0.7
        gridRow.push(null)
      }
    }
    // Centre the shorter recliner rows inside the 16-wide 2D grid.
    if (recliner) {
      const pad = (18 - gridRow.length) / 2
      for (let i = 0; i < pad; i++) {
        gridRow.unshift(null)
        gridRow.push(null)
      }
    }
    grid.push(gridRow)
    rowLabels.push(letters[r]!)
    z += recliner ? 1.45 : 1.02
    if (r === 4) z += 0.5 // cross-aisle between Classic and Prime
    if (r === 10) z += 0.5
  }
  return { mode: 'cinema', seats, tiers: CINEMA_TIERS, grid, rowLabels, index: new Map(seats.map((x, i) => [x.id, i])) }
}

/* ----------------------------------------------------------------------- Bus */

const BUS_TIERS: Tier[] = [
  { id: 'window', label: 'Window', price: 1149, note: 'Reclining · USB' },
  { id: 'aisle', label: 'Aisle', price: 999, note: 'Reclining · USB' },
  { id: 'rear', label: 'Rear bench', price: 899, note: 'Last row' },
]

function buildBus(): Layout {
  const seats: Seat[] = []
  const grid: (number | null)[][] = []
  const rowLabels: string[] = []
  const xs = [-0.86, -0.38, 0.38, 0.86]
  for (let r = 0; r < 11; r++) {
    const last = r === 10
    const gridRow: (number | null)[] = []
    const z = -3.2 + r * 0.82
    const cols = last ? [-0.86, -0.43, 0, 0.43, 0.86] : xs
    cols.forEach((x, c) => {
      const window = c === 0 || c === cols.length - 1
      const tier = last ? 'rear' : window ? 'window' : 'aisle'
      const price = BUS_TIERS.find((t) => t.id === tier)!.price
      const tags: string[] = []
      if (window) tags.push('Window')
      else if (!last) tags.push('Aisle')
      if (!last && (r === 1 || r === 2) && c < 2) tags.push('Women only')
      if (r === 4 && c === 3) tags.push('Emergency exit')
      const id = `${r + 1}${'ABCDE'[c]}`
      seats.push({ id, row: r, col: c, x, y: 0, z, scale: last ? 0.88 : 1, tier, price, tags })
      gridRow.push(seats.length - 1)
      if (!last && c === 1) gridRow.push(null)
    })
    grid.push(gridRow)
    rowLabels.push(String(r + 1))
  }
  return { mode: 'bus', seats, tiers: BUS_TIERS, grid, rowLabels, index: new Map(seats.map((x, i) => [x.id, i])) }
}

const cache: Partial<Record<Mode, Layout>> = {}
export function layoutFor(mode: Mode): Layout {
  return (cache[mode] ??= mode === 'cinema' ? buildCinema() : buildBus())
}

