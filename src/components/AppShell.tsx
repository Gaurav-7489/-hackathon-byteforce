import { lazy, Suspense, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Toaster } from 'sonner'
import { usingMock } from '../lib/api/client'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { Icon } from './Icon'
import { Logo } from './Logo'

const DemoControls = lazy(() => import('./DemoControls').then((m) => ({ default: m.DemoControls })))

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

  // Route-change focus management: move focus to <main> so keyboard and
  // screen-reader users start at the new page's content.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    document.getElementById('main')?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header" data-immersive={immersive || undefined}>
        <div className="container site-header-inner">
          <NavLink to="/events" className="brand-link" aria-label="SeatLock home">
            <Logo />
          </NavLink>
          <nav aria-label="Primary" className="site-nav">
            <NavLink to="/events" className="nav-link">Events</NavLink>
            <NavLink to="/bookings" className="nav-link">My bookings</NavLink>
            <NavLink to="/design" className="nav-link nav-link-optional">Design</NavLink>
          </nav>
          <div className="site-actions">
            <ThemeToggle />
            {user && (
              <button
                type="button"
                className="icon-btn"
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
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container site-footer-inner">
          <span>© SeatLock · built for campus rushes</span>
          <span className="site-footer-links">
            <NavLink to="/design">Design tokens</NavLink>
            {usingMock && <span className="badge badge-muted">Mock API mode</span>}
          </span>
        </div>
      </footer>
      {usingMock && user && <Suspense fallback={null}><DemoControls /></Suspense>}
      <Toaster theme={resolved} position="top-center" richColors closeButton toastOptions={{ className: 'sl-toast' }} />
    </>
  )
}
