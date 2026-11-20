import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, useLocation, useRouteError } from 'react-router'
import { AppShell } from './components/AppShell'
import { AuthProvider, useAuth } from './lib/auth'
import { HoldProvider } from './lib/hold'
import { ThemeProvider } from './lib/theme'
import { RouteFallback } from './components/RouteFallback'

function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function RouteError() {
  const error = useRouteError()
  console.error('[SeatLock] route error', error)
  return (
    <div className="container" style={{ paddingBlock: 'var(--space-16)' }}>
      <div className="state-panel" data-tone="error" role="alert">
        <h1 style={{ fontSize: 'var(--text-xl)' }}>Something went wrong on this page</h1>
        <p>An unexpected error stopped this screen from loading. Your bookings are safe.</p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
          <Link to="/events" className="btn">Back to events</Link>
        </div>
      </div>
    </div>
  )
}

// Route-level code splitting: each screen is its own chunk.
const router = createBrowserRouter([
  {
    path: '/login',
    lazy: async () => ({ Component: (await import('./routes/Onboard')).Onboard }),
    HydrateFallback: RouteFallback,
    errorElement: <RouteError />,
  },
  {
    // Cinema / bus booking with the live 3D seat view (outside the dark app shell).
    element: <RequireAuth />,
    HydrateFallback: RouteFallback,
    errorElement: <RouteError />,
    children: [
      { path: '/book', element: <Navigate to="/book/cinema" replace /> },
      { path: '/book/:mode', lazy: async () => ({ Component: (await import('./routes/Book')).Book }) },
    ],
  },
  {
    element: <AppShell />,
    HydrateFallback: RouteFallback,
    errorElement: <RouteError />,
    children: [
      { path: '/design', lazy: async () => ({ Component: (await import('./routes/Design')).Design }) },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <Navigate to="/login" replace /> },
          { path: '/events', lazy: async () => ({ Component: (await import('./routes/Events')).Events }) },
          { path: '/events/:id', lazy: async () => ({ Component: (await import('./routes/EventDetail')).EventDetailPage }) },
          { path: '/checkout', lazy: async () => ({ Component: (await import('./routes/Checkout')).Checkout }) },
          { path: '/success', lazy: async () => ({ Component: (await import('./routes/Success')).Success }) },
          { path: '/bookings', lazy: async () => ({ Component: (await import('./routes/Bookings')).Bookings }) },
        ],
      },
      { path: '*', lazy: async () => ({ Component: (await import('./routes/NotFound')).NotFound }) },
    ],
  },
])

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HoldProvider>
          <RouterProvider router={router} />
        </HoldProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
