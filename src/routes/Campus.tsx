import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Icon } from '../components/Icon'
import { Card, PageHead, Segmented, SimBadge, Toggle } from '../components/ui'
import { findRoute, routePath } from '../lib/campus/algorithms/route'
import { crowdAt, hashSeed, suggestGate } from '../lib/campus/algorithms/simulation'
import { BUILDINGS, CROWD_ZONES, EDGES, NODES, START_POINTS, VENUE_DOORS, VENUES, venueByName } from '../lib/campus/data'
import { scheduleReminder } from '../lib/campus/engine'
import { useCampus } from '../lib/campus/store'
import type { VenueProfile } from '../lib/campus/types'
import { dateLong, time } from '../lib/format'
import './campus.css'

type Tab = 'route' | 'safety'

export function Campus() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'safety' ? 'safety' : 'route'
  return (
    <div className="container page-pad">
      <title>{tab === 'safety' ? 'SafeExit · SeatLock' : 'Campus map · SeatLock'}</title>
      <PageHead eyebrow="Live campus navigation" icon="map" title={tab === 'safety' ? 'Know your exits before the lights go down' : 'Find your venue, gate and seat'} lead={tab === 'safety' ? 'Exits, assembly points and step-free routes for each venue. Previously opened safety info stays available offline.' : 'Walking routes on an illustrative campus map, with a step-free option and the least busy entry gate.'} />
      <div className="row-wrap" style={{ marginBottom: 'var(--space-6)' }}>
        <Segmented label="Campus view" value={tab} onChange={(v) => setParams(v === 'safety' ? { tab: 'safety' } : {}, { replace: true })} options={[{ value: 'route', label: 'Route & gates', icon: 'route' }, { value: 'safety', label: 'SafeExit', icon: 'exit' }]} />
      </div>
      {tab === 'route' ? <RouteView initialVenue={params.get('venue')} /> : <SafetyView initialVenue={params.get('venue')} />}
    </div>
  )
}

/* ---------------------------------------------------------------- Route */

function RouteView({ initialVenue }: { initialVenue: string | null }) {
  const vault = useCampus((s) => s.vault)
  const next = [...vault].filter((t) => Date.parse(t.startsAt) > Date.now() - 3 * 3_600_000).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]
  const [query, setQuery] = useState('')
  const [dest, setDest] = useState(initialVenue ?? next?.venue ?? 'Main Auditorium')
  const [from, setFrom] = useState<string>('MG')
  const prefersStepFree = useCampus((s) => s.prefs.access.stepFree)
  const [stepFree, setStepFree] = useState(prefersStepFree)
  const building = BUILDINGS.find((b) => b.name === dest || (dest === 'Seminar Hall B' && b.id === 'academic')) ?? BUILDINGS[0]!
  const doors = VENUE_DOORS[dest]
  const to = doors ? (stepFree ? doors.stepFreeDoor : doors.door) : building.door
  const route = findRoute(from, to, stepFree)
  const matches = query.trim()
    ? BUILDINGS.filter((b) => `${b.name} ${b.keywords.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : []
  const zones = CROWD_ZONES[dest] ?? []
  const minute = -12
  const loads = zones.length ? crowdAt(zones, minute, 180, hashSeed(dest)) : []
  const tip = suggestGate(loads)
  const profile = venueByName(dest)

  return (
    <div className="campus-layout">
      <div className="stack">
        <Card title="Plan a route" icon="route">
          <label className="field">
            <span className="field-label">Search buildings</span>
            <input className="input" type="search" placeholder="Try “library”, “OAT” or “medical”" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          </label>
          {matches.length > 0 && (
            <ul className="list-plain" aria-label="Search results">
              {matches.map((b) => (
                <li key={b.id}><button type="button" className="search-hit" onClick={() => { setDest(b.id === 'academic' ? 'Seminar Hall B' : b.name); setQuery('') }}><Icon name="pin" size={16} /> {b.name}</button></li>
              ))}
            </ul>
          )}
          <div className="form-row">
            <label className="field"><span className="field-label">From</span>
              <select className="select" value={from} onChange={(e) => setFrom(e.currentTarget.value)}>{START_POINTS.map((s) => <option key={s.node} value={s.node}>{s.label}</option>)}</select>
            </label>
            <label className="field"><span className="field-label">To</span>
              <select className="select" value={dest} onChange={(e) => setDest(e.currentTarget.value)}>
                {VENUES.map((v) => <option key={v.name}>{v.name}</option>)}
                {BUILDINGS.filter((b) => b.kind !== 'venue').map((b) => <option key={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
          <Toggle checked={stepFree} onChange={setStepFree} label="Step-free route" description="Avoids stairs; uses ramps and level paths" />
          {next && (
            <p className="small">Next ticket: <strong>{next.title}</strong>, {dateLong(next.startsAt)} {time(next.startsAt)} — seats {next.seats.join(', ')}. <button type="button" className="link-btn" onClick={() => setDest(next.venue)}>Route there</button></p>
          )}
        </Card>

        {route ? (
          <Card title={`${route.metres} m · about ${route.minutes} min`} icon="compass" badge={<SimBadge>Demo route</SimBadge>}>
            <ol className="steps">
              {route.nodes.map((n, i) => {
                const e = route.edges[i]
                return (
                  <li key={n.id + i}>
                    <span>{n.label ?? (i === 0 ? 'Start' : 'Continue straight')}</span>
                    {e?.note && <span className="muted small"> — {e.note}{e.stairs ? ' (stairs)' : ''}</span>}
                  </li>
                )
              })}
            </ol>
            {route.usesStairs && <p className="small"><Icon name="alert" size={14} /> This route uses stairs. Turn on “Step-free route” for ramps.</p>}
            {profile && <p className="small muted">At the venue: nearest step-free entry is {profile.exits.find((x) => x.stepFree)?.label ?? 'listed by the organizer'}. Seat sections: left (1–5), centre (6–15), right (16–20).</p>}
            {next && next.venue === dest && (
              <button type="button" className="btn" onClick={async () => {
                scheduleReminder(next.bookingId, next.title, next.startsAt, route.minutes)
                if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission() } catch { /* ignore */ } }
                toast.success('Arrival reminder set', { description: `We’ll remind you ${route.minutes + 15} min before ${time(next.startsAt)}.` })
              }}><Icon name="bell" size={16} /> Remind me when to leave</button>
            )}
          </Card>
        ) : <p className="muted">No route found for those points.</p>}

        {loads.length > 0 && (
          <Card title="Which gate?" icon="flame" badge={<SimBadge>Simulated crowd</SimBadge>}>
            <ul className="list-plain">
              {loads.map((l) => (
                <li key={l.zone.id} className="gate-row" data-level={l.level}>
                  <span className="gate-dot" aria-hidden="true" />
                  <span>{l.zone.label}</span>
                  <span className="small muted num">~{Math.round(l.waitMin)} min wait · {l.level}</span>
                </li>
              ))}
            </ul>
            <p className="small">{tip ? <>Recommended: <strong>{tip.to.zone.label}</strong> — about {tip.savedMin} min faster than {tip.from.zone.label} 12 minutes before doors.</> : 'Both gates look similar right now.'}</p>
          </Card>
        )}
      </div>
      <CampusSvg route={route ? routePath(route) : ''} destId={building.id} from={from} gates={loads.map((l) => ({ x: l.zone.x, y: l.zone.y, level: l.level, label: l.zone.label }))} />
    </div>
  )
}

function CampusSvg({ route, destId, from, gates }: { route: string; destId: string; from: string; gates: { x: number; y: number; level: string; label: string }[] }) {
  const nodes = new Map(NODES.map((n) => [n.id, n]))
  const start = nodes.get(from)
  return (
    <figure className="campus-map card">
      <svg viewBox="0 0 1000 640" role="img" aria-labelledby="map-cap" className="campus-svg">
        <rect x="0" y="0" width="1000" height="640" className="cm-ground" />
        {EDGES.map((e) => {
          const a = nodes.get(e.a)!
          const b = nodes.get(e.b)!
          return <line key={e.a + e.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={e.stairs ? 'cm-path cm-stairs' : 'cm-path'} />
        })}
        {BUILDINGS.map((b) => (
          <g key={b.id} className="cm-building" data-kind={b.kind} data-dest={b.id === destId || undefined}>
            {b.round ? <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} /> : <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="10" />}
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 5} textAnchor="middle">{b.name.replace(' (Seminar Hall B)', '')}</text>
          </g>
        ))}
        {route && <path d={route} className="cm-route" pathLength={1} key={route} />}
        {gates.map((g) => <circle key={g.label} cx={g.x} cy={g.y} r={g.level === 'high' ? 22 : g.level === 'medium' ? 16 : 11} className="cm-gate" data-level={g.level} />)}
        {start && <g className="cm-you"><circle cx={start.x} cy={start.y} r="10" /><text x={start.x + 14} y={start.y + 4}>You</text></g>}
      </svg>
      <figcaption id="map-cap" className="tiny muted">Illustrative campus map (not to survey scale). Dashed paths have stairs. Circles at gates show simulated crowd levels.</figcaption>
    </figure>
  )
}

/* ---------------------------------------------------------------- SafeExit */

function SafetyView({ initialVenue }: { initialVenue: string | null }) {
  const vault = useCampus((s) => s.vault)
  const [venue, setVenue] = useState(initialVenue ?? vault[0]?.venue ?? 'Main Auditorium')
  const [contrast, setContrast] = useState(false)
  const [stepFreeOnly, setStepFreeOnly] = useState(false)
  const profile = venueByName(venue) ?? VENUES[0]!
  return (
    <div className="safety" data-contrast={contrast || undefined}>
      <div className="safety-warn" role="note">
        <Icon name="alert" size={20} />
        <div><strong>Illustrative layout — not an approved evacuation plan.</strong> In an emergency, follow stewards, venue signage and staff instructions. {profile.verifiedPlan ? '' : 'This venue’s organizer has not published a verified plan yet.'}</div>
      </div>
      <div className="row-wrap">
        <label className="field" style={{ minWidth: 220 }}><span className="field-label">Venue</span>
          <select className="select" value={venue} onChange={(e) => setVenue(e.currentTarget.value)}>{VENUES.map((v) => <option key={v.name}>{v.name}</option>)}</select>
        </label>
        <Toggle checked={contrast} onChange={setContrast} label="High-contrast mode" />
        <Toggle checked={stepFreeOnly} onChange={setStepFreeOnly} label="Step-free exits only" />
      </div>
      <div className="grid-2">
        <ExitPlan profile={profile} stepFreeOnly={stepFreeOnly} />
        <div className="stack">
          <Card title="Exits" icon="exit">
            <ul className="list-plain">
              {profile.exits.filter((e) => !stepFreeOnly || e.stepFree).map((e) => (
                <li key={e.id} className="exit-row"><span className="exit-tag">{e.id.split('-')[1]?.toUpperCase()}</span>{e.label}{e.stepFree ? <span className="badge badge-ok">Step-free</span> : <span className="badge">Stairs</span>}</li>
              ))}
            </ul>
            <p className="small"><strong>Assembly point:</strong> {profile.assemblyPoint}</p>
          </Card>
          <Card title="Organizer instructions" icon="shield">
            <ol className="steps">{profile.safetyInstructions.map((i) => <li key={i}>{i}</li>)}</ol>
            <p className="small muted">Accessible evacuation: {profile.exits.some((e) => e.stepFree) ? `use the step-free exits (${profile.exits.filter((e) => e.stepFree).map((e) => e.label).join(', ')}). Stewards assist anyone who needs help.` : 'not supplied by the organizer.'}</p>
          </Card>
          <Link to={`/campus?venue=${encodeURIComponent(venue)}`} className="btn btn-ghost">Route to {venue}</Link>
        </div>
      </div>
    </div>
  )
}

function ExitPlan({ profile, stepFreeOnly }: { profile: VenueProfile; stepFreeOnly: boolean }) {
  const exits = profile.exits.filter((e) => !stepFreeOnly || e.stepFree)
  const X = (col: number) => 40 + ((col + 1) / 23) * 420
  const Y = (row: number) => 80 + (row / 9) * 230
  const blocks = [
    { c0: 0, c1: 4, label: 'Left 1–5' },
    { c0: 6, c1: 15, label: 'Centre 6–15' },
    { c0: 17, c1: 21, label: 'Right 16–20' },
  ]
  return (
    <figure className="card exit-plan">
      <svg viewBox="0 0 500 360" role="img" aria-label={`Illustrative exit plan for ${profile.name}: ${exits.map((e) => e.label).join(', ')}. Assembly at ${profile.assemblyPoint}.`}>
        <rect x="20" y="20" width="460" height="320" rx="16" className="ep-room" />
        <rect x="120" y="32" width="260" height="26" rx="8" className="ep-stage" />
        <text x="250" y="50" textAnchor="middle" className="ep-label">STAGE</text>
        {blocks.map((b) => (
          <g key={b.label}>
            <rect x={X(b.c0) - 8} y={Y(0) - 10} width={X(b.c1) - X(b.c0) + 16} height={Y(9) - Y(0) + 20} rx="8" className="ep-block" />
            <text x={(X(b.c0) + X(b.c1)) / 2} y={Y(9) + 26} textAnchor="middle" className="ep-small">{b.label}</text>
          </g>
        ))}
        {blocks.map((b) => {
          const cx = (X(b.c0) + X(b.c1)) / 2
          const cy = (Y(0) + Y(9)) / 2
          const nearest = exits.reduce((best, e) => (Math.hypot(X(e.col) - cx, Y(e.rowIndex) - cy) < Math.hypot(X(best.col) - cx, Y(best.rowIndex) - cy) ? e : best), exits[0] ?? profile.exits[0]!)
          return <line key={`arrow-${b.label}`} x1={cx} y1={cy} x2={X(nearest.col)} y2={Y(nearest.rowIndex)} className="ep-arrow" markerEnd="url(#ep-head)" />
        })}
        {exits.map((e) => (
          <g key={e.id} className="ep-exit" data-stepfree={e.stepFree || undefined}>
            <rect x={X(e.col) - 16} y={Y(e.rowIndex) - 11} width="32" height="22" rx="5" />
            <text x={X(e.col)} y={Y(e.rowIndex) + 4} textAnchor="middle">EXIT</text>
          </g>
        ))}
        <defs>
          <marker id="ep-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" className="ep-head" /></marker>
        </defs>
      </svg>
      <figcaption className="tiny"><SimBadge>Illustrative only</SimBadge> Arrows point from each seating block to its nearest listed exit.</figcaption>
    </figure>
  )
}
