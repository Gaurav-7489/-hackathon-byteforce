import { useActionState, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
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
import { invalidate } from '../lib/resource'
import { tierLabel } from '../lib/seats'
import { toast } from '../lib/toast'
import { readLang } from '../lib/i18n'
import { narrate } from '../lib/speech'
import './checkout.css'

const HOLD_MS = 5 * 60_000

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
      toast.warning('1 minute left on your hold', 'Confirm now to keep these seats.')
      narrate(readLang() === 'hi' ? 'एक मिनट बचा है। सीटें रखने के लिए अभी पुष्टि करें।' : 'One minute left. Confirm now to keep your seats.', readLang())
    }
  }, [warning])

  useEffect(() => {
    if (!expired || !active) return
    const { hold } = active
    toast.error('Your hold expired', 'The seats were released back to everyone else.')
    void Promise.resolve(navigate(`/e/${hold.eventId}`, { replace: true, state: { expired: true, reselect: hold.seatIds } })).then(() => setActive(null))
  }, [expired, active, setActive, navigate])

  // Actions + useActionState: Confirm booking.
  const [state, confirmAction] = useActionState<{ error: string | null }, FormData>(
    async () => {
      if (!active) return { error: 'No active hold.' }
      try {
        const booking = await api.confirm(active.hold.id)
        setLastBooking(booking)
        invalidate('bookings')
        invalidate('events')
        toast.success('Booking confirmed', `${booking.seats.map((s) => s.id).join(', ')} are yours.`)
        await navigate('/success', { replace: true })
        setActive(null)
        return { error: null }
      } catch (e) {
        const err = toApiError(e)
        if (err.code === 'hold_expired') {
          const { hold } = active
          toast.error('Your hold expired before confirming')
          await navigate(`/e/${hold.eventId}`, { replace: true, state: { expired: true, reselect: hold.seatIds } })
          setActive(null)
          return { error: null }
        }
        // Any other failure gets its own page: what happened, no money taken, hold time left.
        toast.error('Booking didn’t go through', 'No money was taken. Your seats are still held.')
        await navigate('/failed', { state: { reason: friendlyMessage(err) } })
        return { error: friendlyMessage(err) }
      }
    },
    { error: null },
  )

  if (!active) {
    return (
      <div className="container page">
        <title>Checkout · SeatLock</title>
        <StatePanel
          icon="ticket"
          title="No seats on hold"
          action={
            <Link className="lk-btn lk-btn-primary" to="/">
              Find a show or trip
            </Link>
          }
        >
          Pick seats on a seat map and press Hold to reserve them for five minutes.
        </StatePanel>
      </div>
    )
  }

  const { hold, event, seats } = active
  const pct = Math.min(1, remaining / HOLD_MS)
  const R = 54
  const C = 2 * Math.PI * R

  return (
    <div className="container page co">
      <title>{`Checkout ${mmss(remaining)} · SeatLock`}</title>
      <Link to={`/e/${event.id}`} state={{ reselect: hold.seatIds }} className="ep-back">
        <Icon name="arrowLeft" size={18} /> Back to seat map
      </Link>
      <p className="lk-eyebrow">Step 2 of 3 · Checkout</p>
      <h1 className="lk-display page-title">Confirm your seats</h1>

      <div className="co-grid">
        <section className="co-timer lk-card" data-warning={warning || undefined} aria-labelledby="timer-title">
          <div className="co-ring" role="timer" aria-live="off" aria-label={`Hold expires in ${mmss(remaining)}`}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r={R} className="co-track" />
              <circle cx="60" cy="60" r={R} className="co-bar" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
            </svg>
            <span className="co-time lk-num">{mmss(remaining)}</span>
          </div>
          <div>
            <h2 id="timer-title">{warning ? 'Under a minute left' : 'Seats locked to you'}</h2>
            <p>{warning ? 'Confirm now or the seats go back to everyone else.' : 'Nobody else can take these seats until the timer ends.'}</p>
          </div>
          <p className="sr-only" aria-live="assertive">
            {warning ? 'Warning: less than one minute left on your hold.' : ''}
          </p>
        </section>

        <section className="co-order lk-card" aria-labelledby="order-title">
          <div className="co-event">
            <div className="co-poster">
              <Poster event={event} />
            </div>
            <div>
              <p className="lk-eyebrow">{event.kind === 'bus' ? 'Bus' : 'Cinema'}</p>
              <h2 id="order-title">{event.title}</h2>
              <p className="co-meta">
                {dateLong(event.startsAt)}, {time(event.startsAt)} · {event.venue}
              </p>
            </div>
          </div>

          <ul className="co-seats">
            {seats.map((s) => (
              <li key={s.id}>
                <span className="ep-chip lk-num">{s.id}</span>
                <span>
                  {tierLabel(s.section)}
                  <small>
                    Row {s.row}, seat {s.number}
                    {s.isAisle ? ' · aisle' : ''}
                    {s.tags.includes('Window') ? ' · window' : ''}
                  </small>
                </span>
                <span className="lk-num">{money(s.price)}</span>
              </li>
            ))}
          </ul>

          <dl className="co-sum">
            <div>
              <dt>
                Tickets ({seats.length} seat{seats.length > 1 ? 's' : ''})
              </dt>
              <dd className="lk-num">{rupees(hold.total)}</dd>
            </div>
            <div>
              <dt>Booking fee</dt>
              <dd className="lk-num">₹0</dd>
            </div>
            <div className="co-total">
              <dt>Total</dt>
              <dd className="lk-num">{rupees(hold.total)}</dd>
            </div>
          </dl>

          <form action={confirmAction} className="co-actions">
            {state.error && (
              <div className="alert" data-tone="danger" role="alert">
                <Icon name="alert" size={18} />
                <div>
                  <strong>Booking didn’t go through</strong>
                  {state.error} Your seats are still held.
                </div>
              </div>
            )}
            <SubmitButton pendingLabel="Confirming booking…" disabled={expired} className="lk-btn lk-btn-signal lk-btn-lg lk-btn-block">
              {state.error ? (
                <>
                  <Icon name="refresh" size={18} /> Retry confirm
                </>
              ) : (
                <>
                  <Icon name="check" size={18} /> Confirm and pay {rupees(hold.total)}
                </>
              )}
            </SubmitButton>
            <button type="button" className="lk-btn lk-btn-ghost lk-btn-block" onClick={() => setCancelOpen(true)}>
              Cancel and release seats
            </button>
          </form>
        </section>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Release these seats?"
        description={`${hold.seatIds.join(', ')} will go back to everyone else. You can pick seats again from the map.`}
        confirmLabel="Release seats"
        cancelLabel="Keep my hold"
        onConfirm={() => {
          setCancelOpen(false)
          toast('Seats released', `${hold.seatIds.join(', ')} are available again.`)
          void Promise.resolve(navigate(`/e/${event.id}`, { replace: true })).then(() => setActive(null))
        }}
      />
    </div>
  )
}
