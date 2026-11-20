import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { toast } from 'sonner'
import { Icon, type IconName } from '../../components/Icon'
import { SimBadge, Toggle } from '../../components/ui'
import type { EventDetail, Seat } from '../../lib/api/types'
import { venueByName } from '../../lib/campus/data'
import {
  accessibilityAvailability, computeTraits, estimateView, findGroupArrangements, matchAccessible, planBudget,
  priceDiffLabel, rankComfort, tierOf, type AccessMatch, type Arrangement, type PriceTier,
} from '../../lib/campus/algorithms/seating'
import { updateCampus, useCampus } from '../../lib/campus/store'
import type { AccessibilityPreference, ComfortPreference, VenueProfile } from '../../lib/campus/types'
import { money, rupees } from '../../lib/format'
import { MAX_SEATS } from '../../lib/seats'
import './smart-tools.css'

export interface SmartToolsProps {
  event: EventDetail
  seats: Seat[]
  selected: string[]
  highlighted: string[]
  onHighlight: (ids: string[] | null, label?: string) => void
  onApprove: (ids: string[], source: string) => void
  onPreview: (seatId: string) => void
}

type Tab = 'group' | 'access' | 'comfort' | 'budget' | 'view'
const TABS: { value: Tab; label: string; icon: IconName }[] = [
  { value: 'group', label: 'Buddies', icon: 'users' },
  { value: 'access', label: 'Access', icon: 'access' },
  { value: 'comfort', label: 'Quiet', icon: 'volume' },
  { value: 'budget', label: 'Budget', icon: 'wallet' },
  { value: 'view', label: 'View', icon: 'eye' },
]

/**
 * Smart seat tools. Every tool *recommends*: results are highlighted on the map
 * and only become a selection when the student presses "Select these seats".
 * Nothing here ever holds or books.
 */
export function SmartTools(props: SmartToolsProps) {
  const [tab, setTab] = useState<Tab>('group')
  const profile = venueByName(props.event.venue)
  return (
    <section className="smart card" aria-labelledby="smart-title">
      <div className="smart-head">
        <h2 id="smart-title" className="summary-title"><Icon name="sparkle" size={18} /> Smart seat tools</h2>
        <span className="badge badge-muted">Suggests only</span>
      </div>
      <Tabs.Root value={tab} onValueChange={(v) => { setTab(v as Tab); props.onHighlight(null) }}>
        <Tabs.List className="smart-tabs" aria-label="Smart seat tools">
          {TABS.map((t) => (
            <Tabs.Trigger key={t.value} value={t.value} className="smart-tab">
              <Icon name={t.icon} size={16} /> <span>{t.label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="group" className="smart-body"><GroupTool {...props} /></Tabs.Content>
        <Tabs.Content value="access" className="smart-body">{profile ? <AccessTool {...props} profile={profile} /> : <NoVenueData />}</Tabs.Content>
        <Tabs.Content value="comfort" className="smart-body">{profile ? <ComfortTool {...props} profile={profile} /> : <NoVenueData />}</Tabs.Content>
        <Tabs.Content value="budget" className="smart-body"><BudgetTool {...props} /></Tabs.Content>
        <Tabs.Content value="view" className="smart-body">{profile ? <ViewTool {...props} profile={profile} /> : <NoVenueData />}</Tabs.Content>
      </Tabs.Root>
    </section>
  )
}

function NoVenueData() {
  return <p className="muted small">The organizer hasn’t published venue details for this event yet, so we can’t make venue-specific recommendations.</p>
}

function ResultCard({ title, ids, reasons, warnings = [], meta, active, onShow, onUse, seats }: {
  title: string
  ids: string[]
  reasons: string[]
  warnings?: string[]
  meta?: string
  active: boolean
  onShow: () => void
  onUse: () => void
  seats: Seat[]
}) {
  const total = ids.reduce((t, id) => t + (seats.find((s) => s.id === id)?.price ?? 0), 0)
  return (
    <article className="rec" data-active={active || undefined} aria-label={`${title}: seats ${ids.join(', ')}`}>
      <div className="rec-head">
        <strong className="rec-title">{title}</strong>
        <span className="rec-seats num">{ids.join(' · ')}</span>
      </div>
      <ul className="reason-list">
        {reasons.slice(0, 4).map((r, i) => <li key={`${i}-${r}`}><Icon name="check" size={14} />{r}</li>)}
        {warnings.map((w, i) => <li key={`w${i}-${w}`} data-warn><Icon name="alert" size={14} />{w}</li>)}
      </ul>
      <div className="rec-foot">
        <span className="num rec-total">{meta ?? rupees(total)}</span>
        <div className="row-wrap">
          <button type="button" className="btn btn-ghost" aria-pressed={active} onClick={onShow}><Icon name="eye" size={16} /> {active ? 'Shown' : 'Show on map'}</button>
          <button type="button" className="btn btn-primary" onClick={onUse}>Select these seats</button>
        </div>
      </div>
    </article>
  )
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/* ---------------------------------------------------------------- Buddies */

function GroupTool({ event, seats, highlighted, onHighlight, onApprove }: SmartToolsProps) {
  const [size, setSize] = useState(4)
  const [cap, setCap] = useState<number | null>(300)
  const [sameRow, setSameRow] = useState(true)
  const [adjacent, setAdjacent] = useState(true)
  const [friends, setFriends] = useState(['', '', ''])
  const results = findGroupArrangements(seats, { size, maxPricePerSeat: cap, preferAdjacent: adjacent, preferSameRow: sameRow })
  const together = results.some((r) => r.together)
  const invite = (name: string) => `${location.origin}/events/${event.id}?invite=${encodeURIComponent(name || 'friend')}`

  return (
    <div className="stack">
      <p className="muted small">Find seats for your group that fit everyone’s budget. You approve the arrangement before anything is held — and one person holds all {MAX_SEATS} seats at most.</p>
      <div className="form-row">
        <label className="field"><span className="field-label">Group size</span>
          <select className="select" value={size} onChange={(e) => setSize(Number(e.currentTarget.value))}>
            {[2, 3, 4].map((n) => <option key={n} value={n}>{n} people</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Max per seat</span>
          <select className="select" value={cap ?? 'none'} onChange={(e) => setCap(e.currentTarget.value === 'none' ? null : Number(e.currentTarget.value))}>
            {[150, 200, 300, 400, 600].map((n) => <option key={n} value={n}>₹{n}</option>)}
            <option value="none">No limit</option>
          </select>
        </label>
      </div>
      <Toggle checked={adjacent} onChange={setAdjacent} label="Prefer side by side" />
      <Toggle checked={sameRow} onChange={setSameRow} label="Prefer the same row" />
      <details className="smart-invite">
        <summary>Invite friends (demo links)</summary>
        <div className="stack">
          {friends.map((f, i) => (
            <div key={i} className="invite-row">
              <input className="input" aria-label={`Friend ${i + 1} name`} placeholder={`Friend ${i + 1}`} value={f} onChange={(e) => { const v = e.currentTarget.value; setFriends((cur) => cur.map((x, k) => (k === i ? v : x))) }} />
              <button type="button" className="icon-btn" aria-label={`Copy invite link for ${f || `friend ${i + 1}`}`} onClick={() => { void navigator.clipboard?.writeText(invite(f)).then(() => toast.success('Invite link copied'), () => toast.error('Couldn’t copy — long-press the link instead')) }}><Icon name="copy" size={16} /></button>
            </div>
          ))}
          <p className="tiny muted">Links open this event for your friends. They’re demo invitations: no accounts are linked and nothing is reserved for them.</p>
        </div>
      </details>
      {results.length === 0 ? (
        <div className="alert" data-tone="warning" role="status"><Icon name="alert" size={18} /><div><strong>No {size} seats under {cap ? money(cap) : 'any price'}</strong>Try a higher budget or a smaller group, or join the waitlist.</div></div>
      ) : (
        <>
          {!together && <div className="alert" data-tone="warning" role="status"><Icon name="info" size={18} /><div><strong>Your group can’t sit in one row right now</strong>These are the closest arrangements. Compare them below.</div></div>}
          <div className="rec-list" role="list" aria-label="Seating arrangements">
            {results.map((a: Arrangement, i) => (
              <div role="listitem" key={a.id}>
                <ResultCard
                  title={`${i === 0 ? 'Best' : `Option ${i + 1}`} · ${a.label}`}
                  ids={a.seatIds}
                  reasons={a.reasons}
                  meta={`${rupees(a.total)} · ${rupees(Math.ceil(a.total / size))} each`}
                  seats={seats}
                  active={same(highlighted, a.seatIds)}
                  onShow={() => onHighlight(a.seatIds, 'buddy-seating recommendation')}
                  onUse={() => onApprove(a.seatIds, 'buddy seating')}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Accessibility */

const ACCESS_LABELS: { key: keyof AccessibilityPreference; label: string; desc?: string }[] = [
  { key: 'wheelchair', label: 'Wheelchair space' },
  { key: 'companion', label: 'Companion seat beside me' },
  { key: 'stepFree', label: 'Step-free access' },
  { key: 'easyExit', label: 'Easy entry and exit' },
  { key: 'shortWalk', label: 'Less walking' },
  { key: 'lowStimulation', label: 'Lower-stimulation area' },
  { key: 'clearSightline', label: 'Clear sightline' },
  { key: 'accessibleRestroom', label: 'Accessible restroom nearby' },
]

function AccessTool({ seats, highlighted, onHighlight, onApprove, profile }: SmartToolsProps & { profile: VenueProfile }) {
  const prefs = useCampus((s) => s.prefs.access)
  const [count, setCount] = useState(prefs.companion ? 2 : 1)
  const traits = computeTraits(seats, profile)
  const results = Object.values(prefs).some(Boolean) ? matchAccessible(seats, profile, prefs, count, traits) : []
  const avail = accessibilityAvailability(seats, profile)
  const set = (k: keyof AccessibilityPreference, v: boolean) => updateCampus((d) => { d.prefs.access[k] = v })
  return (
    <div className="stack">
      <p className="muted small"><Icon name="shield" size={14} /> Optional. We never ask why — and these choices stay on this device. Venue details come from the organizer.</p>
      <dl className="avail">
        <div><dt>Wheelchair spaces</dt><dd className="num">{avail.wheelchairFree} of {avail.wheelchairTotal} free</dd></div>
        <div><dt>Companion seats</dt><dd className="num">{avail.companionFree} of {avail.companionTotal} free</dd></div>
        <div><dt>Step-free rows</dt><dd>{profile.stepFreeRows.join(', ')}</dd></div>
      </dl>
      <fieldset className="fieldset">
        <legend>What helps you?</legend>
        <div className="toggle-grid">
          {ACCESS_LABELS.map((a) => <Toggle key={a.key} checked={prefs[a.key]} onChange={(v) => set(a.key, v)} label={a.label} />)}
        </div>
      </fieldset>
      <label className="field"><span className="field-label">Seats needed</span>
        <select className="select" value={count} onChange={(e) => setCount(Number(e.currentTarget.value))}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {prefs.accessibleRestroom && (
        <p className="small">{profile.accessibleRestroom ? <><Icon name="info" size={14} /> {profile.accessibleRestroom.note} (≈{profile.accessibleRestroom.distanceM} m)</> : 'The organizer hasn’t listed an accessible restroom for this venue.'}</p>
      )}
      <Results results={results} seats={seats} highlighted={highlighted} onHighlight={onHighlight} onApprove={onApprove} source="accessibility match" empty="Turn on what helps you to see matching seats." />
    </div>
  )
}

function Results({ results, seats, highlighted, onHighlight, onApprove, source, empty }: {
  results: AccessMatch[]
  seats: Seat[]
  highlighted: string[]
  onHighlight: SmartToolsProps['onHighlight']
  onApprove: SmartToolsProps['onApprove']
  source: string
  empty: string
}) {
  if (results.length === 0) return <p className="muted small">{empty}</p>
  return (
    <div className="rec-list" role="list" aria-label="Recommendations">
      {results.map((r, i) => r.seatIds.length === 0 ? (
        <div role="listitem" key={i} className="alert" data-tone="warning"><Icon name="alert" size={18} /><div>{r.warnings.join(' ')}</div></div>
      ) : (
        <div role="listitem" key={r.seatIds.join()}>
          <ResultCard
            title={i === 0 ? 'Best match' : `Option ${i + 1}`}
            ids={r.seatIds}
            reasons={r.reasons.length ? r.reasons : ['Balanced view and price']}
            warnings={r.warnings}
            seats={seats}
            active={same(highlighted, r.seatIds)}
            onShow={() => onHighlight(r.seatIds, `${source} recommendation`)}
            onUse={() => onApprove(r.seatIds, source)}
          />
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- QuietZone */

const COMFORT_LABELS: { key: keyof ComfortPreference; label: string }[] = [
  { key: 'quieter', label: 'Quieter zones' },
  { key: 'lessCrowded', label: 'Less crowded right now' },
  { key: 'easyExit', label: 'Easy exit' },
  { key: 'lowNoise', label: 'Lower noise exposure' },
  { key: 'personalSpace', label: 'More personal space' },
]

function ComfortTool({ seats, highlighted, onHighlight, onApprove, profile }: SmartToolsProps & { profile: VenueProfile }) {
  const prefs = useCampus((s) => s.prefs.comfort)
  const [count, setCount] = useState(1)
  const results = Object.values(prefs).some(Boolean) ? rankComfort(seats, profile, prefs, count) : []
  return (
    <div className="stack">
      <div className="row-wrap"><SimBadge>Noise is an estimate</SimBadge><span className="tiny muted">From organizer-listed speaker positions — not an acoustic measurement.</span></div>
      <div className="toggle-grid">
        {COMFORT_LABELS.map((c) => <Toggle key={c.key} checked={prefs[c.key]} onChange={(v) => updateCampus((d) => { d.prefs.comfort[c.key] = v })} label={c.label} />)}
      </div>
      {profile.quietZones.length > 0 && <p className="small muted">Organizer quiet zone: {profile.quietZones.map((z) => `${z.label} (rows ${z.rows.join(', ')})`).join('; ')}.</p>}
      <label className="field"><span className="field-label">Seats</span>
        <select className="select" value={count} onChange={(e) => setCount(Number(e.currentTarget.value))}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <Results results={results} seats={seats} highlighted={highlighted} onHighlight={onHighlight} onApprove={onApprove} source="QuietZone" empty="Choose at least one comfort preference." />
    </div>
  )
}

/* ---------------------------------------------------------------- Budget */

function BudgetTool({ seats, highlighted, onHighlight, onApprove }: SmartToolsProps) {
  const defaultBudget = useCampus((s) => s.prefs.budget)
  const [budget, setBudget] = useState(Math.max(defaultBudget * 2, 600))
  const [tickets, setTickets] = useState(2)
  const [tier, setTier] = useState<PriceTier>('any')
  const [travel, setTravel] = useState(40)
  const [food, setFood] = useState(120)
  const plan = planBudget({ budget, tickets, tier, travelPerPerson: travel, foodPerPerson: food }, seats)
  const num = (v: string) => Math.max(0, Math.min(100000, Math.round(Number(v) || 0)))
  return (
    <div className="stack">
      <div className="form-row">
        <label className="field"><span className="field-label">Total budget (₹)</span><input className="input" inputMode="numeric" type="number" min={0} value={budget} onChange={(e) => setBudget(num(e.currentTarget.value))} /></label>
        <label className="field"><span className="field-label">Tickets</span>
          <select className="select" value={tickets} onChange={(e) => setTickets(Number(e.currentTarget.value))}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select>
        </label>
        <label className="field"><span className="field-label">Category</span>
          <select className="select" value={tier} onChange={(e) => setTier(e.currentTarget.value as PriceTier)}>
            <option value="any">Any</option><option value="premium">Premium (A–C)</option><option value="standard">Standard (D–H)</option><option value="economy">Economy (J–K)</option>
          </select>
        </label>
        <label className="field"><span className="field-label">Travel / person (₹)</span><input className="input" type="number" min={0} inputMode="numeric" value={travel} onChange={(e) => setTravel(num(e.currentTarget.value))} /></label>
        <label className="field"><span className="field-label">Food / person (₹)</span><input className="input" type="number" min={0} inputMode="numeric" value={food} onChange={(e) => setFood(num(e.currentTarget.value))} /></label>
      </div>
      <dl className="budget-sum" aria-live="polite">
        <div><dt>Tickets</dt><dd className="num">{plan.ticketCost === null ? '—' : rupees(plan.ticketCost)}</dd></div>
        <div><dt>Travel + food</dt><dd className="num">{rupees(plan.extras)}</dd></div>
        <div data-tone={plan.status}><dt>Estimated total</dt><dd className="num">{plan.total === null ? '—' : rupees(plan.total)}</dd></div>
        <div data-tone={plan.status}><dt>Remaining</dt><dd className="num">{plan.remaining === null ? '—' : rupees(plan.remaining)}</dd></div>
      </dl>
      <p className="tiny muted">Cheapest open seat by category: {(['premium', 'standard', 'economy'] as const).map((t) => `${t} ${plan.tierPrices[t] === null ? 'sold out' : money(plan.tierPrices[t]!)}`).join(' · ')}. Max ticket price that fits: {plan.perSeatCap < 0 ? 'none' : money(plan.perSeatCap)} each.</p>
      {plan.warnings.map((w) => <p key={w} className="field-error" role="status"><Icon name="alert" size={16} /> {w}</p>)}
      {plan.recommended && (
        <ResultCard title={`Fits your budget · ${plan.recommended.label}`} ids={plan.recommended.seatIds} reasons={[`${tierOf(plan.recommended.seatIds[0]!.replace(/\d+/, ''))} seats`, ...plan.recommended.reasons]} seats={seats}
          meta={`${rupees(plan.recommended.total)} for ${tickets}`} active={same(highlighted, plan.recommended.seatIds)}
          onShow={() => onHighlight(plan.recommended!.seatIds, 'within budget')} onUse={() => onApprove(plan.recommended!.seatIds, 'budget planner')} />
      )}
      {plan.cheaper && (
        <ResultCard title={`Cheaper alternative · ${plan.cheaper.label}`} ids={plan.cheaper.seatIds} reasons={[`Saves ${rupees((plan.recommended?.total ?? plan.cheaper.total) - plan.cheaper.total)} on tickets`, ...plan.cheaper.reasons.slice(0, 2)]} seats={seats}
          active={same(highlighted, plan.cheaper.seatIds)} onShow={() => onHighlight(plan.cheaper!.seatIds, 'cheaper alternative')} onUse={() => onApprove(plan.cheaper!.seatIds, 'budget planner')} />
      )}
      {tickets > 1 && plan.total !== null && <p className="small">Group summary: <strong className="num">{rupees(Math.ceil(plan.total / tickets))}</strong> per person including travel and food. Split it after booking from My bookings.</p>}
    </div>
  )
}

/* ---------------------------------------------------------------- SeatView compare */

function Sightline({ seat, profile }: { seat: Seat; profile: VenueProfile }) {
  const v = estimateView(seat, profile)
  // Top-down sketch: stage at top, seat dot positioned by grid coords.
  const x = 20 + (seat.col / 21) * 160
  const y = 40 + (('ABCDEFGHJK'.indexOf(seat.row)) / 9) * 90
  return (
    <svg viewBox="0 0 200 140" className="sightline" role="img" aria-label={`Top-down sketch: seat ${seat.id}, ${v.summary}`}>
      <path d="M30 18 Q100 6 170 18" className="sl-stage" />
      <text x="100" y="32" textAnchor="middle" className="sl-label">STAGE</text>
      <line x1={x} y1={y} x2="30" y2="18" className="sl-ray" />
      <line x1={x} y1={y} x2="170" y2="18" className="sl-ray" />
      {v.obstruction && <rect x={x - 6} y={y - 22} width="12" height="8" rx="2" className="sl-obs" />}
      <circle cx={x} cy={y} r="5" className="sl-seat" />
    </svg>
  )
}

function ViewTool({ seats, selected, highlighted, profile, onPreview }: SmartToolsProps & { profile: VenueProfile }) {
  const pool = [...new Set([...selected, ...highlighted])]
  const [a, setA] = useState<string>(pool[0] ?? 'D10')
  const [b, setB] = useState<string>(pool[1] ?? 'H3')
  const sa = seats.find((s) => s.id === a)
  const sb = seats.find((s) => s.id === b)
  const options = seats.map((s) => s.id)
  return (
    <div className="stack">
      <div className="row-wrap"><SimBadge>Approximation</SimBadge><span className="tiny muted">Not calibrated to this venue. Distances use organizer-listed row depth.</span></div>
      <div className="form-row">
        <label className="field"><span className="field-label">Seat A</span><select className="select" value={a} onChange={(e) => setA(e.currentTarget.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="field"><span className="field-label">Seat B</span><select className="select" value={b} onChange={(e) => setB(e.currentTarget.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>
      </div>
      <div className="view-compare">
        {[sa, sb].map((s, i) => s && (
          <article key={`${i}-${s.id}`} className="view-card">
            <div className="rec-head"><strong>Seat {s.id}</strong><span className="badge">{tierOf(s.row)} · {money(s.price)}</span></div>
            <Sightline seat={s} profile={profile} />
            <ViewFacts seat={s} profile={profile} />
            <button type="button" className="btn btn-ghost btn-block" onClick={() => onPreview(s.id)}><Icon name="cube" size={16} /> Preview in 3D</button>
          </article>
        ))}
      </div>
      {sa && sb && <CompareVerdict a={sa} b={sb} profile={profile} />}
    </div>
  )
}

function ViewFacts({ seat, profile }: { seat: Seat; profile: VenueProfile }) {
  const v = estimateView(seat, profile)
  return (
    <dl className="view-facts">
      <div><dt>View score</dt><dd className="num">{v.score}/100</dd></div>
      <div><dt>Distance</dt><dd className="num">≈{v.distanceM.toFixed(1)} m</dd></div>
      <div><dt>Angle</dt><dd className="num">{Math.round(v.angleDeg)}°</dd></div>
      <div><dt>Raised</dt><dd className="num">{v.elevationM.toFixed(1)} m</dd></div>
      {v.obstruction && <div className="view-obs"><dt>Note</dt><dd>{v.obstruction}</dd></div>}
    </dl>
  )
}

function CompareVerdict({ a, b, profile }: { a: Seat; b: Seat; profile: VenueProfile }) {
  const va = estimateView(a, profile)
  const vb = estimateView(b, profile)
  if (a.id === b.id) return null
  const better = va.score >= vb.score ? a : b
  const worse = better === a ? b : a
  const diff = Math.abs(va.score - vb.score)
  return (
    <p className="small" role="status">
      {diff < 5 ? `${a.id} and ${b.id} have a similar view` : `${better.id} has the better view (+${diff})`}; {better.id} is {priceDiffLabel(better.price - worse.price)} than {worse.id}.
    </p>
  )
}
