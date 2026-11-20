import { describe, expect, it } from 'vitest'
import { validateSuggestion } from '../components/AiAssistant'
import { parseIntent, recommend } from '../lib/api/mock/ai'
import { generateSeats } from '../lib/api/mock/data'
import type { AiAssistRequest } from '../lib/api/types'

const seats = generateSeats('ai-event', 300, 0.3)
const req = (prompt: string, history: AiAssistRequest['history'] = []): AiAssistRequest => ({
  eventId: 'ai-event', prompt, maxSeats: 4, selectedSeatIds: [], history,
  seats: seats.map(({ id, row, number, section, price, status, isAisle }) => ({ id, row, number, section, price, status, isAisle })),
})

describe('AI intent parsing', () => {
  it('understands the PDF example prompts', () => {
    const i = parseIntent('2 seats together near the stage under ₹300 each')
    expect(i).toMatchObject({ count: 2, budget: 300, nearStage: true, together: true })
    expect(parseIntent('aisle seat in the middle section')).toMatchObject({ count: 1, aisle: true, middle: true })
    expect(parseIntent('4 seats in the same row')).toMatchObject({ count: 4, together: true })
    expect(parseIntent("best view, price doesn't matter")).toMatchObject({ bestView: true })
  })
  it('handles Hinglish', () => {
    expect(parseIntent('do seats stage ke paas, 300 se kam')).toMatchObject({ count: 2, nearStage: true, budget: 300 })
  })
})

describe('AI recommendations', () => {
  it('returns adjacent available seats within budget', () => {
    const r = recommend(req('2 seats together near the stage under ₹300 each'))
    expect(r.seatIds).toHaveLength(2)
    const picked = r.seatIds.map((id) => seats.find((s) => s.id === id)!)
    picked.forEach((s) => { expect(s.status).toBe('available'); expect(s.price).toBeLessThanOrEqual(300) })
    expect(picked[0]!.row).toBe(picked[1]!.row)
    expect(Math.abs(picked[0]!.number - picked[1]!.number)).toBe(1)
    expect(r.reason.length).toBeGreaterThan(10)
  })
  it('refines "cheaper" against the previous suggestion', () => {
    const first = recommend(req('best view 2 seats'))
    const firstTotal = first.seatIds.reduce((t, id) => t + seats.find((s) => s.id === id)!.price, 0)
    const second = recommend(req('cheaper', [{ prompt: 'best view 2 seats', seatIds: first.seatIds }]))
    const secondTotal = second.seatIds.reduce((t, id) => t + seats.find((s) => s.id === id)!.price, 0)
    expect(secondTotal).toBeLessThan(firstTotal)
  })
})

describe('suggestion validation', () => {
  it('drops unknown, unavailable and over-limit seats', () => {
    const booked = seats.find((s) => s.status === 'booked')!.id
    const free = seats.filter((s) => s.status === 'available').slice(0, 5).map((s) => s.id)
    const { valid, dropped } = validateSuggestion(['ZZ99', booked, ...free], seats)
    expect(valid).toHaveLength(4)
    expect(dropped).toEqual(expect.arrayContaining(['ZZ99', booked, free[4]]))
  })
})
