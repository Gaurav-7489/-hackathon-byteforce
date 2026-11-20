export type ApiErrorCode =
  | 'invalid_credentials'
  | 'unauthorized'
  | 'conflict'
  | 'hold_expired'
  | 'validation'
  | 'not_found'
  | 'server_error'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'bad_response'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly conflictingSeatIds: string[]

  constructor(code: ApiErrorCode, message: string, status = 0, conflictingSeatIds: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.conflictingSeatIds = conflictingSeatIds
  }

  /** Errors that a "Retry" button can reasonably fix. */
  get retryable(): boolean {
    return this.code === 'server_error' || this.code === 'network' || this.code === 'timeout'
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ApiError('aborted', 'Request was cancelled.')
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return new ApiError('network', 'We could not reach SeatLock. Check your connection and try again.')
  }
  return new ApiError('bad_response', 'Something unexpected went wrong. Please try again.')
}

export function friendlyMessage(err: unknown): string {
  const e = toApiError(err)
  switch (e.code) {
    case 'server_error':
      return 'The booking server didn’t respond. Try again.'
    case 'network':
      return 'You’re offline or the server can’t be reached. Check your connection and try again.'
    case 'timeout':
      return 'The server took too long to respond.'
    default:
      return e.message
  }
}
