import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useRouteError } from 'react-router'
import { AuthProvider, useAuth } from './lib/auth'

function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function Home() {
  const { user } = useAuth()
  let mode = 'cinema'
  try {
    if (localStorage.getItem('seatlock-mode') === 'bus') mode = 'bus'
  } catch {
    /* storage blocked */
  }
  return <Navigate to={user ? `/book/${mode}` : '/login'} replace />
}

function RouteError() {
  const error = useRouteError()
  console.error('[SeatLock] route error', error)
  return (
    <main className="app-error" role="alert">
      <h1>Something went wrong on this page</h1>
      <p>An unexpected error stopped this screen from loading.</p>
      <button type="button" onClick={() => location.reload()}>
        Reload
      </button>
    </main>
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
    errorElement: <RouteError />,
    HydrateFallback: Loading,
    children: [
      { index: true, element: <Home /> },
      { path: '/login', lazy: async () => ({ Component: (await import('./routes/Onboard')).Onboard }) },
      {
        element: <RequireAuth />,
        children: [
          { path: '/book', element: <Navigate to="/book/cinema" replace /> },
          { path: '/book/:mode', lazy: async () => ({ Component: (await import('./routes/Book')).Book }) },
        ],
      },
      { path: '*', element: <Home /> },
    ],
  },
])

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
