import { Suspense, use, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon } from '../components/Icon'
import { Card, Empty, Meter, PageHead, SimBadge, Toggle } from '../components/ui'
import { api } from '../lib/api/client'
import type { Booking, EventSummary } from '../lib/api/types'
import { COMPANIONS } from '../lib/campus/data'
import { notify, updateCampus, useCampus } from '../lib/campus/store'
import type { CompanionProfile, CompanionStatus } from '../lib/campus/types'
import { invalidate, resource } from '../lib/resource'
import './campus.css'

/**
 * Smart Companion Matching — strictly opt-in. Profiles are fictional and
 * anonymous. Seats, location, contact details and schedules are never shown;
 * the only thing shared after mutual acceptance is a public meeting point.
 */
export function Buddies() {
  const settings = useCampus((s) => s.companion)
  const [attempt, setAttempt] = useState(0)
  const set = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) => updateCampus((d) => { d.companion[k] = v })
  return (
    <div className="container page-pad">
      <title>Event buddies · SeatLock</title>
      <PageHead eyebrow="Smart companion matching" icon="heart" title="Going alone? Find a buddy — on your terms" lead="Anonymous, interest-based matching for the events you’re attending. Nothing is shared until both of you say yes." />
      <div className="grid-2">
        <Card title="Privacy & visibility" icon="shield">
          <Toggle checked={settings.optIn} onChange={(v) => set('optIn', v)} label="Show me in buddy matching" description="Off by default. Turning it off hides you instantly." />
          <Toggle checked={settings.showInterests} onChange={(v) => set('showInterests', v)} label="Show my interests" disabled={!settings.optIn} />
          <Toggle checked={settings.showYear} onChange={(v) => set('showYear', v)} label="Show my year of study" disabled={!settings.optIn} />
          <Toggle checked={settings.allowRequests} onChange={(v) => set('allowRequests', v)} label="Allow incoming requests" disabled={!settings.optIn} />
          <Toggle checked={settings.shareHandleOnAccept} onChange={(v) => set('shareHandleOnAccept', v)} label="Share my campus handle after a mutual match" description="Never your phone, email, seat or location." disabled={!settings.optIn} />
          <ul className="reason-list">
            <li><Icon name="check" size={14} />Your seat numbers are never shown</li>
            <li><Icon name="check" size={14} />No live location, no schedule sharing</li>
            <li><Icon name="check" size={14} />Block or report anyone in one tap</li>
          </ul>
        </Card>
        {settings.optIn ? (
          <ErrorBoundary key={attempt} section="buddy matches" onReset={() => { invalidate('bookings'); setAttempt((a) => a + 1) }}>
            <Suspense fallback={<div className="skeleton" style={{ height: 300, borderRadius: 20 }} />}>
              <Matches bookings={resource('bookings', api.bookings)} events={resource('events', api.events)} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <Empty icon="heart" title="Matching is off">Turn on “Show me in buddy matching” to see students going to the same events. You can turn it off any time.</Empty>
        )}
      </div>
      <p className="tiny muted" style={{ marginTop: 'var(--space-6)' }}><SimBadge>Fictional profiles</SimBadge> Demo profiles and responses are simulated.</p>
    </div>
  )
}

function compatibility(p: CompanionProfile, interests: string[], myEvents: string[]) {
  const shared = p.interests.filter((i) => interests.includes(i))
  const sharedEvents = p.eventIds.filter((e) => myEvents.includes(e))
  const score = Math.min(100, sharedEvents.length * 35 + shared.length * 15 + 20)
  return { score, shared, sharedEvents }
}

function Matches({ bookings, events }: { bookings: Promise<Booking[]>; events: Promise<EventSummary[]> }) {
  const mine = use(bookings)
  const all = use(events)
  const interests = useCampus((s) => s.prefs.interests)
  const requests = useCampus((s) => s.companion.requests)
  const share = useCampus((s) => s.companion.shareHandleOnAccept)
  const [confirm, setConfirm] = useState<{ p: CompanionProfile; action: 'blocked' | 'reported' } | null>(null)
  const myEvents = mine.filter((b) => b.status === 'confirmed' && Date.parse(b.event.startsAt) > Date.now()).map((b) => b.eventId)
  const titles = new Map(all.map((e) => [e.id, e.title]))
  const ranked = COMPANIONS.map((p) => ({ p, ...compatibility(p, interests, myEvents) }))
    .filter((x) => requests[x.p.id] !== 'blocked' && requests[x.p.id] !== 'reported')
    .sort((a, b) => b.score - a.score)
  const setStatus = (id: string, st: CompanionStatus) => updateCampus((d) => { d.companion.requests[id] = st })

  const send = (p: CompanionProfile) => {
    setStatus(p.id, 'pending')
    toast.success(`Request sent to ${p.handle}`)
    setTimeout(() => {
      setStatus(p.id, p.respondsWith)
      notify({ kind: 'companion', title: p.respondsWith === 'accepted' ? `${p.handle} said yes` : `${p.handle} passed`, body: p.respondsWith === 'accepted' ? 'Meet at the venue’s main gate 15 minutes before doors — a public spot.' : 'No worries — nothing about you was shared.', href: '/buddies' })
    }, 3500)
  }

  return (
    <div className="stack">
      {myEvents.length === 0 && <div className="alert" data-tone="info"><Icon name="info" size={18} /><div>Book an event to see buddies going to the same one. Showing interest-based matches for now. <Link to="/events">Browse events</Link></div></div>}
      {ranked.map(({ p, score, shared, sharedEvents }) => {
        const st = requests[p.id] ?? 'none'
        return (
          <article key={p.id} className="buddy card" aria-label={`${p.handle}, ${score}% compatible`}>
            <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
              <div className="buddy-id"><span className="buddy-avatar" aria-hidden="true">{p.handle.slice(0, 1)}</span><div><strong>{p.handle}</strong><p className="tiny muted">{p.year} · anonymous profile</p></div></div>
              <span className="num small">{score}% match</span>
            </div>
            <Meter value={score} max={100} label={`Compatibility ${score}%`} tone="brand" />
            <ul className="reason-list">
              {sharedEvents.map((e) => <li key={e}><Icon name="check" size={14} />Also going to {titles.get(e) ?? e}</li>)}
              {shared.length > 0 && <li><Icon name="check" size={14} />Shared interests: {shared.join(', ')}</li>}
              <li><Icon name="info" size={14} />{p.vibe}</li>
            </ul>
            <div className="row-wrap">
              {st === 'none' || st === 'declined' ? (
                <button type="button" className="btn btn-primary" onClick={() => send(p)} disabled={st === 'declined'}>{st === 'declined' ? 'Not available' : 'Send buddy request'}</button>
              ) : st === 'pending' ? <span className="badge">Request pending…</span> : st === 'accepted' ? (
                <span className="badge badge-ok">Matched · meet at the main gate{share ? ' · handles shared' : ''}</span>
              ) : null}
              {st === 'accepted' && <button type="button" className="btn btn-ghost" onClick={() => setStatus(p.id, 'none')}>Unmatch</button>}
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm({ p, action: 'blocked' })}>Block</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm({ p, action: 'reported' })}><Icon name="flag" size={14} /> Report</button>
            </div>
          </article>
        )
      })}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => { if (!o) setConfirm(null) }}
        title={confirm?.action === 'reported' ? `Report ${confirm.p.handle}?` : `Block ${confirm?.p.handle ?? ''}?`}
        description={confirm?.action === 'reported' ? 'They’ll be hidden from you and the report goes to campus moderators (simulated in this demo).' : 'They won’t see you or be able to send requests. They aren’t notified.'}
        confirmLabel={confirm?.action === 'reported' ? 'Report' : 'Block'}
        cancelLabel="Cancel"
        onConfirm={() => { if (confirm) { setStatus(confirm.p.id, confirm.action); toast.success(confirm.action === 'reported' ? 'Reported and hidden' : 'Blocked') } setConfirm(null) }}
      />
    </div>
  )
}
