import { Suspense, use, useState } from 'react'
import { Link } from 'react-router'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { Card, Meter, PageHead, Segmented, SimBadge } from '../components/ui'
import { api } from '../lib/api/client'
import type { Booking, EventSummary } from '../lib/api/types'
import { eventWindow, findConflicts, recommendEvents, type MatchResult } from '../lib/campus/algorithms/planning'
import { INTERESTS } from '../lib/campus/data'
import { updateCampus, useCampus } from '../lib/campus/store'
import type { TimeOfDay } from '../lib/campus/types'
import { money, relativeDay, time } from '../lib/format'
import { invalidate, resource } from '../lib/resource'
import './campus.css'

const CATEGORIES = ['Music', 'Classical', 'Literature', 'Comedy', 'Tech']
const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night']

export function Discover() {
  const [attempt, setAttempt] = useState(0)
  return (
    <div className="container page-pad">
      <title>For you · SeatLock</title>
      <PageHead eyebrow="Event matchmaker" icon="sparkle" title="Picked for you, with reasons" lead="An explainable recommender that runs on this device: it scores events against your interests, budget, preferred times, past bookings and schedule. No paid AI, no hidden profile." />
      <div className="foryou">
        <PrefsEditor />
        <ErrorBoundary key={attempt} section="recommendations" onReset={() => { invalidate('events'); invalidate('bookings'); setAttempt((a) => a + 1) }}>
          <Suspense fallback={<div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 150, borderRadius: 20 }} />)}</div>}>
            <Results events={resource('events', api.events)} bookings={resource('bookings', api.bookings)} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}

function PrefsEditor() {
  const prefs = useCampus((s) => s.prefs)
  const toggleIn = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  return (
    <Card title="Your preferences" icon="settings" className="foryou-prefs">
      <fieldset className="fieldset">
        <legend>Interests</legend>
        <div className="row-wrap">
          {INTERESTS.map((i) => (
            <button key={i} type="button" className="chip" aria-pressed={prefs.interests.includes(i)} onClick={() => updateCampus((d) => { d.prefs.interests = toggleIn(d.prefs.interests, i) })}>{i}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend>Categories you follow</legend>
        <div className="row-wrap">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={prefs.categories.includes(c)} onClick={() => updateCampus((d) => { d.prefs.categories = toggleIn(d.prefs.categories, c) })}>{c}</button>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span className="field-label">Budget per ticket: <span className="num">{money(prefs.budget)}</span></span>
        <input className="range" type="range" min={0} max={800} step={50} value={prefs.budget} onChange={(e) => { const v = Number(e.currentTarget.value); updateCampus((d) => { d.prefs.budget = v }) }} />
      </label>
      <fieldset className="fieldset">
        <legend>When are you free?</legend>
        <div className="row-wrap">
          {TIMES.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={prefs.times.includes(t)} onClick={() => updateCampus((d) => { d.prefs.times = toggleIn(d.prefs.times, t) })}>{t}</button>
          ))}
        </div>
      </fieldset>
      <p className="tiny muted">Saved on this device only. Add classes and exams in <Link to="/schedule">Schedule</Link> to avoid clashes.</p>
    </Card>
  )
}

function Results({ events, bookings }: { events: Promise<EventSummary[]>; bookings: Promise<Booking[]> }) {
  const all = use(events)
  const mine = use(bookings)
  const prefs = useCampus((s) => s.prefs)
  const schedule = useCampus((s) => s.schedule)
  const [view, setView] = useState<'top' | 'all'>('top')
  const titles = new Map(all.map((e) => [e.id, e.category]))
  const pastCategories = [...new Set(mine.map((b) => titles.get(b.eventId) ?? (/(tedx|talk)/i.test(b.event.title) ? 'Tech' : 'Music')))]
  const ranked = recommendEvents(all, prefs, {
    pastCategories,
    conflictsFor: (e) => { const w = eventWindow(e); return findConflicts(w.start, w.end, schedule).length },
  })
  const top = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  return (
    <div className="stack">
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <Segmented label="Show" value={view} onChange={setView} options={[{ value: 'top', label: 'Top picks' }, { value: 'all', label: `All ${ranked.length}` }]} />
        <SimBadge>Deterministic, explainable scoring</SimBadge>
      </div>
      {(view === 'top' ? top : ranked).map((r, i) => <MatchCard key={r.event.id} r={r} rank={i + 1} />)}
      {view === 'top' && rest.length > 0 && (
        <section aria-labelledby="alt-title" className="stack">
          <h2 id="alt-title" className="panel-title">Also worth a look</h2>
          <ul className="alt-list">
            {rest.slice(0, 4).map((r) => (
              <li key={r.event.id}><Link to={`/events/${r.event.id}`}>{r.event.title}</Link> <span className="muted small">· {r.score}% · {r.cautions[0] ?? r.reasons[0] ?? ''}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function MatchCard({ r, rank }: { r: MatchResult; rank: number }) {
  const e = r.event
  const prompt = `2 seats together under ₹${Math.max(e.priceFrom, 100)} each`
  return (
    <article className="match card" aria-label={`${e.title}, ${r.score}% match`}>
      <div className="match-poster"><Poster event={e} /></div>
      <div className="match-body">
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <p className="ph-eyebrow">#{rank} · {e.category}</p>
          <span className="match-score num">{r.score}% match</span>
        </div>
        <h3 className="match-title">{e.title}</h3>
        <p className="muted small">{relativeDay(e.startsAt)}, {time(e.startsAt)} · {e.venue} · from {money(e.priceFrom)}</p>
        <Meter value={r.score} max={100} label={`Compatibility ${r.score}%`} tone={r.score > 65 ? 'ok' : r.score > 40 ? 'brand' : 'warn'} />
        <ul className="reason-list">
          {r.reasons.map((x) => <li key={x}><Icon name="check" size={14} />{x}</li>)}
          {r.cautions.map((x) => <li key={x} data-warn><Icon name="alert" size={14} />{x}</li>)}
        </ul>
        <div className="row-wrap">
          <Link className="btn btn-primary" to={`/events/${e.id}`}>{e.seatsLeft === 0 ? 'Join waitlist' : 'Choose seats'}</Link>
          <Link className="btn btn-ghost" to={`/events/${e.id}`} state={{ aiPrompt: prompt }}><Icon name="sparkle" size={16} /> Ask the seat assistant</Link>
        </div>
      </div>
    </article>
  )
}
