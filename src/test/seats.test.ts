import { describe, expect, it } from 'vitest'
import type { Seat } from '../lib/api/types'
import { effectiveStatus, MAX_SEATS, neighbour, suggestAlternative, totalFor } from '../lib/seats'
import { generateSeats } from '../lib/api/mock/data'

const seats: Seat[] = generateSeats('test-event', 300, 0.4)

describe('seat helpers', () => {
  it('builds a 10 × 20 venue with aisles', () => {
    expect(seats).toHaveLength(200)
    expect(seats.filter((s) => s.row === 'A')).toHaveLength(20)
    expect(seats.find((s) => s.id === 'A5')?.isAisle).toBe(true)
  })

  it('shows the student their own selection and hold', () => {
    const seat = { ...seats[0]!, status: 'held' as const, heldByMe: true }
    expect(effectiveStatus(seat, new Set())).toBe('available')
    expect(effectiveStatus(seat, new Set([seat.id]))).toBe('selected')
    expect(effectiveStatus({ ...seat, heldByMe: false }, new Set())).toBe('held')
  })

  it('navigates with arrow keys across aisle gaps and rows', () => {
    expect(neighbour(seats, 'A5', 'right')?.id).toBe('A6') // jumps the aisle gap
    expect(neighbour(seats, 'A1', 'left')).toBeNull()
    expect(neighbour(seats, 'A3', 'down')?.id).toBe('B3')
    expect(neighbour(seats, 'A3', 'up')).toBeNull()
    expect(neighbour(seats, 'C7', 'home')?.id).toBe('C1')
    expect(neighbour(seats, 'C7', 'end')?.id).toBe('C20')
  })

  it('suggests the nearest available alternative for a lost seat', () => {
    const local = seats.map((s) => ({ ...s, status: 'available' as const }))
    const lost = { ...local.find((s) => s.id === 'D8')!, status: 'held' as const }
    const alt = suggestAlternative(lost, local, new Set(['D9']))
    expect(alt?.row).toBe('D')
    expect(['D7']).toContain(alt?.id)
  })

  it('totals prices and caps at four seats', () => {
    expect(MAX_SEATS).toBe(4)
    const ids = ['A1', 'H1']
    expect(totalFor(ids, seats)).toBe(seats.find((s) => s.id === 'A1')!.price + seats.find((s) => s.id === 'H1')!.price)
  })
})
