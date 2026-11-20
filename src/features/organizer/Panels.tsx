import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '../../components/Icon'
import { Bars, Card, SimBadge, Stat, Toggle } from '../../components/ui'
import { buildAttendance, crowdAt, eligibleNoShows, hashSeed, noShowStatus, suggestGate } from '../../lib/campus/algorithms/simulation'
import { CROWD_ZONES, venueByName } from '../../lib/campus/data'
import { routeReleased, simulatedDemand } from '../../lib/campus/engine'
import { notify, useCampus } from '../../lib/campus/store'
import { rowIndex } from '../../lib/seats'
import { counts, mockApi, useInventory } from './useInventory'

/* ---------------------------------------------------------------- Crowd heatmap */

export function CrowdPanel({ eventId }: { eventId: string }) {
  const { snap } = useInventory(eventId, 5000)
  const [minute, setMinute] = useState(-12)
  const [extra, setExtra] = useState(60)
  const [playing, setPlaying] = useState(false)
  const [redirect, setRedirect] = useState(0)
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setMinute((m) => (m >= 30 ? -60 : m + 1)), 350)
    return () => clearInterval(id)
  }, [playing])
  const event = snap?.events.find((e) => e.id === eventId)
  if (!snap || !event) return <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
  const zones = CROWD_ZONES[event.venue] ?? []
  const c = counts(snap.seats)
  const attendees = c.booked + c.held + extra
  const loads = crowdAt(zones, minute, attendees, hashSeed(eventId), redirect / 100)
  const tip = suggestGate(loads)
  const minX = Math.min(...zones.map((z) => z.x)) - 120
  const minY = Math.min(...zones.map((z) => z.y)) - 100
  const maxX = Math.max(...zones.map((z) => z.x)) + 120
  const maxY = Math.max(...zones.map((z) => z.y)) + 100
  const label = minute < 0 ? `T−${-minute} min` : minute === 0 ? 'Doors' : `T+${minute} min`
  return (
    <div className="grid-2">
      <Card title={`Entry gates · ${event.venue}`} icon="flame" badge={<SimBadge>Simulated — not sensor data</SimBadge>}>
        <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="heat-svg" role="img" aria-label={`Crowd at ${label}: ${loads.map((l) => `${l.zone.label} ${l.level}`).join(', ')}`}>
          <defs>
            {(['low', 'medium', 'high'] as const).map((lv) => (
              <radialGradient key={lv} id={`heat-${lv}`}>
                <stop offset="0" stopColor={lv === 'low' ? 'var(--success)' : lv === 'medium' ? 'var(--warning)' : 'var(--danger)'} stopOpacity="0.85" />
                <stop offset="1" stopColor={lv === 'low' ? 'var(--success)' : lv === 'medium' ? 'var(--warning)' : 'var(--danger)'} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} className="cm-ground" />
          {loads.map((l) => (
            <g key={l.zone.id} className="heat" data-level={l.level}>
              <circle cx={l.zone.x} cy={l.zone.y} r={22 + Math.min(80, l.load * 18)} fill={`url(#heat-${l.level})`} />
              <circle cx={l.zone.x} cy={l.zone.y} r="7" className="heat-core" />
              <text x={l.zone.x} y={l.zone.y - 14} textAnchor="middle" className="heat-label">{l.zone.label}</text>
            </g>
          ))}
        </svg>
        <div className="row-wrap">
          <button type="button" className="btn" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}><Icon name={playing ? 'stop' : 'play'} size={16} /> {playing ? 'Pause' : 'Play arrivals'}</button>
          <strong className="num">{label}</strong>
        </div>
        <label className="field"><span className="field-label">Time relative to doors</span>
          <input type="range" className="range" min={-60} max={30} value={minute} onChange={(e) => { setPlaying(false); setMinute(Number(e.currentTarget.value)) }} aria-valuetext={label} />
        </label>
      </Card>
      <div className="stack">
        <Card title="Gate load" icon="chart">
          <Bars label="Estimated wait per gate (minutes)" unit=" min" data={loads.map((l) => ({ label: l.zone.label, value: Math.round(l.waitMin), tone: l.level === 'high' ? 'danger' as const : l.level === 'medium' ? 'warn' as const : 'ok' as const }))} />
          <div className="stat-grid">
            {loads.map((l) => <Stat key={l.zone.id} label={l.zone.label} value={l.queue} hint={`in queue · ${l.arrivalsPerMin}/min arriving · ${l.level}`} tone={l.level === 'high' ? 'danger' : l.level === 'medium' ? 'warn' : 'ok'} />)}
          </div>
        </Card>
        <Card title="Redirect students" icon="route">
          {tip ? <p className="small">Suggest <strong>{tip.to.zone.label}</strong> — saves about {tip.savedMin} min versus {tip.from.zone.label}.</p> : <p className="small">Gates are balanced at {label}.</p>}
          <label className="field"><span className="field-label">Share nudged to alternative gates: {redirect}%</span>
            <input type="range" className="range" min={0} max={60} step={5} value={redirect} onChange={(e) => setRedirect(Number(e.currentTarget.value))} />
          </label>
          <button type="button" className="btn" onClick={() => { notify({ kind: 'system', title: `Use ${tip?.to.zone.label ?? 'any gate'} for ${event.title}`, body: 'Organizer tip: the main gate is busy. The alternative gate is faster right now.', href: '/campus' }); toast.success('Gate tip sent to attendees (simulated)') }}><Icon name="bell" size={16} /> Send gate tip</button>
          <label className="field"><span className="field-label">Walk-ins, guest list & staff: {extra}</span>
            <input type="range" className="range" min={0} max={200} step={10} value={extra} onChange={(e) => setExtra(Number(e.currentTarget.value))} />
          </label>
          <p className="tiny muted">Arrivals model: {attendees} expected ({c.booked + c.held} ticket holders + {extra} others), bell curve peaking 15 min before doors, most heading to the main gate.</p>
        </Card>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Waitlist analytics */

export function WaitlistPanel({ eventId }: { eventId: string }) {
  const { snap } = useInventory(eventId, 4000)
  const entries = useCampus((s) => s.waitlist)
  if (!snap) return <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
  const rows = snap.events.map((e) => {
    const real = entries.filter((w) => w.eventId === e.id && (w.status === 'waiting' || w.status === 'offered')).length
    return { e, demand: simulatedDemand(e) + real, real }
  }).sort((a, b) => b.demand - a.demand)
  const m = snap.metrics
  const accepted = entries.filter((w) => w.status === 'accepted').length
  const expired = entries.filter((w) => w.status === 'expired' || w.status === 'declined').length
  return (
    <div className="grid-2">
      <Card title="Waitlist demand by event" icon="queue" badge={<SimBadge />}>
        <Bars label="Students waiting per event" data={rows.map((r) => ({ label: r.e.title, value: r.demand, tone: r.e.seatsLeft === 0 ? 'danger' as const : 'brand' as const }))} />
      </Card>
      <div className="stack">
        <div className="stat-grid">
          <Stat label="Offers made (this event)" value={m.waitlistOffers} icon="bell" tone="brand" />
          <Stat label="Seats returned" value={m.cancelled} icon="refresh" />
          <Stat label="No-show seats recovered" value={m.noShowReleased} icon="check" tone="ok" />
          <Stat label="Demo student: accepted" value={accepted} icon="ticket" tone="ok" />
          <Stat label="Expired / declined" value={expired} icon="clock" tone="warn" />
        </div>
        <Card title="How offers flow" icon="info">
          <ol className="steps small">
            <li>A seat is returned, cancelled or released as a no-show.</li>
            <li>It’s reserved for the waitlist so the open crowd can’t grab it.</li>
            <li>The next student gets 2 minutes to accept; then it moves down the list.</li>
            <li>Unclaimed seats go back to open sale.</li>
          </ol>
        </Card>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- No-show recovery */

export function NoShowPanel({ eventId }: { eventId: string }) {
  const { snap, refresh } = useInventory(eventId, 6000)
  const [now, setNow] = useState(5)
  const [deadline, setDeadline] = useState(15)
  const [protect, setProtect] = useState(true)
  const [released, setReleased] = useState<string[]>([])
  if (!snap) return <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
  const event = snap.events.find((e) => e.id === eventId)
  if (!event) return null
  const profile = venueByName(event.venue)
  const accessible = new Set([...(profile?.wheelchairSpaces ?? []), ...(profile?.companionSeats ?? [])])
  const rs = buildAttendance(snap.seats, hashSeed(eventId), accessible)
  const checked = rs.filter((r) => noShowStatus(r, now) === 'checked_in').length
  const eligible = eligibleNoShows(rs, now, { deadlineMin: deadline, protectAccessible: protect })
  const protectedCount = protect && now >= deadline ? rs.filter((r) => r.accessibility && noShowStatus(r, now) !== 'checked_in').length : 0

  const release = async () => {
    const m = await mockApi()
    const ids = m.releaseSeats(eventId, eligible.map((r) => r.seatId), 'noshow')
    setReleased((cur) => [...cur, ...ids])
    const routed = await routeReleased(event, ids)
    notify({ kind: 'noshow', title: `${ids.length} no-show seats released`, body: `${event.title}: ${routed === 'waitlist' ? 'offered to the waitlist first.' : 'back on sale.'}`, href: '/organizer?tab=noshow' })
    toast.success(`Released ${ids.length} seats`, { description: routed === 'waitlist' ? 'Waitlisted students are being offered them.' : 'Back on open sale.' })
    refresh()
  }

  return (
    <div className="grid-2">
      <Card title="Check-in simulation" icon="clock" badge={<SimBadge>Simulated check-ins</SimBadge>}>
        <label className="field"><span className="field-label">Event clock: {now < 0 ? `T−${-now}` : `T+${now}`} min</span>
          <input type="range" className="range" min={-30} max={45} value={now} onChange={(e) => setNow(Number(e.currentTarget.value))} />
        </label>
        <label className="field"><span className="field-label">Check-in deadline: T+{deadline} min</span>
          <input type="range" className="range" min={0} max={40} step={5} value={deadline} onChange={(e) => setDeadline(Number(e.currentTarget.value))} />
        </label>
        <Toggle checked={protect} onChange={setProtect} label="Never auto-release accessibility seats" description="Organizer contacts these attendees personally." />
        <div className="stat-grid">
          <Stat label="Reservations" value={rs.length} />
          <Stat label="Checked in" value={checked} tone="ok" />
          <Stat label="Not yet in" value={rs.length - checked} tone="warn" />
          <Stat label="Eligible to release" value={eligible.length} tone="brand" hint={protectedCount ? `${protectedCount} accessibility seats protected` : undefined} />
        </div>
      </Card>
      <Card title="Release preview" icon="refresh">
        {now < deadline ? (
          <p className="small">Nothing is eligible until the deadline (T+{deadline}). Move the event clock past it to preview releases.</p>
        ) : (
          <>
            <p className="small">These seats had no check-in by T+{deadline}. Releasing them follows your policy and sends them to the waitlist first.</p>
            <ul className="chip-list" aria-label="Seats eligible for release">{eligible.slice(0, 40).map((r) => <li key={r.seatId} className="badge num">{r.seatId}</li>)}</ul>
            <button type="button" className="btn btn-primary" disabled={!eligible.length} onClick={() => void release()}>Release {eligible.length} seats</button>
          </>
        )}
        <p className="tiny muted">Demo only. Real releases need authoritative check-in data and policy enforcement on the server. The signed-in student’s own tickets are never released.</p>
        <Stat label="Recovered capacity (this session)" value={released.length} tone="ok" hint={`${snap.metrics.noShowReleased} total for this event`} />
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------------- Seat management */

export function SeatsPanel({ eventId }: { eventId: string }) {
  const { snap, refresh } = useInventory(eventId, 4000)
  if (!snap) return <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
  const rows = [...new Set(snap.seats.map((s) => s.row))].sort((a, b) => rowIndex(a) - rowIndex(b))
  const toggle = async (id: string, block: boolean) => {
    const m = await mockApi()
    const ok = m.setSeatBlocked(eventId, id, block)
    if (!ok) toast.error(`${id} can’t be ${block ? 'blocked' : 'unblocked'}`, { description: 'Only available seats can be blocked.' })
    refresh()
  }
  return (
    <Card title="Seat management (demo)" icon="grid" badge={<SimBadge />}>
      <p className="small muted">Block seats for cameras, VIPs or broken chairs. Only available seats can be blocked; held and booked seats belong to students.</p>
      <div className="mgmt-wrap">
        <div className="mgmt" role="grid" aria-label="Seat management grid">
          {rows.map((r) => (
            <div role="row" key={r} className="mgmt-row">
              {snap.seats.filter((s) => s.row === r).map((s) => (
                <span role="gridcell" key={s.id} style={{ gridColumn: s.col + 1 }}>
                  <button type="button" className="mgmt-seat" data-s={s.status} disabled={s.status === 'held' || s.status === 'booked'} aria-label={`${s.id}, ${s.status}${s.status === 'available' ? ', press to block' : s.status === 'blocked' ? ', press to unblock' : ''}`} onClick={() => void toggle(s.id, s.status === 'available')}>{s.id}</button>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
