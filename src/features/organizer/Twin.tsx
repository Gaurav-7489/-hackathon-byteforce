import { lazy, Suspense, useState } from 'react'
import { toast } from 'sonner'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { Icon } from '../../components/Icon'
import { Card, Segmented, SimBadge } from '../../components/ui'
import type { Seat } from '../../lib/api/types'
import { routeReleased } from '../../lib/campus/engine'
import { getCampus } from '../../lib/campus/store'
import { rowIndex } from '../../lib/seats'
import { counts, mockApi, useInventory } from './useInventory'

const TwinCanvas = lazy(() => import('./TwinCanvas'))

/**
 * Venue digital twin. The 2D grid is the accessible primary view; the 3D scene
 * is optional, lazy-loaded, renders on demand and only recolours instances when
 * data changes (no full re-render of the venue).
 */
export function TwinPanel({ eventId }: { eventId: string }) {
  const { snap, refresh } = useInventory(eventId)
  const reduced = getCampus().prefs.reducedEffects
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [busy, setBusy] = useState(false)
  if (!snap) return <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
  const event = snap.events.find((e) => e.id === eventId)
  const c = counts(snap.seats)

  const scenario = async (kind: 'rush' | 'cancel' | 'block') => {
    setBusy(true)
    const m = await mockApi()
    if (kind === 'rush') toast.info(`${m.simulateRush(eventId, 25)} seats grabbed in a simulated rush`)
    if (kind === 'cancel' && event) {
      const released = m.simulateCancellation(eventId, 6)
      const routed = await routeReleased(event, released)
      toast.info(`${released.length} cancellations`, { description: routed === 'waitlist' ? 'Routed to the waitlist first.' : 'Back in open inventory.' })
    }
    if (kind === 'block') {
      const free = snap.seats.filter((s) => s.status === 'available' && s.row === 'K').slice(0, 4)
      free.forEach((s) => m.setSeatBlocked(eventId, s.id, true))
      toast.info(`Blocked ${free.length} rear seats for a camera platform`)
    }
    refresh()
    setBusy(false)
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <Card title={event?.title ?? 'Venue'} icon="cube" badge={<SimBadge>Live mock inventory</SimBadge>} actions={
        <Segmented size="sm" label="View" value={mode} onChange={setMode} options={[{ value: '2d', label: '2D grid', icon: 'grid' }, { value: '3d', label: '3D', icon: 'cube' }]} />
      }>
        <ul className="twin-legend" aria-label="Seat counts">
          <li data-s="available">Available <strong className="num">{c.available}</strong></li>
          <li data-s="held">Held <strong className="num">{c.held}</strong></li>
          <li data-s="booked">Booked <strong className="num">{c.booked}</strong></li>
          <li data-s="blocked">Blocked <strong className="num">{c.blocked}</strong></li>
          <li data-s="selected">Demo student hold <strong className="num">{c.mine}</strong></li>
        </ul>
        {mode === '3d' && !reduced ? (
          <div className="twin-3d">
            <ErrorBoundary section="the 3D twin" compact>
              <Suspense fallback={<div className="skeleton" style={{ height: '100%' }} />}>
                <TwinCanvas seats={snap.seats} label={`3D seating: ${c.available} available, ${c.held} held, ${c.booked} booked, ${c.blocked} blocked`} />
              </Suspense>
            </ErrorBoundary>
            <p className="tiny muted">Drag to orbit. Renders only when data changes.</p>
          </div>
        ) : (
          <>
            {mode === '3d' && <p className="small muted">3D is off because “Reduce visual effects” is on. Showing the 2D grid.</p>}
            <TwinGrid seats={snap.seats} />
          </>
        )}
      </Card>
      <Card title="Scenario controls" icon="wand">
        <div className="row-wrap">
          <button type="button" className="btn" disabled={busy} onClick={() => void scenario('rush')}><Icon name="flame" size={16} /> Demand rush (25 holds)</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void scenario('cancel')}><Icon name="refresh" size={16} /> 6 cancellations</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void scenario('block')}><Icon name="ban" size={16} /> Block rear seats</button>
        </div>
        <p className="tiny muted">Scenarios change the shared mock inventory, so students’ seat maps update on their next poll.</p>
      </Card>
    </div>
  )
}

function TwinGrid({ seats }: { seats: Seat[] }) {
  const rows = [...new Set(seats.map((s) => s.row))].sort((a, b) => rowIndex(a) - rowIndex(b))
  return (
    <div className="twin-grid" role="img" aria-label={`Seating grid. ${rows.length} rows. Stage at the top.`}>
      <div className="twin-stage">STAGE</div>
      {rows.map((r) => (
        <div key={r} className="twin-row">
          <span className="twin-rl">{r}</span>
          {seats.filter((s) => s.row === r).map((s) => (
            <span key={s.id} className="twin-cell" style={{ gridColumn: s.col + 2 }} data-s={s.heldByMe ? 'selected' : s.status} title={`${s.id}: ${s.heldByMe ? 'held by demo student' : s.status}`} />
          ))}
        </div>
      ))}
    </div>
  )
}
