import { useEffect, useState } from 'react'
import { serverNow } from '../lib/api/client'

/** Remaining ms until `expiresAt`, using the server clock offset learnt from the hold response. */
export function useCountdown(expiresAt: string | null): number {
  const target = expiresAt ? Date.parse(expiresAt) : 0
  const [remaining, setRemaining] = useState(() => (target ? Math.max(0, target - serverNow()) : 0))
  useEffect(() => {
    if (!target) return
    const tick = () => setRemaining(Math.max(0, target - serverNow()))
    tick()
    const id = setInterval(tick, 250)
    // Timers are throttled in background tabs — resync the moment we're visible again.
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [target])
  return remaining
}

export const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
