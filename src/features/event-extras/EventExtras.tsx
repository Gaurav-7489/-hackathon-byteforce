import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { SimBadge } from '../../components/ui'
import { api, usingMock } from '../../lib/api/client'
import type { EventDetail, EventSummary, Seat } from '../../lib/api/types'
import { alternativeSessions, eventWindow, findConflicts, waitlistChance } from '../../lib/campus/algorithms/planning'
import { joinWaitlist, simulatedDemand } from '../../lib/campus/engine'
import { useCampus } from '../../lib/campus/store'
import { dateLong, time } from '../../lib/format'
import { isSelectable } from '../../lib/seats'

const kindLabel = { class: 'class', exam: 'exam', commitment: 'commitment' } as const

/** Warns when the event overlaps the student's classes, exams or commitments (all checked locally). */
export function ClashNotice({ event }: { event: EventDetail }) {
  const schedule = useCampus((s) => s.schedule)
  const { start, end } = eventWindow(event)
  const conflicts = findConflicts(start, end, schedule)
  const [alts, setAlts] = useState<EventSummary[] | null>(null)
  const clash = conflicts.length > 0

  useEffect(() => {
    if (!clash) return
    let live = true
    api.events().then((all) => { if (live) setAlts(alternativeSessions(event, all, schedule)) }, () => { if (live) setAlts([]) })
    return () => { live = false }
  }, [clash, event, schedule])

  if (!clash) return null
  return (
    <div className="alert" data-tone="warning" role="alert">
      <Icon name="calendar" size={18} />
      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        <strong>This clashes with your schedule</strong>
        <ul className="list-plain small">
          {conflicts.map((c) => (
            <li key={c.item.id + c.start.toISOString()}>
              {c.kind === 'full' ? 'Fully overlaps' : `Overlaps ${c.overlapMinutes} min with`} your {kindLabel[c.item.kind]} “{c.item.title}” ({time(c.start.toISOString())}–{time(c.end.toISOString())}).
            </li>
          ))}
        </ul>
        {alts && alts.length > 0 && (
          <p className="small">Clash-free alternatives: {alts.map((a, i) => <span key={a.id}>{i > 0 && ', '}<Link to={`/events/${a.id}`}>{a.title}</Link> ({dateLong(a.startsAt)})</span>)}</p>
        )}
        <Link to="/schedule" className="small">Review my schedule</Link>
      </div>
    </div>
  )
}

/** Sold out (or nearly)? Offer the predictive waitlist. */
export function WaitlistCta({ event, seats }: { event: EventDetail; seats: Seat[] }) {
  const entries = useCampus((s) => s.waitlist)
  const entry = entries.find((w) => w.eventId === event.id && (w.status === 'waiting' || w.status === 'offered'))
  const free = seats.filter(isSelectable).length
  if (!usingMock) return null
  if (free > 12 && !entry) return null
  const demand = simulatedDemand(event)
  const days = Math.max(0, (Date.parse(event.startsAt) - Date.now()) / 86_400_000)
  const chance = waitlistChance({ position: (entry?.ahead ?? Math.min(4, demand)) + 1, capacity: event.totalSeats, category: event.category, daysUntil: days })
  return (
    <section className="card waitlist-cta" aria-labelledby="wl-title">
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <h2 id="wl-title" className="summary-title"><Icon name="queue" size={18} /> {free === 0 ? 'Sold out — join the waitlist' : 'Almost gone'}</h2>
        <SimBadge>Demo estimate</SimBadge>
      </div>
      {entry ? (
        <p className="small">{entry.status === 'offered' ? <><strong>Seats are being offered to you.</strong> <Link to="/waitlist">Accept them now</Link>.</> : <>You’re on the waitlist with <strong>{entry.ahead}</strong> ahead of you. <Link to="/waitlist">Track it</Link>.</>}</p>
      ) : (
        <>
          <p className="small muted">Returned and no-show seats are offered to the waitlist first, in order. No refreshing needed — you’ll get an in-app notification and 2 minutes to accept.</p>
          <p className="small">Estimated chance of a seat: <strong className="num">{Math.round(chance * 100)}%</strong> <span className="muted">(based on a simulated history of {event.category.toLowerCase()} returns — not a guarantee)</span></p>
          <div className="row-wrap">
            {[1, 2].map((n) => (
              <button key={n} type="button" className="btn btn-primary" onClick={() => joinWaitlist(event, n)}>Join for {n} seat{n > 1 ? 's' : ''}</button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/** Shown when the page is opened from a buddy invite link. */
export function InviteNotice({ from }: { from: string }) {
  return (
    <div className="alert" data-tone="info" role="status">
      <Icon name="users" size={18} />
      <div><strong>{from} invited you to a group booking (demo link)</strong>One person holds up to 4 seats for the group. Use the Buddies tool to find seats together, then share the cost from My bookings.</div>
    </div>
  )
}
