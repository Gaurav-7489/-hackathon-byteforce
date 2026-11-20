import type { PointerEvent } from 'react'
import { useFinePointer, useReducedMotion } from '../hooks/useMediaQuery'
import type { Booking } from '../lib/api/types'
import { dayParts, money, time } from '../lib/format'
import { tierLabel } from '../lib/seats'
import { Icon } from './Icon'
import './ticket.css'

/** Deterministic QR-style placeholder (not a scannable code). */
function QrPlaceholder({ seed }: { seed: string }) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const N = 21
  const cells: string[] = []
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (finder(x, y)) continue
      h ^= h << 13
      h ^= h >>> 17
      h ^= h << 5
      if ((h >>> 0) % 100 < 46) cells.push(`M${x} ${y}h1v1h-1z`)
    }
  }
  const eye = (x: number, y: number) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} className="qr" role="img" aria-label="QR code placeholder for entry">
      <rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#fff" rx="1.5" />
      <path d={cells.join('') + eye(0, 0) + eye(N - 7, 0) + eye(0, N - 7)} fill="#0f1a14" fillRule="evenodd" />
    </svg>
  )
}

/** Animated ticket: drops in on reveal, tilts towards the pointer on desktop. */
export function Ticket({ booking }: { booking: Booking }) {
  const fine = useFinePointer()
  const reduced = useReducedMotion()
  const tilt = fine && !reduced
  const { day, month, weekday } = dayParts(booking.event.startsAt)
  const bus = booking.event.kind === 'bus'

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!tilt) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    e.currentTarget.style.setProperty('--rx', `${(0.5 - py) * 10}deg`)
    e.currentTarget.style.setProperty('--ry', `${(px - 0.5) * 14}deg`)
    e.currentTarget.style.setProperty('--sx', `${px * 100}%`)
  }
  const onLeave = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  }

  return (
    <div className="ticket-stage" onPointerMove={onMove} onPointerLeave={onLeave}>
      <article className="ticket" data-kind={booking.event.kind} aria-label={`Ticket ${booking.id} for ${booking.event.title}`}>
        <div className="ticket-main">
          <div className="ticket-top">
            <span className="ticket-brand">
              <Icon name={bus ? 'bus' : 'film'} size={16} /> SeatLock · {bus ? 'Boarding pass' : 'Admit'} {booking.seats.length}
            </span>
            <span className={`badge ${booking.status === 'cancelled' ? 'badge-muted' : 'badge-ok'}`}>{booking.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}</span>
          </div>
          <h2 className="ticket-title">{booking.event.title}</h2>
          <p className="ticket-venue">{booking.event.venue}</p>
          <dl className="ticket-grid">
            <div>
              <dt>Date</dt>
              <dd>
                {weekday} {day} {month}
              </dd>
            </div>
            <div>
              <dt>{bus ? 'Departs' : 'Show'}</dt>
              <dd>{time(booking.event.startsAt)}</dd>
            </div>
            <div className="ticket-wide">
              <dt>Seats</dt>
              <dd>
                {booking.seats.map((s) => (
                  <span key={s.id} className="ticket-seat">
                    {s.id}
                    <small>{tierLabel(s.tier)}</small>
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{money(booking.total)}</dd>
            </div>
          </dl>
        </div>
        <div className="ticket-stub">
          <QrPlaceholder seed={booking.id} />
          <span className="ticket-id lk-num">{booking.id}</span>
        </div>
        <span className="ticket-shine" aria-hidden="true" />
      </article>
    </div>
  )
}
