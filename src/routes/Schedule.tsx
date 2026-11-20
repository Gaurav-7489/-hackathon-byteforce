import { Suspense, use, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon } from '../components/Icon'
import { Card, Empty, PageHead, Segmented } from '../components/ui'
import { api } from '../lib/api/client'
import type { Booking, EventSummary } from '../lib/api/types'
import { downloadText, eventWindow, findConflicts, icsForBookings, parseIcs } from '../lib/campus/algorithms/planning'
import { uid, updateCampus, useCampus } from '../lib/campus/store'
import type { ScheduleItem, ScheduleKind } from '../lib/campus/types'
import { dateLong, time } from '../lib/format'
import { invalidate, resource } from '../lib/resource'
import './campus.css'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const today = () => new Date().toISOString().slice(0, 10)

export function Schedule() {
  const [attempt, setAttempt] = useState(0)
  return (
    <div className="container page-pad">
      <title>Schedule · SeatLock</title>
      <PageHead eyebrow="Schedule conflict detector" icon="calendar" title="Don’t book over your classes" lead="Add classes, exams and commitments — or import a calendar file. SeatLock checks every event and booking against them on this device." actions={<ImportIcs />} />
      <div className="grid-2">
        <div className="stack">
          <AddItem />
          <ItemList />
        </div>
        <ErrorBoundary key={attempt} section="conflict check" onReset={() => { invalidate('events'); invalidate('bookings'); setAttempt((a) => a + 1) }}>
          <Suspense fallback={<div className="skeleton" style={{ height: 320, borderRadius: 20 }} />}>
            <Conflicts events={resource('events', api.events)} bookings={resource('bookings', api.bookings)} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}

function AddItem() {
  const [kind, setKind] = useState<ScheduleKind>('class')
  const [error, setError] = useState<string | null>(null)
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const title = String(f.get('title') ?? '').trim()
    const start = String(f.get('start') ?? '')
    const end = String(f.get('end') ?? '')
    if (!title) return setError('Give it a name, e.g. “DSA lecture”.')
    if (!start || !end || end <= start) return setError('End time must be after the start time.')
    const item: ScheduleItem = kind === 'class'
      ? { id: uid('sch'), kind, title, weekday: Number(f.get('weekday')), start, end, source: 'manual' }
      : { id: uid('sch'), kind, title, date: String(f.get('date') || today()), start, end, source: 'manual' }
    updateCampus((d) => { d.schedule.push(item) })
    setError(null)
    e.currentTarget.reset()
    toast.success(`${title} added`)
  }
  return (
    <Card title="Add to schedule" icon="plus">
      <form className="stack" onSubmit={submit} noValidate>
        <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: 'class', label: 'Weekly class' }, { value: 'exam', label: 'Exam' }, { value: 'commitment', label: 'Commitment' }]} />
        <label className="field"><span className="field-label">Name</span><input name="title" className="input" placeholder={kind === 'exam' ? 'Midsem: Signals' : kind === 'class' ? 'DSA lecture' : 'Club meeting'} aria-invalid={Boolean(error) || undefined} /></label>
        <div className="form-row">
          {kind === 'class' ? (
            <label className="field"><span className="field-label">Day</span>
              <select name="weekday" className="select" defaultValue={new Date().getDay()}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
            </label>
          ) : (
            <label className="field"><span className="field-label">Date</span><input name="date" type="date" className="input" defaultValue={today()} /></label>
          )}
          <label className="field"><span className="field-label">Starts</span><input name="start" type="time" className="input" defaultValue="18:00" /></label>
          <label className="field"><span className="field-label">Ends</span><input name="end" type="time" className="input" defaultValue="20:00" /></label>
        </div>
        {error && <p className="field-error" role="alert"><Icon name="alert" size={16} /> {error}</p>}
        <button type="submit" className="btn btn-primary">Add</button>
      </form>
    </Card>
  )
}

function ImportIcs() {
  return (
    <label className="btn">
      <Icon name="upload" size={16} /> Import .ics
      <input
        type="file"
        accept=".ics,text/calendar"
        className="sr-only"
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (!file) return
          if (file.size > 1_000_000) { toast.error('That calendar file is too large (1 MB max).'); return }
          const items = parseIcs(await file.text(), `ics-${Date.now()}`)
          if (!items.length) { toast.error('No events found in that file', { description: 'Supported: VEVENT with DTSTART/DTEND; weekly RRULEs become classes.' }); return }
          updateCampus((d) => { d.schedule.push(...items.slice(0, 200)) })
          toast.success(`Imported ${items.length} item${items.length > 1 ? 's' : ''}`)
        }}
      />
    </label>
  )
}

function ItemList() {
  const items = useCampus((s) => s.schedule)
  if (items.length === 0) return <Empty icon="calendar" title="Nothing scheduled yet">Add your timetable to see clashes with events.</Empty>
  return (
    <Card title={`Your schedule (${items.length})`} icon="clock" actions={<button type="button" className="btn btn-ghost" onClick={() => updateCampus((d) => { d.schedule = [] })}>Clear all</button>}>
      <ul className="list-plain">
        {items.map((i) => (
          <li key={i.id} className="sched-row">
            <span className="badge" data-kind={i.kind}>{i.kind}</span>
            <span className="sched-title">{i.title}</span>
            <span className="muted small num">{i.kind === 'class' ? `Every ${DAYS[i.weekday ?? 0]?.slice(0, 3)}` : i.date} · {i.start}–{i.end}</span>
            <button type="button" className="icon-btn" aria-label={`Remove ${i.title}`} onClick={() => updateCampus((d) => { d.schedule = d.schedule.filter((x) => x.id !== i.id) })}><Icon name="trash" size={16} /></button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Conflicts({ events, bookings }: { events: Promise<EventSummary[]>; bookings: Promise<Booking[]> }) {
  const all = use(events)
  const mine = use(bookings).filter((b) => b.status === 'confirmed' && Date.parse(b.event.startsAt) > Date.now())
  const items = useCampus((s) => s.schedule)
  const check = (title: string, startsAt: string, duration: number) => {
    const w = eventWindow({ startsAt, durationMinutes: duration })
    return { title, startsAt, conflicts: findConflicts(w.start, w.end, items) }
  }
  const bookingRows = mine.map((b) => ({ ...check(b.event.title, b.event.startsAt, b.event.durationMinutes), href: '/bookings', booked: true }))
  const eventRows = all.filter((e) => Date.parse(e.startsAt) > Date.now()).map((e) => ({ ...check(e.title, e.startsAt, 150), href: `/events/${e.id}`, booked: false }))
  const clashes = [...bookingRows, ...eventRows].filter((r) => r.conflicts.length)
  return (
    <Card title="Conflict check" icon="alert" actions={
      <button type="button" className="btn btn-ghost" disabled={!mine.length} onClick={() => { downloadText('seatlock-bookings.ics', icsForBookings(mine), 'text/calendar'); toast.success('Calendar file downloaded') }}>
        <Icon name="download" size={16} /> Export bookings
      </button>
    }>
      {items.length === 0 ? <p className="muted small">Add schedule items to start checking.</p> : clashes.length === 0 ? (
        <p className="small"><Icon name="check" size={16} /> No clashes across {bookingRows.length} booking{bookingRows.length === 1 ? '' : 's'} and {eventRows.length} upcoming events.</p>
      ) : (
        <ul className="list-plain">
          {clashes.map((r) => (
            <li key={r.title + r.startsAt} className="clash">
              <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
                <Link to={r.href} className="clash-title">{r.title}</Link>
                {r.booked && <span className="badge badge-warn">Booked</span>}
              </div>
              <p className="small muted">{dateLong(r.startsAt)} at {time(r.startsAt)}</p>
              {r.conflicts.map((c) => (
                <p key={c.item.id} className="small">{c.kind === 'full' ? 'Fully overlaps' : `Overlaps by ${c.overlapMinutes} min:`} <strong>{c.item.title}</strong> ({c.item.kind})</p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
