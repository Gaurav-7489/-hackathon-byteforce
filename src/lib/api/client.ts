import type * as z from 'zod/mini'
import { ApiError, toApiError } from './errors'
import { ErrorBodySchema, LoginResponseSchema } from './types'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
/** With no API configured the app runs against the in-browser mock. */
export const usingMock = BASE_URL === ''

const TOKEN_KEY = 'seatlock-token'
let token: string | null = null
try {
  token = localStorage.getItem(TOKEN_KEY)
} catch {
  /* storage blocked */
}

export function setToken(next: string | null) {
  token = next
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage blocked */
  }
}
export const getToken = () => token

async function transport(path: string, init: RequestInit): Promise<Response> {
  if (usingMock) {
    const { mockFetch } = await import('./mock/server')
    return mockFetch(path, init)
  }
  return fetch(BASE_URL + path, init)
}

async function request<S extends z.ZodMiniType>(method: string, path: string, schema: S, body?: unknown): Promise<z.infer<S>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await transport(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch (e) {
    throw toApiError(e)
  }
  if (res.ok) {
    const parsed = schema.safeParse(await res.json())
    if (!parsed.success) throw new ApiError('bad_response', 'The server sent data we did not understand.', res.status)
    return parsed.data
  }
  let message = `Request failed (${res.status})`
  let code = ''
  try {
    const r = ErrorBodySchema.safeParse(await res.json())
    if (r.success) ({ message, code } = r.data)
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 401) throw new ApiError(code === 'invalid_credentials' ? 'invalid_credentials' : 'unauthorized', message, 401)
  if (res.status === 400 || res.status === 422) throw new ApiError('validation', message, res.status)
  throw new ApiError('server_error', message, res.status)
}

export const api = {
  login: (email: string, password: string) => request('POST', '/auth/login', LoginResponseSchema, { email, password }),
}
