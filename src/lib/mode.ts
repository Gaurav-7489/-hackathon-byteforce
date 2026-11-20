import { useSyncExternalStore } from 'react'
import type { Mode } from '../booking/data'

/**
 * The active venue type ("bus" or "cinema"). It drives the accent colour
 * through <html data-mode>: bus = white + yellow, cinema = white + cherry red.
 */
const KEY = 'seatlock-mode'
const listeners = new Set<() => void>()

export function readMode(): Mode {
  try {
    return localStorage.getItem(KEY) === 'bus' ? 'bus' : 'cinema'
  } catch {
    return 'cinema'
  }
}

export function applyMode(m: Mode) {
  document.documentElement.dataset.mode = m
}

export function setMode(m: Mode) {
  try {
    localStorage.setItem(KEY, m)
  } catch {
    /* storage blocked: keep the in-memory value only */
  }
  applyMode(m)
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useMode(): Mode {
  return useSyncExternalStore(subscribe, readMode, () => 'cinema' as Mode)
}

applyMode(readMode())
