import { describe, expect, it } from 'vitest'
import { layoutFor } from '../booking/data'
import { parseIntent, recommend } from '../lib/api/mock/ai'
import { seedEvents } from '../lib/api/mock/data'
import type { Seat } from '../lib/api/types'
import { isSelectable, neighbour, suggestAlternative } from '../lib/seats'

describe('seat layouts', () => {
  it('builds the cinema hall with three tiers and unique ids', () => {
    const l = layoutFor('cinema')
    expect(l.seats).toHaveLength(196)
    expect(new Set(l.seats.map((s) => s.tier))).toEqual(new Set(['classic', 'prime', 'recliner']))
    expect(l.index.size).toBe(l.seats.length)
  })

  it('builds the 2+2 coach with window, aisle and a rear bench', () => {
    const l = layoutFor('bus')
    expect(l.seats).toHaveLength(45)
    expect(l.seats.filter((s) => s.tier === 'rear')).toHaveLength(5)
    expect(l.seats.filter((s) => s.tags.includes('Women only')).length).toBeGreaterThan(0)
  })
})

describe('seeded catalogue', () => {
  const { events, seats } = seedEvents()
  it('has cinema shows and bus trips, all in the future', () => {
    expect(events.some((e) => e.kind === 'cinema')).toBe(true)
    expect(events.some((e) => e.kind === 'bus')).toBe(true)
    expect(events.every((e) => Date.parse(e.startsAt) > Date.now())).toBe(true)
  })
  it('gives every event a full seat inventory with blocked seats', () => {
    for (const e of events) {
      expect(seats[e.id]).toHaveLength(e.totalSeats)
      expect(seats[e.id]!.some((s) => s.status === 'blocked')).toBe(true)
    }
  })
})

const S = (id: string, r: number, col: number, status: Seat['status'] = 'available', section = 'prime'): Seat => ({
  id, row: String.fromCharCode(65 + r), r, number: col + 1, col, section, price: 200, status, isAisle: false, tags: [],
})

describe('seat rules', () => {
  const grid = [S('A1', 0, 0), S('A2', 0, 1), S('A3', 0, 3), S('B1', 1, 0), S('B2', 1, 1, 'booked'), S('B3', 1, 3)]

  it('moves across aisles with the arrow keys', () => {
    expect(neighbour(grid, 'A2', 'right')?.id).toBe('A3')
    expect(neighbour(grid, 'A1', 'down')?.id).toBe('B1')
    expect(neighbour(grid, 'A1', 'up')).toBeNull()
  })

  it('suggests the nearest free seat when one is lost', () => {
    const lost = grid[4]!
    expect(suggestAlternative(lost, grid, new Set(['B1']))?.id).toBe('B3')
  })

  it('treats my own hold as selectable', () => {
    expect(isSelectable({ ...S('C1', 2, 0, 'held'), heldByMe: true })).toBe(true)
    expect(isSelectable(S('C2', 2, 1, 'held'))).toBe(false)
  })
})

describe('AI assistant (mock endpoint)', () => {
  it('understands English and Hinglish', () => {
    expect(parseIntent('2 seats together near the screen under ₹300')).toMatchObject({ count: 2, budget: 300, front: true, together: true })
    expect(parseIntent('ek khidki wali seat aage')).toMatchObject({ count: 1, window: true, front: true })
    expect(parseIntent('do sasti seats saath mein')).toMatchObject({ count: 2, cheapest: true, together: true })
  })

  it('only suggests available seats within the limit', () => {
    const { events, seats } = seedEvents()
    const ev = events.find((e) => e.kind === 'bus')!
    const ctx = seats[ev.id]!.map(({ heldByMe: _h, mine: _m, col: _c, ...s }) => s)
    const res = recommend({ eventId: ev.id, kind: 'bus', prompt: '2 window seats together', maxSeats: 4, selectedSeatIds: [], seats: ctx, history: [] })
    expect(res.seatIds.length).toBeLessThanOrEqual(4)
    for (const id of res.seatIds) expect(ctx.find((s) => s.id === id)?.status).toBe('available')
    expect(res.reason.length).toBeGreaterThan(5)
  })
})
