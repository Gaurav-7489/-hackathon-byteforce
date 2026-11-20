import type * as z from 'zod/mini'
import { ApiError, toApiError } from './errors'
import {
  AiStreamChunkSchema,
  BookingResponseSchema,
  BookingsResponseSchema,
  ErrorBodySchema,
  EventDetailSchema,
  EventsResponseSchema,
  HoldResponseSchema,
  LoginResponseSchema,
  SeatsResponseSchema,
  type AiAssistRequest,
  type AiResult,
  type AiStreamChunk,
} from './types'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
export const usingMock = BASE_URL === ''

let token: string | null = null
try {
  token = localStorage.getItem('seatlock-token')
} catch {
  /* storage blocked */
}

export function setToken(next: string | null) {
  token = next
  try {
    if (next) localStorage.setItem('seatlock-token', next)
    else localStorage.removeItem('seatlock-token')
  } catch {
    /* storage blocked */
  }
}
export const getToken = () => token

/** Server clock offset (server − client), learnt from hold responses for accurate countdowns. */
let clockOffset = 0
export const serverNow = () => Date.now() + clockOffset

async function transport(path: string, init: RequestInit): Promise<Response> {
  if (usingMock) {
    const { mockFetch } = await import('./mock/server')
    return mockFetch(path, init)
  }
  return fetch(BASE_URL + path, init)
}

let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

async function send(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  const init: RequestInit = { method, headers }
  if (body !== undefined) init.body = JSON.stringify(body)
  if (signal) init.signal = signal
  try {
    return await transport(path, init)
  } catch (e) {
    throw toApiError(e)
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  let parsed: z.infer<typeof ErrorBodySchema> | null = null
  try {
    const r = ErrorBodySchema.safeParse(await res.json())
    if (r.success) parsed = r.data
  } catch {
    /* non-JSON error body */
  }
  const message = parsed?.message ?? `Request failed (${res.status})`
  if (res.status === 401) {
    if (parsed?.code === 'invalid_credentials') return new ApiError('invalid_credentials', message, 401)
    onUnauthorized()
    return new ApiError('unauthorized', message, 401)
  }
  if (res.status === 409) return new ApiError('conflict', message, 409, parsed?.conflictingSeatIds ?? [])
  if (res.status === 410 || parsed?.code === 'hold_expired') return new ApiError('hold_expired', message, res.status)
  if (res.status === 404) return new ApiError('not_found', message, 404)
  if (res.status === 422 || res.status === 400) return new ApiError('validation', message, res.status)
  return new ApiError('server_error', message, res.status)
}

const REQUEST_TIMEOUT_MS = 20_000

/** Combine the caller's signal with a timeout; falls back gracefully on older browsers. */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; timedOut: () => boolean; done: () => void } {
  const ctrl = new AbortController()
  let fired = false
  const t = setTimeout(() => { fired = true; ctrl.abort(new DOMException('Timed out', 'TimeoutError')) }, ms)
  const onAbort = () => ctrl.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason)
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: ctrl.signal,
    timedOut: () => fired,
    done: () => { clearTimeout(t); signal?.removeEventListener('abort', onAbort) },
  }
}

const backoff = (attempt: number) => new Promise((r) => setTimeout(r, Math.min(2000, 250 * 2 ** attempt) * (0.75 + Math.random() * 0.5)))

/** In-flight GET de-duplication: identical concurrent reads share one network request. */
const inflightGets = new Map<string, Promise<unknown>>()

async function request<S extends z.ZodMiniType>(
  method: string,
  path: string,
  schema: S,
  opts: { body?: unknown; signal?: AbortSignal; retries?: number } = {},
): Promise<z.infer<S>> {
  if (method === 'GET' && !opts.signal) {
    const key = `${path}`
    const existing = inflightGets.get(key) as Promise<z.infer<S>> | undefined
    if (existing) return existing
    const p = rawRequest(method, path, schema, opts).finally(() => inflightGets.delete(key))
    inflightGets.set(key, p)
    return p
  }
  return rawRequest(method, path, schema, opts)
}

async function rawRequest<S extends z.ZodMiniType>(
  method: string,
  path: string,
  schema: S,
  opts: { body?: unknown; signal?: AbortSignal; retries?: number },
): Promise<z.infer<S>> {
  // Idempotent GETs get silent retries with exponential backoff on 5xx/network —
  // the mock fails ~1 in 20 requests. Writes (hold/confirm/cancel) are never retried blindly.
  const retries = opts.retries ?? (method === 'GET' ? 2 : 0)
  for (let attempt = 0; ; attempt++) {
    const t = withTimeout(opts.signal, REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await send(method, path, opts.body, t.signal)
    } catch (e) {
      t.done()
      const err = t.timedOut() ? new ApiError('timeout', 'The server took too long to respond.') : toApiError(e)
      if (attempt < retries && (err.code === 'network' || err.code === 'timeout')) { await backoff(attempt); continue }
      throw err
    }
    t.done()
    if (res.ok) {
      const parsed = schema.safeParse(await res.json())
      if (!parsed.success) throw new ApiError('bad_response', 'The server sent data we did not understand.', res.status)
      return parsed.data
    }
    const e = await errorFrom(res)
    if (attempt < retries && e.code === 'server_error') { await backoff(attempt); continue }
    throw e
  }
}

export const api = {
  login: (email: string, password: string) =>
    request('POST', '/auth/login', LoginResponseSchema, { body: { email, password } }),
  events: () => request('GET', '/events', EventsResponseSchema).then((r) => r.events),
  event: (id: string) => request('GET', `/events/${encodeURIComponent(id)}`, EventDetailSchema),
  seats: (id: string, signal?: AbortSignal) =>
    request('GET', `/events/${encodeURIComponent(id)}/seats`, SeatsResponseSchema, signal ? { signal } : {}),
  hold: async (eventId: string, seatIds: string[]) => {
    const sentAt = Date.now()
    const r = await request('POST', `/events/${encodeURIComponent(eventId)}/hold`, HoldResponseSchema, { body: { seatIds } })
    const rtt = Date.now() - sentAt
    clockOffset = Date.parse(r.serverTime) + rtt / 2 - Date.now()
    return r.hold
  },
  confirm: (holdId: string) =>
    request('POST', `/holds/${encodeURIComponent(holdId)}/confirm`, BookingResponseSchema, {}).then((r) => r.booking),
  bookings: () => request('GET', '/me/bookings', BookingsResponseSchema).then((r) => r.bookings),
  cancelBooking: (id: string) =>
    request('DELETE', `/bookings/${encodeURIComponent(id)}`, BookingResponseSchema).then((r) => r.booking),
}

/**
 * Calls the organizer AI endpoint. Accepts NDJSON, SSE (`data:` lines) or a
 * plain JSON body so it works regardless of how the organizer streams.
 */
export async function aiAssist(
  req: AiAssistRequest,
  onChunk: (c: AiStreamChunk) => void,
  signal: AbortSignal,
): Promise<AiResult> {
  const res = await send('POST', '/ai/assist', req, signal)
  if (!res.ok) throw await errorFrom(res)
  const type = res.headers.get('content-type') ?? ''
  if (!res.body || type.includes('application/json')) {
    const parsed = AiStreamChunkSchema.safeParse({ type: 'result', ...(await res.json()) })
    if (!parsed.success || parsed.data.type !== 'result') throw new ApiError('bad_response', 'The assistant replied in an unexpected format.')
    onChunk(parsed.data)
    return parsed.data
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let result: AiResult | null = null
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const raw = line.replace(/^data:\s*/, '').trim()
        if (!raw || raw === '[DONE]') continue
        let data: unknown
        try {
          data = JSON.parse(raw)
        } catch {
          onChunk({ type: 'progress', text: raw })
          continue
        }
        const chunk = AiStreamChunkSchema.safeParse(data)
        if (!chunk.success) continue
        onChunk(chunk.data)
        if (chunk.data.type === 'error') throw new ApiError('server_error', chunk.data.message)
        if (chunk.data.type === 'result') result = { seatIds: chunk.data.seatIds, reason: chunk.data.reason }
      }
    }
  } catch (e) {
    throw toApiError(e)
  } finally {
    reader.releaseLock()
  }
  if (!result) throw new ApiError('bad_response', 'The assistant finished without a suggestion.')
  return result
}
