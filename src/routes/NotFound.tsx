import { Link, useLocation, useNavigate } from 'react-router'
import { FailurePage } from '../components/FailurePage'
import { Icon } from '../components/Icon'

export function NotFound() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <>
      <title>Page not found · SeatLock</title>
      <FailurePage
        code="404"
        tone="info"
        title="This seat doesn’t exist"
        actions={
          <>
            <Link to="/" className="lk-btn lk-btn-primary">
              <Icon name="grid" size={16} /> Go home
            </Link>
            <Link to="/book/bus" className="lk-btn">
              <Icon name="bus" size={16} /> Bus trips
            </Link>
            <Link to="/book/cinema" className="lk-btn">
              <Icon name="film" size={16} /> Cinema shows
            </Link>
            <button type="button" className="lk-btn lk-btn-ghost" onClick={() => void navigate(-1)}>
              <Icon name="arrowLeft" size={16} /> Go back
            </button>
          </>
        }
      >
        <p>
          We couldn’t find <code>{pathname}</code>. The link may be old, or the show has finished.
        </p>
      </FailurePage>
    </>
  )
}
