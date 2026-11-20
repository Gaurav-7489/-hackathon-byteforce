import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { StatePanel } from '../components/StatePanel'
import { Ticket } from '../components/Ticket'
import { downloadIcs } from '../lib/format'
import { useHold } from '../lib/hold'
import './success.css'

export function Success() {
  const { lastBooking } = useHold()
  if (!lastBooking) {
    return (
      <div className="container page">
        <title>Booking · SeatLock</title>
        <StatePanel
          icon="ticket"
          title="No recent booking"
          action={
            <Link to="/bookings" className="lk-btn lk-btn-primary">
              View my tickets
            </Link>
          }
        >
          Your confirmed tickets are always in My tickets.
        </StatePanel>
      </div>
    )
  }
  const b = lastBooking
  return (
    <div className="container page sc">
      <title>{`Booked: ${b.event.title} · SeatLock`}</title>
      <div className="sc-burst" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>
      <p className="lk-eyebrow sc-eyebrow">
        <Icon name="check" size={14} /> Step 3 of 3 · Confirmed
      </p>
      <h1 className="lk-display page-title sc-title">You’re in. Enjoy {b.event.kind === 'bus' ? 'the ride' : 'the show'}.</h1>
      <p className="sc-sub" role="status">
        Booking {b.id} is confirmed. We’ve saved it to My tickets — show the QR at the {b.event.kind === 'bus' ? 'boarding point' : 'entrance'}.
      </p>
      <Ticket booking={b} />
      <div className="sc-actions">
        <button type="button" className="lk-btn lk-btn-lg" onClick={() => downloadIcs(b)}>
          <Icon name="calendar" size={18} /> Add to calendar
        </button>
        <Link to="/bookings" className="lk-btn lk-btn-primary lk-btn-lg">
          <Icon name="ticket" size={18} /> View my tickets
        </Link>
        <Link to={`/explore?kind=${b.event.kind}`} className="lk-btn lk-btn-ghost lk-btn-lg">
          Book another
        </Link>
      </div>
    </div>
  )
}
