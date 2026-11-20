import { beforeEach, describe, expect, it } from 'vitest'
import { SEEDED_STUDENT } from '../lib/api/mock/data'
import { demoControls, mockFetch, resetMockDb } from '../lib/api/mock/server'

const auth = { authorization: `Bearer mock-token-${SEEDED_STUDENT.id}` }
const call = (url: string, method = 'GET', body?: unknown) =>
  mockFetch(url, { method, headers: auth, body: body === undefined ? undefined : JSON.stringify(body) })

beforeEach(() => {
  resetMockDb()
  Object.assign(demoControls, { latency: 'fast', failures: false, live: false, forceConflictNext: false })
})

describe('mock API', () => {
  it('rejects a wrong password and accepts the demo account', async () => {
    expect((await mockFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: SEEDED_STUDENT.email, password: 'nope-nope' }) })).status).toBe(401)
    const ok = await mockFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: SEEDED_STUDENT.email, password: SEEDED_STUDENT.password }) })
    expect(ok.status).toBe(200)
  })

  it('holds, confirms and cancels seats', async () => {
    const { events } = await (await call('/events')).json()
    const id = events[0].id
    const { seats } = await (await call(`/events/${id}/seats`)).json()
    const free = seats.filter((s: { status: string }) => s.status === 'available').slice(0, 2).map((s: { id: string }) => s.id)
    const held = await call(`/events/${id}/hold`, 'POST', { seatIds: free })
    expect(held.status).toBe(201)
    const { hold } = await held.json()
    const confirmed = await call(`/holds/${hold.id}/confirm`, 'POST')
    expect(confirmed.status).toBe(201)
    const { booking } = await confirmed.json()
    expect(booking.seats.map((s: { id: string }) => s.id)).toEqual(free)
    const after = await (await call(`/events/${id}/seats`)).json()
    expect(after.seats.find((s: { id: string }) => s.id === free[0]).mine).toBe(true)
    expect((await call(`/bookings/${booking.id}`, 'DELETE')).status).toBe(200)
  })

  it('refuses a fifth seat and reports conflicts', async () => {
    const { events } = await (await call('/events')).json()
    const id = events[0].id
    const { seats } = await (await call(`/events/${id}/seats`)).json()
    const free = seats.filter((s: { status: string }) => s.status === 'available').map((s: { id: string }) => s.id)
    expect((await call(`/events/${id}/hold`, 'POST', { seatIds: free.slice(0, 5) })).status).toBe(422)
    demoControls.forceConflictNext = true
    const res = await call(`/events/${id}/hold`, 'POST', { seatIds: free.slice(0, 2) })
    expect(res.status).toBe(409)
    expect((await res.json()).conflictingSeatIds).toHaveLength(1)
  })
})
