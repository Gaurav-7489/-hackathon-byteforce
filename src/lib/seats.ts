import type { Seat, SeatStatus } from './api/types'

export const MAX_SEATS = 4

/** The status the user sees: their own selection and own hold read as theirs. */
export function effectiveStatus(seat: Seat, selected: ReadonlySet<string>): SeatStatus {
  if (selected.has(seat.id)) return 'selected'
  if (seat.heldByMe) return 'available'
  return seat.status
}

export const isSelectable = (seat: Seat) => seat.status === 'available' || seat.heldByMe === true

export const STATUS_LABEL: Record<SeatStatus, string> = {
  available: 'available',
  selected: 'selected',
  held: 'held by someone else',
  booked: 'booked',
  blocked: 'blocked',
}

/**
 * Nearest selectable alternative to a lost seat: same row first, then
 * neighbouring rows; prefers the same tier and a similar price.
 */
export function suggestAlternative(lost: Seat, seats: Seat[], exclude: ReadonlySet<string>): Seat | null {
  let best: Seat | null = null
  let bestScore = Infinity
  for (const s of seats) {
    if (!isSelectable(s) || exclude.has(s.id) || s.id === lost.id) continue
    const score = Math.abs(s.r - lost.r) * 3 + Math.abs(s.col - lost.col) + (s.section === lost.section ? 0 : 2) + Math.abs(s.price - lost.price) / 100
    if (score < bestScore) {
      bestScore = score
      best = s
    }
  }
  return best
}

export type Direction = 'left' | 'right' | 'up' | 'down' | 'home' | 'end'

/** Arrow-key navigation across the grid, skipping aisle gaps. */
export function neighbour(seats: Seat[], fromId: string, dir: Direction): Seat | null {
  const from = seats.find((s) => s.id === fromId)
  if (!from) return seats[0] ?? null
  const sameRow = seats.filter((s) => s.r === from.r).sort((a, b) => a.col - b.col)
  if (dir === 'home') return sameRow[0] ?? null
  if (dir === 'end') return sameRow.at(-1) ?? null
  if (dir === 'left' || dir === 'right') {
    const i = sameRow.findIndex((s) => s.id === from.id)
    return sameRow[i + (dir === 'left' ? -1 : 1)] ?? null
  }
  const row = seats.filter((s) => s.r === from.r + (dir === 'up' ? -1 : 1))
  if (row.length === 0) return null
  return row.reduce((a, b) => (Math.abs(b.col - from.col) < Math.abs(a.col - from.col) ? b : a))
}

export const totalFor = (ids: readonly string[], seats: Seat[]) => ids.reduce((sum, id) => sum + (seats.find((s) => s.id === id)?.price ?? 0), 0)

export const TIER_LABEL: Record<string, string> = {
  classic: 'Classic',
  prime: 'Prime',
  recliner: 'Recliner',
  window: 'Window',
  aisle: 'Aisle',
  rear: 'Rear bench',
}
export const tierLabel = (id: string) => TIER_LABEL[id] ?? id
