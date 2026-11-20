import { Suspense, use, useOptimistic, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon } from '../components/Icon'
import { StatePanel } from '../components/StatePanel'
import { api } from '../lib/api/client'
import { friendlyMessage } from '../lib/api/errors'
import type { Booking } from '../lib/api/types'
import { dateLong, dayParts, downloadIcs, money, time } from '../lib/format'
import { invalidate, resource } from '../lib/resource'
import { toast } from '../lib/toast'
import { ToolStrip } from '../components/ToolStrip'
import './bookings.css'

export function Bookings() {
  const [attempt, setAttempt] = useState(0)
  return (
    <div className="container page">
      <title>My tickets · SeatLock</title>
      <meta name="description" content="Your upcoming and past cinema and bus tickets." />
      <p className="lk-eyebrow">Wallet</p>
      <h1 className="lk-display page-title">My tickets</h1>
      <ErrorBoundary
        key={attempt}
        section="your tickets"
        onReset={() => {
          invalidate('bookings')
          setAttempt((a) => a + 1)
        }}
      >
        <Suspense fallback={<WalletSkeleton />}>
          <Wallet promise={resource('bookings', api.bookings)} />
        </Suspense>
      </ErrorBoundary>
      <ToolStrip ids={['vault', 'exchange', 'split', 'nav', 'exit', 'conflict', 'pass', 'companion']} title="Tools for your tickets" hiTitle="आपके टिकट के टूल" />
    </div>
  )
}

function WalletSkeleton() {
  return (
    <div role="status" aria-label="Loading tickets" className="bk-list">
      <span className="skeleton" style={{ height: 44, width: 240, borderRadius: 999 }} />
      {[0, 1, 2].map((i) => (
        <span key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
      ))}
    </div>
  )
}

type Tab = 'upcoming' | 'past'

function Wallet({ promise }: { promise: Promise<Booking[]> }) {
  const initial = use(promise)
  const [bookings, setBookings] = useState(initial)
  // useOptimistic: the ticket moves to Past instantly; rolls back if the server rejects.
  const [optimistic, markCancelled] = useOptimistic(bookings, (cur, id: string) => cur.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b)))
  const [, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [target, setTarget] = useState<Booking | null>(null)
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ upcoming: null, past: null })

  const now = Date.now()
  const upcoming = optimistic.filter((b) => b.status === 'confirmed' && Date.parse(b.event.startsAt) > now)
  const past = optimistic.filter((b) => b.status === 'cancelled' || Date.parse(b.event.startsAt) <= now)

  const cancel = (b: Booking) => {
    setTarget(null)
    startTransition(async () => {
      markCancelled(b.id)
      try {
        const updated = await api.cancelBooking(b.id)
        startTransition(() => setBookings((cur) => cur.map((x) => (x.id === updated.id ? updated : x))))
        invalidate('events')
        toast.success('Booking cancelled', `Seats ${b.seats.map((s) => s.id).join(', ')} for ${b.event.title} are released.`)
      } catch (e) {
        toast.error('Couldn’t cancel booking', `${friendlyMessage(e)} Your ticket is still valid.`)
      }
    })
  }

  const tabs: { v: Tab; label: string; n: number }[] = [
    { v: 'upcoming', label: 'Upcoming', n: upcoming.length },
    { v: 'past', label: 'Past', n: past.length },
  ]
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const next: Tab = tab === 'upcoming' ? 'past' : 'upcoming'
    setTab(next)
    tabRefs.current[next]?.focus()
  }
  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div className="bk-wallet">
      <div className="seg" role="tablist" aria-label="Tickets" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.v}
            ref={(el) => void (tabRefs.current[t.v] = el)}
            type="button"
            role="tab"
            id={`tab-${t.v}`}
            aria-selected={tab === t.v}
            aria-controls={`panel-${t.v}`}
            tabIndex={tab === t.v ? 0 : -1}
            onClick={() => setTab(t.v)}
          >
            {t.label} <span className="seg-count lk-num">{t.n}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="bk-list" tabIndex={0}>
        {list.length === 0 ? (
          tab === 'upcoming' ? (
            <StatePanel
              icon="ticket"
              title="No upcoming tickets"
              action={
                <Link to="/" className="lk-btn lk-btn-primary">
                  Find a show or trip
                </Link>
              }
            >
              When you book seats they’ll appear here, ready to show at the door or boarding point.
            </StatePanel>
          ) : (
            <StatePanel icon="clock" title="Nothing here yet">
              Past and cancelled tickets will show up here.
            </StatePanel>
          )
        ) : (
          list.map((b) => <WalletCard key={b.id} booking={b} onCancel={tab === 'upcoming' ? () => setTarget(b) : undefined} />)
        )}
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => {
          if (!o) setTarget(null)
        }}
        title="Cancel this booking?"
        description={target ? `Your ${target.seats.length} seat${target.seats.length > 1 ? 's' : ''} (${target.seats.map((s) => s.id).join(', ')}) for ${target.event.title} will be released to others. This can’t be undone.` : ''}
        confirmLabel="Cancel booking"
        cancelLabel="Keep tickets"
        onConfirm={() => {
          if (target) cancel(target)
        }}
      />
    </div>
  )
}

function WalletCard({ booking: b, onCancel }: { booking: Booking; onCancel?: () => void }) {
  const { day, month } = dayParts(b.event.startsAt)
  const cancelled = b.status === 'cancelled'
  return (
    <article className="bk-card" data-cancelled={cancelled || undefined} aria-label={`${b.event.title}, ${dateLong(b.event.startsAt)}${cancelled ? ', cancelled' : ''}`}>
      <div className="bk-date" aria-hidden="true">
        <Icon name={b.event.kind === 'bus' ? 'bus' : 'film'} size={16} />
        <span className="lk-num">{day}</span>
        <span>{month}</span>
      </div>
      <div className="bk-body">
        <div className="bk-row">
          <h2 className="bk-title">{b.event.title}</h2>
          {cancelled && <span className="badge badge-muted">Cancelled</span>}
        </div>
        <p className="bk-meta">
          {dateLong(b.event.startsAt)}, {time(b.event.startsAt)} · {b.event.venue}
        </p>
        <p className="bk-meta">
          Seats <strong>{b.seats.map((s) => s.id).join(', ')}</strong> · {money(b.total)} · <span className="lk-num">{b.id}</span>
        </p>
      </div>
      {onCancel && (
        <div className="bk-actions">
          <button type="button" className="lk-btn lk-btn-sm" onClick={() => downloadIcs(b)} aria-label={`Add ${b.event.title} to calendar`}>
            <Icon name="calendar" size={15} /> Calendar
          </button>
          <button type="button" className="lk-btn lk-btn-sm lk-btn-ghost bk-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </article>
  )
}
