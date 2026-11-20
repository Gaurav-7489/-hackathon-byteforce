import type { Seat } from '../../api/types'
import type { CrowdZone } from '../types'

/**
 * Deterministic, seeded simulations for the hackathon demo. Same seed → same
 * result, so judges can replay a scenario. These model *behaviour*; they do not
 * provide real anti-bot protection, distributed locking or sensor data.
 */

export function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const hashSeed = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

/* ======================================================================
   FairQueue — 100 students competing for limited seats
   ====================================================================== */

export type Connection = 'fast' | 'average' | 'slow'

export interface QueueStudent {
  id: string
  connection: Connection
  /** ms after sales open that the request arrives. */
  arrivalMs: number
  wants: number
  duplicateOf?: string
}

export interface QueueOutcome {
  id: string
  connection: Connection
  position: number
  got: number
  admittedAtS: number | null
  status: 'booked' | 'sold_out' | 'merged_duplicate'
}

export interface QueueRun {
  mode: 'fair' | 'fcfs'
  outcomes: QueueOutcome[]
  frames: { t: number; admitted: number; seatsLeft: number; waiting: number }[]
  successByConnection: Record<Connection, { total: number; served: number }>
  duplicatesMerged: number
}

export function makeQueueStudents(seed: number, n = 100): QueueStudent[] {
  const rand = prng(seed)
  const students: QueueStudent[] = []
  for (let i = 0; i < n; i++) {
    const roll = rand()
    const connection: Connection = roll < 0.35 ? 'fast' : roll < 0.75 ? 'average' : 'slow'
    const base = connection === 'fast' ? 80 : connection === 'average' ? 600 : 2600
    students.push({
      id: `S${String(i + 1).padStart(3, '0')}`,
      connection,
      arrivalMs: Math.round(base + rand() * base * 1.4),
      wants: 1 + Math.floor(rand() * 3.2),
    })
  }
  // A handful of "two tabs" sessions from the same student, arriving very fast.
  for (let i = 0; i < 6; i++) {
    const src = students[Math.floor(rand() * students.length)]
    if (src) students.push({ ...src, id: `${src.id}-tab2`, duplicateOf: src.id, arrivalMs: 40 + Math.round(rand() * 60), connection: 'fast' })
  }
  return students
}

/**
 * Fair mode: everyone who arrives within the 8-second opening window gets a
 * random (lottery) position, duplicate sessions are merged into one token and
 * each student is limited to 4 seats (2 when demand is over 1.5× supply). FCFS: pure arrival order — the fastest
 * connections (and duplicate tabs) win.
 */
export function runQueue(students: readonly QueueStudent[], opts: { mode: 'fair' | 'fcfs'; seats: number; admitPerSecond: number; seed: number; windowMs?: number }): QueueRun {
  const rand = prng(opts.seed ^ 0x9e3779b9)
  const windowMs = opts.windowMs ?? 8000
  let pool = [...students]
  let duplicatesMerged = 0
  if (opts.mode === 'fair') {
    const before = pool.length
    pool = pool.filter((s) => !s.duplicateOf)
    duplicatesMerged = before - pool.length
  }
  let order: QueueStudent[]
  if (opts.mode === 'fair') {
    const early = pool.filter((s) => s.arrivalMs <= windowMs)
    const late = pool.filter((s) => s.arrivalMs > windowMs).sort((a, b) => a.arrivalMs - b.arrivalMs)
    const shuffled = early.map((s) => ({ s, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.s)
    order = [...shuffled, ...late]
  } else {
    order = [...pool].sort((a, b) => a.arrivalMs - b.arrivalMs)
  }
  let seatsLeft = opts.seats
  const overDemand = pool.reduce((t, s) => t + s.wants, 0) > opts.seats * 1.5
  const outcomes: QueueOutcome[] = []
  const frames: QueueRun['frames'] = []
  const claimed = new Map<string, number>()
  order.forEach((s, i) => {
    const t = Math.floor(i / opts.admitPerSecond)
    const owner = s.duplicateOf ?? s.id
    const already = claimed.get(owner) ?? 0
    // Fair mode: 4 seats per student normally, 2 when demand clearly exceeds supply.
    const limit = opts.mode === 'fair' ? Math.max(0, (overDemand ? 2 : 4) - already) : s.wants
    const want = Math.min(s.wants, limit)
    const got = Math.min(want, seatsLeft)
    seatsLeft -= got
    claimed.set(owner, already + got)
    outcomes.push({ id: s.id, connection: s.connection, position: i + 1, got, admittedAtS: got > 0 ? t : null, status: got > 0 ? 'booked' : 'sold_out' })
    if (i % opts.admitPerSecond === opts.admitPerSecond - 1 || i === order.length - 1) {
      frames.push({ t, admitted: i + 1, seatsLeft, waiting: order.length - i - 1 })
    }
  })
  const successByConnection: QueueRun['successByConnection'] = {
    fast: { total: 0, served: 0 }, average: { total: 0, served: 0 }, slow: { total: 0, served: 0 },
  }
  const seenOwners = new Set<string>()
  for (const s of students) {
    if (s.duplicateOf) continue
    if (seenOwners.has(s.id)) continue
    seenOwners.add(s.id)
    successByConnection[s.connection].total++
    const served = (claimed.get(s.id) ?? 0) > 0
    if (served) successByConnection[s.connection].served++
  }
  return { mode: opts.mode, outcomes, frames, successByConnection, duplicatesMerged }
}

/** Student-facing queue position at time `nowMs` for a token that started at `startPosition`. */
export function queuePosition(startPosition: number, joinedAt: number, nowMs: number, admitPerSecond: number): number {
  const elapsed = Math.max(0, nowMs - joinedAt) / 1000
  return Math.max(0, Math.ceil(startPosition - elapsed * admitPerSecond))
}

export function waitRange(position: number, admitPerSecond: number): [number, number] {
  const mid = position / Math.max(0.1, admitPerSecond)
  return [Math.max(0, Math.floor(mid * 0.8)), Math.ceil(mid * 1.3)]
}

/* ======================================================================
   Load simulation — concurrent reservation attempts
   ====================================================================== */

export type LoadEventKind = 'request' | 'hold' | 'conflict' | 'error' | 'confirm' | 'release' | 'expire' | 'retry'

export interface LoadEvent {
  t: number // ms
  user: string
  kind: LoadEventKind
  seats: string[]
  latencyMs?: number
}

export interface LoadFrame {
  t: number // seconds
  available: number
  held: number
  booked: number
  conflicts: number
  errors: number
  holds: number
  released: number
  expired: number
  queue: number
  p50: number
  p95: number
}

export interface LoadRun {
  events: LoadEvent[]
  frames: LoadFrame[]
  totals: { requests: number; holds: number; conflicts: number; errors: number; confirmed: number; released: number; expired: number; retries: number }
}

export interface LoadOptions {
  seed: number
  users: number
  seats: number
  durationS: number
  holdTtlS: number
  errorRate: number
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0
}

export function simulateLoad(o: LoadOptions): LoadRun {
  const rand = prng(o.seed)
  const seatIds = Array.from({ length: o.seats }, (_, i) => `${'ABCDEFGHJK'[Math.floor(i / 10) % 10]}${(i % 10) + 1}`)
  const state = new Map<string, { status: 'available' | 'held' | 'booked'; by?: string; until?: number }>()
  seatIds.forEach((id) => state.set(id, { status: 'available' }))
  type Job = { at: number; user: string; kind: 'arrive' | 'process' | 'decide' | 'expire'; seats: string[]; latency?: number; attempt: number }
  const jobs: Job[] = []
  for (let i = 0; i < o.users; i++) {
    // Rush at open: most users arrive within the first third.
    const at = Math.round(Math.pow(rand(), 2.2) * o.durationS * 0.6 * 1000)
    jobs.push({ at, user: `U${String(i + 1).padStart(3, '0')}`, kind: 'arrive', seats: [], attempt: 0 })
  }
  const events: LoadEvent[] = []
  const totals = { requests: 0, holds: 0, conflicts: 0, errors: 0, confirmed: 0, released: 0, expired: 0, retries: 0 }
  const latencies: { t: number; v: number }[] = []
  let inFlight = 0
  const inflightAt: { t: number; v: number }[] = []

  const pickSeats = (n: number) => {
    // Everyone wants the front: weighted towards low indices, ignoring live state (stale view → conflicts).
    const picks = new Set<string>()
    while (picks.size < n) picks.add(seatIds[Math.floor(Math.pow(rand(), 1.7) * seatIds.length)] ?? seatIds[0]!)
    return [...picks]
  }
  const freeSeats = (n: number) => seatIds.filter((id) => state.get(id)?.status === 'available').slice(0, n)

  while (jobs.length) {
    jobs.sort((a, b) => a.at - b.at)
    const job = jobs.shift()!
    if (job.at > o.durationS * 1000) break
    if (job.kind === 'arrive') {
      const n = 1 + Math.floor(rand() * 3)
      const seats = job.attempt > 0 ? freeSeats(n) : pickSeats(n)
      if (seats.length === 0) continue
      const latency = Math.round(180 + Math.pow(rand(), 2) * 2300)
      totals.requests++
      inFlight++
      inflightAt.push({ t: job.at, v: inFlight })
      events.push({ t: job.at, user: job.user, kind: job.attempt > 0 ? 'retry' : 'request', seats, latencyMs: latency })
      if (job.attempt > 0) totals.retries++
      jobs.push({ ...job, kind: 'process', at: job.at + latency, seats, latency })
    } else if (job.kind === 'process') {
      inFlight--
      latencies.push({ t: job.at, v: job.latency ?? 0 })
      if (rand() < o.errorRate) {
        totals.errors++
        events.push({ t: job.at, user: job.user, kind: 'error', seats: job.seats })
        // Non-idempotent hold: never retried automatically. The (simulated) student taps Retry later.
        if (job.attempt < 1) jobs.push({ ...job, kind: 'arrive', at: job.at + 2000 + Math.round(rand() * 2000), attempt: job.attempt + 1 })
        continue
      }
      const taken = job.seats.filter((id) => state.get(id)?.status !== 'available')
      if (taken.length) {
        totals.conflicts++
        events.push({ t: job.at, user: job.user, kind: 'conflict', seats: taken })
        if (job.attempt < 2) jobs.push({ ...job, kind: 'arrive', at: job.at + 600 + Math.round(rand() * 900), attempt: job.attempt + 1 })
        continue
      }
      for (const id of job.seats) state.set(id, { status: 'held', by: job.user, until: job.at + o.holdTtlS * 1000 })
      totals.holds++
      events.push({ t: job.at, user: job.user, kind: 'hold', seats: job.seats })
      const r = rand()
      if (r < 0.62) jobs.push({ ...job, kind: 'decide', at: job.at + Math.round((0.2 + rand() * 0.7) * o.holdTtlS * 1000) })
      else if (r < 0.75) jobs.push({ ...job, kind: 'decide', at: job.at + Math.round(rand() * o.holdTtlS * 500), attempt: -1 })
      else jobs.push({ ...job, kind: 'expire', at: job.at + o.holdTtlS * 1000 })
    } else if (job.kind === 'decide') {
      const still = job.seats.every((id) => state.get(id)?.by === job.user)
      if (!still) continue
      if (job.attempt === -1) {
        for (const id of job.seats) state.set(id, { status: 'available' })
        totals.released++
        events.push({ t: job.at, user: job.user, kind: 'release', seats: job.seats })
      } else {
        for (const id of job.seats) state.set(id, { status: 'booked', by: job.user })
        totals.confirmed++
        events.push({ t: job.at, user: job.user, kind: 'confirm', seats: job.seats })
      }
    } else if (job.kind === 'expire') {
      const still = job.seats.every((id) => state.get(id)?.status === 'held' && state.get(id)?.by === job.user)
      if (!still) continue
      for (const id of job.seats) state.set(id, { status: 'available' })
      totals.expired++
      events.push({ t: job.at, user: job.user, kind: 'expire', seats: job.seats })
    }
  }

  // Build per-second frames by replaying events.
  const frames: LoadFrame[] = []
  const replay = new Map<string, 'available' | 'held' | 'booked'>(seatIds.map((id) => [id, 'available']))
  const counters = { conflicts: 0, errors: 0, holds: 0, released: 0, expired: 0 }
  let ei = 0
  const sorted = [...events].sort((a, b) => a.t - b.t)
  for (let s = 0; s <= o.durationS; s++) {
    const until = s * 1000
    while (ei < sorted.length && sorted[ei]!.t <= until) {
      const e = sorted[ei++]!
      if (e.kind === 'hold') { counters.holds++; e.seats.forEach((id) => replay.set(id, 'held')) }
      if (e.kind === 'confirm') e.seats.forEach((id) => replay.set(id, 'booked'))
      if (e.kind === 'release') { counters.released++; e.seats.forEach((id) => replay.set(id, 'available')) }
      if (e.kind === 'expire') { counters.expired++; e.seats.forEach((id) => replay.set(id, 'available')) }
      if (e.kind === 'conflict') counters.conflicts++
      if (e.kind === 'error') counters.errors++
    }
    const win = latencies.filter((l) => l.t <= until).map((l) => l.v)
    const q = inflightAt.filter((x) => x.t <= until).at(-1)?.v ?? 0
    let available = 0, held = 0, booked = 0
    for (const v of replay.values()) { if (v === 'available') available++; else if (v === 'held') held++; else booked++ }
    frames.push({ t: s, available, held, booked, ...counters, queue: q, p50: pct(win, 50), p95: pct(win, 95) })
  }
  return { events: sorted, frames, totals }
}

/* ======================================================================
   Crowd heatmap — simulated arrivals per entry gate
   ====================================================================== */

export type DensityLevel = 'low' | 'medium' | 'high'

export interface ZoneLoad {
  zone: CrowdZone
  arrivalsPerMin: number
  queue: number
  waitMin: number
  load: number
  level: DensityLevel
}

/**
 * Minute-by-minute queue model from T−60 to `minute` (relative to start).
 * Arrivals follow a bell curve peaking 15 min before start; most people head
 * for the first (main) gate, which is what makes it overcrowd.
 */
export function crowdAt(zones: readonly CrowdZone[], minute: number, attendees: number, seed: number, redirectShare = 0): ZoneLoad[] {
  const rand = prng(seed)
  const weights = zones.map((_, i) => (i === 0 ? 0.68 : 0.32 / Math.max(1, zones.length - 1)))
  if (zones.length > 1 && redirectShare > 0) {
    const moved = weights[0]! * redirectShare
    weights[0]! -= moved
    for (let i = 1; i < weights.length; i++) weights[i]! += moved / (zones.length - 1)
  }
  const queues = zones.map(() => 0)
  const arrivalsNow = zones.map(() => 0)
  const total = attendees * 0.95
  const SD = 8
  const norm = 1 / (SD * Math.sqrt(2 * Math.PI))
  for (let m = -60; m <= minute; m++) {
    const base = total * norm * Math.exp(-((m + 15) ** 2) / (2 * SD * SD))
    zones.forEach((z, i) => {
      const jitter = 0.85 + rand() * 0.3
      const a = base * weights[i]! * jitter
      queues[i] = Math.max(0, queues[i]! + a - z.capacityPerMin)
      if (m === minute) arrivalsNow[i] = a
    })
  }
  return zones.map((zone, i) => {
    const queue = Math.round(queues[i]!)
    const waitMin = queue / zone.capacityPerMin
    const load = (arrivalsNow[i]! + queue) / zone.capacityPerMin
    const level: DensityLevel = waitMin < 2 ? 'low' : waitMin < 6 ? 'medium' : 'high'
    return { zone, arrivalsPerMin: Math.round(arrivalsNow[i]!), queue, waitMin, load, level }
  })
}

export function suggestGate(loads: readonly ZoneLoad[]): { from: ZoneLoad; to: ZoneLoad; savedMin: number } | null {
  if (loads.length < 2) return null
  const sorted = [...loads].sort((a, b) => b.waitMin - a.waitMin)
  const from = sorted[0]!
  const to = sorted.at(-1)!
  const savedMin = Math.round(from.waitMin - to.waitMin)
  return savedMin >= 2 ? { from, to, savedMin } : null
}

/* ======================================================================
   No-show recovery
   ====================================================================== */

export interface Reservation {
  seatId: string
  holder: string
  /** Minutes relative to event start when the attendee checks in; null = never shows. */
  checkInAtMin: number | null
  accessibility: boolean
}

export function buildAttendance(seats: readonly Seat[], seed: number, accessibleSeatIds: ReadonlySet<string>, noShowRate = 0.14): Reservation[] {
  const rand = prng(seed)
  return seats
    .filter((s) => s.status === 'booked')
    .map((s, i) => {
      const shows = rand() >= noShowRate
      const at = Math.round(-25 + rand() * 35 + (rand() - 0.5) * 10)
      return { seatId: s.id, holder: `Student #${1000 + i * 7}`, checkInAtMin: shows ? at : null, accessibility: accessibleSeatIds.has(s.id) }
    })
}

export interface NoShowPolicy {
  deadlineMin: number
  protectAccessible: boolean
}

export function noShowStatus(r: Reservation, nowMin: number): 'checked_in' | 'pending' | 'no_show' {
  if (r.checkInAtMin !== null && r.checkInAtMin <= nowMin) return 'checked_in'
  return 'pending'
}

/** Seats eligible for release: not checked in by the deadline, and (optionally) not accessibility seats. */
export function eligibleNoShows(rs: readonly Reservation[], nowMin: number, policy: NoShowPolicy): Reservation[] {
  if (nowMin < policy.deadlineMin) return []
  return rs.filter((r) => noShowStatus(r, nowMin) !== 'checked_in' && !(policy.protectAccessible && r.accessibility))
}

/* ======================================================================
   Demand forecast (Holt linear smoothing)
   ====================================================================== */

export function forecast(series: readonly number[], steps: number, alpha = 0.5, beta = 0.3): number[] {
  if (series.length === 0) return []
  let level = series[0]!
  let trend = series.length > 1 ? series[1]! - series[0]! : 0
  for (let i = 1; i < series.length; i++) {
    const prev = level
    level = alpha * series[i]! + (1 - alpha) * (level + trend)
    trend = beta * (level - prev) + (1 - beta) * trend
  }
  return Array.from({ length: steps }, (_, k) => Math.max(0, level + trend * (k + 1)))
}
