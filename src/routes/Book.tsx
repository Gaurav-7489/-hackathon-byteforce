import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router'
import { LISTINGS, layoutFor, type FeedItem, type Layout, type Mode, type SeatStatus } from '../booking/data'
import { Mark } from '../booking/Mark'
import type { View } from '../booking/Scene3D'
import { useLiveInventory } from '../booking/useLiveInventory'
import { useAuth } from '../lib/auth'
import { rupees } from '../booking/format'
import '../booking/lk.css'
import './book.css'

// three.js + the scene only download when a booking page is opened.
const Scene3D = lazy(() => import('../booking/Scene3D'))

const MAX_SEATS = 6
const HOLD_MS = 5 * 60 * 1000

const COLORS = {
  free: '#dfe5da',
  women: '#f3bfd0',
  recliner: '#cfd9ec',
  locked: '#ff6b3d',
  sold: '#68716b',
  selected: '#f2b705',
  mine: '#2fbf71',
}

let webgl: boolean | null = null
function hasWebGL() {
  if (webgl !== null) return webgl
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    webgl = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webgl = false
  }
  return webgl
}

type Phase = 'pick' | 'held' | 'booked'

export function Book() {
  const { mode: param } = useParams()
  if (param !== 'cinema' && param !== 'bus') return <Navigate to="/book/cinema" replace />
  return <Booking key={param} mode={param} />
}

function Booking({ mode }: { mode: Mode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const layout = layoutFor(mode)
  const listing = LISTINGS[mode]
  const [slotId, setSlotId] = useState(listing.slots[mode === 'cinema' ? 2 : 1]!.id)
  const slot = listing.slots.find((s) => s.id === slotId)!

  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [held, setHeld] = useState<Set<number>>(() => new Set())
  const [booked, setBooked] = useState<Set<number>>(() => new Set())
  const [phase, setPhase] = useState<Phase>('pick')
  const [holdUntil, setHoldUntil] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [ticket, setTicket] = useState<{ code: string; seats: string[]; total: number } | null>(null)
  const [view, setView] = useState<View>('overview')
  const [render, setRender] = useState<'3d' | '2d'>(() => (hasWebGL() ? '3d' : '2d'))

  const mine = new Set([...held, ...booked])
  const protect = new Set([...selected, ...mine])
  const { statuses, feed, viewers } = useLiveInventory(mode, slot, protect)

  // Reset the basket when the show / departure changes.
  const [lastSlot, setLastSlot] = useState(slotId)
  if (lastSlot !== slotId) {
    setLastSlot(slotId)
    setSelected(new Set())
    setHeld(new Set())
    setBooked(new Set())
    setPhase('pick')
    setTicket(null)
    setNotice(null)
  }

  // Fill-rate history for the sparkline.
  const soldNow = statuses.reduce((n, s, i) => n + (s === 'sold' || booked.has(i) ? 1 : 0), 0)
  const [history, setHistory] = useState<{ key: string; pts: number[] }>({ key: slotId, pts: [] })
  const pts = history.key === slotId ? history.pts : []
  if (pts[pts.length - 1] !== soldNow) setHistory({ key: slotId, pts: [...pts, soldNow].slice(-40) })

  // Hold countdown.
  const now = useNow(phase === 'held')
  const left = Math.max(0, holdUntil - now)
  useEffect(() => {
    if (phase === 'held' && left === 0) {
      setPhase('pick')
      setHeld(new Set())
      setNotice('Your 5-minute hold ran out. The seats are still selected — lock them again.')
    }
  }, [phase, left])

  const counts = { free: 0, locked: 0, sold: 0 }
  statuses.forEach((s, i) => {
    if (booked.has(i)) counts.sold++
    else if (held.has(i)) counts.locked++
    else if (selected.has(i)) counts.free++
    else counts[s]++
  })
  const total = layout.seats.length
  const fill = Math.round((counts.sold / total) * 100)

  const basket = [...(phase === 'pick' ? selected : held)].sort((a, b) => a - b)
  const sum = basket.reduce((n, i) => n + layout.seats[i]!.price, 0)
  const lastPick = basket[basket.length - 1] ?? [...booked].pop() ?? defaultFocus(layout, statuses)

  const pick = (i: number) => {
    if (phase !== 'pick') {
      setNotice(phase === 'held' ? 'Release your hold to change seats.' : null)
      return
    }
    const s = statuses[i]
    if (booked.has(i)) return
    if (s !== 'free' && !selected.has(i)) {
      setNotice(`${layout.seats[i]!.id} is ${s === 'sold' ? 'already sold' : 'being booked by someone else'}.`)
      return
    }
    setNotice(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else if (next.size >= MAX_SEATS) {
        setNotice(`You can pick up to ${MAX_SEATS} seats per booking.`)
        return prev
      } else next.add(i)
      return next
    })
  }

  const lock = async () => {
    setBusy(true)
    await wait(550)
    setHeld(new Set(selected))
    setSelected(new Set())
    setHoldUntil(Date.now() + HOLD_MS)
    setPhase('held')
    setBusy(false)
    setNotice(null)
  }
  const release = () => {
    setSelected(new Set(held))
    setHeld(new Set())
    setPhase('pick')
  }
  const pay = async () => {
    setBusy(true)
    await wait(800)
    const seats = basket.map((i) => layout.seats[i]!.id)
    setBooked((prev) => new Set([...prev, ...held]))
    setHeld(new Set())
    setTicket({ code: `SL-${mode === 'cinema' ? 'C' : 'B'}${Math.floor(100000 + Math.random() * 899999)}`, seats, total: sum })
    setPhase('booked')
    setBusy(false)
  }
  const again = () => {
    setTicket(null)
    setPhase('pick')
  }

  // Imperative tooltip: hover never re-renders the page or the 3D scene.
  const tipRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const statusesRef = useRef(statuses)
  useEffect(() => {
    statusesRef.current = statuses
  })
  const hover = (i: number | null, x: number, y: number) => {
    const tip = tipRef.current
    const box = stageRef.current?.getBoundingClientRect()
    if (!tip || !box) return
    if (i === null) {
      tip.hidden = true
      return
    }
    const s = layout.seats[i]!
    const st = statusesRef.current[i]!
    tip.hidden = false
    tip.innerHTML = `<strong>${s.id}</strong><span>${tierLabel(layout, s.tier)} · ${rupees(s.price)}</span><em data-s="${st}">${STATUS_TEXT[st]}</em>${s.tags.length ? `<small>${s.tags.join(' · ')}</small>` : ''}`
    tip.style.transform = `translate(${Math.min(x - box.left + 14, box.width - 180)}px, ${y - box.top + 14}px)`
  }

  return (
    <main className="lk bk">
      <title>{`${mode === 'cinema' ? 'Cinema' : 'Bus'} seats · SeatLock`}</title>
      <meta name="description" content={`Live ${mode === 'cinema' ? 'cinema hall' : 'bus'} seat map in 3D. Lock seats for five minutes while you pay.`} />

      <header className="bk-top">
        <Link to="/" aria-label="SeatLock home">
          <Mark />
        </Link>
        <nav className="bk-switch" aria-label="Booking type">
          <NavLink to="/book/cinema" onClick={() => remember('cinema')}>
            Cinema
          </NavLink>
          <NavLink to="/book/bus" onClick={() => remember('bus')}>
            Bus
          </NavLink>
        </nav>
        <div className="bk-user">
          <span className="bk-name bk-hide-sm">{user?.name}</span>
          <button
            type="button"
            className="bk-avatar"
            title={`Signed in as ${user?.name ?? ''} — sign out`}
            aria-label="Sign out"
            onClick={() => {
              signOut()
              void navigate('/login')
            }}
          >
            {(user?.name ?? 'S').slice(0, 1)}
          </button>
        </div>
      </header>

      <section className="bk-head">
        <div className="bk-title">
          <p className="lk-eyebrow">{mode === 'cinema' ? 'Now showing · Fri 20 Nov' : 'Departing · Fri 20 Nov'}</p>
          <h1 className="lk-display">{listing.title}</h1>
          <ul className="bk-meta">
            {listing.meta.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
        <div className="bk-slots" role="radiogroup" aria-label={mode === 'cinema' ? 'Showtime' : 'Departure'}>
          {listing.slots.map((s) => {
            const f = s.id === slotId ? fill : Math.round(s.fill * 100)
            return (
              <button key={s.id} type="button" role="radio" aria-checked={s.id === slotId} className="bk-slot" onClick={() => setSlotId(s.id)}>
                <span className="bk-slot-time lk-num">{s.label}</span>
                <span className="bk-slot-sub">{s.sub}</span>
                <span className="bk-slot-bar" aria-hidden="true">
                  <span style={{ width: `${f}%` }} data-hot={f > 70 || undefined} />
                </span>
                <span className="bk-slot-fill lk-num">{f > 85 ? 'Filling fast' : `${f}% full`}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="bk-grid">
        <section className="bk-stage-col" aria-label="Seat map">
          <div className="bk-stage lk-card" data-mode={mode}>
            <div className="bk-toolbar">
              <div className="bk-seg" role="group" aria-label="Camera">
                {(['overview', 'top', 'seat'] as View[]).map((v) => (
                  <button key={v} type="button" aria-pressed={view === v} disabled={render === '2d'} onClick={() => setView(v)}>
                    {v === 'overview' ? 'Overview' : v === 'top' ? 'Top' : 'From seat'}
                  </button>
                ))}
              </div>
              <span className="bk-live">
                <span className="bk-dot" aria-hidden="true" />
                <span className="lk-num">{viewers}</span>&nbsp;viewing
              </span>
              <div className="bk-seg" role="group" aria-label="Map style">
                {(['3d', '2d'] as const).map((r) => (
                  <button key={r} type="button" aria-pressed={render === r} onClick={() => setRender(r)} disabled={r === '3d' && !hasWebGL()}>
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="bk-viewport" ref={stageRef} data-render={render}>
              {render === '3d' ? (
                <>
                  <Suspense fallback={<StageSkeleton mode={mode} />}>
                    <Scene3D layout={layout} statuses={statuses} selected={selected} mine={mine} view={view} focus={lastPick} onPick={pick} onHover={hover} />
                  </Suspense>
                  <div className="bk-tip" ref={tipRef} hidden role="tooltip" />
                  <p className="bk-hint">
                    {view === 'seat'
                      ? `View from ${layout.seats[lastPick]?.id ?? 'seat'}`
                      : 'Drag to rotate · scroll to zoom · tap a seat'}
                  </p>
                </>
              ) : (
                <SeatGrid layout={layout} statuses={statuses} selected={selected} mine={mine} onPick={pick} />
              )}
            </div>

            <ul className="bk-legend">
              <Legend color={layout.mode === 'cinema' ? COLORS.free : COLORS.free} label="Available" />
              {mode === 'cinema' ? <Legend color={COLORS.recliner} label="Recliner" /> : <Legend color={COLORS.women} label="Women only" />}
              <Legend color={COLORS.selected} label="Your pick" />
              <Legend color={COLORS.locked} label="Being booked" />
              <Legend color={COLORS.sold} label="Sold" />
              <Legend color={COLORS.mine} label="Yours" />
            </ul>
          </div>

          <div className="bk-kpis">
            <Kpi label="Available" value={counts.free} of={total} />
            <Kpi label="Being booked" value={counts.locked} of={total} tone="coral" />
            <Kpi label="Sold" value={counts.sold} of={total} />
            <div className="bk-kpi lk-card">
              <span className="bk-kpi-label">Fill rate</span>
              <span className="bk-kpi-value lk-num">{fill}%</span>
              <Spark pts={pts} max={total} />
            </div>
          </div>

          <TierTable layout={layout} statuses={statuses} selected={selected} mine={mine} />
        </section>

        <aside className="bk-side">
          <div className="lk-card bk-basket">
            {phase === 'booked' && ticket ? (
              <div className="bk-ticket lk-enter">
                <p className="lk-eyebrow">Booked</p>
                <p className="lk-display bk-ticket-code lk-num">{ticket.code}</p>
                <dl className="bk-dl">
                  <div>
                    <dt>{mode === 'cinema' ? 'Show' : 'Departure'}</dt>
                    <dd className="lk-num">
                      {slot.label} · {slot.sub}
                    </dd>
                  </div>
                  <div>
                    <dt>Seats</dt>
                    <dd>{ticket.seats.join(', ')}</dd>
                  </div>
                  <div>
                    <dt>Paid</dt>
                    <dd className="lk-num">{rupees(ticket.total)}</dd>
                  </div>
                </dl>
                <button type="button" className="lk-btn lk-btn-lg" onClick={again}>
                  Book more seats
                </button>
              </div>
            ) : (
              <>
                <div className="bk-basket-head">
                  <h2>{phase === 'held' ? 'Seats locked' : 'Your seats'}</h2>
                  {phase === 'held' ? (
                    <span className="bk-timer lk-num" data-low={left < 60000 || undefined} aria-live="off">
                      {mmss(left)}
                    </span>
                  ) : (
                    <span className="bk-count lk-num">
                      {basket.length}/{MAX_SEATS}
                    </span>
                  )}
                </div>
                {phase === 'held' && (
                  <div className="bk-holdbar" aria-hidden="true">
                    <span style={{ width: `${(left / HOLD_MS) * 100}%` }} />
                  </div>
                )}
                {basket.length === 0 ? (
                  <p className="bk-empty">{mode === 'cinema' ? 'Tap seats in the hall. The centre of rows F–K has the best sightline.' : 'Tap seats in the coach. Window seats on the left get the sunrise.'}</p>
                ) : (
                  <ul className="bk-lines">
                    {basket.map((i) => {
                      const s = layout.seats[i]!
                      return (
                        <li key={i}>
                          <span className="bk-seat-chip lk-num">{s.id}</span>
                          <span className="bk-line-text">
                            {tierLabel(layout, s.tier)}
                            {s.tags.length > 0 && <small>{s.tags.join(' · ')}</small>}
                          </span>
                          <span className="lk-num">{rupees(s.price)}</span>
                          {phase === 'pick' && (
                            <button type="button" className="bk-x" aria-label={`Remove ${s.id}`} onClick={() => pick(i)}>
                              ×
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
                <div className="bk-total">
                  <span>Total</span>
                  <span className="lk-num">{rupees(sum)}</span>
                </div>
                <p className="bk-fine">All-in price. Includes GST and convenience fee.</p>
                {notice && (
                  <p className="bk-notice" role="status">
                    {notice}
                  </p>
                )}
                {phase === 'pick' ? (
                  <button type="button" className="lk-btn lk-btn-primary lk-btn-lg" disabled={basket.length === 0 || busy} onClick={lock}>
                    {busy ? 'Locking…' : basket.length ? `Lock ${basket.length} seat${basket.length > 1 ? 's' : ''} for 5 min` : 'Select seats'}
                  </button>
                ) : (
                  <div className="bk-actions">
                    <button type="button" className="lk-btn lk-btn-signal lk-btn-lg" disabled={busy} onClick={pay}>
                      {busy ? 'Paying…' : `Pay ${rupees(sum)}`}
                    </button>
                    <button type="button" className="lk-btn lk-btn-ghost" onClick={release} disabled={busy}>
                      Release hold
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <Feed feed={feed} />
        </aside>
      </div>

      {phase !== 'booked' && basket.length > 0 && (
        <div className="bk-mobilebar">
          <span>
            <strong className="lk-num">{rupees(sum)}</strong>
            <small>
              {basket.map((i) => layout.seats[i]!.id).join(', ')}
              {phase === 'held' && ` · ${mmss(left)}`}
            </small>
          </span>
          {phase === 'pick' ? (
            <button type="button" className="lk-btn lk-btn-primary" disabled={busy} onClick={lock}>
              {busy ? 'Locking…' : 'Lock seats'}
            </button>
          ) : (
            <button type="button" className="lk-btn lk-btn-signal" disabled={busy} onClick={pay}>
              {busy ? 'Paying…' : 'Pay'}
            </button>
          )}
        </div>
      )}
    </main>
  )
}

/* ------------------------------------------------------------------ Pieces */

const STATUS_TEXT: Record<SeatStatus, string> = { free: 'Available', locked: 'Someone is booking', sold: 'Sold' }

const tierLabel = (layout: Layout, id: string) => layout.tiers.find((t) => t.id === id)?.label ?? id
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function remember(m: Mode) {
  try {
    localStorage.setItem('seatlock-mode', m)
  } catch {
    /* ignore */
  }
}

function defaultFocus(layout: Layout, statuses: SeatStatus[]) {
  const best = layout.seats.findIndex((s, i) => statuses[i] === 'free' && (layout.mode === 'cinema' ? s.tags.includes('Sweet spot') : s.tags.includes('Window')))
  return best >= 0 ? best : Math.floor(layout.seats.length / 2)
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <li>
      <span style={{ background: color }} />
      {label}
    </li>
  )
}

function Kpi({ label, value, of, tone }: { label: string; value: number; of: number; tone?: 'coral' }) {
  return (
    <div className="bk-kpi lk-card" data-tone={tone}>
      <span className="bk-kpi-label">{label}</span>
      <span className="bk-kpi-value lk-num">{value}</span>
      <span className="bk-kpi-sub lk-num">of {of}</span>
    </div>
  )
}

function Spark({ pts, max }: { pts: number[]; max: number }) {
  if (pts.length < 2) return <span className="bk-kpi-sub">live</span>
  const lo = Math.min(...pts)
  const hi = Math.max(...pts, lo + 1)
  const w = 100
  const h = 26
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${h - ((p - lo) / (hi - lo)) * (h - 4) - 2}`).join(' ')
  return (
    <svg className="bk-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label={`Sold went from ${pts[0]} to ${pts[pts.length - 1]} of ${max}`} role="img">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function TierTable({ layout, statuses, selected, mine }: { layout: Layout; statuses: SeatStatus[]; selected: Set<number>; mine: Set<number> }) {
  return (
    <div className="lk-card bk-tiers">
      <table>
        <caption className="sr-only">Availability by {layout.mode === 'cinema' ? 'tier' : 'seat type'}</caption>
        <thead>
          <tr>
            <th scope="col">{layout.mode === 'cinema' ? 'Tier' : 'Seat type'}</th>
            <th scope="col">Price</th>
            <th scope="col">Availability</th>
            <th scope="col" className="bk-num">
              Left
            </th>
          </tr>
        </thead>
        <tbody>
          {layout.tiers.map((t) => {
            let all = 0
            let free = 0
            layout.seats.forEach((s, i) => {
              if (s.tier !== t.id) return
              all++
              if (statuses[i] === 'free' && !selected.has(i) && !mine.has(i)) free++
            })
            const pct = all ? (free / all) * 100 : 0
            return (
              <tr key={t.id}>
                <th scope="row">
                  {t.label}
                  <small>{t.note}</small>
                </th>
                <td className="lk-num">{rupees(t.price)}</td>
                <td>
                  <span className="bk-meter" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} data-low={pct < 20 || undefined} />
                  </span>
                </td>
                <td className="bk-num lk-num">
                  {free}
                  <small>/{all}</small>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Feed({ feed }: { feed: FeedItem[] }) {
  const now = useNow(true)
  return (
    <div className="lk-card bk-feed">
      <div className="bk-basket-head">
        <h2>Live activity</h2>
        <span className="bk-live">
          <span className="bk-dot" aria-hidden="true" />
          Live
        </span>
      </div>
      {feed.length === 0 ? (
        <p className="bk-empty">Watching for other bookings…</p>
      ) : (
        <ol className="bk-feed-list">
          {feed.slice(0, 8).map((f) => (
            <li key={f.id} data-kind={f.kind}>
              <span className="bk-feed-dot" aria-hidden="true" />
              <span className="bk-feed-text">
                <strong>{f.who}</strong> {f.kind === 'lock' ? 'is booking' : f.kind === 'sold' ? 'bought' : 'released'} <span className="lk-num">{f.seats.join(', ')}</span>
              </span>
              <time className="lk-num">{ago(now - f.at)}</time>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
const ago = (ms: number) => (ms < 5000 ? 'now' : ms < 60000 ? `${Math.floor(ms / 1000)}s` : `${Math.floor(ms / 60000)}m`)

function SeatGrid({ layout, statuses, selected, mine, onPick }: { layout: Layout; statuses: SeatStatus[]; selected: Set<number>; mine: Set<number>; onPick: (i: number) => void }) {
  return (
    <div className="bk-grid2d" data-mode={layout.mode}>
      <div className="bk-front">{layout.mode === 'cinema' ? 'Screen' : 'Front · Driver'}</div>
      <div className="bk-rows">
        {layout.grid.map((row, r) => (
          <div key={r} className="bk-row">
            <span className="bk-rowlabel">{layout.rowLabels[r]}</span>
            {row.map((i, c) => {
              if (i === null) return <span key={`g${c}`} className="bk-gap" />
              const s = layout.seats[i]!
              const st = mine.has(i) ? 'mine' : selected.has(i) ? 'selected' : statuses[i]!
              return (
                <button
                  key={i}
                  type="button"
                  className="bk-cell"
                  data-s={st}
                  data-tag={s.tags.includes('Women only') ? 'women' : s.tier === 'recliner' ? 'recliner' : undefined}
                  aria-pressed={st === 'selected'}
                  aria-disabled={st === 'sold' || st === 'locked' || undefined}
                  aria-label={`${s.id}, ${tierLabel(layout, s.tier)}, ${rupees(s.price)}, ${st === 'free' ? 'available' : st === 'selected' ? 'selected' : st === 'mine' ? 'yours' : st === 'locked' ? 'being booked' : 'sold'}`}
                  onClick={() => onPick(i)}
                >
                  {s.col + 1}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function StageSkeleton({ mode }: { mode: Mode }) {
  return (
    <div className="bk-skel" data-mode={mode} role="status">
      <span className="bk-spin" aria-hidden="true" />
      Loading 3D {mode === 'cinema' ? 'hall' : 'coach'}…
    </div>
  )
}
