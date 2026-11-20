import type { PointerEvent } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { Booking } from '../lib/api/types'
import { dayParts, money, time } from '../lib/format'
import { spring } from '../lib/motion'
import { useFinePointer, useReducedMotion } from '../hooks/useMediaQuery'
import './ticket.css'

/** Deterministic QR-style placeholder (not a scannable code). */
export function QrPlaceholder({ seed }: { seed: string }) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const N = 21
  const cells: string[] = []
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (finder(x, y)) continue
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5
      if ((h >>> 0) % 100 < 46) cells.push(`M${x} ${y}h1v1h-1z`)
    }
  }
  const eye = (x: number, y: number) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} className="qr" role="img" aria-label="QR code placeholder for entry">
      <rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#fff" rx="1.5" />
      <path d={cells.join('') + eye(0, 0) + eye(N - 7, 0) + eye(0, N - 7)} fill="#0b0f1a" fillRule="evenodd" />
    </svg>
  )
}

export function Ticket({ booking, reveal = true }: { booking: Booking; reveal?: boolean }) {
  const fine = useFinePointer()
  const reduced = useReducedMotion()
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateY = useSpring(useTransform(px, [0, 1], [-10, 10]), { stiffness: 180, damping: 18 })
  const rotateX = useSpring(useTransform(py, [0, 1], [8, -8]), { stiffness: 180, damping: 18 })
  const shineX = useTransform(px, (v) => `${v * 100}%`)
  const tilt = fine && !reduced
  const { day, month, weekday } = dayParts(booking.event.startsAt)

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!tilt) return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }

  return (
    <div className="ticket-stage" onPointerMove={onMove} onPointerLeave={() => { px.set(0.5); py.set(0.5) }}>
      <motion.article
        className="ticket"
        aria-label={`Ticket ${booking.id} for ${booking.event.title}`}
        initial={reveal && !reduced ? { opacity: 0, y: 60, rotateX: 40, scale: 0.9 } : false}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={spring.elastic}
        style={tilt ? { rotateX, rotateY, ['--shine-x' as string]: shineX } : undefined}
      >
        <div className="ticket-main">
          <div className="ticket-top">
            <span className="ticket-brand">SeatLock</span>
            <span className={`badge ${booking.status === 'cancelled' ? 'badge-muted' : 'badge-ok'}`}>{booking.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}</span>
          </div>
          <h2 className="ticket-title">{booking.event.title}</h2>
          <p className="ticket-venue">{booking.event.venue}</p>
          <dl className="ticket-grid">
            <div><dt>Date</dt><dd>{weekday} {day} {month}</dd></div>
            <div><dt>Doors</dt><dd>{time(booking.event.startsAt)}</dd></div>
            <div><dt>Seats</dt><dd>{booking.seats.map((s) => s.id).join(', ')}</dd></div>
            <div><dt>Paid</dt><dd>{money(booking.total)}</dd></div>
          </dl>
        </div>
        <div className="ticket-stub">
          <QrPlaceholder seed={booking.id} />
          <span className="ticket-id num">{booking.id}</span>
        </div>
        <span className="ticket-shine" aria-hidden="true" />
      </motion.article>
    </div>
  )
}
