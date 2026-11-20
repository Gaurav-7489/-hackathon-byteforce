import { describe, expect, it } from 'vitest'
import { generateSeats } from '../lib/api/mock/data'
import type { Seat } from '../lib/api/types'
import { venueByName, VENUES } from '../lib/campus/data'
import {
  computeSplit, equalShares, expandSchedule, findConflicts, parseIcs, recommendEvents, returnPolicy, scoreEvent,
  validateSplit, waitlistChance,
} from '../lib/campus/algorithms/planning'
import { findRoute } from '../lib/campus/algorithms/route'
import {
  accessibilityAvailability, computeTraits, estimateView, findGroupArrangements, matchAccessible, planBudget, rankComfort,
  rankReplacements,
} from '../lib/campus/algorithms/seating'
import {
  buildAttendance, crowdAt, eligibleNoShows, forecast, makeQueueStudents, runQueue, simulateLoad, suggestGate,
} from '../lib/campus/algorithms/simulation'
import { CampusStateSchema } from '../lib/campus/types'
import { defaultCampusState } from '../lib/campus/store'
import { isSelectable } from '../lib/seats'

const venue = venueByName('Main Auditorium')!
const allFree = (): Seat[] => generateSeats('t', 300, 0).map((s) => ({ ...s, status: 'available' as const }))
const mixed = () => generateSeats('neon-monsoon', 300, 0.55)

describe('Smart Buddy Seating', () => {
  it('returns adjacent same-row seats within budget and never more than 4', () => {
    const seats = mixed()
    const res = findGroupArrangements(seats, { size: 4, maxPricePerSeat: 300, preferAdjacent: true, preferSameRow: true })
    expect(res.length).toBeGreaterThan(0)
    for (const a of res) {
      expect(a.seatIds.length).toBe(4)
      for (const id of a.seatIds) {
        const s = seats.find((x) => x.id === id)!
        expect(isSelectable(s)).toBe(true)
        expect(s.price).toBeLessThanOrEqual(300)
      }
    }
    const best = res[0]!
    expect(best.together).toBe(true)
    const nums = best.seatIds.map((id) => seats.find((s) => s.id === id)!.number).sort((a, b) => a - b)
    nums.forEach((n, i) => i && expect(n).toBe(nums[i - 1]! + 1))
  })

  it('clamps the group size to 4 and excludes booked/held/blocked seats', () => {
    const seats = mixed()
    const res = findGroupArrangements(seats, { size: 9, maxPricePerSeat: null, preferAdjacent: true, preferSameRow: true })
    expect(res.every((a) => a.seatIds.length === 4)).toBe(true)
    const bad = new Set(seats.filter((s) => !isSelectable(s)).map((s) => s.id))
    expect(res.flatMap((a) => a.seatIds).some((id) => bad.has(id))).toBe(false)
  })

  it('falls back to split arrangements when no row has 4 together', () => {
    // Only pairs available: every third seat booked.
    const seats = allFree().map((s) => (s.number % 3 === 0 ? { ...s, status: 'booked' as const } : s))
    const res = findGroupArrangements(seats, { size: 4, maxPricePerSeat: null, preferAdjacent: true, preferSameRow: true })
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.together).toBe(false)
  })
})

describe('Accessibility-first matching', () => {
  it('only offers organizer-designated wheelchair spaces, plus companion seat', () => {
    const seats = allFree()
    const prefs = { ...defaultCampusState().prefs.access, wheelchair: true, companion: true }
    const res = matchAccessible(seats, venue, prefs, 2)
    expect(res.length).toBeGreaterThan(0)
    for (const m of res) {
      expect(venue.wheelchairSpaces).toContain(m.seatIds[0])
      expect(venue.companionSeats).toContain(m.seatIds[1])
    }
  })

  it('explains when no wheelchair space is free', () => {
    const seats = allFree().map((s) => (venue.wheelchairSpaces.includes(s.id) ? { ...s, status: 'booked' as const } : s))
    const res = matchAccessible(seats, venue, { ...defaultCampusState().prefs.access, wheelchair: true }, 1)
    expect(res[0]!.seatIds).toEqual([])
    expect(res[0]!.warnings[0]).toMatch(/taken/)
    expect(accessibilityAvailability(seats, venue).wheelchairFree).toBe(0)
  })

  it('step-free preference prefers listed step-free rows', () => {
    const res = matchAccessible(allFree(), venue, { ...defaultCampusState().prefs.access, stepFree: true }, 2)
    const row = res[0]!.seatIds[0]!.replace(/\d+/, '')
    expect(venue.stepFreeRows).toContain(row)
  })
})

describe('QuietZone, view and AutoRescue', () => {
  it('quiet preference ranks organizer quiet-zone seats first', () => {
    const res = rankComfort(allFree(), venue, { quieter: true, lessCrowded: false, easyExit: false, lowNoise: true, personalSpace: false }, 1)
    const t = computeTraits(allFree(), venue).get(res[0]!.seatIds[0]!)!
    expect(t.quietZone).not.toBeNull()
  })

  it('estimates the view with listed obstructions penalised', () => {
    const v = venueByName('Seminar Hall B')!
    const seats = allFree()
    const blocked = estimateView(seats.find((s) => s.id === 'E5')!, v)
    const clear = estimateView(seats.find((s) => s.id === 'E10')!, v)
    expect(blocked.obstruction).not.toBeNull()
    expect(clear.score).toBeGreaterThan(blocked.score)
  })

  it('ranks replacements that keep the group together and explains price differences', () => {
    const seats = allFree()
    const lost = seats.find((s) => s.id === 'D9')!
    const res = rankReplacements(lost, seats, { kept: ['D8'], exclude: new Set(['D8']) })
    expect(res.length).toBe(3)
    // D7 sits beside the kept D8, so the group stays together.
    expect(res[0]!.seat.id).toBe('D7')
    expect(res[0]!.reasons.join(' ')).toMatch(/Next to D8/)
    expect(res[0]!.reasons.join(' ')).toMatch(/Same row/)
    expect(res.every((r) => r.seat.id !== 'D9' && r.seat.id !== 'D8')).toBe(true)
  })
})

describe('Budget planner', () => {
  it('computes deterministic totals and warns when extras exceed the budget', () => {
    const seats = allFree()
    const plan = planBudget({ budget: 1200, tickets: 2, tier: 'any', travelPerPerson: 50, foodPerPerson: 100 }, seats)
    expect(plan.extras).toBe(300)
    expect(plan.perSeatCap).toBe(450)
    expect(plan.recommended).not.toBeNull()
    expect(plan.total).toBe((plan.ticketCost ?? 0) + 300)
    const over = planBudget({ budget: 100, tickets: 2, tier: 'any', travelPerPerson: 100, foodPerPerson: 0 }, seats)
    expect(over.warnings[0]).toMatch(/exceed/)
  })
})

describe('Schedule conflicts', () => {
  const base = new Date()
  base.setDate(base.getDate() + 7)
  base.setHours(0, 0, 0, 0)
  const ymd = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`

  it('detects partial and full overlaps, ignores touching edges', () => {
    const items = [
      { id: 'a', kind: 'exam' as const, title: 'Maths', date: ymd, start: '18:00', end: '20:00' },
      { id: 'b', kind: 'commitment' as const, title: 'Call', date: ymd, start: '21:00', end: '22:00' },
    ]
    const start = new Date(base); start.setHours(19)
    const end = new Date(base); end.setHours(21)
    const c = findConflicts(start, end, items)
    expect(c.map((x) => x.item.id)).toEqual(['a'])
    expect(c[0]!.kind).toBe('partial')
    expect(c[0]!.overlapMinutes).toBe(60)
  })

  it('expands weekly classes', () => {
    const items = [{ id: 'c', kind: 'class' as const, title: 'DSA', weekday: base.getDay(), start: '09:00', end: '10:00' }]
    const to = new Date(base.getTime() + 13 * 86_400_000)
    expect(expandSchedule(items, base, to).length).toBe(2)
  })

  it('parses .ics events and weekly rules', () => {
    const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20261201T090000\r\nDTEND:20261201T100000\r\nSUMMARY:Midsem Exam\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261202T110000\r\nDTEND:20261202T120000\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:Physics\r\nEND:VEVENT\r\nEND:VCALENDAR'
    const items = parseIcs(ics)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ kind: 'exam', date: '2026-12-01', start: '09:00', end: '10:00' })
    expect(items[1]).toMatchObject({ kind: 'class', weekday: new Date(2026, 11, 2).getDay() })
  })
})

describe('Expense split', () => {
  it('splits equally with the remainder distributed and validates sums', () => {
    expect(equalShares(1000, 3)).toEqual([334, 333, 333])
    const ps = computeSplit('equal', 1000, [1, 2, 3].map((i) => ({ id: `${i}`, name: `P${i}`, amount: 0, settled: false })), {})
    expect(validateSplit(1000, ps)).toEqual([])
    expect(validateSplit(1000, ps.map((p) => ({ ...p, amount: 300 })))[0]).toMatch(/unassigned/)
    const bySeat = computeSplit('seat', 750, [{ id: '1', name: 'A', seatId: 'A1', amount: 0, settled: false }, { id: '2', name: 'B', seatId: 'A2', amount: 0, settled: false }], { A1: 450, A2: 300 })
    expect(bySeat.map((p) => p.amount)).toEqual([450, 300])
  })
})

describe('Matchmaker, waitlist chance, return policy', () => {
  const ev = { id: 'x', title: 'Indie night', subtitle: 'indie bands', category: 'Music', venue: 'OAT', startsAt: new Date(Date.now() + 86_400_000 * 3).toISOString().replace(/T.*/, 'T19:30:00'), priceFrom: 200, priceTo: 400, seatsLeft: 50, totalSeats: 200, poster: { hue: 1, accent: 1, motif: 'rings' as const } }
  it('scores matching events higher and explains why', () => {
    const prefs = { interests: ['indie'], categories: ['Music'], budget: 300, times: [] }
    const r = scoreEvent(ev, prefs, { pastCategories: [], conflicts: 0 })
    expect(r.score).toBeGreaterThan(60)
    expect(r.reasons.join(' ')).toMatch(/Music/)
    const worse = scoreEvent({ ...ev, category: 'Tech', priceFrom: 900 }, prefs, { pastCategories: [], conflicts: 1 })
    expect(worse.score).toBeLessThan(r.score)
    expect(recommendEvents([ev], prefs, { pastCategories: [], conflictsFor: () => 0 })[0]!.event.id).toBe('x')
  })
  it('waitlist chance falls as position grows', () => {
    const a = waitlistChance({ position: 1, capacity: 200, category: 'Music', daysUntil: 5 })
    const b = waitlistChance({ position: 15, capacity: 200, category: 'Music', daysUntil: 5 })
    expect(a).toBeGreaterThan(b)
    expect(a).toBeLessThanOrEqual(1)
  })
  it('applies the tiered return policy', () => {
    const now = Date.now()
    expect(returnPolicy(new Date(now + 72 * 3_600_000).toISOString(), now).refundPercent).toBe(100)
    expect(returnPolicy(new Date(now + 30 * 3_600_000).toISOString(), now).refundPercent).toBe(75)
    expect(returnPolicy(new Date(now + 3_600_000).toISOString(), now).eligible).toBe(false)
  })
})

describe('Simulations are deterministic', () => {
  it('fair queue serves slow connections better than FCFS and merges duplicate tabs', () => {
    const students = makeQueueStudents(42)
    const fair = runQueue(students, { mode: 'fair', seats: 40, admitPerSecond: 8, seed: 42 })
    const fcfs = runQueue(students, { mode: 'fcfs', seats: 40, admitPerSecond: 8, seed: 42 })
    const rate = (r: typeof fair) => r.successByConnection.slow.served / Math.max(1, r.successByConnection.slow.total)
    expect(rate(fair)).toBeGreaterThan(rate(fcfs))
    expect(fair.duplicatesMerged).toBeGreaterThan(0)
    expect(runQueue(students, { mode: 'fair', seats: 40, admitPerSecond: 8, seed: 42 }).outcomes).toEqual(fair.outcomes)
  })

  it('load simulation is reproducible and conserves seats', () => {
    const o = { seed: 7, users: 100, seats: 40, durationS: 60, holdTtlS: 20, errorRate: 0.05 }
    const a = simulateLoad(o)
    expect(simulateLoad(o).totals).toEqual(a.totals)
    expect(a.totals.conflicts).toBeGreaterThan(0)
    for (const f of a.frames) expect(f.available + f.held + f.booked).toBe(40)
  })

  it('crowd model overloads the main gate and suggests an alternative', () => {
    const zones = [{ id: 'a', label: 'A', x: 0, y: 0, capacityPerMin: 5 }, { id: 'b', label: 'B', x: 0, y: 0, capacityPerMin: 5 }]
    const loads = crowdAt(zones, -12, 200, 1)
    expect(loads[0]!.waitMin).toBeGreaterThan(loads[1]!.waitMin)
    expect(suggestGate(loads)?.to.zone.id).toBe('b')
    const redirected = crowdAt(zones, -12, 200, 1, 0.5)
    expect(redirected[0]!.waitMin).toBeLessThan(loads[0]!.waitMin)
  })

  it('no-show release respects the deadline and protects accessibility seats', () => {
    const seats = generateSeats('neon-monsoon', 300, 0.55)
    const access = new Set(seats.filter((s) => s.status === 'booked').slice(0, 3).map((s) => s.id))
    const rs = buildAttendance(seats, 3, access, 0.3)
    expect(eligibleNoShows(rs, 5, { deadlineMin: 15, protectAccessible: true })).toEqual([])
    const elig = eligibleNoShows(rs, 20, { deadlineMin: 15, protectAccessible: true })
    expect(elig.length).toBeGreaterThan(0)
    expect(elig.some((r) => access.has(r.seatId))).toBe(false)
  })

  it('forecast extends a trend', () => {
    const f = forecast([100, 90, 80, 70], 2)
    expect(f[0]!).toBeLessThan(70)
  })
})

describe('Campus routing and data', () => {
  it('step-free routes avoid stairs', () => {
    const fast = findRoute('MG', 'AUD', false)!
    const acc = findRoute('MG', 'AUD', true)!
    expect(fast.usesStairs).toBe(true)
    expect(acc.usesStairs).toBe(false)
    expect(acc.metres).toBeGreaterThan(fast.metres)
  })
  it('every venue lists explicit exits and is marked unverified demo data', () => {
    for (const v of VENUES) {
      expect(v.exits.some((e) => e.stepFree)).toBe(true)
      expect(v.verifiedPlan).toBe(false)
    }
  })
  it('default campus state passes its own schema', () => {
    expect(CampusStateSchema.safeParse(defaultCampusState()).success).toBe(true)
  })
})
