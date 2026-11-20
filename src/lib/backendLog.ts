import { useSyncExternalStore } from 'react'

/** Recent organizer-API requests. Shown in the Live demo panel so presenters can watch the backend work. */
export interface BackendEntry {
  id: number
  at: number
  method: string
  path: string
  status: number | 'network'
  ms: number
}

let entries: BackendEntry[] = []
let seq = 0
const listeners = new Set<() => void>()

export function logBackend(e: Omit<BackendEntry, 'id' | 'at'>) {
  entries = [{ id: ++seq, at: Date.now(), ...e }, ...entries].slice(0, 40)
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const snapshot = () => entries

export function useBackendLog(): BackendEntry[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
