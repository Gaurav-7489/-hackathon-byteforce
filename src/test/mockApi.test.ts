import { describe, expect, it } from 'vitest'
import { DEMO_USER, mockFetch } from '../lib/api/mock/server'

const login = (email: string, password: string) => mockFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })

describe('mock auth', () => {
  it('signs in the demo account', async () => {
    const res = await login(DEMO_USER.email, DEMO_USER.password)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.email).toBe(DEMO_USER.email)
    expect(body.user.password).toBeUndefined()
  })

  it('rejects a wrong password', async () => {
    const res = await login(DEMO_USER.email, 'nope-nope')
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('invalid_credentials')
  })
})
