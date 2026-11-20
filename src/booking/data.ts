/**
 * Seat inventory for the two booking modes (cinema hall, intercity bus) plus a
 * small deterministic "live market" simulation: other people lock, buy and
 * release seats while you look, so the 3D view always has something happening.
 * Pure data — no React, no three.js — so it is cheap to test and to lazy-load.
 */

export type Mode = 'cinema' | 'bus'
export type SeatStatus = 'free' | 'locked' | 'sold'

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
}

export interface Slot {
  id: string
  label: string
  sub: string
  /** Base fill 0..1 used to seed the simulation. */
  fill: number
}

export interface Listing {
  title: string
  meta: string[]
  slots: Slot[]
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
  return { mode: 'cinema', seats, tiers: CINEMA_TIERS, grid, rowLabels }
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
  return { mode: 'bus', seats, tiers: BUS_TIERS, grid, rowLabels }
}

const cache: Partial<Record<Mode, Layout>> = {}
export function layoutFor(mode: Mode): Layout {
  return (cache[mode] ??= mode === 'cinema' ? buildCinema() : buildBus())
}

/* ------------------------------------------------------------------ Listings */

export const LISTINGS: Record<Mode, Listing> = {
  cinema: {
    title: 'Northbound',
    meta: ['UA 13+', '2h 18m', 'Sci-fi · Drama', 'Hall 4 · Dolby Atmos'],
    slots: [
      { id: 'c1030', label: '10:30', sub: 'Morning', fill: 0.22 },
      { id: 'c1315', label: '13:15', sub: 'Matinee', fill: 0.41 },
      { id: 'c1640', label: '16:40', sub: 'Evening', fill: 0.58 },
      { id: 'c1955', label: '19:55', sub: 'Prime', fill: 0.79 },
      { id: 'c2230', label: '22:30', sub: 'Late', fill: 0.47 },
    ],
  },
  bus: {
    title: 'Bengaluru → Hyderabad',
    meta: ['AC Seater 2+2', '9h 40m', '574 km', 'Volvo B11R'],
    slots: [
      { id: 'b1945', label: '19:45', sub: 'Majestic', fill: 0.34 },
      { id: 'b2115', label: '21:15', sub: 'Silk Board', fill: 0.62 },
      { id: 'b2230', label: '22:30', sub: 'Hebbal', fill: 0.81 },
      { id: 'b2350', label: '23:50', sub: 'Majestic', fill: 0.18 },
    ],
  },
}

/** Initial statuses for one show / departure, deterministic per slot id. */
export function seedStatuses(layout: Layout, slot: Slot): SeatStatus[] {
  const rand = rng(hash(slot.id))
  return layout.seats.map((s) => {
    // Popular spots fill first: the centre for cinemas, windows for buses.
    const bias = layout.mode === 'cinema' ? (s.tags.includes('Sweet spot') ? 0.18 : 0) - (s.row < 2 ? 0.2 : 0) : s.tags.includes('Window') ? 0.12 : 0
    const p = rand()
    if (p < slot.fill + bias) return 'sold'
    if (p < slot.fill + bias + 0.035) return 'locked'
    return 'free'
  })
}

/* ---------------------------------------------------------------- Simulation */

export type FeedKind = 'lock' | 'sold' | 'release'
export interface FeedItem {
  id: number
  at: number
  kind: FeedKind
  seats: string[]
  who: string
}

const NAMES = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Isha', 'Vikram', 'Ananya', 'Arjun', 'Sara', 'Neel', 'Tara']

export interface Step {
  changes: { index: number; status: SeatStatus }[]
  feed: Omit<FeedItem, 'id' | 'at'> | null
}

/**
 * One tick of other people's activity. Picks a group lock (1–4 neighbours in a
 * row), a checkout of an existing lock, or a released hold. `exclude` holds the
 * viewer's own seats, which the simulation never touches.
 */
export function simulateStep(layout: Layout, statuses: SeatStatus[], exclude: Set<number>, rand: () => number): Step {
  const roll = rand()
  const locked: number[] = []
  statuses.forEach((s, i) => s === 'locked' && !exclude.has(i) && locked.push(i))
  const who = NAMES[Math.floor(rand() * NAMES.length)]!

  if (roll < 0.52 || locked.length === 0) {
    const free: number[] = []
    statuses.forEach((s, i) => s === 'free' && !exclude.has(i) && free.push(i))
    if (free.length === 0) return { changes: [], feed: null }
    const start = free[Math.floor(rand() * free.length)]!
    const size = 1 + Math.floor(rand() * rand() * 4)
    const group = [start]
    const seat = layout.seats[start]!
    for (let k = 1; k < size; k++) {
      const next = start + k
      const n = layout.seats[next]
      if (!n || n.row !== seat.row || statuses[next] !== 'free' || exclude.has(next)) break
      group.push(next)
    }
    return {
      changes: group.map((index) => ({ index, status: 'locked' })),
      feed: { kind: 'lock', seats: group.map((i) => layout.seats[i]!.id), who },
    }
  }

  // Locks resolve as a group: everything in that row's contiguous run.
  const pick = locked[Math.floor(rand() * locked.length)]!
  const group = [pick]
  for (let n = pick + 1; statuses[n] === 'locked' && layout.seats[n]?.row === layout.seats[pick]!.row && !exclude.has(n); n++) group.push(n)
  const status: SeatStatus = roll < 0.82 ? 'sold' : 'free'
  return {
    changes: group.map((index) => ({ index, status })),
    feed: { kind: status === 'sold' ? 'sold' : 'release', seats: group.map((i) => layout.seats[i]!.id), who },
  }
}
