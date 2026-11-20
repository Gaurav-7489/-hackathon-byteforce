import { Suspense, use, useState, useTransition } from 'react'
import { Navigate, useParams } from 'react-router'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { EventCard, EventCardSkeleton } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { StatePanel } from '../components/StatePanel'
import { api } from '../lib/api/client'
import type { EventSummary, Kind } from '../lib/api/types'
import { useT } from '../lib/i18n'
import { invalidate, resource } from '../lib/resource'
import { setMode } from '../lib/mode'
import { Link } from 'react-router'
import { useEffect } from 'react'
import { ToolButton, ToolRow } from '../components/ToolStrip'
import './explore.css'

/** Trips for bus, shows for cinema — one list per venue type, no tabs. */
export function Browse() {
  const { kind: raw = '' } = useParams()
  const t = useT()
  if (raw !== 'bus' && raw !== 'cinema') return <Navigate to="/" replace />
  const kind: Kind = raw
  return <BrowseKind kind={kind} t={t} />
}

function BrowseKind({ kind, t }: { kind: Kind; t: (k: 'browse.bus' | 'browse.cinema' | 'browse.search' | 'browse.empty' | 'browse.back') => string }) {
  const [query, setQuery] = useState('')
  const [deferred, setDeferred] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [, startTransition] = useTransition()
  useEffect(() => setMode(kind), [kind])
  const title = kind === 'bus' ? t('browse.bus') : t('browse.cinema')

  return (
    <div className={`container page browse browse-${kind}`}>
      <title>{`${title} · SeatLock`}</title>
      <meta name="description" content={kind === 'bus' ? 'Pick a bus trip and the exact seat.' : 'Pick a cinema show and the exact seat.'} />
      <Link to="/" className="br-back">
        <Icon name="arrowLeft" size={18} /> {t('browse.back')}
      </Link>
      <header className="br-head">
        <h1 className="lk-display page-title">{title}</h1>
        <div className="ex-search">
          <Icon name="search" size={18} />
          <label htmlFor="br-q" className="sr-only">
            {t('browse.search')}
          </label>
          <input
            id="br-q"
            type="search"
            className="lk-input"
            placeholder={kind === 'bus' ? 'City or operator' : 'Film or cinema'}
            value={query}
            onChange={(e) => {
              const v = e.currentTarget.value
              setQuery(v)
              startTransition(() => setDeferred(v))
            }}
          />
        </div>
      </header>
      {/* Planning tools belong where you choose what to book. */}
      <ToolRow title="Plan smart" hi="समझदारी से चुनें">
        <ToolButton id="match" label="Recommended for you" hi="आपके लिए सुझाव" />
        <ToolButton id="budget" label="Fits my budget" hi="मेरे बजट में" />
        <ToolButton id="conflict" label="Fits my timetable" hi="मेरे टाइम-टेबल में" />
        <ToolButton id="queue" label="Fair queue for busy shows" hi="फ़ेयर क्यू" />
        <ToolButton id="waitlist" label="Sold out? Join a waitlist" hi="वेटलिस्ट" />
      </ToolRow>
      <ErrorBoundary
        key={attempt}
        section="this list"
        onReset={() => {
          invalidate('events')
          setAttempt((a) => a + 1)
        }}
      >
        <Suspense fallback={<GridSkeleton />}>
          <EventGrid promise={resource('events', api.events)} kind={kind} query={deferred} empty={t('browse.empty')} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="ex-grid" role="status" aria-label="Loading">
      {Array.from({ length: 6 }, (_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  )
}

function EventGrid({ promise, kind, query, empty }: { promise: Promise<EventSummary[]>; kind: Kind; query: string; empty: string }) {
  const events = use(promise)
  const q = query.trim().toLowerCase()
  const shown = events.filter((e) => e.kind === kind && (!q || `${e.title} ${e.subtitle} ${e.category} ${e.venue}`.toLowerCase().includes(q)))
  if (shown.length === 0) {
    return (
      <StatePanel icon="search" title={empty}>
        {q ? `No results for “${query}”.` : 'Check back soon.'}
      </StatePanel>
    )
  }
  return (
    <div className="ex-grid">
      {shown.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  )
}
