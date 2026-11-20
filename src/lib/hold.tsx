import { createContext, use, useState, type ReactNode } from 'react'
import type { Booking, EventDetail, Hold, Seat } from './api/types'

/**
 * The active hold (seats reserved for 5 minutes) and the last confirmed
 * booking. Persisted to sessionStorage so a refresh during checkout keeps the
 * countdown — the expiry time always comes from the server.
 */
export interface ActiveHold {
  hold: Hold
  event: EventDetail
  seats: Seat[]
}

interface HoldState {
  active: ActiveHold | null
  setActive: (h: ActiveHold | null) => void
  lastBooking: Booking | null
  setLastBooking: (b: Booking | null) => void
}

const HoldContext = createContext<HoldState | null>(null)
const KEY = 'seatlock-hold'
const BKEY = 'seatlock-last-booking'

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value))
    else sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function HoldProvider({ children }: { children: ReactNode }) {
  const [active, setActiveState] = useState<ActiveHold | null>(() => read<ActiveHold>(KEY))
  const [lastBooking, setLastBookingState] = useState<Booking | null>(() => read<Booking>(BKEY))
  const setActive = (h: ActiveHold | null) => {
    write(KEY, h)
    setActiveState(h)
  }
  const setLastBooking = (b: Booking | null) => {
    write(BKEY, b)
    setLastBookingState(b)
  }
  return <HoldContext value={{ active, setActive, lastBooking, setLastBooking }}>{children}</HoldContext>
}

export function useHold(): HoldState {
  const ctx = use(HoldContext)
  if (!ctx) throw new Error('useHold must be used inside HoldProvider')
  return ctx
}
