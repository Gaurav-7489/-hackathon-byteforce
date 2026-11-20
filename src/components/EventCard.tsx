import { ViewTransition } from 'react'
import { Link } from 'react-router'
import type { EventSummary } from '../lib/api/types'
import { summaryCache } from '../lib/eventCache'
import { money, relativeDay, time } from '../lib/format'
import { Icon } from './Icon'
import { EventMedia } from './Photo'

export function EventCard({ event }: { event: EventSummary }) {
  const left = event.seatsLeft / event.totalSeats
  const soldOut = event.seatsLeft === 0
  const hot = left < 0.25
  return (
    <article className="ev-card">
      <Link
        to={`/e/${event.id}`}
        className="ev-link"
        onClick={() => summaryCache.set(event.id, event)}
        aria-label={`${event.title}, ${event.kind === 'bus' ? 'bus' : 'film'}, ${relativeDay(event.startsAt)} at ${time(event.startsAt)}, ${event.venue}, from ${money(event.priceFrom)}, ${soldOut ? 'sold out' : `${event.seatsLeft} seats left`}`}
      >
        <div className="ev-media">
          {/* ViewTransition: the poster morphs into the detail page header. */}
          <ViewTransition name={`poster-${event.id}`} share="poster-morph">
            <EventMedia event={event} className="ev-poster" />
          </ViewTransition>
          <span className="ev-kind" aria-hidden="true">
            <Icon name={event.kind === 'bus' ? 'bus' : 'film'} size={14} />
            {event.kind === 'bus' ? 'Bus' : 'Cinema'}
          </span>
          {hot && !soldOut && <span className="ev-hot">Filling fast</span>}
        </div>
        <div className="ev-body">
          <h3 className="ev-title">{event.title}</h3>
          <p className="ev-when">
            <strong>{relativeDay(event.startsAt)}</strong> · {time(event.startsAt)}
          </p>
          <p className="ev-venue">{event.venue}</p>
          <div className="ev-foot">
            <span className="ev-price">
              from <strong className="lk-num">{money(event.priceFrom)}</strong>
            </span>
            <span className="ev-left lk-num" data-hot={hot || undefined}>
              {soldOut ? 'Sold out' : `${event.seatsLeft} left`}
            </span>
          </div>
          <span className="ev-meter" aria-hidden="true">
            <span style={{ width: `${(1 - left) * 100}%` }} data-hot={hot || undefined} />
          </span>
        </div>
      </Link>
    </article>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="ev-card" aria-hidden="true">
      <div className="ev-media skeleton" style={{ borderRadius: 0 }} />
      <div className="ev-body">
        <span className="skeleton" style={{ height: 20, width: '80%' }} />
        <span className="skeleton" style={{ height: 14, width: '55%' }} />
        <span className="skeleton" style={{ height: 14, width: '70%' }} />
        <span className="skeleton" style={{ height: 6, width: '100%', marginTop: 8 }} />
      </div>
    </div>
  )
}
