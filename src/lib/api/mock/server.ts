import type { AiAssistRequest, Booking, EventDetail, Hold, Seat } from '../types'
import { recommend } from './ai'
import { SEEDED_ORGANIZER, SEEDED_STUDENT, seedEvents, seedPastBookings } from './data'

/**
 * In-browser stand-in for the organizer mock API, used when VITE_API_BASE_URL
 * is empty. It is fetch-compatible so the real client code path runs unchanged,
 * and reproduces the PDF's conditions: 2–3 s latency, ~1 in 20 random failures,
 * and other students holding/booking seats in the background.
 */

const STORAGE_KEY = 'seatlock-mock-db-v4'
const HOLD_MS = 5 * 60_000

interface OtherHold { seatId: string; until: number; outcome: 'booked' | 'available' }
interface MyHold extends Hold { userId: string }
export interface MockMetrics {
  holds: number
  conflicts: number
  confirmed: number
  expired: number
  cancelled: number
  released: number
  noShowReleased: number
  waitlistOffers: number
}
interface Db {
  events: EventDetail[]
  seats: Record<string, Seat[]>
  holds: MyHold[]
  others: Record<string, OtherHold[]>
  lastTick: Record<string, number>
  bookings: Booking[]
  metrics: Record<string, MockMetrics>
  /** Occupancy history (seats left) per event, sampled on ticks, for organizer forecasts. */
  history: Record<string, number[]>
}

const emptyMetrics = (): MockMetrics => ({ holds: 0, conflicts: 0, confirmed: 0, expired: 0, cancelled: 0, released: 0, noShowReleased: 0, waitlistOffers: 0 })
function metric(d: Db, eventId: string, k: keyof MockMetrics, n = 1) {
  const m = (d.metrics[eventId] ??= emptyMetrics())
  m[k] += n
}

export interface DemoControls {
  latency: 'realistic' | 'fast'
  failures: boolean
  forceConflictNext: boolean
  shortHoldNext: boolean
  aiSlowNext: boolean
  aiStaleNext: boolean
}

export const demoControls: DemoControls = {
  latency: 'realistic',
  failures: true,
  forceConflictNext: false,
  shortHoldNext: false,
  aiSlowNext: false,
  aiStaleNext: false,
}

let db: Db | null = null

function load(): Db {
  if (db) return db
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      // Re-seed if the newest event is in the past (stale cache from an old demo day).
      const latest = Math.max(...parsed.events.map((e) => Date.parse(e.startsAt)))
      if (latest > Date.now()) {
        parsed.metrics ??= {}
        parsed.history ??= {}
        return (db = parsed)
      }
    }
  } catch {
    /* corrupted or unavailable storage — fall through to a fresh seed */
  }
  const { events, seats } = seedEvents()
  db = { events, seats, holds: [], others: {}, lastTick: {}, bookings: seedPastBookings(), metrics: {}, history: {} }
  save()
  return db
}

// Browser-local multi-tab sync: another tab wrote the mock DB, so drop our in-memory copy.
// (Same-browser only; this is not distributed consistency.)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) db = null
  })
}

function save() {
  try {
    if (db) localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* storage full or blocked; the mock still works in memory */
  }
}

export function resetMockDb() {
  db = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', date: new Date().toUTCString() },
  })
}

const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json(status, { code, message, ...extra })

function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

function latency(kind: 'poll' | 'normal') {
  if (demoControls.latency === 'fast') return 150 + Math.random() * 250
  return kind === 'poll' ? 400 + Math.random() * 900 : 2000 + Math.random() * 1000
}

/** Advance the simulated crowd: other students grab and release seats over time. */
function tick(eventId: string) {
  const d = load()
  const now = Date.now()
  const seats = d.seats[eventId]
  const event = d.events.find((e) => e.id === eventId)
  if (!seats || !event) return
  const others = (d.others[eventId] ??= [])
  // Resolve expired holds by other students.
  for (const h of others.filter((o) => o.until <= now)) {
    const seat = seats.find((s) => s.id === h.seatId)
    if (seat && seat.status === 'held' && !seat.heldByMe) seat.status = h.outcome
  }
  d.others[eventId] = others.filter((o) => o.until > now)
  // Expire my own holds.
  for (const hold of d.holds.filter((h) => h.eventId === eventId && Date.parse(h.expiresAt) <= now)) {
    metric(d, eventId, 'expired')
    for (const s of seats) {
      if (hold.seatIds.includes(s.id) && s.heldByMe) {
        s.status = 'available'
        delete s.heldByMe
      }
    }
  }
  d.holds = d.holds.filter((h) => Date.parse(h.expiresAt) > now)

  const last = d.lastTick[eventId] ?? now - 4000
  const steps = Math.min(Math.floor((now - last) / 3500), 6)
  if (steps > 0) d.lastTick[eventId] = now
  const available = seats.filter((s) => s.status === 'available')
  const grabs = Math.round(steps * (0.6 + Math.random() * 1.6))
  for (let i = 0; i < grabs && available.length > 12; i++) {
    // Bias towards front rows — that's where the rush is.
    const idx = Math.floor(Math.pow(Math.random(), 1.8) * available.length)
    const seat = available.splice(idx, 1)[0]
    if (!seat) continue
    seat.status = 'held'
    d.others[eventId]?.push({ seatId: seat.id, until: now + 12_000 + Math.random() * 30_000, outcome: Math.random() < 0.55 ? 'booked' : 'available' })
  }
  event.seatsLeft = seats.filter((s) => s.status === 'available').length
  if (steps > 0) {
    const h = (d.history[eventId] ??= [])
    h.push(event.seatsLeft)
    if (h.length > 60) h.splice(0, h.length - 60)
  }
  save()
}

function auth(init: RequestInit) {
  const h = new Headers(init.headers).get('authorization')
  return h === `Bearer mock-token-${SEEDED_STUDENT.id}` || h === `Bearer mock-token-${SEEDED_ORGANIZER.id}`
}

function aiStream(req: AiAssistRequest, signal?: AbortSignal | null): Response {
  const slow = demoControls.aiSlowNext || /\bslow\b/i.test(req.prompt)
  const stale = demoControls.aiStaleNext
  demoControls.aiSlowNext = false
  demoControls.aiStaleNext = false
  const open = req.seats.filter((s) => s.status === 'available').length
  const steps = [
    'Reading your request…',
    `Checking ${open} open seats and live prices…`,
    'Scoring rows for view, distance and budget…',
  ]
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const text of steps) {
          await wait(slow ? 3500 : 450 + Math.random() * 500, signal)
          controller.enqueue(enc.encode(JSON.stringify({ type: 'progress', text }) + '\n'))
        }
        await wait(300, signal)
        if (demoControls.failures && Math.random() < 0.05) {
          controller.enqueue(enc.encode(JSON.stringify({ type: 'error', message: 'Assistant is overloaded' }) + '\n'))
          controller.close()
          return
        }
        const result = recommend(req)
        if (stale) {
          const taken = req.seats.find((s) => s.status !== 'available')
          if (taken) result.seatIds = [taken.id, ...result.seatIds].slice(0, req.maxSeats)
        }
        controller.enqueue(enc.encode(JSON.stringify({ type: 'result', ...result }) + '\n'))
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
}

export async function mockFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] ?? ''
  const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {}
  const isPoll = method === 'GET' && /\/seats$/.test(path)

  if (path !== '/ai/assist') await wait(latency(isPoll ? 'poll' : 'normal'), init.signal)
  if (demoControls.failures && path !== '/ai/assist' && Math.random() < 0.05) {
    return err(503, 'server_error', 'Service temporarily unavailable')
  }

  const d = load()

  if (method === 'POST' && path === '/auth/login') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const account = [SEEDED_STUDENT, SEEDED_ORGANIZER].find((a) => a.email === email && a.password === body.password)
    if (!account) {
      return err(401, 'invalid_credentials', 'That email and password don’t match.')
    }
    const { password: _pw, ...user } = account
    return json(200, { token: `mock-token-${account.id}`, user })
  }

  if (!auth(init)) return err(401, 'unauthorized', 'Please sign in again.')

  let m: RegExpMatchArray | null

  if (method === 'GET' && path === '/events') {
    d.events.forEach((e) => tick(e.id))
    const events = d.events.map(({ description: _d, organizer: _o, lineup: _l, durationMinutes: _m, ...summary }) => summary)
    return json(200, { events })
  }

  if (method === 'GET' && (m = path.match(/^\/events\/([^/]+)$/))) {
    const ev = d.events.find((e) => e.id === m?.[1])
    return ev ? json(200, ev) : err(404, 'not_found', 'Event not found.')
  }

  if (method === 'GET' && (m = path.match(/^\/events\/([^/]+)\/seats$/))) {
    const id = m[1] ?? ''
    if (!d.seats[id]) return err(404, 'not_found', 'Event not found.')
    tick(id)
    return json(200, { eventId: id, seats: d.seats[id], updatedAt: new Date().toISOString() })
  }

  if (method === 'POST' && (m = path.match(/^\/events\/([^/]+)\/hold$/))) {
    const id = m[1] ?? ''
    const seats = d.seats[id]
    if (!seats) return err(404, 'not_found', 'Event not found.')
    tick(id)
    const seatIds = Array.isArray(body.seatIds) ? body.seatIds.map(String) : []
    if (seatIds.length < 1 || seatIds.length > 4) return err(422, 'validation', 'You can hold between 1 and 4 seats.')
    // Release any previous hold this student had on this event.
    for (const h of d.holds.filter((h) => h.eventId === id)) {
      for (const s of seats) if (h.seatIds.includes(s.id) && s.heldByMe) { s.status = 'available'; delete s.heldByMe }
    }
    d.holds = d.holds.filter((h) => h.eventId !== id)
    let conflicting = seatIds.filter((sid) => seats.find((s) => s.id === sid)?.status !== 'available')
    if (conflicting.length === 0 && (demoControls.forceConflictNext || Math.random() < 0.08)) {
      demoControls.forceConflictNext = false
      const victim = seatIds[Math.floor(Math.random() * seatIds.length)] ?? seatIds[0] ?? ''
      const seat = seats.find((s) => s.id === victim)
      if (seat) seat.status = 'held'
      d.others[id]?.push({ seatId: victim, until: Date.now() + 40_000, outcome: 'booked' })
      conflicting = [victim]
    }
    if (conflicting.length) {
      metric(d, id, 'conflicts')
      save()
      return err(409, 'conflict', `Seat${conflicting.length > 1 ? 's' : ''} ${conflicting.join(', ')} ${conflicting.length > 1 ? 'were' : 'was'} just taken by another student.`, { conflictingSeatIds: conflicting })
    }
    const ttl = demoControls.shortHoldNext ? 75_000 : HOLD_MS
    demoControls.shortHoldNext = false
    const hold: MyHold = {
      id: `HLD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      eventId: id,
      seatIds,
      total: seatIds.reduce((t, sid) => t + (seats.find((s) => s.id === sid)?.price ?? 0), 0),
      expiresAt: new Date(Date.now() + ttl).toISOString(),
      userId: SEEDED_STUDENT.id,
    }
    for (const s of seats) if (seatIds.includes(s.id)) { s.status = 'held'; s.heldByMe = true }
    d.holds.push(hold)
    metric(d, id, 'holds')
    save()
    const { userId: _u, ...pub } = hold
    return json(201, { hold: pub, serverTime: new Date().toISOString() })
  }

  if (method === 'POST' && (m = path.match(/^\/holds\/([^/]+)\/confirm$/))) {
    const hold = d.holds.find((h) => h.id === m?.[1])
    if (!hold || Date.parse(hold.expiresAt) <= Date.now()) {
      if (hold) tick(hold.eventId)
      return err(410, 'hold_expired', 'Your 5-minute hold expired and the seats were released.')
    }
    const seats = d.seats[hold.eventId] ?? []
    const event = d.events.find((e) => e.id === hold.eventId)
    for (const s of seats) if (hold.seatIds.includes(s.id)) { s.status = 'booked'; delete s.heldByMe }
    const booking: Booking = {
      id: `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      eventId: hold.eventId,
      event: { title: event?.title ?? '', venue: event?.venue ?? '', startsAt: event?.startsAt ?? '', durationMinutes: event?.durationMinutes ?? 120 },
      seats: hold.seatIds.map((sid) => ({ id: sid, price: seats.find((s) => s.id === sid)?.price ?? 0 })),
      total: hold.total,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    }
    d.bookings.unshift(booking)
    d.holds = d.holds.filter((h) => h.id !== hold.id)
    metric(d, hold.eventId, 'confirmed')
    save()
    return json(201, { booking })
  }

  if (method === 'GET' && path === '/me/bookings') return json(200, { bookings: d.bookings })

  if (method === 'DELETE' && (m = path.match(/^\/bookings\/([^/]+)$/))) {
    const booking = d.bookings.find((b) => b.id === m?.[1])
    if (!booking) return err(404, 'not_found', 'Booking not found.')
    // Prevent duplicate returns: a ticket can only leave your ownership once.
    if (booking.status === 'cancelled') return err(409, 'already_cancelled', 'This booking was already returned.')
    booking.status = 'cancelled'
    for (const s of d.seats[booking.eventId] ?? []) if (booking.seats.some((x) => x.id === s.id)) s.status = 'available'
    metric(d, booking.eventId, 'cancelled')
    const ev = d.events.find((e) => e.id === booking.eventId)
    if (ev) ev.seatsLeft = (d.seats[booking.eventId] ?? []).filter((s) => s.status === 'available').length
    save()
    return json(200, { booking })
  }

  if (method === 'POST' && path === '/ai/assist') return aiStream(body as unknown as AiAssistRequest, init.signal)

  return err(404, 'not_found', `No mock route for ${method} ${path}`)
}

/** Demo helper: make another student grab one seat right now. */
export function stealSeat(eventId: string, seatId: string) {
  const d = load()
  const seat = d.seats[eventId]?.find((s) => s.id === seatId)
  if (!seat || seat.status !== 'available') return
  seat.status = 'held'
  ;(d.others[eventId] ??= []).push({ seatId, until: Date.now() + 45_000, outcome: 'booked' })
  save()
}

/* ==========================================================================
   Inventory operations for the campus features (mock mode only). They all act
   on the same DB as the HTTP routes above, so seat ownership never diverges.
   ========================================================================== */

export function inventory(eventId: string): Seat[] {
  return (load().seats[eventId] ?? []).map((s) => ({ ...s }))
}

export function mockEvents(): EventDetail[] {
  return load().events.map((e) => ({ ...e }))
}

export function mockMetrics(eventId: string): MockMetrics {
  return { ...(load().metrics[eventId] ?? emptyMetrics()) }
}

export function occupancyHistory(eventId: string): number[] {
  return [...(load().history[eventId] ?? [])]
}

export function advance(eventId: string) {
  tick(eventId)
}

function refreshLeft(d: Db, eventId: string) {
  const ev = d.events.find((e) => e.id === eventId)
  if (ev) ev.seatsLeft = (d.seats[eventId] ?? []).filter((s) => s.status === 'available').length
}

/**
 * Reserve released seats for the waitlist so the background crowd can't grab
 * them while an offer is open. Returns the reserved seat ids.
 */
export function reserveForWaitlist(eventId: string, seatIds: string[], ttlMs: number): string[] {
  const d = load()
  const seats = d.seats[eventId] ?? []
  const out: string[] = []
  for (const id of seatIds) {
    const s = seats.find((x) => x.id === id)
    if (!s || s.status !== 'available') continue
    s.status = 'held'
    ;(d.others[eventId] ??= []).push({ seatId: id, until: Date.now() + ttlMs, outcome: 'available' })
    out.push(id)
  }
  metric(d, eventId, 'waitlistOffers', out.length ? 1 : 0)
  refreshLeft(d, eventId)
  save()
  return out
}

/** Resolve a waitlist reservation held for a simulated student. */
export function resolveReserved(eventId: string, seatIds: string[], outcome: 'booked' | 'available') {
  const d = load()
  const seats = d.seats[eventId] ?? []
  d.others[eventId] = (d.others[eventId] ?? []).filter((o) => !seatIds.includes(o.seatId))
  for (const s of seats) if (seatIds.includes(s.id) && s.status === 'held' && !s.heldByMe) s.status = outcome
  refreshLeft(d, eventId)
  save()
}

/** The current student accepts a waitlist offer: the reserved seats become their own 5-minute hold. */
export function claimReserved(eventId: string, seatIds: string[]): { hold: Hold; serverTime: string } | null {
  const d = load()
  const seats = d.seats[eventId] ?? []
  const reserved = seatIds.every((id) => (d.others[eventId] ?? []).some((o) => o.seatId === id))
  if (!reserved) return null
  d.others[eventId] = (d.others[eventId] ?? []).filter((o) => !seatIds.includes(o.seatId))
  for (const h of d.holds.filter((h) => h.eventId === eventId)) {
    for (const s of seats) if (h.seatIds.includes(s.id) && s.heldByMe) { s.status = 'available'; delete s.heldByMe }
  }
  d.holds = d.holds.filter((h) => h.eventId !== eventId)
  const hold: MyHold = {
    id: `HLD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    eventId,
    seatIds,
    total: seatIds.reduce((t, sid) => t + (seats.find((s) => s.id === sid)?.price ?? 0), 0),
    expiresAt: new Date(Date.now() + HOLD_MS).toISOString(),
    userId: SEEDED_STUDENT.id,
  }
  for (const s of seats) if (seatIds.includes(s.id)) { s.status = 'held'; s.heldByMe = true }
  d.holds.push(hold)
  metric(d, eventId, 'holds')
  save()
  const { userId: _u, ...pub } = hold
  return { hold: pub, serverTime: new Date().toISOString() }
}

/** Another (simulated) student cancels: one booked seat goes back into inventory. */
export function simulateCancellation(eventId: string, count = 1): string[] {
  const d = load()
  const seats = d.seats[eventId] ?? []
  const mine = new Set(d.bookings.filter((b) => b.eventId === eventId && b.status === 'confirmed').flatMap((b) => b.seats.map((s) => s.id)))
  const booked = seats.filter((s) => s.status === 'booked' && !mine.has(s.id))
  const out: string[] = []
  for (let i = 0; i < count && booked.length; i++) {
    const s = booked.splice(Math.floor(Math.random() * booked.length), 1)[0]
    if (!s) break
    s.status = 'available'
    out.push(s.id)
  }
  metric(d, eventId, 'cancelled', out.length)
  refreshLeft(d, eventId)
  save()
  return out
}

/** Organizer policy action: release no-show seats back into inventory. */
export function releaseSeats(eventId: string, seatIds: string[], reason: 'noshow' | 'organizer'): string[] {
  const d = load()
  const mine = new Set(d.bookings.filter((b) => b.eventId === eventId && b.status === 'confirmed').flatMap((b) => b.seats.map((s) => s.id)))
  const out: string[] = []
  for (const s of d.seats[eventId] ?? []) {
    if (!seatIds.includes(s.id) || mine.has(s.id)) continue // never release the signed-in student's own tickets
    if (s.status === 'booked' || (s.status === 'held' && !s.heldByMe)) { s.status = 'available'; out.push(s.id) }
  }
  metric(d, eventId, reason === 'noshow' ? 'noShowReleased' : 'released', out.length)
  refreshLeft(d, eventId)
  save()
  return out
}

/** Organizer seat-management demo: block or unblock an available seat. */
export function setSeatBlocked(eventId: string, seatId: string, blocked: boolean): boolean {
  const d = load()
  const s = d.seats[eventId]?.find((x) => x.id === seatId)
  if (!s) return false
  if (blocked && s.status !== 'available') return false
  if (!blocked && s.status !== 'blocked') return false
  s.status = blocked ? 'blocked' : 'available'
  refreshLeft(d, eventId)
  save()
  return true
}

/** Scenario control: a burst of other students holding seats. */
export function simulateRush(eventId: string, n: number): number {
  const d = load()
  const seats = d.seats[eventId] ?? []
  const available = seats.filter((s) => s.status === 'available')
  let grabbed = 0
  for (let i = 0; i < n && available.length > 4; i++) {
    const seat = available.splice(Math.floor(Math.pow(Math.random(), 1.6) * available.length), 1)[0]
    if (!seat) continue
    seat.status = 'held'
    ;(d.others[eventId] ??= []).push({ seatId: seat.id, until: Date.now() + 8_000 + Math.random() * 20_000, outcome: Math.random() < 0.6 ? 'booked' : 'available' })
    grabbed++
  }
  refreshLeft(d, eventId)
  save()
  return grabbed
}
