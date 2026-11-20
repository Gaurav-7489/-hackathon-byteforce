import { describe, expect, it } from 'vitest'
import { LISTINGS, layoutFor, rng, seedStatuses, simulateStep } from '../booking/data'

describe('seat layouts', () => {
  it('builds the cinema hall with three priced tiers', () => {
    const l = layoutFor('cinema')
    expect(l.seats).toHaveLength(196)
    expect(new Set(l.seats.map((s) => s.tier))).toEqual(new Set(['classic', 'prime', 'recliner']))
    expect(new Set(l.seats.map((s) => s.id)).size).toBe(l.seats.length)
  })

  it('builds the 2+2 coach with a 5-seat rear bench', () => {
    const l = layoutFor('bus')
    expect(l.seats).toHaveLength(45)
    expect(l.seats.filter((s) => s.tier === 'rear')).toHaveLength(5)
    expect(l.seats.some((s) => s.tags.includes('Women only'))).toBe(true)
  })

  it('maps every seat exactly once in the 2D grid', () => {
    for (const mode of ['cinema', 'bus'] as const) {
      const l = layoutFor(mode)
      const cells = l.grid.flat().filter((i): i is number => i !== null)
      expect(cells.sort((a, b) => a - b)).toEqual(l.seats.map((_, i) => i))
    }
  })
})

describe('live simulation', () => {
  it('seeds the same statuses for the same show', () => {
    const l = layoutFor('cinema')
    const slot = LISTINGS.cinema.slots[0]!
    expect(seedStatuses(l, slot)).toEqual(seedStatuses(l, slot))
  })

  it('never touches the viewer’s own seats', () => {
    const l = layoutFor('bus')
    let statuses = seedStatuses(l, LISTINGS.bus.slots[0]!)
    const mine = new Set(statuses.flatMap((s, i) => (s === 'free' ? [i] : [])).slice(0, 4))
    const rand = rng(7)
    for (let t = 0; t < 400; t++) {
      const step = simulateStep(l, statuses, mine, rand)
      for (const c of step.changes) expect(mine.has(c.index)).toBe(false)
      statuses = statuses.slice()
      for (const c of step.changes) statuses[c.index] = c.status
    }
  })
})
