/**
 * In-browser mock of the SeatLock API, used when VITE_API_BASE_URL is unset.
 * Only authentication is served; seat inventory is simulated client-side
 * (see src/booking/data.ts).
 */
export const DEMO_USER = { id: 'stu_42', name: 'Aarav Sharma', email: 'student@seatlock.dev', password: 'seatlock123' }

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function mockFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
  const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {}
  await wait(250 + Math.random() * 350)

  if (method === 'POST' && path === '/auth/login') {
    const email = String(body.email ?? '').trim().toLowerCase()
    if (email !== DEMO_USER.email || body.password !== DEMO_USER.password) {
      return json(401, { code: 'invalid_credentials', message: 'That email and password don’t match.' })
    }
    const { password: _pw, ...user } = DEMO_USER
    return json(200, { token: `mock-token-${user.id}`, user })
  }
  return json(404, { code: 'not_found', message: 'Not found.' })
}
