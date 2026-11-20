import { Link, useLocation } from 'react-router'
import { FailurePage } from '../components/FailurePage'
import { Icon } from '../components/Icon'
import { mmss, useCountdown } from '../hooks/useCountdown'
import { useHold } from '../lib/hold'

/** Booking failed: what happened, that no money moved, and how long the seats stay held. */
export function Failed() {
  const { active } = useHold()
  const state = useLocation().state as { reason?: string } | null
  const left = useCountdown(active?.hold.expiresAt ?? null)
  const held = active !== null && left > 0
  return (
    <>
      <title>Booking didn’t go through · SeatLock</title>
      <FailurePage
        code="402"
        title="Your booking didn’t go through"
        actions={
          <>
            {held ? (
              <Link to="/checkout" className="lk-btn lk-btn-primary">
                <Icon name="refresh" size={16} /> Try again
              </Link>
            ) : null}
            <Link to={active ? `/e/${active.hold.eventId}` : '/'} className="lk-btn">
              <Icon name="seat" size={16} /> Choose other seats
            </Link>
            <Link to="/bookings" className="lk-btn lk-btn-ghost">
              <Icon name="ticket" size={16} /> My tickets
            </Link>
          </>
        }
        details={
          <>
            <summary>Technical details</summary>
            <p>{state?.reason ?? 'The booking server did not confirm the payment.'}</p>
            {active && <p>Hold {active.hold.id} · seats {active.hold.seatIds.join(', ')}</p>}
          </>
        }
      >
        <ul className="fail-points">
          <li>
            <Icon name="check" size={16} />
            <span>
              <strong>No money was taken.</strong> You’ll only be charged when a booking is confirmed.
            </span>
          </li>
          <li>
            <Icon name="clock" size={16} />
            {held ? (
              <span>
                Your seats {active.hold.seatIds.join(', ')} are still held for <strong className="lk-num">{mmss(left)}</strong>.
              </span>
            ) : (
              <span>Your hold has ended, so the seats went back on sale. Pick seats again.</span>
            )}
          </li>
        </ul>
      </FailurePage>
    </>
  )
}
