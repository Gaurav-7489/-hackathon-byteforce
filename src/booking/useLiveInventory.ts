import { useEffect, useRef, useState } from 'react'
import { hash, layoutFor, rng, seedStatuses, simulateStep, type FeedItem, type Mode, type SeatStatus, type Slot } from './data'

export interface LiveInventory {
  statuses: SeatStatus[]
  feed: FeedItem[]
  viewers: number
}

/**
 * Seat statuses for one show / departure that keep changing as simulated
 * shoppers lock, buy and release seats. Ticks pause while the tab is hidden.
 * `protect` is the viewer's own selection, which the simulation never touches.
 */
export function useLiveInventory(mode: Mode, slot: Slot, protect: Set<number>): LiveInventory {
  const layout = layoutFor(mode)
  const key = `${mode}:${slot.id}`
  const [state, setState] = useState(() => ({ key, statuses: seedStatuses(layout, slot), feed: [] as FeedItem[], viewers: 12 + (hash(key) % 30) }))
  const protectRef = useRef(protect)
  useEffect(() => {
    protectRef.current = protect
  })

  // New show selected → reseed synchronously during render (no flash of old data).
  let current = state
  if (state.key !== key) {
    current = { key, statuses: seedStatuses(layout, slot), feed: [], viewers: 12 + (hash(key) % 30) }
    setState(current)
  }

  useEffect(() => {
    const rand = rng(hash(key) ^ Date.now())
    let id = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      if (!document.hidden) {
        setState((prev) => {
          if (prev.key !== key) return prev
          const step = simulateStep(layout, prev.statuses, protectRef.current, rand)
          if (!step.feed) return prev
          const statuses = prev.statuses.slice()
          for (const c of step.changes) statuses[c.index] = c.status
          const feed = [{ ...step.feed, id: ++id, at: Date.now() }, ...prev.feed].slice(0, 30)
          const viewers = Math.max(6, prev.viewers + Math.round((rand() - 0.5) * 4))
          return { key, statuses, feed, viewers }
        })
      }
      timer = setTimeout(tick, 1300 + rand() * 1500)
    }
    timer = setTimeout(tick, 900)
    return () => clearTimeout(timer)
  }, [key, layout])

  return current
}
