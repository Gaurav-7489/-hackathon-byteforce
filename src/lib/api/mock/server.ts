import type { AiAssistRequest, Booking, EventDetail, Hold, Seat } from '../types'
import { recommend } from './ai'
import { SEEDED_STUDENT, seedEvents, seedPastBookings } from './data'

/**
 * In-browser stand-in for the organizer mock API, used when VITE_API_BASE_URL
 * is empty. It is fetch-compatible so the real client code path runs unchanged,
 * and reproduces the brief's conditions: 2–3 s latency, ~1 in 20 random
 * failures, and other people holding / booking seats in the background.
 */

const STORAGE_KEY = 'seatlock-mock-db-v5'
const HOLD_MS = 5 * 60_000

interface OtherHold { seatId: string; until: number; outcome: 'booked' | 'available' }
interface MyHold extends Hold { userId: string }
interface Db {
  events: EventDetail[]
  seats: Record<string, Seat[]>
  holds: MyHold[]
  others: Record<string, OtherHold[]>
  lastTick: Record<string, number>
  bookings: Booking[]
}

export interface DemoControls {
  /** Live crowd: other people keep holding and booking seats. */
  live: boolean
  latency: 'realistic' | 'fast'
  failures: boolean
  forceConflictNext: boolean
  shortHoldNext: boolean
  aiSlowNext: boolean
  aiStaleNext: boolean
}

export const demoControls: DemoControls = {
  live: true,
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
      const latest = Math.max(...parsed.events.map((e) => Date.parse(e.startsAt)))
      // Re-seed when the cached catalogue has gone stale (older than a day).
      if (latest > Date.now() + 2 * 86_400_000) return (db = parsed)
    }
  } catch {
    /* corrupted or unavailable storage — fall through to a fresh seed */
  }
  const { events, seats } = seedEvents()
  db = { events, seats, holds: [], others: {}, lastTick: {}, bookings: seedPastBookings() }
  save()
  return db
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
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', date: new Date().toUTCString() } })
}
const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) => json(status, { code, message, ...extra })

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
  if (demoControls.latency === 'fast') return 120 + Math.random() * 200
  return kind === 'poll' ? 300 + Math.random() * 700 : 2000 + Math.random() * 1000
}

/** Advance the simulated crowd: other people grab, buy and release seats over time. */
function tick(eventId: string) {
  const d = load()
  const now = Date.now()
  const seats = d.seats[eventId]
  const event = d.events.find((e) => e.id === eventId)
  if (!seats || !event) return
  const others = (d.others[eventId] ??= [])
  for (const h of others.filter((o) => o.until <= now)) {
    const seat = seats.find((s) => s.id === h.seatId)
    if (seat && seat.status === 'held' && !seat.heldByMe) seat.status = h.outcome
  }
  d.others[eventId] = others.filter((o) => o.until > now)
  for (const hold of d.holds.filter((h) => h.eventId === eventId && Date.parse(h.expiresAt) <= now)) {
    for (const s of seats) {
      if (hold.seatIds.includes(s.id) && s.heldByMe) {
        s.status = 'available'
        delete s.heldByMe
      }
    }
  }
  d.holds = d.holds.filter((h) => Date.parse(h.expiresAt) > now)

  const last = d.lastTick[eventId] ?? now - 3000
  const steps = Math.min(Math.floor((now - last) / 1800), 6)
  if (steps > 0) d.lastTick[eventId] = now
  if (demoControls.live && steps > 0) {
    const available = seats.filter((s) => s.status === 'available')
    const groups = Math.round(steps * (0.5 + Math.random()))
    for (let g = 0; g < groups && available.length > 8; g++) {
      // People arrive in groups of 1–4 and sit together.
      const start = available.splice(Math.floor(Math.random() * available.length), 1)[0]
      if (!start) continue
      const size = 1 + Math.floor(Math.random() * Math.random() * 4)
      const group = [start]
      for (const s of seats) {
        if (group.length >= size) break
        if (s.r === start.r && s.status === 'available' && Math.abs(s.col - start.col) <= size && s !== start) group.push(s)
      }
      const until = now + 4_000 + Math.random() * 14_000
      const outcome = Math.random() < 0.7 ? 'booked' : 'available'
      for (const s of group) {
        s.status = 'held'
        d.others[eventId]?.push({ seatId: s.id, until, outcome })
        const i = available.indexOf(s)
        if (i >= 0) available.splice(i, 1)
      }
    }
    // Keep shows from selling out completely during a long demo.
    if (available.length < seats.length * 0.12) {
      for (const s of seats.filter((x) => x.status === 'booked' && !x.mine).slice(0, 6)) s.status = 'available'
    }
  }
  event.seatsLeft = seats.filter((s) => s.status === 'available').length
  save()
}

/* ------------------------------------------------------------ Accounts */
// Accounts created with POST /auth/register live in this browser (a stand-in for the organizer's user store).
interface Account { id: string; name: string; email: string; hash: string; createdAt: string }
const USERS_KEY = 'seatlock-mock-users'
type Owned = Booking & { owner?: string }

function accounts(): Account[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as Account[]
  } catch {
    return []
  }
}
function saveAccounts(list: Account[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(list))
  } catch {
    /* storage blocked */
  }
}
async function hash(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`seatlock:${pw}`))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}
function publicUser(id: string): { id: string; name: string; email: string } | null {
  if (id === SEEDED_STUDENT.id) {
    const override = accounts().find((a) => a.id === id)
    return { id, name: override?.name ?? SEEDED_STUDENT.name, email: SEEDED_STUDENT.email }
  }
  const a = accounts().find((x) => x.id === id)
  return a ? { id: a.id, name: a.name, email: a.email } : null
}

/** The signed-in user id from the bearer token, or null. */
function auth(init: RequestInit): string | null {
  const m = new Headers(init.headers).get('authorization')?.match(/^Bearer mock-token-(.+)$/)
  const id = m?.[1]
  return id && publicUser(id) ? id : null
}
const ownerOf = (b: Booking) => (b as Owned).owner ?? SEEDED_STUDENT.id

function aiStream(req: AiAssistRequest, signal?: AbortSignal | null): Response {
  const slow = demoControls.aiSlowNext || /\bslow\b/i.test(req.prompt)
  const stale = demoControls.aiStaleNext
  demoControls.aiSlowNext = false
  demoControls.aiStaleNext = false
  const open = req.seats.filter((s) => s.status === 'available').length
  const steps = ['Reading your request…', `Checking ${open} open seats and live prices…`, req.kind === 'cinema' ? 'Scoring rows for sightline, distance and budget…' : 'Scoring seats for window, legroom and budget…']
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const text of steps) {
          await wait(slow ? 3500 : 400 + Math.random() * 450, signal)
          controller.enqueue(enc.encode(JSON.stringify({ type: 'progress', text }) + '\n'))
        }
        await wait(250, signal)
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
  if (demoControls.failures && path !== '/ai/assist' && Math.random() < 0.05) return err(503, 'server_error', 'Service temporarily unavailable')

  const d = load()

  if (method === 'POST' && path === '/auth/login') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const pw = String(body.password ?? '')
    if (email === SEEDED_STUDENT.email && pw === SEEDED_STUDENT.password) {
      return json(200, { token: `mock-token-${SEEDED_STUDENT.id}`, user: publicUser(SEEDED_STUDENT.id) })
    }
    const acct = accounts().find((a) => a.email === email && a.id !== SEEDED_STUDENT.id)
    if (!acct || acct.hash !== (await hash(pw))) return err(401, 'invalid_credentials', 'That email and password don’t match.')
    return json(200, { token: `mock-token-${acct.id}`, user: publicUser(acct.id) })
  }

  if (method === 'POST' && path === '/auth/register') {
    const name = String(body.name ?? '').trim().replace(/\s+/g, ' ')
    const email = String(body.email ?? '').trim().toLowerCase()
    const pw = String(body.password ?? '')
    if (name.length < 2) return err(422, 'validation', 'Enter your full name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(422, 'validation', 'Enter a valid email address.')
    if (pw.length < 8 || !/[a-z]/i.test(pw) || !/\d/.test(pw)) return err(422, 'validation', 'Use at least 8 characters with a letter and a number.')
    const list = accounts()
    if (email === SEEDED_STUDENT.email || list.some((a) => a.email === email)) return err(409, 'email_taken', 'An account with this email already exists.')
    const acct: Account = { id: `usr_${Math.random().toString(36).slice(2, 10)}`, name, email, hash: await hash(pw), createdAt: new Date().toISOString() }
    saveAccounts([...list, acct])
    return json(201, { token: `mock-token-${acct.id}`, user: publicUser(acct.id) })
  }

  const uid = auth(init)
  if (!uid) return err(401, 'unauthorized', 'Please sign in again.')

  if (method === 'PATCH' && path === '/me') {
    const name = String(body.name ?? '').trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 60) return err(422, 'validation', 'Your name should be 2–60 characters.')
    const list = accounts()
    const existing = list.find((a) => a.id === uid)
    if (existing) existing.name = name
    else list.push({ id: uid, name, email: SEEDED_STUDENT.email, hash: '', createdAt: new Date().toISOString() })
    saveAccounts(list)
    return json(200, { user: publicUser(uid) })
  }

  let m: RegExpMatchArray | null

  if (method === 'GET' && path === '/events') {
    d.events.forEach((e) => tick(e.id))
    const events = d.events.map(({ description: _d, organizer: _o, tags: _t, rating: _r, language: _l, cast: _c, stops: _s, ...summary }) => summary)
    return json(200, { events })
  }

  if (method === 'GET' && (m = path.match(/^\/events\/([^/]+)$/))) {
    const ev = d.events.find((e) => e.id === m?.[1])
    return ev ? json(200, ev) : err(404, 'not_found', 'We couldn’t find that show or trip.')
  }

  if (method === 'GET' && (m = path.match(/^\/events\/([^/]+)\/seats$/))) {
    const id = m[1] ?? ''
    if (!d.seats[id]) return err(404, 'not_found', 'We couldn’t find that show or trip.')
    tick(id)
    // "Yours" is per account: holds and bookings of the signed-in user only.
    const mineIds = new Set(d.bookings.filter((b) => ownerOf(b) === uid && b.eventId === id && b.status === 'confirmed').flatMap((b) => b.seats.map((x) => x.id)))
    const heldIds = new Set(d.holds.filter((h) => h.userId === uid && h.eventId === id).flatMap((h) => h.seatIds))
    const seats = (d.seats[id] ?? []).map(({ heldByMe: _h, mine: _m, ...s }) => ({ ...s, ...(heldIds.has(s.id) ? { heldByMe: true } : {}), ...(mineIds.has(s.id) ? { mine: true } : {}) }))
    return json(200, { eventId: id, seats, updatedAt: new Date().toISOString() })
  }

  if (method === 'POST' && (m = path.match(/^\/events\/([^/]+)\/hold$/))) {
    const id = m[1] ?? ''
    const seats = d.seats[id]
    if (!seats) return err(404, 'not_found', 'We couldn’t find that show or trip.')
    tick(id)
    const seatIds = Array.isArray(body.seatIds) ? body.seatIds.map(String) : []
    if (seatIds.length < 1 || seatIds.length > 4) return err(422, 'validation', 'You can hold between 1 and 4 seats.')
    for (const h of d.holds.filter((h) => h.eventId === id)) {
      for (const s of seats) if (h.seatIds.includes(s.id) && s.heldByMe) { s.status = 'available'; delete s.heldByMe }
    }
    d.holds = d.holds.filter((h) => h.eventId !== id)
    let conflicting = seatIds.filter((sid) => seats.find((s) => s.id === sid)?.status !== 'available')
    if (conflicting.length === 0 && (demoControls.forceConflictNext || (demoControls.failures && Math.random() < 0.08))) {
      demoControls.forceConflictNext = false
      const victim = seatIds[Math.floor(Math.random() * seatIds.length)] ?? seatIds[0] ?? ''
      const seat = seats.find((s) => s.id === victim)
      if (seat) seat.status = 'held'
      ;(d.others[id] ??= []).push({ seatId: victim, until: Date.now() + 40_000, outcome: 'booked' })
      conflicting = [victim]
    }
    if (conflicting.length) {
      save()
      return err(409, 'conflict', `Seat${conflicting.length > 1 ? 's' : ''} ${conflicting.join(', ')} ${conflicting.length > 1 ? 'were' : 'was'} just taken by someone else.`, { conflictingSeatIds: conflicting })
    }
    const ttl = demoControls.shortHoldNext ? 75_000 : HOLD_MS
    demoControls.shortHoldNext = false
    const hold: MyHold = {
      id: `HLD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      eventId: id,
      seatIds,
      total: seatIds.reduce((t, sid) => t + (seats.find((s) => s.id === sid)?.price ?? 0), 0),
      expiresAt: new Date(Date.now() + ttl).toISOString(),
      userId: uid,
    }
    for (const s of seats) if (seatIds.includes(s.id)) { s.status = 'held'; s.heldByMe = true }
    d.holds.push(hold)
    save()
    const { userId: _u, ...pub } = hold
    return json(201, { hold: pub, serverTime: new Date().toISOString() })
  }

  if (method === 'POST' && (m = path.match(/^\/holds\/([^/]+)\/confirm$/))) {
    const hold = d.holds.find((h) => h.id === m?.[1] && h.userId === uid)
    if (!hold || Date.parse(hold.expiresAt) <= Date.now()) {
      if (hold) tick(hold.eventId)
      return err(410, 'hold_expired', 'Your 5-minute hold expired and the seats were released.')
    }
    const seats = d.seats[hold.eventId] ?? []
    const event = d.events.find((e) => e.id === hold.eventId)
    for (const s of seats) if (hold.seatIds.includes(s.id)) { s.status = 'booked'; s.mine = true; delete s.heldByMe }
    const booking: Booking = {
      id: `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      eventId: hold.eventId,
      event: { kind: event?.kind ?? 'cinema', title: event?.title ?? '', venue: event?.venue ?? '', startsAt: event?.startsAt ?? '', durationMinutes: event?.durationMinutes ?? 120 },
      seats: hold.seatIds.map((sid) => {
        const s = seats.find((x) => x.id === sid)
        return { id: sid, price: s?.price ?? 0, tier: s?.section ?? '' }
      }),
      total: hold.total,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    }
    d.bookings.unshift({ ...booking, owner: uid } as Owned)
    d.holds = d.holds.filter((h) => h.id !== hold.id)
    save()
    return json(201, { booking })
  }

  if (method === 'GET' && path === '/me/bookings') return json(200, { bookings: d.bookings.filter((b) => ownerOf(b) === uid) })

  if (method === 'DELETE' && (m = path.match(/^\/bookings\/([^/]+)$/))) {
    const booking = d.bookings.find((b) => b.id === m?.[1] && ownerOf(b) === uid)
    if (!booking) return err(404, 'not_found', 'Booking not found.')
    booking.status = 'cancelled'
    for (const s of d.seats[booking.eventId] ?? []) {
      if (booking.seats.some((x) => x.id === s.id)) {
        s.status = 'available'
        delete s.mine
      }
    }
    save()
    return json(200, { booking })
  }

  if (method === 'POST' && path === '/ai/assist') return aiStream(body as unknown as AiAssistRequest, init.signal)

  return err(404, 'not_found', `No mock route for ${method} ${path}`)
}

/** Demo helper: make someone else grab one seat right now. */
export function stealSeat(eventId: string, seatId: string) {
  const d = load()
  const seat = d.seats[eventId]?.find((s) => s.id === seatId)
  if (!seat || seat.status !== 'available') return
  seat.status = 'held'
  ;(d.others[eventId] ??= []).push({ seatId, until: Date.now() + 45_000, outcome: 'booked' })
  save()
}
