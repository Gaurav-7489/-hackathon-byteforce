import { beforeEach, describe, expect, it } from 'vitest'
import { demoControls, mockFetch, resetMockDb } from '../lib/api/mock/server'
import { passwordScore } from '../routes/AuthForms'

const post = (path: string, body: unknown, token?: string) =>
  mockFetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
const get = (path: string, token: string) => mockFetch(path, { method: 'GET', headers: { authorization: `Bearer ${token}` } })

describe('accounts (mock organizer API)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMockDb()
    demoControls.latency = 'fast'
    demoControls.failures = false
    demoControls.live = false
  })

  it('creates an account, then signs in with the same password', async () => {
    const reg = await post('/auth/register', { name: 'Asha Rao', email: 'Asha@College.edu', password: 'seat2026x' })
    expect(reg.status).toBe(201)
    const { user } = (await reg.json()) as { user: { name: string; email: string } }
    expect(user).toMatchObject({ name: 'Asha Rao', email: 'asha@college.edu' })
    expect((await post('/auth/login', { email: 'asha@college.edu', password: 'seat2026x' })).status).toBe(200)
    expect((await post('/auth/login', { email: 'asha@college.edu', password: 'wrong-pass1' })).status).toBe(401)
  })

  it('refuses a duplicate email and a weak password', async () => {
    await post('/auth/register', { name: 'Asha Rao', email: 'asha@college.edu', password: 'seat2026x' })
    const dup = await post('/auth/register', { name: 'Other', email: 'asha@college.edu', password: 'seat2026x' })
    expect(dup.status).toBe(409)
    expect(((await dup.json()) as { code: string }).code).toBe('email_taken')
    expect((await post('/auth/register', { name: 'Weak', email: 'weak@college.edu', password: 'short' })).status).toBe(422)
  })

  it('keeps each account’s tickets separate and lets you rename yourself', async () => {
    const reg = await post('/auth/register', { name: 'New Student', email: 'new@college.edu', password: 'seat2026x' })
    const { token } = (await reg.json()) as { token: string }
    const mine = (await (await get('/me/bookings', token)).json()) as { bookings: unknown[] }
    expect(mine.bookings).toHaveLength(0)
    const patch = await mockFetch('/me', { method: 'PATCH', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Neha Student' }) })
    expect(((await patch.json()) as { user: { name: string } }).user.name).toBe('Neha Student')
  })
})

describe('password strength', () => {
  it('scores length, case and symbols', () => {
    expect(passwordScore('abc')).toBe(0)
    expect(passwordScore('abcdefgh')).toBe(1)
    expect(passwordScore('Seat2026!go')).toBeGreaterThanOrEqual(3)
  })
})
