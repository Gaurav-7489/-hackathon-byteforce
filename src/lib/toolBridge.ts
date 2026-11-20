import { createContext, use, useSyncExternalStore } from 'react'

/**
 * Bridge between smart tools and the seat page's 3D / 2D views. A tool
 * publishes the seats it is talking about; the seat page lights them up
 * and can move the camera. Cleared when the tool closes.
 */
export interface ToolHighlight {
  eventId: string
  seatIds: string[]
  label: string
  focusId?: string
  camera?: 'overview' | 'top' | 'seat'
}

let current: ToolHighlight | null = null
const listeners = new Set<() => void>()

export function setToolHighlight(h: ToolHighlight | null) {
  const same = h && current && h.eventId === current.eventId && h.label === current.label && h.focusId === current.focusId && h.camera === current.camera && h.seatIds.join() === current.seatIds.join()
  if (same || (!h && !current)) return
  current = h
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const snap = () => current

export function useToolHighlight(): ToolHighlight | null {
  return useSyncExternalStore(subscribe, snap, snap)
}

/** Set by the seat page: tools opened there default to this show and dock beside the 3D view. */
export const ToolEventContext = createContext<string | null>(null)
export const useToolEvent = () => use(ToolEventContext)
