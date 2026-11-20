import { useEffect, useState } from 'react'
import { usingMock } from '../../lib/api/client'
import type { EventDetail, Seat } from '../../lib/api/types'
import type { MockMetrics } from '../../lib/api/mock/server'

export interface InventorySnapshot {
  events: EventDetail[]
  seats: Seat[]
  metrics: MockMetrics
  history: number[]
  at: number
}

type MockModule = typeof import('../../lib/api/mock/server')
let mod: MockModule | null = null
export async function mockApi(): Promise<MockModule> {
  mod ??= await import('../../lib/api/mock/server')
  return mod
}

/**
 * Organizer view of the shared mock inventory. Polls every 2 s while the tab is
 * visible (and advances the simulated crowd), so the dashboard shows the same
 * seat ownership students see. Mock mode only.
 */
export function useInventory(eventId: string, intervalMs = 2000): { snap: InventorySnapshot | null; refresh: () => void } {
  const [snap, setSnap] = useState<InventorySnapshot | null>(null)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!usingMock) return
    let live = true
    let timer: ReturnType<typeof setInterval> | undefined
    const read = async () => {
      const m = await mockApi()
      if (!live) return
      m.advance(eventId)
      setSnap({ events: m.mockEvents(), seats: m.inventory(eventId), metrics: m.mockMetrics(eventId), history: m.occupancyHistory(eventId), at: Date.now() })
    }
    const start = () => { clearInterval(timer); timer = setInterval(() => void read(), intervalMs) }
    const onVis = () => { if (document.hidden) clearInterval(timer); else { void read(); start() } }
    void read()
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { live = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [eventId, intervalMs, nonce])
  return { snap, refresh: () => setNonce((n) => n + 1) }
}

export function counts(seats: readonly Seat[]) {
  const c = { available: 0, held: 0, booked: 0, blocked: 0, mine: 0 }
  for (const s of seats) {
    if (s.heldByMe) c.mine++
    c[s.status]++
  }
  return c
}
