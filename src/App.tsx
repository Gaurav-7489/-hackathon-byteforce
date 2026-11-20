import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useRouteError } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { StatePanel } from './components/StatePanel'
import { AuthProvider, useAuth } from './lib/auth'
import { DemoProvider } from './lib/demo'
import { HoldProvider } from './lib/hold'
import { ThemeProvider } from './lib/theme'

function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

function RouteError() {
  const error = useRouteError()
  console.error('[SeatLock] route error', error)
  return (
    <div className="container page">
      <StatePanel
        icon="alert"
        tone="error"
        title="Something went wrong on this page"
        action={
          <button type="button" className="lk-btn lk-btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
        }
      >
        An unexpected error stopped this screen from loading. Your bookings are safe.
      </StatePanel>
    </div>
  )
}

function Loading() {
  return (
    <div className="app-loading" role="status">
      <span className="sr-only">Loading…</span>
    </div>
  )
}

// Route-level code splitting: each screen is its own chunk.
const router = createBrowserRouter([
  {
    path: '/login',
    lazy: async () => ({ Component: (await import('./routes/Onboard')).Onboard }),
    HydrateFallback: Loading,
    errorElement: <RouteError />,
  },
  {
    element: <AppLayout />,
    HydrateFallback: Loading,
    errorElement: <RouteError />,
    children: [
      { path: '/design', lazy: async () => ({ Component: (await import('./routes/Design')).Design }) },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <Navigate to="/explore" replace /> },
          { path: '/explore', lazy: async () => ({ Component: (await import('./routes/Explore')).Explore }) },
          { path: '/e/:id', lazy: async () => ({ Component: (await import('./routes/EventPage')).EventPage }) },
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
      <DemoProvider>
        <AuthProvider>
          <HoldProvider>
            <RouterProvider router={router} />
          </HoldProvider>
        </AuthProvider>
      </DemoProvider>
    </ThemeProvider>
  )
}
