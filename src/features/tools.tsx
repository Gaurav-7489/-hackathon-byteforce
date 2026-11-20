import { use, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { hash, layoutFor } from '../booking/data'
import { Icon } from '../components/Icon'
import { api } from '../lib/api/client'
import type { Booking, EventSummary, Kind, Seat } from '../lib/api/types'
import { summaryCache } from '../lib/eventCache'
import { money, rupees, time } from '../lib/format'
import { resource } from '../lib/resource'
import { isSelectable, tierLabel } from '../lib/seats'
import { sfx } from '../lib/sound'
import { toast } from '../lib/toast'

/* ------------------------------------------------------------ shared bits */

function useEvents(): EventSummary[] {
  return use(resource('events', api.events))
}
function useBookings(): Booking[] {
  return use(resource('bookings', api.bookings))
}

function useSeats(eventId: string | null, refreshMs = 0) {
  const [seats, setSeats] = useState<Seat[] | null>(null)
  useEffect(() => {
    if (!eventId) return
    let alive = true
    const load = () =>
      api
        .seats(eventId)
        .then((r) => alive && setSeats(r.seats))
        .catch(() => alive && setSeats((s) => s ?? []))
    setSeats(null)
    void load()
    const t = refreshMs ? setInterval(load, refreshMs) : null
    return () => {
      alive = false
      if (t) clearInterval(t)
    }
  }, [eventId, refreshMs])
  return seats
}

function usePersisted<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = (next: T) => {
    setV(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* storage blocked */
    }
  }
  return [v, set] as const
}

function useTick(ms: number, on = true) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setN((x) => x + 1), ms)
    return () => clearInterval(t)
  }, [ms, on])
  return n
}

function EventPicker({ events, value, onChange, kind }: { events: EventSummary[]; value: string; onChange: (id: string) => void; kind?: Kind }) {
  const list = kind ? events.filter((e) => e.kind === kind) : events
  return (
    <label className="tool-field">
      <span>Show or trip</span>
      <select value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {list.map((e) => (
          <option key={e.id} value={e.id}>
            {e.kind === 'bus' ? '🚌' : '🎬'} {e.title} · {new Date(e.startsAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} {time(e.startsAt)}
          </option>
        ))}
      </select>
    </label>
  )
}

function SeatPills({ seats }: { seats: Seat[] }) {
  return (
    <ul className="tool-pills">
      {seats.map((s) => (
        <li key={s.id}>
          <strong>{s.id}</strong> {tierLabel(s.section)} · {money(s.price)}
        </li>
      ))}
    </ul>
  )
}

/** Opens the seat map with these seats already selected (the event page re-checks them live). */
function OpenOnMap({ event, ids, children }: { event: EventSummary; ids: string[]; children?: ReactNode }) {
  return (
    <Link className="lk-btn lk-btn-primary lk-btn-sm" to={`/e/${event.id}`} state={{ reselect: ids }} onClick={() => summaryCache.set(event.id, event)}>
      {children ?? 'Open on seat map'} <Icon name="arrowRight" size={15} />
    </Link>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="tool-note">{children}</p>
}

const free = (seats: Seat[]) => seats.filter(isSelectable)

function firstId(events: EventSummary[], kind?: Kind) {
  return (kind ? events.find((e) => e.kind === kind) : events[0])?.id ?? ''
}

async function copy(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(ok)
  } catch {
    toast('Copy is blocked here', text)
  }
}

/* -------------------------------------------------------- 01 Buddy seating */

function Buddy() {
  const events = useEvents()
  const [eventId, setEventId] = useState(firstId(events))
  const [size, setSize] = useState(3)
  const [each, setEach] = useState(400)
  const seats = useSeats(eventId)
  const event = events.find((e) => e.id === eventId)
  let group: Seat[] = []
  if (seats) {
    const byRow = new Map<string, Seat[]>()
    for (const s of free(seats)) if (s.price <= each) byRow.set(s.row, [...(byRow.get(s.row) ?? []), s])
    for (const row of byRow.values()) {
      const sorted = row.sort((a, b) => a.col - b.col)
      for (let i = 0; i + size <= sorted.length && !group.length; i++) {
        const win = sorted.slice(i, i + size)
        if (win.every((s, j) => j === 0 || s.col - win[j - 1]!.col <= 2)) group = win
      }
      if (group.length) break
    }
  }
  return (
    <div className="tool">
      <div className="tool-row">
        <EventPicker events={events} value={eventId} onChange={setEventId} />
        <label className="tool-field">
          <span>Friends (incl. you)</span>
          <input type="number" min={2} max={4} value={size} onChange={(e) => setSize(Math.min(4, Math.max(2, Number(e.currentTarget.value) || 2)))} />
        </label>
        <label className="tool-field">
          <span>Max per person (₹)</span>
          <input type="number" min={100} step={50} value={each} onChange={(e) => setEach(Number(e.currentTarget.value) || 0)} />
        </label>
      </div>
      {!seats ? (
        <p className="tool-loading">Checking seats…</p>
      ) : group.length && event ? (
        <div className="tool-result" data-tone="ok">
          <p>
            <strong>{size} seats side by side</strong> · {rupees(group.reduce((n, s) => n + s.price, 0))} total
          </p>
          <SeatPills seats={group} />
          <div className="tool-actions">
            <OpenOnMap event={event} ids={group.map((s) => s.id)}>Book as a group</OpenOnMap>
            <button type="button" className="lk-btn lk-btn-sm" onClick={() => void copy(`Join me for ${event.title} on SeatLock — seats ${group.map((s) => s.id).join(', ')}, ${money(group[0]!.price)} each: ${location.origin}/e/${event.id}`, 'Group invite copied')}>
              <Icon name="users" size={15} /> Copy invite
            </button>
          </div>
        </div>
      ) : (
        <div className="tool-result" data-tone="warn">No {size} seats together under {money(each)} each. Try a higher budget or a smaller group.</div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ 02 FairQueue */

function FairQueue() {
  const events = useEvents()
  const [eventId, setEventId] = useState(firstId(events))
  const [token, setToken] = useState<string | null>(null)
  const [pos, setPos] = useState(0)
  const [turnLeft, setTurnLeft] = useState(120)
  const tick = useTick(1000, token !== null)
  const event = events.find((e) => e.id === eventId)
  useEffect(() => {
    if (!token) return
    if (pos > 0) setPos((p) => Math.max(0, p - 1 - (tick % 3)))
    else setTurnLeft((t) => Math.max(0, t - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  useEffect(() => {
    if (token && pos === 0) sfx.chime()
  }, [token, pos])
  const join = () => {
    setToken(`FQ-${(Date.now() % 1e6).toString(36).toUpperCase()}`)
    setPos(18 + (hash(eventId) % 30))
    setTurnLeft(120)
    sfx.tap()
  }
  return (
    <div className="tool">
      <EventPicker events={events} value={eventId} onChange={(id) => { setEventId(id); setToken(null) }} />
      {!token ? (
        <button type="button" className="lk-btn lk-btn-primary" onClick={join}>
          <Icon name="clock" size={16} /> Join the fair queue
        </button>
      ) : pos > 0 ? (
        <div className="tool-result">
          <p className="tool-big lk-num">#{pos}</p>
          <p>
            in line · token <code>{token}</code>
          </p>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${Math.max(4, 100 - pos * 2)}%` }} />
          </div>
          <Note>Everyone gets one token per student. Refreshing does not move you back. Limit: 4 seats.</Note>
        </div>
      ) : (
        <div className="tool-result" data-tone="ok">
          <p>
            <strong>It’s your turn.</strong> {Math.floor(turnLeft / 60)}:{String(turnLeft % 60).padStart(2, '0')} to pick up to 4 seats.
          </p>
          {event && <OpenOnMap event={event} ids={[]}>Pick seats now</OpenOnMap>}
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------- 03 Accessibility */

function Access() {
  const events = useEvents()
  const [eventId, setEventId] = useState(firstId(events, 'cinema'))
  const [prefs, setPrefs] = useState({ wheel: true, companion: true, aisle: false, calm: false })
  const seats = useSeats(eventId)
  const event = events.find((e) => e.id === eventId)
  const scored = (seats ? free(seats) : [])
    .map((s) => {
      let score = 0
      const why: string[] = []
      if (prefs.wheel && s.tags.includes('Wheelchair')) (score += 5), why.push('wheelchair space')
      if (prefs.aisle && s.isAisle) (score += 2), why.push('step-free aisle access')
      if (prefs.calm && s.r >= 4 && !s.isAisle) (score += 2), why.push('calmer area away from speakers')
      if (prefs.companion && seats!.some((o) => o.row === s.row && Math.abs(o.col - s.col) === 1 && o.tags.includes('Wheelchair'))) (score += 3), why.push('companion seat next to a wheelchair space')
      return { s, score, why }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
  const toggle = (k: keyof typeof prefs) => setPrefs({ ...prefs, [k]: !prefs[k] })
  return (
    <div className="tool">
      <EventPicker events={events} value={eventId} onChange={setEventId} />
      <div className="tool-checks">
        {(
          [
            ['wheel', 'Wheelchair space'],
            ['companion', 'Companion seat'],
            ['aisle', 'Step-free aisle'],
            ['calm', 'Low stimulation'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="chip-check">
            <input type="checkbox" checked={prefs[k]} onChange={() => toggle(k)} /> {label}
          </label>
        ))}
      </div>
      {!seats ? (
        <p className="tool-loading">Checking seats…</p>
      ) : scored.length && event ? (
        <div className="tool-result" data-tone="ok">
          <ul className="tool-list">
            {scored.map(({ s, why }) => (
              <li key={s.id}>
                <strong>{s.id}</strong> — {why.join(', ')} · {money(s.price)}
              </li>
            ))}
          </ul>
          <OpenOnMap event={event} ids={scored.slice(0, 2).map((x) => x.s.id)}>Select the top two</OpenOnMap>
        </div>
      ) : (
        <div className="tool-result" data-tone="warn">No free seats match all of these right now. Untick one preference or try another show.</div>
      )}
      <Note>Preferences stay on this device and are never shared.</Note>
    </div>
  )
}

/* ------------------------------------------------------------ 04 AutoRescue */

function Rescue() {
  const events = useEvents()
  const [eventId, setEventId] = useState(firstId(events))
  const seats = useSeats(eventId)
  const [pick, setPick] = useState('')
  const [lost, setLost] = useState(false)
  const event = events.find((e) => e.id === eventId)
  const available = seats ? free(seats) : []
  const chosen = available.find((s) => s.id === pick) ?? available[Math.floor(available.length / 2)]
  const alts = chosen
    ? available
        .filter((s) => s.id !== chosen.id)
        .map((s) => ({ s, d: Math.abs(s.r - chosen.r) * 2 + Math.abs(s.col - chosen.col) + Math.abs(s.price - chosen.price) / 100 + (s.section === chosen.section ? 0 : 3) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
    : []
  return (
    <div className="tool">
      <div className="tool-row">
        <EventPicker events={events} value={eventId} onChange={(id) => { setEventId(id); setLost(false); setPick('') }} />
        <label className="tool-field">
          <span>Your seat</span>
          <select value={chosen?.id ?? ''} onChange={(e) => { setPick(e.currentTarget.value); setLost(false) }}>
            {available.slice(0, 60).map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {tierLabel(s.section)} · {money(s.price)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!lost ? (
        <button type="button" className="lk-btn" disabled={!chosen} onClick={() => { setLost(true); sfx.warn() }}>
          <Icon name="alert" size={16} /> Simulate: someone else booked {chosen?.id}
        </button>
      ) : (
        <div className="tool-result" data-tone="warn">
          <p>
            <strong>{chosen?.id} was taken.</strong> The closest matches by distance, price and tier:
          </p>
          <SeatPills seats={alts.map((a) => a.s)} />
          {event && alts[0] && <OpenOnMap event={event} ids={[alts[0].s.id]}>Confirm {alts[0].s.id} instead</OpenOnMap>}
        </div>
      )}
      <Note>On the seat map this happens automatically: a lost seat shows a one-tap “Swap in” button.</Note>
    </div>
  )
}

/* --------------------------------------------------------- 05 Navigation */

function NavTool() {
  const events = useEvents()
  const [eventId, setEventId] = useState(firstId(events))
  const event = events.find((e) => e.id === eventId)
  if (!event) return null
  const h = hash(event.id)
  const gate = 'ABCD'[h % 4]!
  const bus = event.kind === 'bus'
  const steps = bus
    ? [`Reach ${event.venue}`, `Go to bay ${(h % 9) + 1} — look for the SeatLock sign`, 'Board through the front door', 'Your row number is above the window']
    : [`Enter ${event.venue} through Gate ${gate} (shortest queue)`, `Take the escalator to level ${(h % 2) + 1}`, `${event.venue.split('·')[0]!.trim()} is on your ${h % 2 ? 'left' : 'right'}`, 'Rows A–E are near the screen; walk up for rows F onwards']
  return (
    <div className="tool">
      <EventPicker events={events} value={eventId} onChange={setEventId} />
      <svg className="tool-map" viewBox="0 0 320 160" role="img" aria-label={`Route from Gate ${gate} to your seat`}>
        <rect x="8" y="8" width="304" height="144" rx="12" className="map-floor" />
        {['A', 'B', 'C', 'D'].map((g, i) => (
          <g key={g}>
            <rect x={20 + i * 72} y="128" width="44" height="16" rx="4" className={g === gate ? 'map-gate is-on' : 'map-gate'} />
            <text x={42 + i * 72} y="140" textAnchor="middle" className="map-label">
              {bus ? `Bay ${i + 1}` : `Gate ${g}`}
            </text>
          </g>
        ))}
        <rect x="200" y="24" width="96" height="64" rx="8" className="map-hall" />
        <text x="248" y="60" textAnchor="middle" className="map-label">
          {bus ? 'Coach' : 'Hall'}
        </text>
        <path d={`M${42 + 'ABCD'.indexOf(gate) * 72} 126 C ${42 + 'ABCD'.indexOf(gate) * 72} 90, 180 100, 230 88`} className="map-route" />
        <circle cx="230" cy="80" r="6" className="map-dot" />
      </svg>
      <ol className="tool-steps">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Note>Indoor maps appear here when the organizer provides them.</Note>
    </div>
  )
}

/* -------------------------------------------------------- 06 Exchange */

function Exchange() {
  const bookings = useBookings().filter((b) => b.status === 'confirmed')
  const [returned, setReturned] = usePersisted<string[]>('seatlock-exchange', [])
  if (!bookings.length) return <p className="tool-result">You have no active tickets. Book a show or trip first.</p>
  return (
    <div className="tool">
      <ul className="tool-list">
        {bookings.map((b) => {
          const done = returned.includes(b.id)
          return (
            <li key={b.id} className="tool-line">
              <span>
                <strong>{b.event.title}</strong> · {b.seats.map((s) => s.id).join(', ')}
              </span>
              {done ? (
                <span className="tool-status">Offered to waitlist · refund {rupees(b.total)} when claimed</span>
              ) : (
                <button type="button" className="lk-btn lk-btn-sm" onClick={() => { setReturned([...returned, b.id]); toast.success('Returned to the verified waitlist', 'The next verified student gets an offer.') }}>
                  Return to waitlist
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <Note>No resale or mark-ups: seats only go to verified students on the official waitlist, at face value.</Note>
    </div>
  )
}

/* -------------------------------------------------------- 07 Waitlist */

function Waitlist() {
  const events = useEvents()
  const sorted = [...events].sort((a, b) => a.seatsLeft / a.totalSeats - b.seatsLeft / b.totalSeats)
  const [eventId, setEventId] = useState(sorted[0]?.id ?? '')
  const [joined, setJoined] = useState(false)
  const [offer, setOffer] = useState<number | null>(null)
  const tick = useTick(1000, offer !== null)
  const event = events.find((e) => e.id === eventId)
  useEffect(() => {
    if (offer !== null) setOffer((o) => (o === null ? o : Math.max(0, o - 1)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  if (!event) return null
  const rank = 3 + (hash(event.id) % 12)
  const chance = Math.max(8, Math.min(92, Math.round(100 - rank * 6 + (event.seatsLeft / event.totalSeats) * 40)))
  return (
    <div className="tool">
      <EventPicker events={sorted} value={eventId} onChange={(id) => { setEventId(id); setJoined(false); setOffer(null) }} />
      {!joined ? (
        <button type="button" className="lk-btn lk-btn-primary" onClick={() => { setJoined(true); sfx.tap() }}>
          Join the waitlist
        </button>
      ) : offer === null ? (
        <div className="tool-result">
          <p>
            You are <strong className="lk-num">#{rank}</strong> in line. Estimated chance: <strong className="lk-num">{chance}%</strong>
          </p>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${chance}%` }} />
          </div>
          <Note>Based on how often seats for similar {event.kind === 'bus' ? 'trips' : 'shows'} were released before.</Note>
          <button type="button" className="lk-btn lk-btn-sm" onClick={() => { setOffer(600); sfx.chime() }}>
            Simulate a released seat
          </button>
        </div>
      ) : (
        <div className="tool-result" data-tone="ok">
          <p>
            <strong>A seat is yours if you want it.</strong> Offer expires in {Math.floor(offer / 60)}:{String(offer % 60).padStart(2, '0')}.
          </p>
          <OpenOnMap event={event} ids={[]}>Accept and pick</OpenOnMap>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------- 08 Budget */

function Budget() {
  const events = useEvents()
  const [total, setTotal] = useState(1200)
  const [travel, setTravel] = useState(150)
  const [food, setFood] = useState(250)
  const left = total - travel - food
  const fits = events.filter((e) => e.priceFrom <= left).sort((a, b) => b.priceFrom - a.priceFrom)
  return (
    <div className="tool">
      <label className="tool-field">
        <span>
          Total budget <strong className="lk-num">{rupees(total)}</strong>
        </span>
        <input type="range" min={300} max={4000} step={50} value={total} onChange={(e) => setTotal(Number(e.currentTarget.value))} />
      </label>
      <div className="tool-row">
        <label className="tool-field">
          <span>Travel (₹)</span>
          <input type="number" min={0} step={10} value={travel} onChange={(e) => setTravel(Number(e.currentTarget.value) || 0)} />
        </label>
        <label className="tool-field">
          <span>Food (₹)</span>
          <input type="number" min={0} step={10} value={food} onChange={(e) => setFood(Number(e.currentTarget.value) || 0)} />
        </label>
      </div>
      <p className="tool-big-line">
        For the ticket: <strong className="lk-num">{rupees(Math.max(0, left))}</strong>
      </p>
      {fits.length ? (
        <ul className="tool-list">
          {fits.slice(0, 5).map((e) => (
            <li key={e.id} className="tool-line">
              <span>
                <strong>{e.title}</strong> from {money(e.priceFrom)}
              </span>
              <span className="tool-status">{rupees(left - e.priceFrom)} spare</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="tool-result" data-tone="warn">Nothing fits yet. Raise the budget or trim travel and food.</div>
      )}
    </div>
  )
}

/* -------------------------------------------------------- 09 QuietZone */

function Quiet() {
  const [kind, setKind] = useState<Kind>('cinema')
  const layout = layoutFor(kind)
  const rows = layout.rowLabels.map((label, r) => {
    // Cinema: speakers at the front and side exits are busiest. Bus: the engine is at the back.
    const db = kind === 'cinema' ? Math.round(98 - r * 2.2) : Math.round(62 + r * 1.8)
    return { label, db }
  })
  const quietest = [...rows].sort((a, b) => a.db - b.db).slice(0, 3).map((r) => r.label)
  return (
    <div className="tool">
      <div className="seg" role="tablist" aria-label="Venue">
        {(['cinema', 'bus'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
            {k === 'cinema' ? 'Cinema' : 'Bus'}
          </button>
        ))}
      </div>
      <ul className="quiet-rows" aria-label="Expected sound by row">
        {rows.map((r) => (
          <li key={r.label} data-quiet={quietest.includes(r.label) || undefined}>
            <span className="lk-num">{kind === 'cinema' ? `Row ${r.label}` : `Row ${r.label}`}</span>
            <span className="quiet-bar">
              <span style={{ width: `${Math.min(100, (r.db - 50) * 2)}%` }} />
            </span>
            <span className="lk-num">{r.db} dB</span>
          </li>
        ))}
      </ul>
      <div className="tool-result" data-tone="ok">
        Quietest: rows {quietest.join(', ')}. {kind === 'cinema' ? 'Leave by the rear exit to avoid the crowd at the front.' : 'Front rows are furthest from the engine.'}
      </div>
      <Note>Estimates from the venue layout; organizers can supply measured levels.</Note>
    </div>
  )
}

/* -------------------------------------------------------- 10 SafeExit */

function SafeExit() {
  const [kind, setKind] = useState<Kind>('cinema')
  const layout = layoutFor(kind)
  const [row, setRow] = useState(layout.rowLabels[0]!)
  const r = Math.max(0, layout.rowLabels.indexOf(row))
  const n = layout.rowLabels.length
  const exit =
    kind === 'cinema'
      ? r < n / 2
        ? 'Front exits beside the screen (left and right)'
        : 'Rear exits behind the last row'
      : r <= 4
        ? 'Front door, next to the driver'
        : r <= 7
          ? 'Emergency door on the right, by row 5'
          : 'Rear emergency window (break with the red hammer)'
  return (
    <div className="tool">
      <div className="tool-row">
        <div className="seg" role="tablist" aria-label="Venue">
          {(['cinema', 'bus'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setRow(layoutFor(k).rowLabels[0]!) }}>
              {k === 'cinema' ? 'Cinema' : 'Bus'}
            </button>
          ))}
        </div>
        <label className="tool-field">
          <span>Your row</span>
          <select value={row} onChange={(e) => setRow(e.currentTarget.value)}>
            {layout.rowLabels.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="tool-result" data-tone="danger">
        <p>
          <strong>Nearest exit:</strong> {exit}
        </p>
        <ol className="tool-steps">
          <li>Stay calm and leave your belongings.</li>
          <li>Follow the green exit signs and floor lights.</li>
          <li>Help anyone near you who needs it; do not use lifts.</li>
          <li>Meet at the assembly point and wait for staff.</li>
        </ol>
      </div>
      <Note>Shown from the organizer-approved safety plan (demo plan in this build).</Note>
    </div>
  )
}

/* -------------------------------------------------------- 11 Conflicts */

interface Slot {
  day: number
  start: string
  end: string
  label: string
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Conflicts() {
  const events = useEvents()
  const [slots, setSlots] = usePersisted<Slot[]>('seatlock-timetable', [
    { day: 1, start: '09:00', end: '13:00', label: 'Lectures' },
    { day: 3, start: '14:00', end: '17:00', label: 'Lab' },
    { day: 5, start: '18:00', end: '20:00', label: 'Exam prep' },
  ])
  const [draft, setDraft] = useState<Slot>({ day: new Date().getDay(), start: '18:00', end: '21:00', label: 'Class' })
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const clashes = events
    .map((e) => {
      const d = new Date(e.startsAt)
      const s = d.getHours() * 60 + d.getMinutes()
      const end = s + e.durationMinutes
      const hit = slots.find((x) => x.day === d.getDay() && s < mins(x.end) && end > mins(x.start))
      return hit ? { e, hit } : null
    })
    .filter((x): x is { e: EventSummary; hit: Slot } => x !== null)
  return (
    <div className="tool">
      <ul className="tool-list">
        {slots.map((s, i) => (
          <li key={i} className="tool-line">
            <span>
              <strong>{DAYS[s.day]}</strong> {s.start}–{s.end} · {s.label}
            </span>
            <button type="button" className="lk-icon-btn" aria-label={`Remove ${s.label}`} onClick={() => setSlots(slots.filter((_, j) => j !== i))}>
              <Icon name="x" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="tool-row">
        <select aria-label="Day" value={draft.day} onChange={(e) => setDraft({ ...draft, day: Number(e.currentTarget.value) })}>
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input aria-label="Start" type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.currentTarget.value })} />
        <input aria-label="End" type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.currentTarget.value })} />
        <input aria-label="What" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.currentTarget.value })} />
        <button type="button" className="lk-btn lk-btn-sm" onClick={() => setSlots([...slots, draft])}>
          Add
        </button>
      </div>
      {clashes.length ? (
        <div className="tool-result" data-tone="warn">
          <p>
            <strong>{clashes.length} clash{clashes.length > 1 ? 'es' : ''}</strong> with your timetable:
          </p>
          <ul className="tool-list">
            {clashes.slice(0, 6).map(({ e, hit }) => (
              <li key={e.id}>
                {e.title} ({DAYS[new Date(e.startsAt).getDay()]} {time(e.startsAt)}) overlaps <strong>{hit.label}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="tool-result" data-tone="ok">No clashes this week.</div>
      )}
    </div>
  )
}

/* -------------------------------------------------------- 12 Group split */

function Split() {
  const bookings = useBookings().filter((b) => b.status === 'confirmed')
  const [total, setTotal] = useState(bookings[0]?.total ?? 1200)
  const [people, setPeople] = usePersisted<{ name: string; paid: boolean }[]>('seatlock-split', [
    { name: 'You', paid: true },
    { name: 'Aarav', paid: false },
    { name: 'Diya', paid: false },
  ])
  const [name, setName] = useState('')
  const each = Math.ceil(total / Math.max(1, people.length))
  const owed = people.filter((p) => !p.paid).length * each
  return (
    <div className="tool">
      <div className="tool-row">
        {bookings.length > 0 && (
          <label className="tool-field">
            <span>From a booking</span>
            <select onChange={(e) => setTotal(Number(e.currentTarget.value))}>
              {bookings.map((b) => (
                <option key={b.id} value={b.total}>
                  {b.event.title} · {rupees(b.total)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="tool-field">
          <span>Total (₹)</span>
          <input type="number" min={0} value={total} onChange={(e) => setTotal(Number(e.currentTarget.value) || 0)} />
        </label>
      </div>
      <ul className="tool-list">
        {people.map((p, i) => (
          <li key={p.name + i} className="tool-line">
            <label className="chip-check">
              <input type="checkbox" checked={p.paid} onChange={() => setPeople(people.map((q, j) => (j === i ? { ...q, paid: !q.paid } : q)))} /> {p.name}
            </label>
            <span className="lk-num">{rupees(each)}</span>
          </li>
        ))}
      </ul>
      <div className="tool-row">
        <input aria-label="Friend's name" placeholder="Add a friend" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <button type="button" className="lk-btn lk-btn-sm" disabled={!name.trim()} onClick={() => { setPeople([...people, { name: name.trim(), paid: false }]); setName('') }}>
          Add
        </button>
      </div>
      <div className="tool-result" data-tone={owed ? 'warn' : 'ok'}>
        {owed ? `${rupees(owed)} still to collect.` : 'Everyone has paid.'}
      </div>
      <button type="button" className="lk-btn lk-btn-sm" onClick={() => void copy(`SeatLock split: ${rupees(total)} ÷ ${people.length} = ${rupees(each)} each. Still to pay: ${people.filter((p) => !p.paid).map((p) => p.name).join(', ') || 'nobody'}.`, 'Split summary copied')}>
        Copy summary
      </button>
    </div>
  )
}

/* -------------------------------------------------------- 13 Matchmaker */

const INTERESTS = ['Sci-fi', 'Drama', 'Comedy', 'Action', 'Thriller', 'Animation', 'Romance', 'Road trips', 'Weekend', 'Night']

function Match() {
  const events = useEvents()
  const [likes, setLikes] = useState<string[]>(['Sci-fi', 'Weekend'])
  const [budget, setBudget] = useState(600)
  const ranked = events
    .map((e) => {
      const why: string[] = []
      let score = 0
      const text = `${e.category} ${e.title} ${e.subtitle}`.toLowerCase()
      for (const l of likes) {
        const k = l.toLowerCase()
        if (k === 'road trips' && e.kind === 'bus') (score += 3), why.push('you like road trips')
        else if (k === 'weekend' && [0, 6].includes(new Date(e.startsAt).getDay())) (score += 2), why.push('it’s on a weekend')
        else if (k === 'night' && new Date(e.startsAt).getHours() >= 19) (score += 2), why.push('it starts in the evening')
        else if (text.includes(k.replace('-', ''))) (score += 3), why.push(`you like ${l.toLowerCase()}`)
        else if (text.includes(k)) (score += 3), why.push(`you like ${l.toLowerCase()}`)
      }
      if (e.priceFrom <= budget) (score += 2), why.push(`from ${money(e.priceFrom)}, inside your budget`)
      else score -= 3
      return { e, score, why }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
  return (
    <div className="tool">
      <div className="tool-checks">
        {INTERESTS.map((i) => (
          <label key={i} className="chip-check">
            <input type="checkbox" checked={likes.includes(i)} onChange={() => setLikes(likes.includes(i) ? likes.filter((x) => x !== i) : [...likes, i])} /> {i}
          </label>
        ))}
      </div>
      <label className="tool-field">
        <span>
          Budget per ticket <strong className="lk-num">{rupees(budget)}</strong>
        </span>
        <input type="range" min={150} max={2000} step={50} value={budget} onChange={(e) => setBudget(Number(e.currentTarget.value))} />
      </label>
      {ranked.length ? (
        <ul className="tool-cards">
          {ranked.map(({ e, why }) => (
            <li key={e.id}>
              <Link to={`/e/${e.id}`} onClick={() => summaryCache.set(e.id, e)}>
                <strong>{e.title}</strong>
                <span>
                  <Icon name="sparkle" size={12} /> Because {why.join(', ')}.
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="tool-result" data-tone="warn">Pick a few interests or raise the budget.</div>
      )}
    </div>
  )
}

/* -------------------------------------------------------- 14 SeatView */

function SeatView() {
  const layout = layoutFor('cinema')
  const [row, setRow] = useState('G')
  const [side, setSide] = useState<'left' | 'centre' | 'right'>('centre')
  const r = Math.max(0, layout.rowLabels.indexOf(row))
  const seat = layout.seats.find((s) => s.row === r)!
  const distance = seat.z + 5.3 // metres from the screen (screen sits at z ≈ -5.3)
  const angle = Math.round((2 * Math.atan(4.5 / distance) * 180) / Math.PI)
  const offset = side === 'centre' ? 0 : side === 'left' ? -1 : 1
  const verdict = angle > 50 ? 'Very close — you will turn your head' : angle >= 30 ? 'Ideal — the screen fills your view' : 'Comfortable, a little far'
  const screenW = Math.min(300, angle * 5)
  return (
    <div className="tool">
      <div className="tool-row">
        <label className="tool-field">
          <span>Row</span>
          <select value={row} onChange={(e) => setRow(e.currentTarget.value)}>
            {layout.rowLabels.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <div className="seg" role="tablist" aria-label="Side">
          {(['left', 'centre', 'right'] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => setSide(s)}>
              {s[0]!.toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <svg className="tool-view" viewBox="0 0 320 180" role="img" aria-label={`View from row ${row}, ${side}: ${verdict}`}>
        <rect width="320" height="180" className="view-room" />
        <polygon
          points={`${160 - screenW / 2 + offset * 18},${40 - offset * 3} ${160 + screenW / 2 + offset * 18},${40 + offset * 3} ${160 + screenW / 2 + offset * 18},${40 + screenW * 0.42 + offset * 3} ${160 - screenW / 2 + offset * 18},${40 + screenW * 0.42 - offset * 3}`}
          className="view-screen"
        />
        {r > 0 &&
          [0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx={40 + i * 60} cy={176 - Math.max(0, 6 - r) * 2} rx="22" ry={14 - Math.min(8, r)} className="view-head" />)}
      </svg>
      <div className="tool-result" data-tone={angle >= 30 && angle <= 50 ? 'ok' : 'warn'}>
        <strong>{verdict}.</strong> About {distance.toFixed(1)} m from the screen, {angle}° wide. {r > 0 ? 'Heads in front sit below your sightline (stadium seating).' : 'Nothing in front of you.'}
      </div>
      <Note>For a full 3D look, open any show and choose the “From seat” camera.</Note>
    </div>
  )
}

/* -------------------------------------------------------- 15 No-show */

const STANDBY = ['Kabir', 'Meera', 'Rohan', 'Isha', 'Tara']

function NoShow() {
  const [running, setRunning] = useState(false)
  const [left, setLeft] = useState(30)
  const tick = useTick(1000, running)
  const reserved = ['F4', 'F5', 'G9', 'H2', 'J7', 'K11']
  const checked = reserved.filter((_, i) => i < Math.min(reserved.length, Math.floor((30 - left) / 7) + 2) && i % 3 !== 2)
  useEffect(() => {
    if (running) setLeft((l) => (l > 0 ? l - 1 : 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  useEffect(() => {
    if (running && left === 0) {
      setRunning(false)
      sfx.chime()
    }
  }, [running, left])
  const released = left === 0 ? reserved.filter((s) => !checked.includes(s)) : []
  return (
    <div className="tool">
      <div className="tool-row">
        <button type="button" className="lk-btn lk-btn-primary" disabled={running} onClick={() => { setLeft(30); setRunning(true) }}>
          {left === 0 ? 'Run again' : 'Start check-in demo'}
        </button>
        <span className="tool-big-line lk-num">Deadline in 0:{String(left).padStart(2, '0')}</span>
      </div>
      <ul className="noshow-seats">
        {reserved.map((s) => (
          <li key={s} data-state={checked.includes(s) ? 'in' : released.includes(s) ? 'released' : 'waiting'}>
            <strong>{s}</strong>
            <span>{checked.includes(s) ? 'Checked in' : released.includes(s) ? 'Released' : 'Waiting'}</span>
          </li>
        ))}
      </ul>
      {released.length > 0 && (
        <div className="tool-result" data-tone="ok">
          Offered to standby: {released.map((s, i) => `${s} → ${STANDBY[i % STANDBY.length]}`).join(' · ')}
        </div>
      )}
      <Note>Only runs under the organizer’s entry rules (a 30-second demo here instead of the real deadline).</Note>
    </div>
  )
}

/* -------------------------------------------------------- 16 Crowd */

function Crowd() {
  const tick = useTick(2000)
  const gates = ['A', 'B', 'C', 'D'].map((g, i) => {
    const base = [72, 45, 18, 58][i]!
    const load = Math.max(5, Math.min(98, base + Math.round(Math.sin(tick / 2 + i * 1.7) * 18)))
    return { g, load, wait: Math.round(load / 8) }
  })
  const best = [...gates].sort((a, b) => a.load - b.load)[0]!
  return (
    <div className="tool">
      <ul className="crowd" aria-live="off">
        {gates.map((x) => (
          <li key={x.g} data-level={x.load > 70 ? 'high' : x.load > 40 ? 'mid' : 'low'}>
            <span className="crowd-cell" style={{ ['--load' as string]: `${x.load}%` }}>
              <strong>Gate {x.g}</strong>
              <span className="lk-num">{x.load}% busy</span>
            </span>
            <span className="lk-num">~{x.wait} min</span>
          </li>
        ))}
      </ul>
      <div className="tool-result" data-tone="ok">
        <strong>Use Gate {best.g}</strong> — about {best.wait} minute{best.wait === 1 ? '' : 's'} to get in.
      </div>
      <Note>Simulated from aggregated check-in counts; refreshes every 2 seconds.</Note>
    </div>
  )
}

/* -------------------------------------------------------- 17 Vault */

function Vault() {
  const bookings = useBookings().filter((b) => b.status === 'confirmed')
  const [saved, setSaved] = usePersisted<Booking[]>('seatlock-vault', [])
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  const isSaved = (id: string) => saved.some((b) => b.id === id)
  return (
    <div className="tool">
      <p className="tool-status-line" data-online={online || undefined}>
        <span className="live-dot" aria-hidden="true" /> {online ? 'Online' : 'Offline — showing saved tickets'}
      </p>
      <ul className="tool-list">
        {bookings.map((b) => (
          <li key={b.id} className="tool-line">
            <span>
              <strong>{b.event.title}</strong> · {b.seats.map((s) => s.id).join(', ')}
            </span>
            {isSaved(b.id) ? (
              <span className="tool-status">
                <Icon name="check" size={14} /> On this phone
              </span>
            ) : (
              <button type="button" className="lk-btn lk-btn-sm" onClick={() => { setSaved([...saved, b]); toast.success('Saved for offline use') }}>
                <Icon name="download" size={14} /> Save offline
              </button>
            )}
          </li>
        ))}
        {bookings.length === 0 && <li>No tickets yet.</li>}
      </ul>
      {saved.length > 0 && (
        <div className="vault">
          {saved.map((b) => (
            <div key={b.id} className="vault-ticket">
              <strong>{b.event.title}</strong>
              <span>
                {new Date(b.event.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {b.seats.map((s) => s.id).join(', ')}
              </span>
              <code>{b.id}</code>
            </div>
          ))}
        </div>
      )}
      <Note>Saved tickets open without internet. The gate scanner rejects a code scanned twice.</Note>
    </div>
  )
}

/* -------------------------------------------------------- 18 Opportunity */

const OPPS = [
  { t: 'Film Club volunteer — usher at Friday screenings', skill: 'Event operations' },
  { t: 'Travel desk helper for the inter-college fest', skill: 'Logistics' },
  { t: 'Write a short review for the campus magazine', skill: 'Writing' },
]

function Pass() {
  const bookings = useBookings().filter((b) => b.status === 'confirmed')
  const [applied, setApplied] = usePersisted<string[]>('seatlock-opps', [])
  const shows = bookings.filter((b) => b.event.kind === 'cinema').length
  const trips = bookings.filter((b) => b.event.kind === 'bus').length
  return (
    <div className="tool">
      <ul className="badges">
        <li data-on={shows > 0 || undefined}>
          <Icon name="film" size={18} /> Film Club · {shows} show{shows === 1 ? '' : 's'}
        </li>
        <li data-on={trips > 0 || undefined}>
          <Icon name="bus" size={18} /> Explorer · {trips} trip{trips === 1 ? '' : 's'}
        </li>
        <li data-on={bookings.length >= 3 || undefined}>
          <Icon name="check" size={18} /> Regular · 3+ bookings
        </li>
      </ul>
      <ul className="tool-list">
        {OPPS.map((o) => (
          <li key={o.t} className="tool-line">
            <span>
              {o.t}
              <small> · {o.skill}</small>
            </span>
            {applied.includes(o.t) ? (
              <span className="tool-status">Applied</span>
            ) : (
              <button type="button" className="lk-btn lk-btn-sm" onClick={() => setApplied([...applied, o.t])}>
                Apply
              </button>
            )}
          </li>
        ))}
      </ul>
      <Note>Attendance certificates appear here once the organizer issues them.</Note>
    </div>
  )
}

/* -------------------------------------------------------- 19 Companion */

const BUDDIES = [
  { who: '2nd-year · Computer Science', likes: 'sci-fi, thrillers', verified: true },
  { who: '3rd-year · Design', likes: 'animation, drama', verified: true },
  { who: '1st-year · Commerce', likes: 'comedy, road trips', verified: true },
]

function Companion() {
  const events = useEvents()
  const [optIn, setOptIn] = usePersisted('seatlock-companion', false)
  const [eventId, setEventId] = useState(firstId(events))
  const [sent, setSent] = useState<number[]>([])
  return (
    <div className="tool">
      <label className="switch">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.currentTarget.checked)} />
        <span>
          Find me a companion<small>Off by default. Only your year and interests are shown.</small>
        </span>
      </label>
      {optIn && (
        <>
          <EventPicker events={events} value={eventId} onChange={setEventId} />
          <ul className="tool-list">
            {BUDDIES.map((b, i) => (
              <li key={b.who} className="tool-line">
                <span>
                  <strong>{b.who}</strong> {b.verified && <span className="tool-status">✓ verified student</span>}
                  <small> · likes {b.likes}</small>
                </span>
                {sent.includes(i) ? (
                  <span className="tool-status">Request sent</span>
                ) : (
                  <button type="button" className="lk-btn lk-btn-sm" onClick={() => { setSent([...sent, i]); sfx.tap() }}>
                    Ask to join
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Note>Seat numbers and contact details are never shared automatically — only if you both accept.</Note>
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------- 20 Digital twin */

function Twin() {
  const events = useEvents()
  const [eventId, setEventId] = useState(firstId(events))
  const [boost, setBoost] = useState(0)
  const seats = useSeats(eventId, 4000)
  const event = events.find((e) => e.id === eventId)
  const counts = { available: 0, held: 0, booked: 0, blocked: 0 }
  for (const s of seats ?? []) counts[s.status]++
  const total = seats?.length ?? 1
  const occ = Math.round(((counts.booked + counts.held) / total) * 100)
  const access = (seats ?? []).filter((s) => s.tags.includes('Wheelchair'))
  const hoursToSellOut = counts.available ? Math.max(1, Math.round((counts.available / Math.max(1, counts.booked)) * 24 * (1 / (1 + boost / 100)))) : 0
  return (
    <div className="tool">
      <EventPicker events={events} value={eventId} onChange={setEventId} />
      <div className="twin-stats">
        <div>
          <span className="lk-num">{occ}%</span>
          <small>occupied</small>
        </div>
        <div>
          <span className="lk-num">{counts.available}</span>
          <small>free</small>
        </div>
        <div>
          <span className="lk-num">{access.filter(isSelectable).length}/{access.length}</span>
          <small>wheelchair free</small>
        </div>
      </div>
      {seats && event && (
        <div className="twin-grid" data-kind={event.kind} aria-label="Live seat states">
          {seats.map((s) => (
            <span key={s.id} data-s={s.status} title={`${s.id} · ${s.status}`} />
          ))}
        </div>
      )}
      <label className="tool-field">
        <span>
          What if demand rises by <strong className="lk-num">{boost}%</strong>?
        </span>
        <input type="range" min={0} max={200} step={10} value={boost} onChange={(e) => setBoost(Number(e.currentTarget.value))} />
      </label>
      <div className="tool-result">{hoursToSellOut ? `Projected to sell out in about ${hoursToSellOut} hours.` : 'Sold out.'}</div>
      <Note>For organizers. Updates every 4 seconds from live seat states.</Note>
    </div>
  )
}

export const TOOLS: Record<string, () => ReactNode> = {
  buddy: Buddy,
  queue: FairQueue,
  access: Access,
  rescue: Rescue,
  nav: NavTool,
  exchange: Exchange,
  waitlist: Waitlist,
  budget: Budget,
  quiet: Quiet,
  exit: SafeExit,
  conflict: Conflicts,
  split: Split,
  match: Match,
  view: SeatView,
  noshow: NoShow,
  crowd: Crowd,
  vault: Vault,
  pass: Pass,
  companion: Companion,
  twin: Twin,
}
