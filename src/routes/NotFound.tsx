import { Link } from 'react-router'
import { StatePanel } from '../components/StatePanel'

export function NotFound() {
  return (
    <div className="container page">
      <title>Not found · SeatLock</title>
      <StatePanel
        icon="seat"
        title="This seat doesn’t exist"
        action={
          <Link to="/explore" className="lk-btn lk-btn-primary">
            Back to shows and trips
          </Link>
        }
      >
        The page you opened isn’t here. It may have moved, or the link is out of date.
      </StatePanel>
    </div>
  )
}
