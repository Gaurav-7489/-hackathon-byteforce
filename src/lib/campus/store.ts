import { useSyncExternalStore } from 'react'
import { CampusStateSchema, type AppNotification, type CampusState } from './types'

/**
 * The one browser-local store for campus features (preferences, schedule,
 * waitlist, exchange history, splits, companion settings, vault, …).
 *
 * - Validated with Zod on load, so stale or tampered data falls back to defaults.
 * - Synced between tabs of the same browser via BroadcastChannel (+ the
 *   `storage` event). This is NOT multi-device or server-authoritative.
 * - Seat inventory is NOT stored here: it lives in the mock API so every
 *   feature shares one source of truth for seat ownership.
 */

const KEY = 'seatlock-campus-v1'
const CHANNEL = 'seatlock-campus'

export const defaultCampusState = (): CampusState => ({
  version: 1,
  prefs: {
    interests: ['music', 'tech'],
    categories: [],
    budget: 400,
    times: ['evening'],
    access: { wheelchair: false, companion: false, stepFree: false, easyExit: false, shortWalk: false, lowStimulation: false, clearSightline: false, accessibleRestroom: false },
    comfort: { quieter: true, lessCrowded: true, easyExit: false, lowNoise: false, personalSpace: false },
    reducedEffects: false,
    reminders: true,
  },
  schedule: [],
  waitlist: [],
  exchange: [],
  notifications: [],
  splits: {},
  companion: { optIn: false, showInterests: true, showYear: false, allowRequests: true, shareHandleOnAccept: false, requests: {} },
  opportunities: { registered: [], volunteered: [] },
  checkIns: {},
  vault: [],
  queue: {},
  reminders: [],
})

function read(): CampusState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = CampusStateSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
    }
  } catch {
    /* blocked or corrupt storage */
  }
  const fresh = defaultCampusState()
  // Low-end hint: start with reduced effects on Save-Data or very small devices.
  try {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
    if (nav.connection?.saveData || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2)) fresh.prefs.reducedEffects = true
  } catch {
    /* ignore */
  }
  return fresh
}

let state: CampusState = typeof window === 'undefined' ? defaultCampusState() : read()
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null
const tabId = Math.random().toString(36).slice(2)

function emit() {
  for (const l of listeners) l()
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage full — keep working in memory */
  }
}

if (typeof window !== 'undefined') {
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (e: MessageEvent<{ from: string; type: 'sync' }>) => {
      if (e.data?.from === tabId) return
      state = read()
      emit()
    }
  } catch {
    channel = null
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = read()
      emit()
    }
  })
}

export function getCampus(): CampusState {
  return state
}

/** Immutable update: pass a function that returns the next state (or mutates a draft copy). */
export function updateCampus(fn: (draft: CampusState) => CampusState | void) {
  const draft = structuredClone(state)
  const next = fn(draft) ?? draft
  state = next
  persist()
  emit()
  try {
    channel?.postMessage({ from: tabId, type: 'sync' })
  } catch {
    /* ignore */
  }
}

export function subscribeCampus(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useCampus<T>(select: (s: CampusState) => T): T {
  return useSyncExternalStore(subscribeCampus, () => select(state), () => select(state))
}

export function resetCampus() {
  state = defaultCampusState()
  persist()
  emit()
  try {
    channel?.postMessage({ from: tabId, type: 'sync' })
  } catch {
    /* ignore */
  }
}

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function notify(n: Omit<AppNotification, 'id' | 'at' | 'read'>) {
  updateCampus((d) => {
    d.notifications.unshift({ ...n, id: uid('ntf'), at: new Date().toISOString(), read: false })
    d.notifications = d.notifications.slice(0, 40)
  })
}
