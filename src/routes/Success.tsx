import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { StatePanel } from '../components/StatePanel'
import { Ticket } from '../components/Ticket'
import { downloadIcs, rupees } from '../lib/format'
import { useHold } from '../lib/hold'
import { useT } from '../lib/i18n'
import { sfx } from '../lib/sound'
import { toast } from '../lib/toast'
import './success.css'

export function Success() {
  const { lastBooking } = useHold()
  useEffect(() => {
    if (lastBooking) sfx.chime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastBooking?.id])
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
      <SplitBill total={b.seats.reduce((n, s) => n + s.price, 0)} />
      <div className="sc-actions">
        <button type="button" className="lk-btn lk-btn-lg" onClick={() => downloadIcs(b)}>
          <Icon name="calendar" size={18} /> Add to calendar
        </button>
        <Link to="/bookings" className="lk-btn lk-btn-primary lk-btn-lg">
          <Icon name="ticket" size={18} /> View my tickets
        </Link>
        <Link to={`/book/${b.event.kind}`} className="lk-btn lk-btn-ghost lk-btn-lg">
          Book another
        </Link>
      </div>
    </div>
  )
}

/** One-tap split: divide the total between friends and copy a share summary. */
function SplitBill({ total }: { total: number }) {
  const t = useT()
  const [people, setPeople] = useState(2)
  const each = Math.ceil(total / Math.max(1, people))
  const copy = async () => {
    const text = `Our SeatLock booking: ${rupees(total)} total. Each of ${people} people pays ${rupees(each)}.`
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Share summary copied')
    } catch {
      toast('Copy is blocked here', text)
    }
  }
  return (
    <section className="split lk-card" aria-labelledby="split-title">
      <h2 id="split-title">{t('ok.split')}</h2>
      <div className="split-row">
        <label>
          <span>People</span>
          <input type="number" min={1} max={12} value={people} onChange={(e) => setPeople(Math.min(12, Math.max(1, Number(e.currentTarget.value) || 1)))} />
        </label>
        <p>
          <span>{t('ok.perPerson')}</span>
          <strong className="lk-num">{rupees(each)}</strong>
        </p>
      </div>
      <button type="button" className="lk-btn lk-btn-sm" onClick={() => void copy()}>
        Copy share summary
      </button>
    </section>
  )
}
