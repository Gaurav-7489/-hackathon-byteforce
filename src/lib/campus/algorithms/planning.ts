import type { Booking, EventSummary } from '../../api/types'
import { HIST_CANCEL_RATE, INTEREST_CATEGORY } from '../data'
import type { Preferences, ScheduleItem, SplitParticipant, SplitPlan, TimeOfDay } from '../types'

/* ======================================================================
   Schedule conflict detection (all local)
   ====================================================================== */

export interface Occurrence {
  item: ScheduleItem
  start: Date
  end: Date
}

const atTime = (base: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(base)
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  return d
}

const parseDate = (ymd: string) => {
  const [y, mo, d] = ymd.split('-').map(Number)
  return new Date(y ?? 1970, (mo ?? 1) - 1, d ?? 1)
}

/** Expand weekly classes and one-off items into concrete occurrences inside [from, to]. */
export function expandSchedule(items: readonly ScheduleItem[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = []
  for (const item of items) {
    if (item.kind === 'class' && item.weekday !== undefined) {
      const day = new Date(from)
      day.setHours(0, 0, 0, 0)
      while (day <= to) {
        if (day.getDay() === item.weekday) {
          const start = atTime(day, item.start)
          let end = atTime(day, item.end)
          if (end <= start) end = new Date(start.getTime() + 60 * 60_000)
          if (end >= from && start <= to) out.push({ item, start, end })
        }
        day.setDate(day.getDate() + 1)
      }
    } else if (item.date) {
      const day = parseDate(item.date)
      const start = atTime(day, item.start)
      let end = atTime(day, item.end)
      if (end <= start) end = new Date(start.getTime() + 60 * 60_000)
      if (end >= from && start <= to) out.push({ item, start, end })
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

export interface Conflict {
  item: ScheduleItem
  start: Date
  end: Date
  overlapMinutes: number
  kind: 'full' | 'partial'
}

/** Overlaps between an event window and the student's commitments. Touching edges are not conflicts. */
export function findConflicts(start: Date, end: Date, items: readonly ScheduleItem[]): Conflict[] {
  const occ = expandSchedule(items, new Date(start.getTime() - 86_400_000), new Date(end.getTime() + 86_400_000))
  const out: Conflict[] = []
  for (const o of occ) {
    const s = Math.max(o.start.getTime(), start.getTime())
    const e = Math.min(o.end.getTime(), end.getTime())
    if (e <= s) continue
    const overlapMinutes = Math.round((e - s) / 60_000)
    const full = o.start <= start && o.end >= end
    out.push({ item: o.item, start: o.start, end: o.end, overlapMinutes, kind: full ? 'full' : 'partial' })
  }
  return out
}

export function eventWindow(e: { startsAt: string; durationMinutes?: number }) {
  const start = new Date(e.startsAt)
  return { start, end: new Date(start.getTime() + (e.durationMinutes ?? 120) * 60_000) }
}

/** Same-category events that do not clash with the schedule (alternative sessions). */
export function alternativeSessions(target: EventSummary, events: readonly EventSummary[], items: readonly ScheduleItem[]): EventSummary[] {
  return events
    .filter((e) => e.id !== target.id && e.category === target.category && e.seatsLeft > 0 && Date.parse(e.startsAt) > Date.now())
    .filter((e) => {
      const w = eventWindow(e)
      return findConflicts(w.start, w.end, items).length === 0
    })
    .slice(0, 3)
}

/* ---------- .ics import / export ---------- */

function icsDate(v: string): Date | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return null
  const [, y, mo, d, h = '0', mi = '0', s = '0', z] = m
  if (z) return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +s))
  return new Date(+y!, +mo! - 1, +d!, +h, +mi, +s)
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Minimal iCalendar reader: VEVENT blocks with DTSTART / DTEND / SUMMARY, and
 * RRULE:FREQ=WEEKLY treated as a recurring class. Unsupported fields are ignored.
 */
export function parseIcs(text: string, idPrefix = 'ics'): ScheduleItem[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const blocks = unfolded.split(/BEGIN:VEVENT/i).slice(1)
  const out: ScheduleItem[] = []
  blocks.forEach((block, i) => {
    const body = block.split(/END:VEVENT/i)[0] ?? ''
    const field = (name: string) => {
      const m = body.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, 'im'))
      return m?.[1]?.trim() ?? null
    }
    const start = icsDate(field('DTSTART') ?? '')
    const endRaw = field('DTEND')
    const end = endRaw ? icsDate(endRaw) : start ? new Date(start.getTime() + 3_600_000) : null
    if (!start || !end) return
    const title = (field('SUMMARY') ?? 'Imported event').replace(/\\([,;\\])/g, '$1').slice(0, 80)
    const weekly = /FREQ=WEEKLY/i.test(field('RRULE') ?? '')
    const exam = /exam|quiz|test|midsem|endsem|viva/i.test(title)
    out.push({
      id: `${idPrefix}-${i}-${start.getTime()}`,
      kind: weekly ? 'class' : exam ? 'exam' : 'commitment',
      title,
      ...(weekly ? { weekday: start.getDay() } : { date: ymd(start) }),
      start: hhmm(start),
      end: hhmm(end),
      source: 'ics',
    })
  })
  return out
}

export function icsForBookings(bookings: readonly Booking[]): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s: string) => s.replace(/[,;\\]/g, (m) => `\\${m}`)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SeatLock//Bookings//EN']
  for (const b of bookings) {
    if (b.status !== 'confirmed') continue
    const start = new Date(b.event.startsAt)
    const end = new Date(start.getTime() + b.event.durationMinutes * 60_000)
    lines.push(
      'BEGIN:VEVENT', `UID:${b.id}@seatlock`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${esc(b.event.title)}`, `LOCATION:${esc(b.event.venue)}`,
      `DESCRIPTION:${esc(`Booking ${b.id} · Seats ${b.seats.map((s) => s.id).join(' ')}`)}`, 'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ======================================================================
   One-tap group expense splitting (whole rupees, deterministic)
   ====================================================================== */

export function equalShares(total: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(total / n)
  const rem = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0))
}

export function computeSplit(
  mode: SplitPlan['mode'],
  total: number,
  participants: readonly SplitParticipant[],
  seatPrices: Record<string, number>,
): SplitParticipant[] {
  if (mode === 'equal') {
    const shares = equalShares(total, participants.length)
    return participants.map((p, i) => ({ ...p, amount: shares[i] ?? 0 }))
  }
  if (mode === 'seat') return participants.map((p) => ({ ...p, amount: p.seatId ? seatPrices[p.seatId] ?? 0 : 0 }))
  return participants.map((p) => ({ ...p }))
}

export function validateSplit(total: number, participants: readonly SplitParticipant[]): string[] {
  const errors: string[] = []
  if (participants.length === 0) errors.push('Add at least one person.')
  if (participants.some((p) => !p.name.trim())) errors.push('Every person needs a name.')
  if (participants.some((p) => !Number.isFinite(p.amount) || p.amount < 0)) errors.push('Amounts must be zero or more.')
  const sum = participants.reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0)
  if (sum !== total) errors.push(sum > total ? `Shares add up to ₹${sum}, which is ₹${sum - total} more than the ₹${total} total.` : `Shares add up to ₹${sum}; ₹${total - sum} is still unassigned.`)
  return errors
}

export function outstanding(participants: readonly SplitParticipant[]): number {
  return participants.filter((p) => !p.settled && p.name !== 'You').reduce((s, p) => s + p.amount, 0)
}

export function splitSummaryText(eventTitle: string, total: number, participants: readonly SplitParticipant[]): string {
  const lines = [`SeatLock split — ${eventTitle} (₹${total} total)`]
  for (const p of participants) lines.push(`• ${p.name}${p.seatId ? ` (${p.seatId})` : ''}: ₹${p.amount}${p.settled ? ' — settled' : ''}`)
  lines.push('Demo request only — no payment has been made through SeatLock.')
  return lines.join('\n')
}

/* ======================================================================
   Explainable event matchmaker (deterministic, no paid model)
   ====================================================================== */

export function timeOfDay(iso: string): TimeOfDay {
  const h = new Date(iso).getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
}

export interface MatchResult {
  event: EventSummary
  score: number
  reasons: string[]
  cautions: string[]
}

export function scoreEvent(
  event: EventSummary,
  prefs: Pick<Preferences, 'interests' | 'categories' | 'budget' | 'times'>,
  ctx: { pastCategories: readonly string[]; conflicts: number },
): MatchResult {
  const reasons: string[] = []
  const cautions: string[] = []
  let score = 0
  const interestCats = new Set(prefs.interests.flatMap((i) => INTEREST_CATEGORY[i] ?? []))
  const matchedInterests = prefs.interests.filter((i) => (INTEREST_CATEGORY[i] ?? []).includes(event.category))
  if (prefs.categories.includes(event.category)) { score += 30; reasons.push(`You follow ${event.category}`) }
  if (interestCats.has(event.category)) {
    score += 15
    if (matchedInterests.length) reasons.push(`Matches your interest in ${matchedInterests.slice(0, 2).join(' & ')}`)
  }
  const text = `${event.title} ${event.subtitle}`.toLowerCase()
  const keyword = prefs.interests.find((i) => text.includes(i))
  if (keyword) { score += 5; reasons.push(`Mentions “${keyword}”`) }
  if (event.priceFrom <= prefs.budget) {
    score += 20
    reasons.push(event.priceFrom === 0 ? 'Free entry' : `Seats from ₹${event.priceFrom}, within your ₹${prefs.budget} budget`)
  } else cautions.push(`Cheapest seat ₹${event.priceFrom} is above your ₹${prefs.budget} budget`)
  const tod = timeOfDay(event.startsAt)
  if (prefs.times.length === 0 || prefs.times.includes(tod)) { score += 15; if (prefs.times.length) reasons.push(`An ${tod} slot you prefer`) } else cautions.push(`Starts in the ${tod}`)
  if (event.seatsLeft === 0) { cautions.push('Sold out — waitlist only'); score -= 5 } else { score += 10; if (event.seatsLeft / event.totalSeats < 0.2) cautions.push(`Only ${event.seatsLeft} seats left`) }
  if (ctx.pastCategories.includes(event.category)) { score += 10; reasons.push(`You enjoyed ${event.category} events before`) }
  if (ctx.conflicts > 0) { score -= 25; cautions.push('Clashes with your schedule') }
  return { event, score: Math.max(0, Math.min(100, score)), reasons, cautions }
}

export function recommendEvents(
  events: readonly EventSummary[],
  prefs: Pick<Preferences, 'interests' | 'categories' | 'budget' | 'times'>,
  ctx: { pastCategories: readonly string[]; conflictsFor: (e: EventSummary) => number },
): MatchResult[] {
  return events
    .filter((e) => Date.parse(e.startsAt) > Date.now() - 3_600_000)
    .map((e) => scoreEvent(e, prefs, { pastCategories: ctx.pastCategories, conflicts: ctx.conflictsFor(e) }))
    .sort((a, b) => b.score - a.score || Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt))
}

/* ======================================================================
   Waitlist chance (demo estimate from a simulated historical dataset)
   ====================================================================== */

function poissonAtLeast(k: number, lambda: number): number {
  if (k <= 0) return 1
  let term = Math.exp(-lambda)
  let cdf = term
  for (let i = 1; i < k; i++) {
    term *= lambda / i
    cdf += term
  }
  return Math.max(0, Math.min(1, 1 - cdf))
}

/** P(at least `position` seats get released before the event), Poisson approximation. */
export function waitlistChance(input: { position: number; capacity: number; category: string; daysUntil: number }): number {
  const rate = HIST_CANCEL_RATE[input.category] ?? 0.07
  const timeFactor = Math.min(1, (Math.max(0, input.daysUntil) + 1) / 10)
  const lambda = input.capacity * rate * timeFactor
  return poissonAtLeast(input.position, lambda)
}

/* ======================================================================
   Verified exchange — return policy
   ====================================================================== */

export interface ReturnPolicy {
  eligible: boolean
  refundPercent: number
  label: string
}

export function returnPolicy(startsAt: string, now = Date.now()): ReturnPolicy {
  const hours = (Date.parse(startsAt) - now) / 3_600_000
  if (hours <= 0) return { eligible: false, refundPercent: 0, label: 'The event has started — returns are closed.' }
  if (hours < 2) return { eligible: false, refundPercent: 0, label: 'Returns close 2 hours before doors.' }
  if (hours < 24) return { eligible: true, refundPercent: 50, label: 'Less than 24 h to go: 50% demo credit.' }
  if (hours < 48) return { eligible: true, refundPercent: 75, label: '24–48 h to go: 75% demo credit.' }
  return { eligible: true, refundPercent: 100, label: 'More than 48 h to go: full demo credit.' }
}
