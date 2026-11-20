import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth'
import { useDemo } from '../lib/demo'
import { useTheme } from '../lib/theme'
import { toast } from '../lib/toast'
import { Icon } from './Icon'
import { Mark } from './Mark'
import { Toaster } from './Toaster'
import './layout.css'

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <button type="button" className="lk-icon-btn" onClick={toggle} aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle theme">
      <Icon name={resolved === 'dark' ? 'sun' : 'moon'} size={19} />
    </button>
  )
}

/** Presenter panel: live crowd, people in 3D, network and one-shot edge cases. */
function DemoMenu() {
  const demo = useDemo()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!demo.available) return null

  const once = async (key: 'forceConflictNext' | 'shortHoldNext' | 'aiSlowNext' | 'aiStaleNext', msg: string) => {
    const { demoControls } = await import('../lib/api/mock/server')
    demoControls[key] = true
    toast(msg)
  }

  return (
    <div className="demo" ref={ref}>
      <button
        type="button"
        className="demo-pill"
        data-on={demo.live || undefined}
        aria-pressed={demo.live}
        onClick={() => demo.set({ live: !demo.live })}
        title="Other people keep booking seats while you watch"
      >
        <span className="demo-led" aria-hidden="true" />
        <span>Live demo</span>
        <span className="demo-state">{demo.live ? 'On' : 'Off'}</span>
      </button>
      <button type="button" className="lk-icon-btn" aria-label="Demo settings" aria-expanded={open} aria-controls="demo-panel" onClick={() => setOpen((o) => !o)}>
        <Icon name="sliders" size={19} />
      </button>
      {open && (
        <div id="demo-panel" className="demo-panel lk-card" role="group" aria-label="Demo settings">
          <p className="lk-eyebrow">Demo data</p>
          <label className="switch">
            <input type="checkbox" checked={demo.live} onChange={(e) => demo.set({ live: e.target.checked })} />
            <span>
              Live crowd<small>Others hold and book seats every few seconds</small>
            </span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={demo.people} onChange={(e) => demo.set({ people: e.target.checked })} />
            <span>
              People in 3D<small>Show who is sitting in booked seats</small>
            </span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={demo.fast} onChange={(e) => demo.set({ fast: e.target.checked })} />
            <span>
              Fast network<small>Skip the 2–3 s API delay</small>
            </span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={demo.failures} onChange={(e) => demo.set({ failures: e.target.checked })} />
            <span>
              Random failures<small>About 1 in 20 requests fail</small>
            </span>
          </label>
          <p className="lk-eyebrow">Next action only</p>
          <div className="demo-once">
            <button type="button" className="chip" onClick={() => void once('forceConflictNext', 'Next hold will hit a conflict')}>
              Conflict on hold
            </button>
            <button type="button" className="chip" onClick={() => void once('shortHoldNext', 'Next hold lasts 75 seconds')}>
              75 s hold
            </button>
            <button type="button" className="chip" onClick={() => void once('aiSlowNext', 'Next AI request will time out')}>
              Slow AI
            </button>
            <button type="button" className="chip" onClick={() => void once('aiStaleNext', 'Next AI answer includes a taken seat')}>
              Stale AI seat
            </button>
          </div>
          <button
            type="button"
            className="lk-btn lk-btn-sm"
            onClick={async () => {
              const { resetMockDb } = await import('../lib/api/mock/server')
              resetMockDb()
              location.reload()
            }}
          >
            <Icon name="refresh" size={15} /> Reset demo data
          </button>
        </div>
      )}
    </div>
  )
}

const NAV = [
  { to: '/explore', label: 'Explore', icon: 'search' as const },
  { to: '/bookings', label: 'My tickets', icon: 'ticket' as const },
  { to: '/design', label: 'Design', icon: 'palette' as const },
]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-top">
        <div className="app-top-inner">
          <Link to="/explore" aria-label="SeatLock home" className="app-brand">
            <Mark />
          </Link>
          <nav aria-label="Primary" className="app-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="app-actions">
            <DemoMenu />
            <ThemeToggle />
            {user && (
              <button
                type="button"
                className="app-avatar"
                aria-label={`Sign out ${user.name}`}
                title={`${user.name} — sign out`}
                onClick={() => {
                  signOut()
                  void navigate('/login')
                }}
              >
                {user.name.slice(0, 1)}
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <nav aria-label="Primary" className="app-tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to}>
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <Toaster />
    </>
  )
}
