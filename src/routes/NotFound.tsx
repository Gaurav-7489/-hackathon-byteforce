import { Link } from 'react-router'
import { StatePanel } from '../components/StatePanel'

export function NotFound() {
  return (
    <div className="container page-pad">
      <title>Page not found · SeatLock</title>
      <StatePanel icon="ticket" title="Page not found" action={<Link className="btn btn-primary" to="/events">Browse events</Link>}>
        This link doesn’t match any page. Browse events to find what you were looking for.
      </StatePanel>
    </div>
  )
}
