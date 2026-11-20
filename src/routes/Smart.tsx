import { Navigate } from 'react-router'

/** Smart tools now live inside the booking flow; old links land on Home. */
export function Smart() {
  return <Navigate to="/" replace />
}
