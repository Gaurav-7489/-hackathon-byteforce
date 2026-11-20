import { ViewTransition, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { EventSummary } from '../lib/api/types'
import { dayParts, money, relativeDay, time } from '../lib/format'
import { summaryCache } from '../lib/eventCache'
import { useFinePointer, useReducedMotion } from '../hooks/useMediaQuery'
import { Icon } from './Icon'
import { Poster } from './Poster'

/** Warm the detail-route chunk on hover/focus — skipped on Save-Data. */
let detailPrefetched = false
function prefetchDetail() {
  if (detailPrefetched) return
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  if (nav.connection?.saveData || /2g/.test(nav.connection?.effectiveType ?? '')) return
  detailPrefetched = true
  void import('../routes/EventDetail').catch(() => { detailPrefetched = false })
}

export function EventCard({ event }: { event: EventSummary }) {
  const fine = useFinePointer()
  const reduced = useReducedMotion()
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [5, -5]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(px, [0, 1], [-6, 6]), { stiffness: 200, damping: 20 })
  const glowX = useTransform(px, (v) => `${v * 100}%`)
  const glowY = useTransform(py, (v) => `${v * 100}%`)
  const tilt = fine && !reduced

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (!tilt) return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const { day, month } = dayParts(event.startsAt)
  const scarcity = event.seatsLeft / event.totalSeats
  const soldOut = event.seatsLeft === 0

  return (
    <motion.article
      className="event-card"
      style={tilt ? { rotateX: rx, rotateY: ry, ['--gx' as string]: glowX, ['--gy' as string]: glowY } : undefined}
      onPointerMove={onMove}
      onPointerLeave={() => { px.set(0.5); py.set(0.5) }}
    >
      <Link
        to={`/events/${event.id}`}
        className="event-card-link"
        onClick={() => summaryCache.set(event.id, event)}
        onPointerEnter={prefetchDetail}
        onFocus={prefetchDetail}
        aria-label={`${event.title}, ${relativeDay(event.startsAt)} at ${time(event.startsAt)}, ${event.venue}, from ${money(event.priceFrom)}, ${soldOut ? 'sold out, waitlist open' : `${event.seatsLeft} seats left`}${event.highDemand ? ', high demand: fair queue' : ''}`}
      >
        <div className="event-card-media">
          <ViewTransition name={`poster-${event.id}`} share="poster-morph">
            <Poster event={event} className="event-card-poster" />
          </ViewTransition>
          <span className="event-card-date" aria-hidden="true">
            <span>{day}</span>
            <span>{month}</span>
          </span>
          {event.highDemand && !soldOut && <span className="event-card-hot">FairQueue</span>}
          <span className={`event-card-left ${scarcity < 0.2 ? 'is-low' : ''}`}>
            {soldOut ? 'Sold out' : scarcity < 0.2 ? `Only ${event.seatsLeft} left` : `${event.seatsLeft} seats left`}
          </span>
        </div>
        <div className="event-card-body">
          <p className="event-card-kind">{event.category}</p>
          <h3 className="event-card-title">{event.title}</h3>
          <p className="event-card-sub">{event.subtitle}</p>
          <dl className="event-card-meta">
            <div><dt className="sr-only">When</dt><dd><Icon name="clock" size={16} />{relativeDay(event.startsAt)}, {time(event.startsAt)}</dd></div>
            <div><dt className="sr-only">Venue</dt><dd><Icon name="pin" size={16} />{event.venue}</dd></div>
          </dl>
          <div className="event-card-foot">
            <span className="event-card-price"><span className="sr-only">Price </span>{event.priceFrom === event.priceTo ? money(event.priceFrom) : <>from <strong>{money(event.priceFrom)}</strong></>}</span>
            <span className="event-card-cta" aria-hidden="true">Choose seats</span>
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="event-card is-skeleton" aria-hidden="true">
      <div className="event-card-media skeleton" style={{ borderRadius: 0 }} />
      <div className="event-card-body">
        <div className="skeleton" style={{ height: 12, width: '40%' }} />
        <div className="skeleton" style={{ height: 24, width: '80%' }} />
        <div className="skeleton" style={{ height: 14, width: '60%' }} />
        <div className="skeleton" style={{ height: 14, width: '70%' }} />
      </div>
    </div>
  )
}
