import { createContext, use, useEffect, useState, type ReactNode } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
interface ThemeState {
  pref: ThemePref
  resolved: 'light' | 'dark'
  setPref: (p: ThemePref) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)
const KEY = 'seatlock-theme'

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage blocked */
  }
  return 'system'
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref)
  const [systemDark, setSystemDark] = useState(() => media().matches)

  useEffect(() => {
    const mq = media()
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const setPref = (p: ThemePref) => {
    setPrefState(p)
    try {
      localStorage.setItem(KEY, p)
    } catch {
      /* storage blocked */
    }
  }

  // React 19: Context rendered directly as a provider.
  return (
    <ThemeContext value={{ pref, resolved, setPref, toggle: () => setPref(resolved === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeContext>
  )
}

export function useTheme(): ThemeState {
  const ctx = use(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
