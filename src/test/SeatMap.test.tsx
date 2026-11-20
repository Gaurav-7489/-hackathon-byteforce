import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SeatMap } from '../components/SeatMap'
import { generateSeats } from '../lib/api/mock/data'

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
globalThis.ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver

describe('SeatMap', () => {
  const seats = generateSeats('kb-event', 200, 0).map((s) => ({ ...s, status: 'available' as const }))

  it('is a keyboard-operable grid: arrows move focus, Space selects', async () => {
    const onToggle = vi.fn()
    render(<SeatMap seats={seats} selected={new Set()} suggested={new Set()} lost={new Set()} onToggle={onToggle} />)
    expect(screen.getByRole('grid', { name: 'Seat map' })).toBeInTheDocument()
    const first = screen.getByRole('button', { name: /^A1,/ })
    expect(first).toHaveAttribute('tabindex', '0')
    first.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')
    expect(screen.getByRole('button', { name: /^B2,/ })).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'B2' }))
  })

  it('labels every state with text, not colour alone', () => {
    const mixed = seats.map((s, i) => ({ ...s, status: (['available', 'held', 'booked', 'blocked'] as const)[i % 4] ?? 'available' }))
    render(<SeatMap seats={mixed} selected={new Set(['A1'])} suggested={new Set(['A5'])} lost={new Set()} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: /A1,.*selected/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /A2,.*held by another student/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: /A3,.*booked/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /A4,.*blocked/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /A5,.*AI suggestion/ })).toBeInTheDocument()
  })
})
