import { Suspense, use, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon } from '../components/Icon'
import { Bars, Card, Meter, PageHead, Segmented, SimBadge, Stat } from '../components/ui'
import { api } from '../lib/api/client'
import type { Booking, EventSummary } from '../lib/api/types'
import { downloadText } from '../lib/campus/algorithms/planning'
import { OPPORTUNITIES } from '../lib/campus/data'
import { updateCampus, useCampus } from '../lib/campus/store'
import type { Opportunity } from '../lib/campus/types'
import { useAuth } from '../lib/auth'
import { dateLong } from '../lib/format'
import { invalidate, resource } from '../lib/resource'
import './campus.css'

export function Pass() {
  const [attempt, setAttempt] = useState(0)
  return (
    <div className="container page-pad">
      <title>Opportunity pass · SeatLock</title>
      <PageHead eyebrow="Campus opportunity pass" icon="award" title="Turn events into experience" lead="Workshops, talks and volunteering in one place — with the skills you picked up and a summary you can export for applications." />
      <ErrorBoundary key={attempt} section="your opportunity pass" onReset={() => { invalidate('events'); invalidate('bookings'); setAttempt((a) => a + 1) }}>
        <Suspense fallback={<div className="skeleton" style={{ height: 400, borderRadius: 20 }} />}>
          <PassBody events={resource('events', api.events)} bookings={resource('bookings', api.bookings)} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

interface Activity { id: string; title: string; date: string; skills: string[]; hours: number; kind: string; source: 'attended' | 'volunteered' }

const dateFor = (o: Opportunity, events: EventSummary[]) => {
  if (o.date === 'event') return events.find((e) => e.id === o.eventId)?.startsAt ?? new Date().toISOString()
  return new Date(Date.now() + Number(o.date) * 86_400_000).toISOString()
}

function PassBody({ events: ep, bookings: bp }: { events: Promise<EventSummary[]>; bookings: Promise<Booking[]> }) {
  const events = use(ep)
  const bookings = use(bp)
  const { user } = useAuth()
  const opp = useCampus((s) => s.opportunities)
  const checkIns = useCampus((s) => s.checkIns)
  const [filter, setFilter] = useState<'all' | 'workshop' | 'volunteer'>('all')
  const [cert, setCert] = useState<Activity | null>(null)

  // Attendance: past confirmed bookings (or ones checked in) + volunteering already done.
  const attended: Activity[] = bookings
    .filter((b) => b.status === 'confirmed' && (Date.parse(b.event.startsAt) < Date.now() || checkIns[b.id]))
    .map((b) => ({ id: b.id, title: b.event.title, date: b.event.startsAt, skills: /tedx|talk/i.test(b.event.title) ? ['Public speaking insight', 'Ideas'] : ['Campus culture'], hours: Math.round(b.event.durationMinutes / 60), kind: 'event', source: 'attended' }))
  const volunteered: Activity[] = OPPORTUNITIES.filter((o) => opp.volunteered.includes(o.id) && Date.parse(dateFor(o, events)) < Date.now())
    .map((o) => ({ id: o.id, title: o.title, date: dateFor(o, events), skills: o.skills, hours: o.hours, kind: o.kind, source: 'volunteered' }))
  const history = [...attended, ...volunteered].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const registered = OPPORTUNITIES.filter((o) => opp.registered.includes(o.id) || opp.volunteered.includes(o.id))
  const hours = history.reduce((h, a) => h + a.hours, 0) + registered.length * 0
  const skillCounts = new Map<string, number>()
  for (const a of [...history, ...registered.map((o) => ({ skills: o.skills }))]) for (const s of a.skills) skillCounts.set(s, (skillCounts.get(s) ?? 0) + 1)
  const milestones = [
    { label: 'First event', done: history.length >= 1 },
    { label: '3 activities', done: history.length + registered.length >= 3 },
    { label: 'Volunteer once', done: opp.volunteered.length >= 1 },
    { label: '10 hours of learning', done: hours >= 10 },
  ]
  const list = OPPORTUNITIES.filter((o) => filter === 'all' || (filter === 'volunteer' ? o.kind === 'volunteer' : o.kind !== 'volunteer'))

  const exportSummary = () => {
    const lines = [
      `SeatLock participation summary — ${user?.name ?? 'Student'}`,
      `Generated ${new Date().toLocaleDateString('en-IN')} (demo data; not an official transcript)`,
      '', `Activities: ${history.length} · Hours: ${hours} · Registered: ${registered.length}`, '', 'History:',
      ...history.map((a) => `- ${dateLong(a.date)}: ${a.title} (${a.source}, ${a.hours} h) — ${a.skills.join(', ')}`),
      '', 'Upcoming:', ...registered.map((o) => `- ${o.title} (${o.host})`),
      '', 'Skills:', ...[...skillCounts].map(([s, n]) => `- ${s} ×${n}`),
    ]
    downloadText('seatlock-participation.txt', lines.join('\n'))
    toast.success('Summary downloaded')
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      <div className="stat-grid">
        <Stat label="Activities" value={history.length} icon="check" />
        <Stat label="Hours" value={hours} icon="clock" />
        <Stat label="Registered" value={registered.length} icon="calendar" tone="brand" />
        <Stat label="Skills" value={skillCounts.size} icon="award" tone="ok" />
      </div>
      <div className="grid-2">
        <Card title="Opportunities" icon="sparkle" actions={<Segmented size="sm" label="Filter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'workshop', label: 'Learn' }, { value: 'volunteer', label: 'Volunteer' }]} />}>
          <ul className="list-plain">
            {list.map((o) => {
              const isReg = opp.registered.includes(o.id)
              const isVol = opp.volunteered.includes(o.id)
              const joined = o.kind === 'volunteer' ? isVol : isReg
              return (
                <li key={o.id} className="opp">
                  <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
                    <strong>{o.title}</strong>
                    <span className="badge">{o.kind}</span>
                  </div>
                  <p className="small muted">{o.host} · {dateLong(dateFor(o, events))} · {o.hours} h</p>
                  <p className="small">{o.description}</p>
                  <p className="tiny muted">Skills: {o.skills.join(', ')}</p>
                  <div className="row-wrap">
                    <button type="button" className={`btn ${joined ? 'btn-ghost' : 'btn-primary'}`} aria-pressed={joined} onClick={() => updateCampus((d) => {
                      const key = o.kind === 'volunteer' ? 'volunteered' : 'registered'
                      d.opportunities[key] = joined ? d.opportunities[key].filter((x) => x !== o.id) : [...d.opportunities[key], o.id]
                    })}>{joined ? (o.kind === 'volunteer' ? 'Signed up ✓' : 'Registered ✓') : o.kind === 'volunteer' ? 'Volunteer' : 'Register'}</button>
                    {o.eventId && <Link className="btn btn-ghost" to={`/events/${o.eventId}`}>Event</Link>}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
        <div className="stack">
          <Card title="Milestones" icon="flag">
            <ul className="list-plain">
              {milestones.map((m) => <li key={m.label} className="milestone" data-done={m.done || undefined}><Icon name={m.done ? 'check' : 'clock'} size={16} /> {m.label}</li>)}
            </ul>
            <Meter value={milestones.filter((m) => m.done).length} max={milestones.length} label="Milestones completed" tone="ok" />
          </Card>
          <Card title="Skills you’re building" icon="chart">
            {skillCounts.size ? <Bars label="Skills by activity count" data={[...skillCounts].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value, tone: 'brand' as const }))} /> : <p className="muted small">Register for a workshop to start.</p>}
          </Card>
          <Card title="Attendance history" icon="clock" actions={<button type="button" className="btn btn-ghost" onClick={exportSummary}><Icon name="download" size={16} /> Export</button>}>
            {history.length === 0 ? <p className="muted small">Attended events show up here after they happen.</p> : (
              <ul className="list-plain">
                {history.map((a) => (
                  <li key={a.id} className="hist-row">
                    <span><strong>{a.title}</strong><br /><span className="small muted">{dateLong(a.date)} · {a.hours} h</span></span>
                    <button type="button" className="btn btn-ghost" onClick={() => setCert(a)}><Icon name="award" size={16} /> Certificate</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <ConfirmDialog open={cert !== null} onOpenChange={(o) => { if (!o) setCert(null) }} title="Demo participation certificate" description="Generated on this device for demonstration. It becomes official only when an authorized organizer issues it." confirmLabel="Download SVG" cancelLabel="Close" onConfirm={() => { if (cert) downloadText(`certificate-${cert.id}.svg`, certificateSvg(cert, user?.name ?? 'Student'), 'image/svg+xml'); setCert(null) }}>
        {cert && <div className="cert-preview" dangerouslySetInnerHTML={{ __html: certificateSvg(cert, user?.name ?? 'Student') }} />}
      </ConfirmDialog>
      <SimBadge>Certificates are demo-generated — not issued by an authorized organizer</SimBadge>
    </div>
  )
}

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c)

function certificateSvg(a: Activity, name: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-label="Demo certificate for ${xml(name)}"><rect width="600" height="400" rx="18" fill="#0b0f1a"/><rect x="14" y="14" width="572" height="372" rx="12" fill="none" stroke="#7065ff" stroke-width="2"/><text x="300" y="80" fill="#a49dff" font-family="sans-serif" font-size="14" letter-spacing="4" text-anchor="middle">SEATLOCK · CERTIFICATE OF PARTICIPATION</text><text x="300" y="150" fill="#f6f7fb" font-family="sans-serif" font-size="30" font-weight="700" text-anchor="middle">${xml(name)}</text><text x="300" y="190" fill="#a7b3c4" font-family="sans-serif" font-size="15" text-anchor="middle">took part in</text><text x="300" y="228" fill="#d5ff73" font-family="sans-serif" font-size="22" font-weight="600" text-anchor="middle">${xml(a.title)}</text><text x="300" y="262" fill="#a7b3c4" font-family="sans-serif" font-size="13" text-anchor="middle">${xml(new Date(a.date).toDateString())} · ${a.hours} hours · ${xml(a.skills.join(', '))}</text><text x="300" y="340" fill="#ffc35c" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle">DEMO — NOT ISSUED BY AN AUTHORIZED ORGANIZER</text><text x="300" y="300" fill="#ffc35c" opacity="0.08" font-family="sans-serif" font-size="90" font-weight="800" text-anchor="middle" transform="rotate(-12 300 300)">DEMO</text></svg>`
}
