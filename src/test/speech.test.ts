import { describe, expect, it } from 'vitest'
import { parseIntent } from '../lib/api/mock/ai'
import { normalizeHindi } from '../lib/speech'

describe('normalizeHindi', () => {
  it('maps a spoken Hindi request onto the seat parser', () => {
    const q = normalizeHindi('दो सस्ती सीटें साथ में')
    const intent = parseIntent(q)
    expect(intent.count).toBe(2)
    expect(intent.cheapest).toBe(true)
    expect(intent.together).toBe(true)
  })
  it('understands window and front, and Devanagari digits', () => {
    const intent = parseIntent(normalizeHindi('१ खिड़की वाली सीट आगे'))
    expect(intent.count).toBe(1)
    expect(intent.window).toBe(true)
    expect(intent.front).toBe(true)
  })
  it('leaves English untouched', () => {
    expect(normalizeHindi('2 seats near the screen')).toBe('2 seats near the screen')
  })
})
