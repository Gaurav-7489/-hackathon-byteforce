import { Suspense, use, useEffect, useOptimistic, useState, useTransition } from 'react'
import { Link } from 'react-router'
import * as Tabs from '@radix-ui/react-tabs'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon } from '../components/Icon'
import { StatePanel } from '../components/StatePanel'
import { api } from '../lib/api/client'
import { returnPolicy } from '../lib/campus/algorithms/planning'
import { returnBooking, saveToVault } from '../lib/campus/engine'
import { useCampus } from '../lib/campus/store'
import { SplitDialog } from '../features/expense-split/SplitDialog'
import { friendlyMessage } from '../lib/api/errors'
import type { Booking } from '../lib/api/types'
import { dateLong, dayParts, downloadIcs, money, time } from '../lib/format'
import { spring } from '../lib/motion'
import { invalidate, resource } from '../lib/resource'
import './bookings.css'

export function Bookings() {
  const [attempt, setAttempt] = useState(0)
  return (
    <div className="container page-pad">
      <title>My bookings · SeatLock</title>
      <header className="page-head">
        <h1>My bookings</h1>
      </header>
      <ErrorBoundary key={attempt} section="your bookings" onReset={() => { invalidate('bookings'); setAttempt((a) => a + 1) }}>
        <Suspense fallback={<WalletSkeleton />}>
          <Wallet promise={resource('bookings', api.bookings)} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

function WalletSkeleton() {
  return (
    <div role="status" aria-label="Loading bookings" className="wallet-list">
      <div className="skeleton" style={{ height: 44, width: 240, borderRadius: 999 }} />
      {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 132, borderRadius: 20 }} />)}
    </div>
  )
}

function Wallet({ promise }: { promise: Promise<Booking[]> }) {
  const initial = use(promise)
  const [bookings, setBookings] = useState(initial)
  // useOptimistic: the ticket disappears instantly; rolls back if the server rejects.
  const [optimistic, markCancelled] = useOptimistic(bookings, (cur, id: string) =>
    cur.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b)),
  )
  const [, startTransition] = useTransition()
  const [tab, setTab] = useState('upcoming')
  const [target, setTarget] = useState<Booking | null>(null)
  const [splitFor, setSplitFor] = useState<Booking | null>(null)
  const exchange = useCampus((s) => s.exchange)

  // Keep the offline vault in sync with upcoming confirmed tickets.
  useEffect(() => {
    bookings.filter((b) => b.status === 'confirmed' && Date.parse(b.event.startsAt) > Date.now()).forEach(saveToVault)
  }, [bookings])

  const now = Date.now()
  const upcoming = optimistic.filter((b) => b.status === 'confirmed' && Date.parse(b.event.startsAt) > now)
  const past = optimistic.filter((b) => b.status === 'cancelled' || Date.parse(b.event.startsAt) <= now)

  const cancel = (b: Booking) => {
    setTarget(null)
    startTransition(async () => {
      markCancelled(b.id)
      try {
        // Verified exchange: policy check → return → route seats to the waitlist first.
        const res = await returnBooking(b)
        if (!res.ok || !res.updated) { toast.error('Can’t return this ticket', { description: res.message }); return }
        const updated = res.updated
        startTransition(() => setBookings((cur) => cur.map((x) => (x.id === updated.id ? updated : x))))
        invalidate('events')
        toast.success('Ticket returned', { description: `Seats ${b.seats.map((s) => s.id).join(', ')}: ${res.message}` })
      } catch (e) {
        toast.error('Couldn’t cancel booking', { description: `${friendlyMessage(e)} Your ticket is still valid.` })
      }
    })
  }

  return (
    <Tabs.Root value={tab} onValueChange={setTab} className="wallet">
      <Tabs.List className="tabs" aria-label="Bookings">
        {[{ v: 'upcoming', label: 'Upcoming', n: upcoming.length }, { v: 'past', label: 'Past', n: past.length }].map((t) => (
          <Tabs.Trigger key={t.v} value={t.v} className="tab">
            {tab === t.v && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring.snappy} />}
            <span className="tab-label">{t.label} <span className="tab-count num">{t.n}</span></span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="upcoming" className="wallet-list">
        {upcoming.length === 0 ? (
          <StatePanel icon="ticket" title="No upcoming tickets" action={<Link to="/events" className="btn btn-primary">Browse events</Link>}>
            When you book seats they’ll appear here, ready to show at the door.
          </StatePanel>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {upcoming.map((b) => <WalletCard key={b.id} booking={b} onCancel={() => setTarget(b)} onSplit={() => setSplitFor(b)} />)}
          </AnimatePresence>
        )}
      </Tabs.Content>
      <Tabs.Content value="past" className="wallet-list">
        {past.length === 0 ? (
          <StatePanel icon="clock" title="Nothing here yet">Past and cancelled bookings will show up here.</StatePanel>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {past.map((b) => <WalletCard key={b.id} booking={b} />)}
          </AnimatePresence>
        )}
      </Tabs.Content>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => { if (!o) setTarget(null) }}
        title="Return this ticket?"
        description={target ? `Your ${target.seats.length} seat${target.seats.length > 1 ? 's' : ''} (${target.seats.map((s) => s.id).join(', ')}) for ${target.event.title} go to the next verified student on the waitlist, or back on sale. This can’t be undone.` : ''}
        confirmLabel="Return ticket"
        cancelLabel="Keep tickets"
        onConfirm={() => { if (target) cancel(target) }}
      >
        {target && <ReturnPolicyNote booking={target} />}
      </ConfirmDialog>
      {splitFor && <SplitDialog booking={splitFor} open onOpenChange={(o) => { if (!o) setSplitFor(null) }} />}
      {exchange.length > 0 && <ExchangeHistory />}
    </Tabs.Root>
  )
}

function ReturnPolicyNote({ booking }: { booking: Booking }) {
  const p = returnPolicy(booking.event.startsAt)
  return (
    <div className="alert" data-tone={p.eligible ? 'info' : 'warning'} style={{ marginTop: 'var(--space-4)' }}>
      <Icon name="info" size={18} />
      <div>
        <strong>{p.eligible ? `${p.refundPercent}% demo credit: ${money(Math.round((booking.total * p.refundPercent) / 100))}` : 'Not returnable'}</strong>
        {p.label} Policy: full credit 48 h+ before, 75% at 24–48 h, 50% under 24 h, closed 2 h before doors. A returned ticket can’t be returned again.
      </div>
    </div>
  )
}

function ExchangeHistory() {
  const exchange = useCampus((s) => s.exchange)
  return (
    <section className="exchange" aria-labelledby="ex-title">
      <h2 id="ex-title" className="wallet-title">Exchange history</h2>
      <ul className="list-plain">
        {exchange.slice(0, 10).map((x) => (
          <li key={x.id} className="exchange-row">
            <span><strong>{x.eventTitle}</strong> · {x.seatIds.join(', ')}</span>
            <span className={`badge ${x.kind === 'failed' ? 'badge-warn' : 'badge-ok'}`}>{x.kind === 'reissued_to_waitlist' ? 'Reissued to waitlist' : x.kind === 'released_to_inventory' ? 'Back on sale' : x.kind === 'failed' ? 'Failed' : 'Returned'}</span>
            <span className="small muted">{money(x.amount)} credit · {new Date(x.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {x.note}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function WalletCard({ booking: b, onCancel, onSplit }: { booking: Booking; onCancel?: () => void; onSplit?: () => void }) {
  const { day, month } = dayParts(b.event.startsAt)
  const cancelled = b.status === 'cancelled'
  return (
    <motion.article layout className="wallet-card" data-cancelled={cancelled || undefined} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }} transition={spring.soft} aria-label={`${b.event.title}, ${dateLong(b.event.startsAt)}${cancelled ? ', cancelled' : ''}`}>
      <div className="wallet-date" aria-hidden="true"><span>{day}</span><span>{month}</span></div>
      <div className="wallet-body">
        <div className="wallet-row">
          <h2 className="wallet-title">{b.event.title}</h2>
          {cancelled && <span className="badge badge-muted">Cancelled</span>}
        </div>
        <p className="wallet-meta">{dateLong(b.event.startsAt)} at {time(b.event.startsAt)}, {b.event.venue}</p>
        <p className="wallet-meta">Seats <strong>{b.seats.map((s) => s.id).join(', ')}</strong>, {money(b.total)}. Booking <span className="num">{b.id}</span></p>
      </div>
      {onCancel && (
        <div className="wallet-actions">
          <button type="button" className="btn btn-ghost" onClick={() => downloadIcs(b)} aria-label={`Add ${b.event.title} to calendar`}><Icon name="calendar" size={16} /><span className="wallet-btn-text">Calendar</span></button>
          {onSplit && <button type="button" className="btn btn-ghost" onClick={onSplit} aria-label={`Split the cost of ${b.event.title}`}><Icon name="split" size={16} /><span className="wallet-btn-text">Split</span></button>}
          <button type="button" className="btn btn-ghost wallet-cancel" onClick={onCancel} aria-label={`Return tickets for ${b.event.title}`}>Return</button>
        </div>
      )}
    </motion.article>
  )
}
