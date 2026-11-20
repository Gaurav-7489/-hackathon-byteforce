import { Link } from 'react-router'
import { StatePanel } from '../components/StatePanel'

export function NotFound() {
  return (
    <div className="container page-pad">
      <title>Page not found · SeatLock</title>
      <StatePanel icon="ticket" title="This seat doesn’t exist" action={<Link className="btn btn-primary" to="/events">Browse events</Link>}>
        The page you’re looking for has left the venue.
      </StatePanel>
    </div>
  )
}
