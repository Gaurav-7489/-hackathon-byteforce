import { createContext, use, useState, type ReactNode } from 'react'
import { usingMock } from './api/client'

/**
 * Presenter settings. "Live" makes other people hold and book seats in the
 * mock API every couple of seconds; "people" seats a little figure on every
 * booked seat in the 3D views. Persisted so a reload keeps the demo set-up.
 */
export interface DemoSettings {
  live: boolean
  people: boolean
  fast: boolean
  failures: boolean
}

interface DemoState extends DemoSettings {
  set: (patch: Partial<DemoSettings>) => void
  available: boolean
}

const KEY = 'seatlock-demo'
const DEFAULTS: DemoSettings = { live: true, people: true, fast: false, failures: true }

function read(): DemoSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DemoSettings>) }
  } catch {
    /* ignore */
  }
  return DEFAULTS
}

async function sync(s: DemoSettings) {
  if (!usingMock) return
  const { demoControls } = await import('./api/mock/server')
  demoControls.live = s.live
  demoControls.latency = s.fast ? 'fast' : 'realistic'
  demoControls.failures = s.failures
}

const DemoContext = createContext<DemoState | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DemoSettings>(() => {
    const s = read()
    void sync(s)
    return s
  })
  const set = (patch: Partial<DemoSettings>) => {
    setSettings((cur) => {
      const nextS = { ...cur, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(nextS))
      } catch {
        /* ignore */
      }
      void sync(nextS)
      return nextS
    })
  }
  return <DemoContext value={{ ...settings, set, available: usingMock }}>{children}</DemoContext>
}

export function useDemo(): DemoState {
  const ctx = use(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside DemoProvider')
  return ctx
}
