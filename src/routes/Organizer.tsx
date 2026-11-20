import { lazy, Suspense, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon, type IconName } from '../components/Icon'
import { Bars, Card, PageHead, SimBadge, Sparkline, Stat } from '../components/ui'
import { api, usingMock } from '../lib/api/client'
import { friendlyMessage } from '../lib/api/errors'
import { useAuth } from '../lib/auth'
import { accessibilityAvailability } from '../lib/campus/algorithms/seating'
import { forecast } from '../lib/campus/algorithms/simulation'
import { venueByName } from '../lib/campus/data'
import { simulatedDemand } from '../lib/campus/engine'
import { useCampus } from '../lib/campus/store'
import { counts, useInventory } from '../features/organizer/useInventory'
import './campus.css'

const Panels = {
  twin: lazy(() => import('../features/organizer/Twin').then((m) => ({ default: m.TwinPanel }))),
  crowd: lazy(() => import('../features/organizer/Panels').then((m) => ({ default: m.CrowdPanel }))),
  waitlist: lazy(() => import('../features/organizer/Panels').then((m) => ({ default: m.WaitlistPanel }))),
  noshow: lazy(() => import('../features/organizer/Panels').then((m) => ({ default: m.NoShowPanel }))),
  seats: lazy(() => import('../features/organizer/Panels').then((m) => ({ default: m.SeatsPanel }))),
  load: lazy(() => import('../features/organizer/LoadLab').then((m) => ({ default: m.LoadLab }))),
}

type Tab = 'overview' | keyof typeof Panels
const TABS: { value: Tab; label: string; icon: IconName }[] = [
  { value: 'overview', label: 'Overview', icon: 'chart' },
  { value: 'twin', label: 'Digital twin', icon: 'cube' },
  { value: 'crowd', label: 'Crowd', icon: 'flame' },
  { value: 'waitlist', label: 'Waitlist', icon: 'queue' },
  { value: 'noshow', label: 'No-shows', icon: 'clock' },
  { value: 'seats', label: 'Seats', icon: 'grid' },
  { value: 'load', label: 'Load lab', icon: 'users' },
]

export function Organizer() {
  const { user, signIn } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'overview') as Tab
  const eventId = params.get('event') ?? 'synthwave-convocation'
  const [switching, setSwitching] = useState(false)
  const setParam = (k: string, v: string) => { const next = new URLSearchParams(params); next.set(k, v); setParams(next, { replace: true }) }

  if (user?.role !== 'organizer') {
    return (
      <div className="container page-pad">
        <title>Organizer · SeatLock</title>
        <PageHead eyebrow="Organizer tools" icon="chart" title="Organizer dashboard" lead="Venue digital twin, crowd and waitlist analytics, no-show recovery and a load lab." />
        <Card title="Switch to the organizer demo account" icon="user">
          <p className="small">Roles here are for presentation only — they are not production authorization.</p>
          <button type="button" className="btn btn-primary" disabled={switching} onClick={async () => {
            setSwitching(true)
            try {
              const r = await api.login('organizer@seatlock.dev', 'organizer123')
              signIn(r.token, r.user)
              toast.success('Signed in as the organizer demo account')
            } catch (e) {
              toast.error('Couldn’t switch accounts', { description: friendlyMessage(e) })
            } finally {
              setSwitching(false)
            }
          }}>{switching ? 'Switching…' : 'Use organizer demo'}</button>
        </Card>
      </div>
    )
  }

  if (!usingMock) {
    return <div className="container page-pad"><Card title="Organizer analytics need the mock adapter" icon="info"><p className="small">These dashboards visualise the in-browser simulation. Connect organizer analytics endpoints to use them with a real API.</p></Card></div>
  }

  const Panel = tab === 'overview' ? null : Panels[tab]
  return (
    <div className="container page-pad">
      <title>Organizer · SeatLock</title>
      <PageHead eyebrow="Organizer · demo role" icon="chart" title="Campus digital twin" lead="Live view of the shared mock inventory: the same seats students are booking right now." actions={<SimBadge>All data simulated</SimBadge>} />
      <div className="org-bar">
        <nav className="org-tabs" aria-label="Organizer sections">
          {TABS.map((t) => (
            <button key={t.value} type="button" className="org-tab" aria-current={t.value === tab ? 'page' : undefined} onClick={() => setParam('tab', t.value)}>
              <Icon name={t.icon} size={16} /> {t.label}
            </button>
          ))}
        </nav>
        {tab !== 'load' && <EventPicker value={eventId} onChange={(v) => setParam('event', v)} />}
      </div>
      <ErrorBoundary key={tab} section="this organizer panel">
        <Suspense fallback={<div className="skeleton" style={{ height: 420, borderRadius: 20 }} />}>
          {Panel ? <Panel eventId={eventId} /> : <Overview eventId={eventId} />}
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

function EventPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { snap } = useInventory(value, 10_000)
  return (
    <label className="field org-picker">
      <span className="sr-only">Event</span>
      <select className="select" value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {(snap?.events ?? []).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        {!snap && <option value={value}>{value}</option>}
      </select>
    </label>
  )
}

function Overview({ eventId }: { eventId: string }) {
  const { snap } = useInventory(eventId)
  const waitlist = useCampus((s) => s.waitlist)
  if (!snap) return <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
  const event = snap.events.find((e) => e.id === eventId)
  if (!event) return <p>Event not found.</p>
  const c = counts(snap.seats)
  const profile = venueByName(event.venue)
  const acc = profile ? accessibilityAvailability(snap.seats, profile) : null
  const demand = simulatedDemand(event) + waitlist.filter((w) => w.eventId === eventId && (w.status === 'waiting' || w.status === 'offered')).length
  const occupancy = Math.round(((c.booked + c.held) / Math.max(1, snap.seats.length - c.blocked)) * 100)
  const proj = forecast(snap.history, 8)
  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <div className="stat-grid">
        <Stat label="Capacity" value={snap.seats.length} icon="grid" />
        <Stat label="Available" value={c.available} tone="ok" icon="check" />
        <Stat label="Held" value={c.held} tone="warn" icon="clock" hint={c.mine ? `${c.mine} by the demo student` : undefined} />
        <Stat label="Booked" value={c.booked} icon="ticket" />
        <Stat label="Blocked" value={c.blocked} icon="ban" />
        <Stat label="Occupancy" value={`${occupancy}%`} tone="brand" icon="chart" />
        <Stat label="Waitlist demand" value={demand} icon="queue" hint="simulated + real entries" />
        <Stat label="Hold conflicts" value={snap.metrics.conflicts} tone={snap.metrics.conflicts ? 'danger' : undefined} icon="alert" />
      </div>
      <div className="grid-2">
        <Card title="Seats left — trend & forecast" icon="chart" badge={<SimBadge>Simulated forecast</SimBadge>}>
          <Sparkline data={snap.history} projection={proj} label="Seats left over time" height={80} />
          <p className="small muted">{snap.history.length < 2 ? 'Collecting samples as the simulated crowd moves…' : `Now ${snap.history.at(-1)} seats left. Holt smoothing projects ${Math.round(proj.at(-1) ?? 0)} in ~${8 * 3.5}s of simulated demand.`}</p>
        </Card>
        <Card title="Booking pipeline" icon="refresh">
          <Bars label="Booking pipeline counts" data={[
            { label: 'Holds created', value: snap.metrics.holds, tone: 'brand' },
            { label: 'Confirmed', value: snap.metrics.confirmed, tone: 'ok' },
            { label: 'Holds expired', value: snap.metrics.expired, tone: 'warn' },
            { label: 'Conflicts', value: snap.metrics.conflicts, tone: 'danger' },
            { label: 'Cancellations', value: snap.metrics.cancelled, tone: 'muted' },
            { label: 'No-show seats recovered', value: snap.metrics.noShowReleased, tone: 'ok' },
            { label: 'Waitlist offers', value: snap.metrics.waitlistOffers, tone: 'brand' },
          ]} />
        </Card>
        {acc && (
          <Card title="Accessibility availability" icon="access">
            <Bars label="Accessible seating free" data={[
              { label: 'Wheelchair spaces', value: acc.wheelchairFree, tone: acc.wheelchairFree ? 'ok' : 'danger' },
              { label: 'Companion seats', value: acc.companionFree, tone: 'ok' },
              { label: 'Step-free seats', value: acc.stepFreeFree, tone: 'brand' },
            ]} />
            <p className="tiny muted">Of {acc.wheelchairTotal} wheelchair spaces and {acc.companionTotal} companion seats listed for {event.venue}.</p>
          </Card>
        )}
        <Card title="All events — occupancy" icon="ticket">
          <Bars label="Seats sold per event" unit="%" data={snap.events.map((e) => ({ label: e.title, value: Math.round((1 - e.seatsLeft / e.totalSeats) * 100), tone: e.seatsLeft === 0 ? 'danger' as const : e.highDemand ? 'warn' as const : 'brand' as const }))} />
        </Card>
      </div>
    </div>
  )
}
