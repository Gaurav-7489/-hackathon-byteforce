import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast, Toaster } from 'sonner'
import { usingMock } from '../lib/api/client'
import { useAuth } from '../lib/auth'
import { startCampusTicker } from '../lib/campus/engine'
import { useCampus } from '../lib/campus/store'
import { useTheme } from '../lib/theme'
import { useOnline } from '../hooks/useOnline'
import { Icon } from './Icon'
import { Logo } from './Logo'

const DemoControls = lazy(() => import('./DemoControls').then((m) => ({ default: m.DemoControls })))
const NavSheet = lazy(() => import('./NavSheet').then((m) => ({ default: m.NavSheet })))

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}>
      <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}


export function AppShell() {
  const { user, signOut } = useAuth()
  const { resolved } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const immersive = pathname === '/events' || pathname === '/'
  const firstRender = useRef(true)
  const [sheet, setSheet] = useState<'menu' | 'notifications' | null>(null)
  const notifications = useCampus((s) => s.notifications)
  const reducedEffects = useCampus((s) => s.prefs.reducedEffects)
  const unread = notifications.filter((n) => !n.read).length
  const online = useOnline()

  // Route-change focus management: move focus to <main> so keyboard and
  // screen-reader users start at the new page's content.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    document.getElementById('main')?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
    setSheet(null)
  }, [pathname])

  // Low-end / reduced-effects mode: one attribute drives CSS and the 3D gate.
  useEffect(() => {
    if (reducedEffects) document.documentElement.dataset.effects = 'reduced'
    else delete document.documentElement.dataset.effects
  }, [reducedEffects])

  useEffect(() => (user && usingMock ? startCampusTicker() : undefined), [user])

  useEffect(() => {
    const onUpdate = () => toast.info('SeatLock was updated', {
      description: 'Reload to use the latest version.',
      action: { label: 'Reload', onClick: () => location.reload() },
      duration: 12_000,
    })
    window.addEventListener('seatlock:sw-updated', onUpdate)
    return () => window.removeEventListener('seatlock:sw-updated', onUpdate)
  }, [])

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header" data-immersive={immersive || undefined}>
        <div className="container site-header-inner">
          <NavLink to="/events" className="brand-link" aria-label="SeatLock home">
            <Logo />
          </NavLink>
          <nav aria-label="Primary" className="site-nav">
            <NavLink to="/events" className="nav-link" end>Events</NavLink>
            <NavLink to="/discover" className="nav-link nav-link-wide">For you</NavLink>
            <NavLink to="/bookings" className="nav-link">My bookings</NavLink>
            <NavLink to="/campus" className="nav-link nav-link-wide">Campus</NavLink>
            {user?.role === 'organizer' && <NavLink to="/organizer" className="nav-link nav-link-wide">Organizer</NavLink>}
          </nav>
          <div className="site-actions">
            {user && (
              <button type="button" className="icon-btn bell-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => setSheet('notifications')}>
                <Icon name="bell" />
                {unread > 0 && <span className="bell-dot num" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
              </button>
            )}
            <span className="theme-wide"><ThemeToggle /></span>
            {user && (
              <button type="button" className="icon-btn" aria-label="Open menu: all SeatLock features" aria-haspopup="dialog" onClick={() => setSheet('menu')}>
                <Icon name="menu" />
              </button>
            )}
            {user && (
              <button
                type="button"
                className="icon-btn nav-link-wide"
                aria-label={`Sign out ${user.name}`}
                onClick={() => {
                  signOut()
                  void navigate('/login')
                }}
              >
                <Icon name="logout" />
              </button>
            )}
          </div>
        </div>
      </header>
      {!online && (
        <div className="offline-banner" role="status">
          <Icon name="wifiOff" size={16} /> You’re offline. Saved tickets still open in <NavLink to="/tickets">Offline tickets</NavLink>. Bookings need a connection.
        </div>
      )}
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container site-footer-inner">
          <span>© 2026 SeatLock — the intelligent campus experience platform.</span>
          <span className="site-footer-links">
            <NavLink to="/design">Design tokens</NavLink>
            <NavLink to="/profile">Preferences</NavLink>
            {usingMock && <span className="badge badge-muted">Mock API mode · demo data</span>}
          </span>
        </div>
      </footer>
      {sheet && (
        <Suspense fallback={null}>
          <NavSheet mode={sheet} onClose={() => setSheet(null)} onSignOut={() => { signOut(); void navigate('/login') }} />
        </Suspense>
      )}
      {usingMock && user && <Suspense fallback={null}><DemoControls /></Suspense>}
      <Toaster theme={resolved} position="top-center" richColors closeButton toastOptions={{ className: 'sl-toast' }} />
    </>
  )
}
