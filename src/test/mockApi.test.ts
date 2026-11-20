import { beforeEach, describe, expect, it } from 'vitest'
import { demoControls, mockFetch, resetMockDb } from '../lib/api/mock/server'

const auth = { authorization: 'Bearer mock-token-stu_42', 'content-type': 'application/json' }
const call = (method: string, path: string, body?: unknown) =>
  mockFetch(path, { method, headers: auth, ...(body ? { body: JSON.stringify(body) } : {}) })

beforeEach(() => {
  resetMockDb()
  demoControls.latency = 'fast'
  demoControls.failures = false
})

describe('mock API contract', () => {
  it('rejects a wrong password with invalid_credentials', async () => {
    const res = await mockFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'student@seatlock.dev', password: 'nope' }) })
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('invalid_credentials')
  })

  it('holds 1–4 seats and rejects a fifth', async () => {
    const { seats } = await (await call('GET', '/events/neon-monsoon/seats')).json()
    const free: string[] = seats.filter((s: { status: string }) => s.status === 'available').map((s: { id: string }) => s.id)
    expect((await call('POST', '/events/neon-monsoon/hold', { seatIds: free.slice(0, 5) })).status).toBe(422)
  })

  it('returns 409 with the conflicting seat and keeps the rest free', async () => {
    const { seats } = await (await call('GET', '/events/neon-monsoon/seats')).json()
    const free: string[] = seats.filter((s: { status: string }) => s.status === 'available').map((s: { id: string }) => s.id).slice(0, 3)
    demoControls.forceConflictNext = true
    const res = await call('POST', '/events/neon-monsoon/hold', { seatIds: free })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.conflictingSeatIds).toHaveLength(1)
    expect(free).toContain(body.conflictingSeatIds[0])
  })

  it('confirms a hold into a booking, then cancels it', async () => {
    const { seats } = await (await call('GET', '/events/strings-at-dusk/seats')).json()
    const id = seats.find((s: { status: string }) => s.status === 'available').id
    let res = await call('POST', '/events/strings-at-dusk/hold', { seatIds: [id] })
    if (res.status === 409) res = await call('POST', '/events/strings-at-dusk/hold', { seatIds: [seats.filter((s: { status: string }) => s.status === 'available')[5].id] })
    const { hold } = await res.json()
    expect(Date.parse(hold.expiresAt) - Date.now()).toBeGreaterThan(4.9 * 60_000)
    const conf = await call('POST', `/holds/${hold.id}/confirm`)
    expect(conf.status).toBe(201)
    const { booking } = await conf.json()
    const del = await call('DELETE', `/bookings/${booking.id}`)
    expect((await del.json()).booking.status).toBe('cancelled')
  })

  it('returns hold_expired for an unknown/expired hold', async () => {
    const res = await call('POST', '/holds/HLD-NOPE/confirm')
    expect(res.status).toBe(410)
    expect((await res.json()).code).toBe('hold_expired')
  })
})
