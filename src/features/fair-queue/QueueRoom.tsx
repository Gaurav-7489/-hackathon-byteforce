import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Icon } from '../../components/Icon'
import { SimBadge } from '../../components/ui'
import { useOnline } from '../../hooks/useOnline'
import { usingMock } from '../../lib/api/client'
import type { EventDetail } from '../../lib/api/types'
import { hashSeed, queuePosition, waitRange } from '../../lib/campus/algorithms/simulation'
import { getCampus, updateCampus, useCampus } from '../../lib/campus/store'
import { mmss } from '../../hooks/useCountdown'
import { spring } from '../../lib/motion'
import './queue.css'

const ADMIT_PER_SECOND = 2.5
const WINDOW_MS = 10 * 60_000
const RECONNECT_GRACE_MS = 2 * 60_000

/**
 * FairQueue waiting room for high-demand events (browser simulation).
 * Everyone who arrives in the opening window gets a lottery position, so a slow
 * phone or patchy Wi-Fi doesn't decide who gets in. Real fairness and bot
 * protection need server enforcement; this demonstrates the experience.
 */
export function QueueGate({ event, children }: { event: EventDetail; children: ReactNode }) {
  const token = useCampus((s) => s.queue[event.id])
  const [now, setNow] = useState(() => Date.now())
  const online = useOnline()
  const [otherTab, setOtherTab] = useState(false)
  const [offlineSince, setOfflineSince] = useState<number | null>(null)

  const active = Boolean(event.highDemand) && usingMock
  const admitted = token?.windowEndsAt !== undefined && token.windowEndsAt > now
  const windowExpired = token?.windowEndsAt !== undefined && token.windowEndsAt <= now

  // Join (or restore) the queue.
  useEffect(() => {
    if (!active) return
    const existing = getCampus().queue[event.id]
    if (existing && (existing.windowEndsAt === undefined || existing.windowEndsAt > Date.now())) return
    if (existing?.windowEndsAt !== undefined) return // expired: student must rejoin explicitly
    join(event.id)
  }, [active, event.id])

  // Tick while waiting (paused while offline) and admit when position hits 0.
  useEffect(() => {
    if (!active || admitted) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [active, admitted])

  useEffect(() => {
    if (!active) return
    if (!online) setOfflineSince((t) => t ?? Date.now())
    else setOfflineSince(null)
  }, [online, active])

  // Duplicate-session detection across tabs of this browser (demo).
  useEffect(() => {
    if (!active || typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel('seatlock-queue')
    const me = Math.random().toString(36).slice(2)
    ch.onmessage = (e: MessageEvent<{ type: string; eventId: string; from: string }>) => {
      if (e.data.eventId !== event.id || e.data.from === me) return
      if (e.data.type === 'hello') ch.postMessage({ type: 'here', eventId: event.id, from: me })
      setOtherTab(true)
    }
    ch.postMessage({ type: 'hello', eventId: event.id, from: me })
    return () => ch.close()
  }, [active, event.id])

  const position = token ? queuePosition(token.startPosition, token.joinedAt, now, ADMIT_PER_SECOND) : 0
  useEffect(() => {
    if (!active || !token || token.windowEndsAt !== undefined || position > 0 || !online) return
    updateCampus((d) => {
      const t = d.queue[event.id]
      if (t && t.windowEndsAt === undefined) { t.admittedAt = Date.now(); t.windowEndsAt = Date.now() + WINDOW_MS }
    })
  }, [active, token, position, online, event.id])

  if (!active) return <>{children}</>
  if (admitted && token?.windowEndsAt) {
    return (
      <>
        <AdmittedBar endsAt={token.windowEndsAt} token={token.token} />
        {children}
      </>
    )
  }

  const [lo, hi] = waitRange(position, ADMIT_PER_SECOND)
  const progress = token ? 1 - position / Math.max(1, token.startPosition) : 0
  const graceLeft = offlineSince ? Math.max(0, RECONNECT_GRACE_MS - (now - offlineSince)) : null

  return (
    <section className="queue card" aria-labelledby="queue-title">
      <div className="queue-head">
        <span className="queue-icon" aria-hidden="true"><Icon name="queue" size={22} /></span>
        <div>
          <h2 id="queue-title" className="queue-title">{windowExpired ? 'Your booking window ended' : 'You’re in the FairQueue'}</h2>
          <p className="muted small">High demand: {event.totalSeats} seats, many more students. Everyone who arrived in the first seconds got a random place — connection speed doesn’t matter.</p>
        </div>
        <SimBadge>Browser simulation</SimBadge>
      </div>

      {windowExpired ? (
        <div className="stack">
          <p>Your 10-minute booking window expired without a hold, so your turn passed to the next student.</p>
          <button type="button" className="btn btn-primary" onClick={() => join(event.id)}>Rejoin the queue</button>
        </div>
      ) : (
        <>
          <div className="queue-pos" role="status" aria-live="polite" aria-atomic="true">
            <span className="queue-pos-label">Your position</span>
            <motion.span key={position} className="queue-pos-num num" initial={{ y: 8, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={spring.snappy}>{position}</motion.span>
            <span className="muted small">{position === 0 ? 'Admitting you now…' : `About ${lo}–${hi} s · ${ADMIT_PER_SECOND * 60} students admitted per minute`}</span>
          </div>
          <div className="queue-bar" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
          {graceLeft !== null && (
            <div className="alert" data-tone="warning" role="alert"><Icon name="wifiOff" size={18} /><div><strong>Reconnecting…</strong>Your place is kept for {mmss(graceLeft)}. Don’t refresh — we’ll resume automatically.</div></div>
          )}
          {otherTab && (
            <div className="alert" data-tone="info" role="status"><Icon name="info" size={18} /><div><strong>This queue is open in another tab</strong>Only one session per student counts — duplicates are merged, not given extra places.</div></div>
          )}
          <ul className="queue-rules">
            <li><Icon name="check" size={14} /> One queue token per student, up to 4 seats</li>
            <li><Icon name="check" size={14} /> 10 minutes to choose and hold once admitted</li>
            <li><Icon name="check" size={14} /> If seats sell out first, you can join the waitlist instead</li>
          </ul>
          {token && <p className="tiny muted">Queue token <span className="num">{token.token}</span></p>}
          <button type="button" className="btn btn-ghost" onClick={() => updateCampus((d) => { const t = d.queue[event.id]; if (t) t.startPosition = 0 })}>
            <Icon name="wand" size={16} /> Presenter: skip to the front
          </button>
        </>
      )}
    </section>
  )
}

function join(eventId: string) {
  const start = 18 + ((hashSeed(eventId) + Math.floor(Date.now() / 1000)) % 40)
  updateCampus((d) => {
    d.queue[eventId] = { eventId, token: `FQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, joinedAt: Date.now(), startPosition: start }
  })
}

function AdmittedBar({ endsAt, token }: { endsAt: number; token: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="queue-pass" role="status">
      <Icon name="shield" size={16} />
      <span>FairQueue pass <span className="num">{token}</span> · <strong className="num">{mmss(Math.max(0, endsAt - now))}</strong> left to choose and hold</span>
    </div>
  )
}
