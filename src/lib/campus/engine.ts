import { toast } from 'sonner'
import { api, usingMock } from '../api/client'
import type { Booking, EventDetail, EventSummary, Hold, Seat } from '../api/types'
import { invalidate } from '../resource'
import { returnPolicy } from './algorithms/planning'
import { hashSeed } from './algorithms/simulation'
import { getCampus, notify, uid, updateCampus } from './store'
import type { VaultTicket, WaitlistEntry } from './types'

/**
 * Orchestrates the campus features that touch seat inventory: waitlist offers,
 * verified returns, no-show releases and reminders. Inventory changes go
 * through the mock API module (the single source of seat ownership).
 *
 * Mock mode only: with a real organizer API these flows would be server-side.
 */

const mock = () => import('../api/mock/server')

export const OFFER_MS = 2 * 60_000
const SIM_DECISION_MS = [3500, 6500] as const

/** Simulated number of *other* students waiting for an event (deterministic per event). */
export function simulatedDemand(e: Pick<EventSummary, 'id' | 'seatsLeft' | 'highDemand' | 'totalSeats'>): number {
  const h = hashSeed(e.id) % 7
  if (e.seatsLeft === 0) return 18 + h * 3
  if (e.highDemand) return 6 + h
  return e.seatsLeft / e.totalSeats < 0.15 ? 2 + (h % 3) : 0
}

/* ---------------------------------------------------------------- Waitlist */

export function joinWaitlist(event: Pick<EventSummary, 'id' | 'title' | 'seatsLeft' | 'highDemand' | 'totalSeats'>, seats: number): WaitlistEntry {
  const existing = getCampus().waitlist.find((w) => w.eventId === event.id && (w.status === 'waiting' || w.status === 'offered'))
  if (existing) return existing
  // Keep "ahead" small so the demo resolves within a minute or two.
  const ahead = Math.min(4, 1 + (hashSeed(event.id) % 3))
  const entry: WaitlistEntry = {
    id: uid('wl'), eventId: event.id, eventTitle: event.title, seats: Math.max(1, Math.min(4, seats)),
    joinedAt: new Date().toISOString(), ahead, status: 'waiting',
  }
  updateCampus((d) => { d.waitlist.unshift(entry) })
  notify({ kind: 'waitlist', title: `On the waitlist for ${event.title}`, body: `${ahead} student${ahead > 1 ? 's are' : ' is'} ahead of you. We’ll offer you seats the moment some are released.`, href: '/waitlist' })
  return entry
}

export function leaveWaitlist(id: string) {
  updateCampus((d) => {
    const w = d.waitlist.find((x) => x.id === id)
    if (w && (w.status === 'waiting' || w.status === 'offered')) w.status = 'left'
  })
}

const activeEntry = (eventId: string) =>
  getCampus().waitlist.find((w) => w.eventId === eventId && w.status === 'waiting')

const simTimers = new Set<ReturnType<typeof setTimeout>>()
function later(ms: number, fn: () => void) {
  const t = setTimeout(() => { simTimers.delete(t); fn() }, ms)
  simTimers.add(t)
}

/**
 * Seats were released (return, cancellation, no-show). Route them to the
 * waitlist first: the student's own entry (if any) after the simulated
 * students ahead, otherwise simulated demand, otherwise back to inventory.
 */
export async function routeReleased(event: Pick<EventSummary, 'id' | 'title' | 'seatsLeft' | 'highDemand' | 'totalSeats'>, seatIds: string[]): Promise<'waitlist' | 'inventory'> {
  if (!usingMock || seatIds.length === 0) return 'inventory'
  const m = await mock()
  const entry = activeEntry(event.id)
  const demand = simulatedDemand(event)
  if (!entry && demand === 0) return 'inventory'
  const reserved = m.reserveForWaitlist(event.id, seatIds, OFFER_MS + 60_000)
  if (!reserved.length) return 'inventory'
  if (!entry) {
    // Reissued to a simulated waitlisted student.
    later(3000, () => { void mock().then((mm) => mm.resolveReserved(event.id, reserved, 'booked')) })
    return 'waitlist'
  }
  offerNext(event, reserved)
  return 'waitlist'
}

function offerNext(event: Pick<EventSummary, 'id' | 'title'>, seatIds: string[]) {
  const entry = activeEntry(event.id)
  if (!entry) {
    void mock().then((m) => m.resolveReserved(event.id, seatIds, 'available'))
    return
  }
  if (entry.ahead > 0) {
    const wait = SIM_DECISION_MS[0] + Math.random() * (SIM_DECISION_MS[1] - SIM_DECISION_MS[0])
    later(wait, () => {
      const accepted = Math.random() < 0.5
      updateCampus((d) => {
        const w = d.waitlist.find((x) => x.id === entry.id)
        if (w && w.ahead > 0) w.ahead -= 1
      })
      if (accepted) {
        void mock().then((m) => m.resolveReserved(event.id, seatIds, 'booked'))
        notify({ kind: 'waitlist', title: 'Waitlist moved', body: `A student ahead of you accepted released seats for ${event.title}. You’re now ${Math.max(0, entry.ahead - 1) === 0 ? 'next' : `#${entry.ahead}`}.`, href: '/waitlist' })
      } else {
        notify({ kind: 'waitlist', title: 'Offer passed on', body: `A student ahead declined. The seats move down the list for ${event.title}.`, href: '/waitlist' })
        offerNext(event, seatIds)
      }
    })
    return
  }
  // It's the signed-in student's turn.
  const take = seatIds.slice(0, entry.seats)
  const rest = seatIds.slice(entry.seats)
  if (rest.length) void mock().then((m) => m.resolveReserved(event.id, rest, 'available'))
  const expiresAt = new Date(Date.now() + OFFER_MS).toISOString()
  updateCampus((d) => {
    const w = d.waitlist.find((x) => x.id === entry.id)
    if (w) { w.status = 'offered'; w.offer = { seatIds: take, expiresAt } }
  })
  notify({ kind: 'waitlist', title: `Seats offered: ${event.title}`, body: `${take.join(', ')} are reserved for you for 2 minutes. Accept to move to checkout.`, href: '/waitlist' })
  toast.success(`Waitlist offer for ${event.title}`, { description: `${take.join(', ')} reserved for 2 minutes — open Waitlist to accept.` })
}

/** Accept an offer: the reserved seats become the student's own 5-minute hold. */
export async function acceptOffer(entry: WaitlistEntry): Promise<{ hold: Hold; event: EventDetail; seats: Seat[] } | null> {
  if (!entry.offer || Date.parse(entry.offer.expiresAt) <= Date.now()) return null
  const m = await mock()
  const claimed = m.claimReserved(entry.eventId, entry.offer.seatIds)
  if (!claimed) return null
  const event = await api.event(entry.eventId)
  const inv = m.inventory(entry.eventId)
  updateCampus((d) => {
    const w = d.waitlist.find((x) => x.id === entry.id)
    if (w) w.status = 'accepted'
  })
  invalidate(`seats:${entry.eventId}`)
  return { hold: claimed.hold, event, seats: entry.offer.seatIds.map((id) => inv.find((s) => s.id === id)).filter((s): s is Seat => Boolean(s)) }
}

export async function declineOffer(entry: WaitlistEntry, reason: 'declined' | 'expired') {
  const seatIds = entry.offer?.seatIds ?? []
  updateCampus((d) => {
    const w = d.waitlist.find((x) => x.id === entry.id)
    if (w) { w.status = reason; delete w.offer }
  })
  if (!seatIds.length) return
  const m = await mock()
  // Reassigned to the next (simulated) student on the list.
  later(2500, () => m.resolveReserved(entry.eventId, seatIds, Math.random() < 0.7 ? 'booked' : 'available'))
  if (reason === 'expired') notify({ kind: 'waitlist', title: 'Waitlist offer expired', body: `${seatIds.join(', ')} for ${entry.eventTitle} were offered to the next student.`, href: '/waitlist' })
}

/** Demo control: another student cancels, releasing seats into the waitlist pipeline. */
export async function simulateCancellationFor(event: Pick<EventSummary, 'id' | 'title' | 'seatsLeft' | 'highDemand' | 'totalSeats'>, count: number) {
  const m = await mock()
  const released = m.simulateCancellation(event.id, count)
  if (!released.length) {
    toast.error('No other bookings left to cancel for this event.')
    return
  }
  toast.info(`${released.length} seat${released.length > 1 ? 's' : ''} released`, { description: `Another student cancelled ${released.join(', ')}.` })
  await routeReleased(event, released)
}

/* ---------------------------------------------------------------- Exchange */

export async function returnBooking(booking: Booking): Promise<{ ok: boolean; message: string; updated?: Booking }> {
  const policy = returnPolicy(booking.event.startsAt)
  if (!policy.eligible) return { ok: false, message: policy.label }
  try {
    const updated = await api.cancelBooking(booking.id)
    const seatIds = booking.seats.map((s) => s.id)
    let routed: 'waitlist' | 'inventory' = 'inventory'
    if (usingMock) {
      const m = await mock()
      const ev = m.mockEvents().find((e) => e.id === booking.eventId)
      if (ev) routed = await routeReleased(ev, seatIds)
    }
    const amount = Math.round((booking.total * policy.refundPercent) / 100)
    updateCampus((d) => {
      d.exchange.unshift({
        id: uid('ex'), bookingId: booking.id, eventId: booking.eventId, eventTitle: booking.event.title, seatIds,
        kind: routed === 'waitlist' ? 'reissued_to_waitlist' : 'released_to_inventory', refundPercent: policy.refundPercent,
        amount, at: new Date().toISOString(),
        note: routed === 'waitlist' ? 'Offered to the next verified student on the waitlist.' : 'Returned to open inventory.',
      })
      d.vault = d.vault.filter((v) => v.bookingId !== booking.id)
      d.reminders = d.reminders.filter((r) => r.bookingId !== booking.id)
    })
    notify({ kind: 'exchange', title: 'Ticket returned', body: `${booking.event.title}: ₹${amount} demo credit (${policy.refundPercent}%). ${routed === 'waitlist' ? 'Your seats went to the waitlist.' : 'Your seats are back on sale.'}`, href: '/bookings' })
    invalidate('events')
    invalidate(`seats:${booking.eventId}`)
    return { ok: true, message: routed === 'waitlist' ? 'Your seats were offered to the next student on the waitlist.' : 'Your seats are available to other students again.', updated }
  } catch (e) {
    updateCampus((d) => {
      d.exchange.unshift({
        id: uid('ex'), bookingId: booking.id, eventId: booking.eventId, eventTitle: booking.event.title, seatIds: booking.seats.map((s) => s.id),
        kind: 'failed', refundPercent: 0, amount: 0, at: new Date().toISOString(), note: e instanceof Error ? e.message : 'Return failed',
      })
    })
    throw e
  }
}

/* ---------------------------------------------------------------- Vault + reminders */

export function saveToVault(b: Booking) {
  if (b.status !== 'confirmed') return
  const t: VaultTicket = {
    bookingId: b.id, eventId: b.eventId, title: b.event.title, venue: b.event.venue, startsAt: b.event.startsAt,
    durationMinutes: b.event.durationMinutes, seats: b.seats.map((s) => s.id), total: b.total, savedAt: new Date().toISOString(),
  }
  updateCampus((d) => {
    d.vault = [t, ...d.vault.filter((v) => v.bookingId !== b.id)].slice(0, 20)
  })
}

export function scheduleReminder(bookingId: string, title: string, startsAt: string, walkMinutes: number) {
  const fireAt = Date.parse(startsAt) - (walkMinutes + 15) * 60_000
  updateCampus((d) => {
    d.reminders = [...d.reminders.filter((r) => r.bookingId !== bookingId), { id: uid('rem'), bookingId, title, fireAt, fired: false }]
  })
}

let tickerStarted = false
/** One lightweight 5 s ticker for offer expiry and arrival reminders. */
export function startCampusTicker() {
  if (tickerStarted) return () => {}
  tickerStarted = true
  const run = () => {
    const s = getCampus()
    const now = Date.now()
    for (const w of s.waitlist) {
      if (w.status === 'offered' && w.offer && Date.parse(w.offer.expiresAt) <= now) void declineOffer(w, 'expired')
    }
    const due = s.reminders.filter((r) => !r.fired && r.fireAt <= now && r.fireAt > now - 6 * 3_600_000)
    if (due.length) {
      updateCampus((d) => { for (const r of d.reminders) if (due.some((x) => x.id === r.id)) r.fired = true })
      for (const r of due) {
        notify({ kind: 'reminder', title: `Time to head out: ${r.title}`, body: 'Leave now to reach your gate with 15 minutes to spare. Open Campus for your route.', href: '/campus' })
        try {
          if (s.prefs.reminders && 'Notification' in window && Notification.permission === 'granted') new Notification(`SeatLock: ${r.title}`, { body: 'Leave now to reach your gate on time.' })
        } catch {
          /* notifications unavailable */
        }
      }
    }
  }
  run()
  const id = setInterval(run, 5000)
  return () => { clearInterval(id); tickerStarted = false; for (const t of simTimers) clearTimeout(t); simTimers.clear() }
}
