import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Icon } from '../components/Icon'
import { Card, Empty, PageHead, SimBadge } from '../components/ui'
import { usingMock } from '../lib/api/client'
import { waitlistChance } from '../lib/campus/algorithms/planning'
import { acceptOffer, declineOffer, leaveWaitlist, OFFER_MS, simulateCancellationFor } from '../lib/campus/engine'
import { useCampus } from '../lib/campus/store'
import type { WaitlistEntry } from '../lib/campus/types'
import { mmss } from '../hooks/useCountdown'
import { useHold } from '../lib/hold'
import './campus.css'

export function Waitlist() {
  const entries = useCampus((s) => s.waitlist)
  const active = entries.filter((w) => w.status === 'waiting' || w.status === 'offered')
  const history = entries.filter((w) => w.status !== 'waiting' && w.status !== 'offered')
  return (
    <div className="container page-pad">
      <title>Waitlist · SeatLock</title>
      <PageHead eyebrow="Predictive waitlist" icon="queue" title="Stop refreshing sold-out events" lead="Returned, cancelled and no-show seats are offered to the waitlist in order. You get an in-app notification and two minutes to accept; unanswered offers move to the next student." />
      {!usingMock && <div className="alert" data-tone="info"><Icon name="info" size={18} /><div>The waitlist needs organizer API support. It runs as a simulation in mock mode.</div></div>}
      {active.length === 0 ? (
        <Empty icon="queue" title="You’re not on any waitlist" action={<Link to="/events/campus-unplugged" className="btn btn-primary">Try the sold-out demo event</Link>}>
          Open a sold-out or nearly full event and choose “Join the waitlist”.
        </Empty>
      ) : (
        <div className="stack">{active.map((w) => <EntryCard key={w.id} w={w} />)}</div>
      )}
      {history.length > 0 && (
        <Card title="History" icon="clock" className="mt">
          <ul className="list-plain">
            {history.map((w) => (
              <li key={w.id} className="hist-row"><span>{w.eventTitle}</span><span className={`badge ${w.status === 'accepted' ? 'badge-ok' : 'badge-muted'}`}>{w.status}</span></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function EntryCard({ w }: { w: WaitlistEntry }) {
  const navigate = useNavigate()
  const { setActive } = useHold()
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (w.status !== 'offered') return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [w.status])
  const left = w.offer ? Math.max(0, Date.parse(w.offer.expiresAt) - now) : 0
  const chance = waitlistChance({ position: w.ahead + 1, capacity: 200, category: 'Music', daysUntil: 3 })

  const accept = async () => {
    setBusy(true)
    try {
      const res = await acceptOffer(w)
      if (!res) { toast.error('This offer has expired'); return }
      setActive(res)
      toast.success('Seats held for 5 minutes', { description: 'Confirm to complete your booking.' })
      await navigate('/checkout')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="wl card" data-offered={w.status === 'offered' || undefined} aria-label={`Waitlist for ${w.eventTitle}`}>
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 className="panel-title">{w.eventTitle}</h2>
          <p className="muted small">{w.seats} seat{w.seats > 1 ? 's' : ''} · joined {new Date(w.joinedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p>
        </div>
        {w.status === 'offered' ? <span className="badge badge-ok">Offer open</span> : <span className="badge">Waiting</span>}
      </div>

      {w.status === 'offered' && w.offer ? (
        <div className="wl-offer" role="alert">
          <div className="wl-ring" style={{ ['--p' as string]: left / OFFER_MS }} aria-hidden="true"><span className="num">{mmss(left)}</span></div>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            <strong>Seats {w.offer.seatIds.join(', ')} are reserved for you</strong>
            <span className="small muted" role="timer" aria-label={`${mmss(left)} left to accept`}>Accept within {mmss(left)} or they go to the next student.</span>
            <div className="row-wrap">
              <button type="button" className="btn btn-lime" disabled={busy || left === 0} onClick={() => void accept()}>{busy ? 'Holding…' : 'Accept & go to checkout'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => void declineOffer(w, 'declined')}>Decline</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="wl-pos">
          <div><span className="wl-num num">{w.ahead}</span><span className="small muted"> ahead of you</span></div>
          <div className="small">Chance of a seat: <strong className="num">{Math.round(chance * 100)}%</strong> <SimBadge>Demo estimate</SimBadge></div>
        </div>
      )}

      <div className="row-wrap">
        {usingMock && (
          <button type="button" className="btn" onClick={() => void simulateCancellationFor({ id: w.eventId, title: w.eventTitle, seatsLeft: 0, totalSeats: 200 }, w.seats)}>
            <Icon name="wand" size={16} /> Simulate a cancellation
          </button>
        )}
        <Link className="btn btn-ghost" to={`/events/${w.eventId}`}>View event</Link>
        {w.status === 'waiting' && <button type="button" className="btn btn-ghost" onClick={() => leaveWaitlist(w.id)}>Leave waitlist</button>}
      </div>
    </article>
  )
}
