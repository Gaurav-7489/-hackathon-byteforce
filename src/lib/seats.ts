import type { Seat, SeatStatus } from './api/types'

export const MAX_SEATS = 4
export const ROW_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K']

export const rowIndex = (row: string) => {
  const i = ROW_ORDER.indexOf(row)
  return i === -1 ? row.charCodeAt(0) - 65 : i
}

/** The status the student sees: their own selection and their own hold read as theirs. */
export function effectiveStatus(seat: Seat, selected: ReadonlySet<string>): SeatStatus {
  if (selected.has(seat.id)) return 'selected'
  if (seat.heldByMe) return 'available'
  return seat.status
}

export const isSelectable = (seat: Seat) => seat.status === 'available' || seat.heldByMe === true

export const STATUS_LABEL: Record<SeatStatus, string> = {
  available: 'available',
  selected: 'selected',
  held: 'held by another student',
  booked: 'booked',
  blocked: 'blocked',
}

/**
 * Nearest selectable alternative to a lost seat: same row first, then
 * neighbouring rows; prefers the same section and a similar price.
 */
export function suggestAlternative(lost: Seat, seats: Seat[], exclude: ReadonlySet<string>): Seat | null {
  let best: Seat | null = null
  let bestScore = Infinity
  const r0 = rowIndex(lost.row)
  for (const s of seats) {
    if (!isSelectable(s) || exclude.has(s.id) || s.id === lost.id) continue
    const score =
      Math.abs(rowIndex(s.row) - r0) * 3 +
      Math.abs(s.col - lost.col) +
      (s.section === lost.section ? 0 : 2) +
      Math.abs(s.price - lost.price) / 100
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
  const sameRow = seats.filter((s) => s.row === from.row).sort((a, b) => a.col - b.col)
  if (dir === 'home') return sameRow[0] ?? null
  if (dir === 'end') return sameRow.at(-1) ?? null
  if (dir === 'left' || dir === 'right') {
    const i = sameRow.findIndex((s) => s.id === from.id)
    return sameRow[i + (dir === 'left' ? -1 : 1)] ?? null
  }
  const target = rowIndex(from.row) + (dir === 'up' ? -1 : 1)
  const row = seats.filter((s) => rowIndex(s.row) === target)
  if (row.length === 0) return null
  return row.reduce((a, b) => (Math.abs(b.col - from.col) < Math.abs(a.col - from.col) ? b : a))
}

export const totalFor = (ids: readonly string[], seats: Seat[]) =>
  ids.reduce((sum, id) => sum + (seats.find((s) => s.id === id)?.price ?? 0), 0)
