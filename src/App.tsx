import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useRouteError } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { FailurePage } from './components/FailurePage'
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
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'
  return (
    <>
      <title>Something went wrong · SeatLock</title>
      <FailurePage
        code="500"
        title="This screen hit a problem"
        actions={
          <>
            <button type="button" className="lk-btn lk-btn-primary" onClick={() => location.reload()}>
              Try again
            </button>
            <a href="/" className="lk-btn">
              Go home
            </a>
          </>
        }
        details={
          <>
            <summary>Technical details</summary>
            <p>
              <code>{msg}</code>
            </p>
          </>
        }
      >
        <p>An unexpected error stopped this page from loading. Your bookings and held seats are safe — try again, or head home.</p>
      </FailurePage>
    </>
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
      {
        element: <RequireAuth />,
        children: [
          { index: true, lazy: async () => ({ Component: (await import('./routes/Home')).Home }) },
          { path: '/explore', element: <Navigate to="/" replace /> },
          { path: '/book/:kind', lazy: async () => ({ Component: (await import('./routes/Browse')).Browse }) },
          { path: '/failed', lazy: async () => ({ Component: (await import('./routes/Failed')).Failed }) },
          { path: '/smart', lazy: async () => ({ Component: (await import('./routes/Smart')).Smart }) },
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
