import { Suspense, use, useState, useTransition } from 'react'
import { useSearchParams } from 'react-router'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { EventCard, EventCardSkeleton } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { StatePanel } from '../components/StatePanel'
import { api } from '../lib/api/client'
import type { EventSummary, Kind } from '../lib/api/types'
import { useAuth } from '../lib/auth'
import { invalidate, resource } from '../lib/resource'
import './explore.css'

type KindFilter = 'all' | Kind
const DAY = 86_400_000

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

function nextDays(n: number) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: n }, (_, i) => new Date(start.getTime() + i * DAY))
}

export function Explore() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const kind = (['cinema', 'bus'].includes(params.get('kind') ?? '') ? params.get('kind') : 'all') as KindFilter
  const [query, setQuery] = useState('')
  const [deferredQuery, setDeferredQuery] = useState('')
  const [day, setDay] = useState<string>('all')
  const [attempt, setAttempt] = useState(0)
  // useTransition: typing stays instant; filtering the grid is non-urgent.
  const [isPending, startTransition] = useTransition()

  const setKind = (k: KindFilter) =>
    startTransition(() => {
      const next = new URLSearchParams(params)
      if (k === 'all') next.delete('kind')
      else next.set('kind', k)
      setParams(next, { replace: true })
      try {
        if (k !== 'all') localStorage.setItem('seatlock-mode', k)
      } catch {
        /* ignore */
      }
    })

  const first = user?.name.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()

  return (
    <div className="container page explore">
      <title>Explore shows and trips · SeatLock</title>
      <meta name="description" content="Browse cinema shows and intercity bus trips, see seats left live, and lock the exact seat you want." />

      <header className="ex-head">
        <div>
          <p className="lk-eyebrow">{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, {first}</p>
          <h1 className="lk-display page-title">Where to sit next?</h1>
          <p className="ex-sub">Every seat is live. Pick one, it’s locked to you for five minutes.</p>
        </div>
        <div className="seg ex-kinds" role="tablist" aria-label="Type">
          {(
            [
              ['all', 'Everything', 'grid'],
              ['cinema', 'Cinema', 'film'],
              ['bus', 'Bus', 'bus'],
            ] as const
          ).map(([k, label, icon]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
              <Icon name={icon} size={16} />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="ex-tools">
        <div className="ex-search">
          <Icon name="search" size={18} />
          <label htmlFor="ex-q" className="sr-only">
            Search films, routes and venues
          </label>
          <input
            id="ex-q"
            type="search"
            className="lk-input"
            placeholder={kind === 'bus' ? 'Search a city or operator' : kind === 'cinema' ? 'Search a film, genre or cinema' : 'Search films, cities, venues'}
            value={query}
            onChange={(e) => {
              const v = e.currentTarget.value
              setQuery(v)
              startTransition(() => setDeferredQuery(v))
            }}
          />
          {isPending && <span className="spinner ex-pending" aria-hidden="true" />}
        </div>
        <div className="ex-days" role="radiogroup" aria-label="Date">
          <button type="button" role="radio" aria-checked={day === 'all'} className="ex-day" onClick={() => startTransition(() => setDay('all'))}>
            <span className="ex-day-top">Any</span>
            <span className="ex-day-num">All</span>
          </button>
          {nextDays(7).map((d, i) => {
            const key = dayKey(d)
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={day === key}
                className="ex-day"
                aria-label={d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                onClick={() => startTransition(() => setDay(key))}
              >
                <span className="ex-day-top">{i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                <span className="ex-day-num lk-num">{d.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>

      <ErrorBoundary
        key={attempt}
        section="shows and trips"
        onReset={() => {
          invalidate('events')
          setAttempt((a) => a + 1)
        }}
      >
        <Suspense fallback={<GridSkeleton />}>
          <EventGrid
            promise={resource('events', api.events)}
            query={deferredQuery}
            kind={kind}
            day={day}
            pending={isPending}
            onClear={() => {
              setQuery('')
              startTransition(() => {
                setDeferredQuery('')
                setDay('all')
              })
              setKind('all')
            }}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

function GridSkeleton() {
  return (
    <div role="status" aria-label="Loading shows and trips">
      <div className="ex-stats">
        {[0, 1, 2].map((i) => (
          <span key={i} className="skeleton" style={{ height: 74, borderRadius: 14 }} />
        ))}
      </div>
      <div className="ex-grid">
        {Array.from({ length: 10 }, (_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function EventGrid({ promise, query, kind, day, pending, onClear }: { promise: Promise<EventSummary[]>; query: string; kind: KindFilter; day: string; pending: boolean; onClear: () => void }) {
  const events = use(promise) // Suspense + use()
  const q = query.trim().toLowerCase()
  const shown = events.filter(
    (e) =>
      (kind === 'all' || e.kind === kind) &&
      (day === 'all' || dayKey(new Date(e.startsAt)) === day) &&
      (!q || `${e.title} ${e.subtitle} ${e.category} ${e.venue}`.toLowerCase().includes(q)),
  )
  const seatsLeft = shown.reduce((n, e) => n + e.seatsLeft, 0)
  const seats = shown.reduce((n, e) => n + e.totalSeats, 0)
  const hot = shown.filter((e) => e.seatsLeft / e.totalSeats < 0.25).length

  return (
    <div data-pending={pending || undefined} className="ex-results">
      <div className="ex-stats">
        <div className="ex-stat lk-card">
          <span className="ex-stat-label">{kind === 'bus' ? 'Departures' : kind === 'cinema' ? 'Shows' : 'Shows & trips'}</span>
          <span className="ex-stat-value lk-num">{shown.length}</span>
        </div>
        <div className="ex-stat lk-card">
          <span className="ex-stat-label">Seats still open</span>
          <span className="ex-stat-value lk-num">{seatsLeft.toLocaleString('en-IN')}</span>
          <span className="ex-stat-bar" aria-hidden="true">
            <span style={{ width: `${seats ? (1 - seatsLeft / seats) * 100 : 0}%` }} />
          </span>
        </div>
        <div className="ex-stat lk-card">
          <span className="ex-stat-label">Filling fast</span>
          <span className="ex-stat-value lk-num" data-hot={hot > 0 || undefined}>
            {hot}
          </span>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {shown.length} {shown.length === 1 ? 'result' : 'results'}
      </p>
      {shown.length === 0 ? (
        <StatePanel
          icon="search"
          title="Nothing matches"
          action={
            <button type="button" className="lk-btn lk-btn-primary" onClick={onClear}>
              Clear filters
            </button>
          }
        >
          No {kind === 'bus' ? 'trips' : kind === 'cinema' ? 'shows' : 'shows or trips'} for “{query || 'this date'}”. Try another day or a different search.
        </StatePanel>
      ) : (
        <div className="ex-grid">
          {shown.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  )
}
