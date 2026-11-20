import { useActionState, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { StatePanel } from '../components/StatePanel'
import { SubmitButton } from '../components/SubmitButton'
import { mmss, useCountdown } from '../hooks/useCountdown'
import { api } from '../lib/api/client'
import { friendlyMessage, toApiError } from '../lib/api/errors'
import { dateLong, money, rupees, time } from '../lib/format'
import { useHold } from '../lib/hold'
import { fadeUp, stagger } from '../lib/motion'
import { invalidate } from '../lib/resource'
import './checkout.css'

const HOLD_MS = 5 * 60_000
const FEE_RATE = 0 // campus events: no convenience fee — shown explicitly for trust

export function Checkout() {
  const { active, setActive, setLastBooking } = useHold()
  const navigate = useNavigate()
  const remaining = useCountdown(active?.hold.expiresAt ?? null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const warned = useRef(false)
  const expired = active !== null && remaining <= 0
  const warning = remaining > 0 && remaining <= 60_000

  useEffect(() => {
    if (warning && !warned.current) {
      warned.current = true
      toast.warning('1 minute left on your hold', { description: 'Confirm now to keep these seats.' })
    }
  }, [warning])

  useEffect(() => {
    if (!expired || !active) return
    const { hold } = active
    toast.error('Your hold expired', { description: 'The seats were released back to other students.' })
    void Promise.resolve(navigate(`/events/${hold.eventId}`, { replace: true, state: { expired: true, reselect: hold.seatIds } })).then(() => setActive(null))
  }, [expired, active, setActive, navigate])

  // Actions + useActionState: Confirm booking.
  const [state, confirmAction] = useActionState<{ error: string | null }, FormData>(async () => {
    if (!active) return { error: 'No active hold.' }
    try {
      const booking = await api.confirm(active.hold.id)
      setLastBooking(booking)
      invalidate('bookings')
      invalidate('events')
      await navigate('/success', { replace: true })
      setActive(null)
      return { error: null }
    } catch (e) {
      const err = toApiError(e)
      if (err.code === 'hold_expired') {
        const { hold } = active
        toast.error('Your hold expired before confirming')
        await navigate(`/events/${hold.eventId}`, { replace: true, state: { expired: true, reselect: hold.seatIds } })
        setActive(null)
        return { error: null }
      }
      return { error: friendlyMessage(err) }
    }
  }, { error: null })

  if (!active) {
    return (
      <div className="container page-pad">
        <title>Checkout · SeatLock</title>
        <StatePanel icon="ticket" title="No seats on hold" action={<Link className="btn btn-primary" to="/events">Find an event</Link>}>
          Pick seats on an event’s seat map and press Hold to reserve them for five minutes.
        </StatePanel>
      </div>
    )
  }

  const { hold, event, seats } = active
  const subtotal = hold.total
  const fee = Math.round(subtotal * FEE_RATE)
  const pct = Math.min(1, remaining / HOLD_MS)
  const R = 54
  const C = 2 * Math.PI * R

  return (
    <div className="container page-pad checkout">
      <title>{`Checkout ${mmss(remaining)} · SeatLock`}</title>
      <Link to={`/events/${event.id}`} state={{ reselect: hold.seatIds }} className="back-link"><Icon name="arrowLeft" size={18} /> Back to seat map</Link>

      <motion.div className="checkout-grid" variants={stagger(0.06)} initial="hidden" animate="show">
        <motion.section variants={fadeUp} className="timer card" data-warning={warning || undefined} aria-labelledby="timer-title">
          <div className="timer-ring" role="timer" aria-live="off" aria-label={`Hold expires in ${mmss(remaining)}`}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r={R} className="timer-track" />
              <circle cx="60" cy="60" r={R} className="timer-bar" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
            </svg>
            <span className="timer-value num">{mmss(remaining)}</span>
          </div>
          <div>
            <h2 id="timer-title" className="timer-title">{warning ? 'Under a minute left' : 'Seats held for you'}</h2>
            <p className="timer-sub">
              {warning ? 'Confirm now or the seats go back to other students.' : 'Other students can’t take these seats until the timer ends.'}
            </p>
          </div>
          {/* Announce only at meaningful moments, not every second. */}
          <p className="sr-only" aria-live="assertive">{warning ? 'Warning: less than one minute left on your hold.' : ''}</p>
        </motion.section>

        <motion.section variants={fadeUp} className="order card" aria-labelledby="order-title">
          <div className="order-event">
            <div className="order-poster"><Poster event={event} /></div>
            <div>
              <h1 id="order-title" className="order-title">{event.title}</h1>
              <p className="order-meta">{dateLong(event.startsAt)} · {time(event.startsAt)} · {event.venue}</p>
            </div>
          </div>

          <h2 className="eyebrow order-label">Selected seats</h2>
          <ul className="order-seats">
            {seats.map((s) => (
              <li key={s.id} className="order-seat">
                <span className="order-seat-id">{s.id}</span>
                <span className="order-seat-meta">Row {s.row}, seat {s.number} · {s.section} block{s.isAisle ? ' · aisle' : ''}</span>
                <span className="num">{money(s.price)}</span>
              </li>
            ))}
          </ul>

          <dl className="order-sum">
            <div><dt>Subtotal ({seats.length} seat{seats.length > 1 ? 's' : ''})</dt><dd className="num">{rupees(subtotal)}</dd></div>
            <div><dt>Booking fee</dt><dd className="num">{fee === 0 ? '₹0' : money(fee)}</dd></div>
            <div className="order-total"><dt>Total</dt><dd className="num">{rupees(subtotal + fee)}</dd></div>
          </dl>

          <form action={confirmAction} className="order-actions">
            {state.error && (
              <div className="alert" data-tone="danger" role="alert">
                <Icon name="alert" size={18} />
                <div><strong>Booking didn’t go through</strong>{state.error} Your seats are still held.</div>
              </div>
            )}
            <SubmitButton pendingLabel="Confirming booking…" disabled={expired}>
              {state.error ? <><Icon name="refresh" size={18} /> Retry confirm</> : <>Confirm booking · {rupees(subtotal + fee)}</>}
            </SubmitButton>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setCancelOpen(true)}>Cancel and release seats</button>
          </form>
        </motion.section>
      </motion.div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Release these seats?"
        description={`${hold.seatIds.join(', ')} will go back to other students. You can pick seats again from the map.`}
        confirmLabel="Release seats"
        cancelLabel="Keep my hold"
        onConfirm={() => {
          setCancelOpen(false)
          toast('Hold cancelled', { description: 'Your seats were released.' })
          void Promise.resolve(navigate(`/events/${event.id}`, { replace: true })).then(() => setActive(null))
        }}
      />
    </div>
  )
}
