import {
  Activity, lazy, Suspense, use, useActionState, useEffect, useEffectEvent, useMemo, useOptimistic, useRef, useState,
  useTransition, startTransition as startGlobalTransition, ViewTransition,
} from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { AiAssistant, validateSuggestion, type Suggestion } from '../components/AiAssistant'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { SeatLegend, SeatMap } from '../components/SeatMap'
import { SubmitButton } from '../components/SubmitButton'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { api } from '../lib/api/client'
import { friendlyMessage, toApiError } from '../lib/api/errors'
import type { EventDetail, EventSummary, Seat, SeatsResponse } from '../lib/api/types'
import { demoBridge } from '../lib/demoBridge'
import { summaryCache } from '../lib/eventCache'
import { dateLong, money, rupees, time } from '../lib/format'
import { useHold } from '../lib/hold'
import { spring } from '../lib/motion'
import { invalidate, resource } from '../lib/resource'
import { isSelectable, MAX_SEATS, rowIndex, totalFor } from '../lib/seats'
import { venueByName } from '../lib/campus/data'
import { priceDiffLabel, rankReplacements, type Replacement } from '../lib/campus/algorithms/seating'
import { getCampus } from '../lib/campus/store'
import { QueueGate } from '../features/fair-queue/QueueRoom'
import { ClashNotice, InviteNotice, WaitlistCta } from '../features/event-extras/EventExtras'
import { StageFallback } from '../three/StageFallback'
import './detail.css'

const StageCanvas = lazy(() => import('../three/StageCanvas'))
const SmartTools = lazy(() => import('../features/smart-tools/SmartTools').then((m) => ({ default: m.SmartTools })))
const POLL_MS = 4000

export function EventDetailPage() {
  const { id = '' } = useParams()
  const summary = summaryCache.get(id)
  const [attempt, setAttempt] = useState(0)
  const [mountKey] = useState(() => Date.now())

  const eventPromise = resource(`event:${id}`, () => api.event(id))
  const seatsPromise = resource(`seats:${id}:${mountKey}:${attempt}`, () => api.seats(id))

  return (
    <div className="detail">
      <title>{`${summary?.title ?? 'Choose seats'} · SeatLock`}</title>
      <meta name="description" content={summary ? `${summary.title} at ${summary.venue} — pick your seats live.` : 'Pick your seats live on SeatLock.'} />
      <div className="container">
        <Link to="/events" className="back-link"><Icon name="arrowLeft" size={18} /> All events</Link>

        <ErrorBoundary section="event details" compact onReset={() => invalidate(`event:${id}`)}>
          <Suspense fallback={summary ? <EventHeader event={summary} /> : <HeaderSkeleton />}>
            <EventHeaderLoader promise={eventPromise} />
          </Suspense>
        </ErrorBoundary>

        <ErrorBoundary key={attempt} section="the seat map" onReset={() => { invalidate(`event:${id}`); setAttempt((a) => a + 1) }}>
          <Suspense fallback={<BookingSkeleton />}>
            <GatedBooking eventPromise={eventPromise} seatsPromise={seatsPromise} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}

/** High-demand events pass through the FairQueue waiting room before the seat map loads. */
function GatedBooking({ eventPromise, seatsPromise }: { eventPromise: Promise<EventDetail>; seatsPromise: Promise<SeatsResponse> }) {
  const event = use(eventPromise)
  return (
    <QueueGate event={event}>
      <BookingPanel eventPromise={eventPromise} seatsPromise={seatsPromise} />
    </QueueGate>
  )
}

function EventHeaderLoader({ promise }: { promise: Promise<EventDetail> }) {
  const event = use(promise)
  return <EventHeader event={event} />
}

function EventHeader({ event }: { event: EventSummary | EventDetail }) {
  const detail = 'description' in event ? event : null
  return (
    <header className="detail-head">
      <ViewTransition name={`poster-${event.id}`} share="poster-morph">
        <div className="detail-poster"><Poster event={event} /></div>
      </ViewTransition>
      <div className="detail-copy">
        <p className="detail-kind">{event.category}{detail ? `, hosted by ${detail.organizer}` : ''}</p>
        <h1 className="detail-title">{event.title}</h1>
        <p className="detail-sub">{event.subtitle}</p>
        <ul className="detail-facts">
          <li><Icon name="calendar" size={16} /> {dateLong(event.startsAt)} at {time(event.startsAt)}</li>
          <li><Icon name="pin" size={16} /> {event.venue}</li>
          <li><Icon name="ticket" size={16} /> {money(event.priceFrom)}–{money(event.priceTo)}</li>
        </ul>
        {detail && <p className="detail-desc">{detail.description}</p>}
      </div>
    </header>
  )
}

function HeaderSkeleton() {
  return (
    <div className="detail-head" aria-hidden="true">
      <div className="detail-poster skeleton" />
      <div className="detail-copy" style={{ gap: 'var(--space-3)' }}>
        <div className="skeleton" style={{ height: 14, width: 120 }} />
        <div className="skeleton" style={{ height: 48, width: '70%' }} />
        <div className="skeleton" style={{ height: 18, width: '50%' }} />
      </div>
    </div>
  )
}

function BookingSkeleton() {
  return (
    <div className="booking" role="status" aria-label="Loading seat map">
      <div className="booking-map">
        <div className="skeleton" style={{ height: 44, width: 220, borderRadius: 999 }} />
        <div className="seat-skeleton-grid">
          {Array.from({ length: 80 }, (_, i) => <span key={i} className="skeleton" />)}
        </div>
      </div>
      <div className="booking-side">
        <div className="skeleton" style={{ height: 220, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 20 }} />
      </div>
    </div>
  )
}

interface Conflict {
  kind: 'hold' | 'poll'
  lost: Seat[]
  kept: string[]
  /** AutoRescue: ranked comparable replacements per lost seat (never applied automatically). */
  alternatives: Record<string, Replacement[]>
}

interface HoldFormState {
  error: string | null
}

type SelectAction = { type: 'add' | 'remove'; id: string } | { type: 'replace'; ids: string[] }

function reduceSelection(cur: string[], a: SelectAction): string[] {
  switch (a.type) {
    case 'add': return cur.includes(a.id) ? cur : [...cur, a.id]
    case 'remove': return cur.filter((x) => x !== a.id)
    case 'replace': return a.ids
  }
}

function BookingPanel({ eventPromise, seatsPromise }: { eventPromise: Promise<EventDetail>; seatsPromise: Promise<SeatsResponse> }) {
  const event = use(eventPromise)
  const initial = use(seatsPromise) // Suspense + use()
  const navigate = useNavigate()
  const location = useLocation()
  const { active, setActive } = useHold()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const routeState = location.state as { expired?: boolean; reselect?: string[]; aiPrompt?: string } | null
  const [params] = useSearchParams()
  const inviteFrom = params.get('invite')
  const profile = venueByName(event.venue)
  const markers = new Map<string, 'wheelchair' | 'companion'>([
    ...(profile?.companionSeats ?? []).map((id) => [id, 'companion'] as const),
    ...(profile?.wheelchairSpaces ?? []).map((id) => [id, 'wheelchair'] as const),
  ])

  const [seats, setSeats] = useState<Seat[]>(initial.seats)
  const [stale, setStale] = useState(false)
  const [selected, setSelected] = useState<string[]>(() => {
    const wanted = routeState?.reselect ?? (active?.hold.eventId === event.id ? active.hold.seatIds : [])
    return wanted.filter((sid) => { const s = initial.seats.find((x) => x.id === sid); return s ? isSelectable(s) : false })
  })
  // useOptimistic: taps render instantly; the server re-check runs in the background.
  const [optimisticSelected, applyOptimistic] = useOptimistic(selected, reduceSelection)
  const [, startTransition] = useTransition()
  const [lost, setLost] = useState<Set<string>>(new Set())
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [recommend, setRecommend] = useState<{ ids: string[]; label: string } | null>(null)
  const [announce, setAnnounce] = useState('')
  const [limitHit, setLimitHit] = useState(false)
  const [focusSeat, setFocusSeat] = useState<string | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [expiredNotice, setExpiredNotice] = useState(Boolean(routeState?.expired))
  const inflight = useRef<Promise<Seat[] | null> | null>(null)

  const selectedSet = new Set(optimisticSelected)
  const suggestedSet = new Set(suggestion?.seatIds ?? [])
  const highlightSet = new Set(recommend?.ids ?? [])
  const total = totalFor(optimisticSelected, seats)
  const selectedSeats = optimisticSelected.map((sid) => seats.find((s) => s.id === sid)).filter((s): s is Seat => Boolean(s))

  useEffect(() => {
    demoBridge.eventId = event.id
    demoBridge.selected = selected
  })

  const flagLost = (ids: string[]) => {
    setLost(new Set(ids))
    setTimeout(() => setLost(new Set()), 6000)
  }

  /** Remove seats that other students took, keep the rest, suggest alternatives. */
  const handleLostSeats = (lostIds: string[], latest: Seat[], kind: Conflict['kind'], base: string[] = selected) => {
    const remaining = base.filter((sid) => !lostIds.includes(sid))
    const exclude = new Set(remaining)
    const lostSeats = lostIds.map((sid) => latest.find((s) => s.id === sid)).filter((s): s is Seat => Boolean(s))
    const alternatives: Record<string, Replacement[]> = {}
    for (const s of lostSeats) {
      const ranked = rescue(s, latest, remaining, exclude)
      alternatives[s.id] = ranked
      if (ranked[0]) exclude.add(ranked[0].seat.id)
    }
    setSelected(remaining)
    flagLost(lostIds)
    setConflict({ kind, lost: lostSeats, kept: remaining, alternatives })
    const msg = `${lostIds.join(', ')} ${lostIds.length > 1 ? 'were' : 'was'} just taken by another student${remaining.length ? `. Kept ${remaining.join(', ')}` : ''}.`
    setAnnounce(msg)
    toast.warning('A seat was taken', { description: msg })
  }

  /** AutoRescue ranking: proximity, price, group adjacency and the student's accessibility needs. */
  const rescue = (lostSeat: Seat, latest: Seat[], kept: string[], exclude: ReadonlySet<string>) =>
    rankReplacements(lostSeat, latest, { kept, exclude, ...(profile ? { profile } : {}), access: getCampus().prefs.access })

  const refreshSeats = (): Promise<Seat[] | null> => {
    inflight.current ??= api.seats(event.id)
      .then((r) => {
        setStale(false)
        startGlobalTransition(() => setSeats(r.seats)) // ViewTransition animates seat-state changes
        return r.seats
      })
      .catch(() => { setStale(true); return null })
      .finally(() => { inflight.current = null })
    return inflight.current
  }

  // useEffectEvent: the interval always sees the latest selection without re-subscribing.
  const onPoll = useEffectEvent(async () => {
    const latest = await refreshSeats()
    if (!latest) return
    const taken = selected.filter((sid) => {
      const s = latest.find((x) => x.id === sid)
      return !s || !isSelectable(s)
    })
    if (taken.length) handleLostSeats(taken, latest, 'poll')
  })

  useEffect(() => {
    let timer = setInterval(() => void onPoll(), POLL_MS)
    // Hidden-tab retention: pause polling while hidden, refresh immediately on return.
    const onVis = () => {
      clearInterval(timer)
      if (document.visibilityState === 'visible') {
        void onPoll()
        timer = setInterval(() => void onPoll(), POLL_MS)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const toggleSeat = (seat: Seat) => {
    setLimitHit(false)
    if (optimisticSelected.includes(seat.id)) {
      setSelected((cur) => cur.filter((x) => x !== seat.id))
      setAnnounce(`${seat.id} removed. ${optimisticSelected.length - 1} of ${MAX_SEATS} seats selected.`)
      return
    }
    if (!isSelectable(seat)) {
      const why = seat.status === 'held' ? 'is being held by another student' : seat.status === 'booked' ? 'is already booked' : 'is not available for sale'
      setAnnounce(`${seat.id} ${why}.`)
      toast(`${seat.id} ${why}`, { description: 'Pick a seat with a light outline.' })
      return
    }
    if (optimisticSelected.length >= MAX_SEATS) {
      setLimitHit(true)
      setAnnounce(`You can select up to ${MAX_SEATS} seats. Remove one to choose ${seat.id}.`)
      toast.error(`Maximum ${MAX_SEATS} seats per booking`, { description: `Remove a seat to choose ${seat.id} instead.` })
      return
    }
    setAnnounce(`${seat.id} selected, ${money(seat.price)}. ${optimisticSelected.length + 1} of ${MAX_SEATS} seats selected.`)
    startTransition(async () => {
      applyOptimistic({ type: 'add', id: seat.id })
      const latest = await refreshSeats()
      const fresh = latest?.find((s) => s.id === seat.id)
      startTransition(() => {
        if (latest && (!fresh || !isSelectable(fresh))) {
          // Roll back: the optimistic seat reverts automatically; explain why.
          flagLost([seat.id])
          const ranked = rescue(seat, latest, selected, new Set(selected))
          const alt = ranked[0]?.seat
          setConflict({ kind: 'poll', lost: [seat], kept: selected, alternatives: { [seat.id]: ranked } })
          setAnnounce(`${seat.id} was just taken by another student.`)
          toast.warning(`${seat.id} was just taken`, { description: alt ? `${alt.id} next to it is free.` : 'Try another seat.' })
          return
        }
        setSelected((cur) => (cur.length >= MAX_SEATS ? cur : reduceSelection(cur, { type: 'add', id: seat.id })))
      })
    })
  }

  /** Smart tools: the student approved a recommendation. Selects (never holds). */
  const approveRecommendation = (ids: string[], source: string) => {
    const { valid, dropped } = validateSuggestion(ids, seats)
    if (valid.length === 0) {
      toast.error('Those seats were just taken', { description: 'The recommendations refresh with live availability.' })
      return
    }
    setSelected(valid)
    setRecommend(null)
    setSuggestion(null)
    setConflict(null)
    setFocusSeat(valid[0] ?? null)
    const msg = `Selected ${valid.join(', ')} from ${source}.${dropped.length ? ` ${dropped.join(', ')} ${dropped.length > 1 ? 'are' : 'is'} no longer available.` : ''}`
    setAnnounce(msg)
    toast.success(`${valid.length} seat${valid.length > 1 ? 's' : ''} selected`, { description: 'Review them, then hold.' })
  }

  const applySuggestion = (ids: string[]) => {
    const { valid, dropped } = validateSuggestion(ids, seats)
    setSelected(valid)
    setSuggestion(null)
    setConflict(null)
    setFocusSeat(valid[0] ?? null)
    const msg = `Selected ${valid.join(', ')} from the AI suggestion.${dropped.length ? ` ${dropped.join(', ')} ${dropped.length > 1 ? 'are' : 'is'} no longer available.` : ''}`
    setAnnounce(msg)
    toast.success(`${valid.length} seat${valid.length > 1 ? 's' : ''} selected`, { description: 'Review them, then hold.' })
  }

  const swapIn = (lostId: string, alt: Seat) => {
    if (selected.length >= MAX_SEATS) return
    if (!isSelectable(seats.find((s) => s.id === alt.id) ?? alt)) {
      toast.error(`${alt.id} was taken too`, { description: 'Pick another option.' })
      return
    }
    setSelected((cur) => [...cur, alt.id])
    setConflict((c) => {
      if (!c) return c
      const alternatives = { ...c.alternatives }
      delete alternatives[lostId]
      return Object.keys(alternatives).length ? { ...c, alternatives } : null
    })
    setFocusSeat(alt.id)
    setAnnounce(`${alt.id} added in place of ${lostId}.`)
  }

  // Actions + useActionState: Hold seats.
  const [holdState, holdAction] = useActionState<HoldFormState, FormData>(async (_prev, form) => {
    const ids = String(form.get('seatIds') ?? '').split(',').filter(Boolean)
    if (ids.length === 0) return { error: 'Select at least one seat to hold.' }
    try {
      const hold = await api.hold(event.id, ids)
      setActive({ hold, event, seats: ids.map((sid) => seats.find((s) => s.id === sid)).filter((s): s is Seat => Boolean(s)) })
      setConflict(null)
      toast.success('Seats held for 5 minutes', { description: `${ids.join(', ')} are yours until the timer runs out.` })
      await navigate('/checkout')
      return { error: null }
    } catch (e) {
      const err = toApiError(e)
      if (err.code === 'conflict') {
        const latest = (await refreshSeats()) ?? seats
        const lostIds = err.conflictingSeatIds.length ? err.conflictingSeatIds : ids.filter((sid) => !latest.find((s) => s.id === sid && isSelectable(s)))
        handleLostSeats(lostIds, latest, 'hold', ids) // the submitted seats are the source of truth
        return { error: null }
      }
      return { error: friendlyMessage(err) }
    }
  }, { error: null })

  // Stable seat reference for the 3D preview (manual memo: the R3F scene keys an effect on it).
  const previewSeatId = focusSeat && previewOpen && !optimisticSelected.includes(focusSeat) ? focusSeat : optimisticSelected.at(-1) ?? focusSeat
  const previewSeat = seats.find((s) => s.id === previewSeatId)
  const pr = previewSeat ? rowIndex(previewSeat.row) : -1
  const pc = previewSeat?.col ?? -1
  const totalRows = new Set(seats.map((s) => s.row)).size
  const totalCols = Math.max(0, ...seats.map((s) => s.col)) + 1
  const seatView = useMemo(() => (pr < 0 ? null : { rowIndex: pr, col: pc, totalRows, totalCols }), [pr, pc, totalRows, totalCols])

  const holdForm = (
    <form action={holdAction} className="hold-form">
      <input type="hidden" name="seatIds" value={optimisticSelected.join(',')} />
      {holdState.error && (
        <div className="alert" data-tone="danger" role="alert">
          <Icon name="alert" size={18} />
          <div><strong>Couldn’t hold seats</strong>{holdState.error}</div>
        </div>
      )}
      <SubmitButton pendingLabel="Holding seats…" disabled={optimisticSelected.length === 0} className="btn btn-lime btn-lg btn-block">
        {holdState.error ? <><Icon name="refresh" size={18} /> Retry hold</> : <>Hold {optimisticSelected.length || ''} seat{optimisticSelected.length === 1 ? '' : 's'}</>}
      </SubmitButton>
    </form>
  )

  return (
    <div className="booking">
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      <div className="booking-map">
        {inviteFrom && <InviteNotice from={inviteFrom} />}
        <ClashNotice event={event} />
        {expiredNotice && (
          <div className="alert" data-tone="warning" role="alert">
            <Icon name="clock" size={18} />
            <div>
              <strong>Your 5-minute hold expired</strong>
              The seats were released. We re-selected the ones still free — hold again when you’re ready.
            </div>
            <button type="button" className="icon-btn alert-close" aria-label="Dismiss" onClick={() => setExpiredNotice(false)}><Icon name="x" size={16} /></button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {conflict && (
            <motion.div className="conflict" role="alert" initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring.soft}>
              <div className="conflict-inner">
                <Icon name="alert" size={20} />
                <div className="conflict-body">
                  <strong>{conflict.lost.map((s) => s.id).join(', ')} {conflict.lost.length > 1 ? 'were' : 'was'} just taken{conflict.kind === 'hold' ? ' before your hold went through' : ''}.</strong>
                  <span>{conflict.kept.length ? `We kept ${conflict.kept.join(', ')} for you.` : 'Your other choices are unaffected.'}</span>
                  <div className="conflict-alts">
                    {conflict.lost.map((s) => {
                      const [best, ...others] = conflict.alternatives[s.id] ?? []
                      if (!best) return <span key={s.id} className="small">No comparable seat is free near {s.id} right now.</span>
                      return (
                        <div key={s.id} className="rescue">
                          <button type="button" className="btn btn-primary" onClick={() => swapIn(s.id, best.seat)} disabled={selected.length >= MAX_SEATS}>
                            Swap in {best.seat.id} ({money(best.seat.price)})
                          </button>
                          <span className="rescue-why small">{best.reasons.join(' · ')} · {priceDiffLabel(best.priceDiff)}</span>
                          {others.length > 0 && (
                            <div className="rescue-more">
                              {others.map((o) => (
                                <button key={o.seat.id} type="button" className="btn btn-ghost" onClick={() => swapIn(s.id, o.seat)} disabled={selected.length >= MAX_SEATS} aria-label={`Use ${o.seat.id} instead of ${s.id}: ${o.reasons.join(', ')}, ${priceDiffLabel(o.priceDiff)}`}>
                                  Or {o.seat.id} · {priceDiffLabel(o.priceDiff)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <button type="button" className="icon-btn alert-close" aria-label="Dismiss conflict message" onClick={() => setConflict(null)}><Icon name="x" size={16} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="map-head">
          <h2 className="map-title">Pick up to {MAX_SEATS} seats</h2>
          <span className={`live-pill ${stale ? 'is-stale' : ''}`}>
            <span className="live-dot" aria-hidden="true" />
            {stale ? 'Reconnecting…' : 'Live availability'}
          </span>
        </div>
        {recommend && (
          <div className="rec-banner" role="status">
            <Icon name="eye" size={16} />
            <span>Showing <strong>{recommend.ids.join(', ')}</strong> ({recommend.label}). Nothing is selected until you choose “Select these seats”.</span>
            <button type="button" className="btn btn-ghost" onClick={() => setRecommend(null)}>Clear</button>
          </div>
        )}
        <SeatMap seats={seats} selected={selectedSet} suggested={suggestedSet} lost={lost} onToggle={toggleSeat} focusSeatId={focusSeat} highlight={highlightSet} highlightLabel={recommend?.label} markers={markers} />
        <SeatLegend />
      </div>

      <aside className="booking-side" aria-label="Your selection">
        <section className="summary card" aria-labelledby="summary-title">
          <div className="summary-head">
            <h2 id="summary-title" className="summary-title">Your seats</h2>
            <span className="summary-count num" aria-label={`${optimisticSelected.length} of ${MAX_SEATS} selected`}>
              {Array.from({ length: MAX_SEATS }, (_, i) => <span key={i} className={i < optimisticSelected.length ? 'is-on' : ''} />)}
            </span>
          </div>
          {selectedSeats.length === 0 ? (
            <p className="summary-empty">Tap a seat on the map, or ask the assistant to pick for you.</p>
          ) : (
            <ul className="summary-list">
              {selectedSeats.map((s) => (
                <ViewTransition key={s.id} enter="summary-enter" exit="summary-enter">
                  <li className="summary-seat">
                    <span className="summary-seat-id">{s.id}</span>
                    <span className="summary-seat-meta">Row {s.row}, {s.section}{s.isAisle ? ', aisle' : ''}</span>
                    <span className="num">{money(s.price)}</span>
                    <button type="button" className="icon-btn summary-remove" aria-label={`Remove ${s.id}`} onClick={() => toggleSeat(s)}><Icon name="x" size={14} /></button>
                  </li>
                </ViewTransition>
              ))}
            </ul>
          )}
          {limitHit && <p className="field-error" role="alert"><Icon name="info" size={16} /> Up to {MAX_SEATS} seats per booking — remove one to swap.</p>}
          <div className="summary-total">
            <span>Total</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.strong key={total} className="num" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={spring.snappy}>
                {rupees(total)}
              </motion.strong>
            </AnimatePresence>
          </div>
          {isDesktop && holdForm}
        </section>

        <WaitlistCta event={event} seats={seats} />

        <ErrorBoundary section="the smart seat tools" compact>
          <Suspense fallback={<div className="skeleton" style={{ height: 320, borderRadius: 20 }} />}>
            <SmartTools
              event={event}
              seats={seats}
              selected={optimisticSelected}
              highlighted={recommend?.ids ?? []}
              onHighlight={(ids, label) => {
                setRecommend(ids ? { ids, label: label ?? 'recommended' } : null)
                if (ids?.[0]) setFocusSeat(ids[0])
                if (ids) setAnnounce(`Showing ${ids.join(', ')} on the map as a ${label ?? 'recommendation'}.`)
              }}
              onApprove={approveRecommendation}
              onPreview={(id) => { setFocusSeat(id); setPreviewOpen(true); document.getElementById('preview-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}
            />
          </Suspense>
        </ErrorBoundary>

        {!isDesktop && (
          <button type="button" className="btn btn-block assistant-toggle" aria-expanded={assistantOpen} aria-controls="assistant-panel" onClick={() => setAssistantOpen((o) => !o)}>
            <Icon name="sparkle" size={18} /> {assistantOpen ? 'Hide seat assistant' : 'Ask the seat assistant'}
          </button>
        )}
        <div id="assistant-panel">
          {/* <Activity> keeps the assistant's conversation alive while hidden. */}
          <Activity mode={assistantOpen || isDesktop ? 'visible' : 'hidden'}>
            <AiAssistant eventId={event.id} seats={seats} selected={selectedSet} suggestion={suggestion} onSuggest={setSuggestion} onUse={applySuggestion} {...(routeState?.aiPrompt ? { initialPrompt: routeState.aiPrompt } : {})} />
          </Activity>
        </div>

        <section className="preview card" aria-labelledby="preview-title">
          <div className="preview-head">
            <h2 id="preview-title" className="summary-title">View from {previewSeat ? previewSeat.id : 'your seat'}</h2>
            <button type="button" className="btn btn-ghost" aria-pressed={previewOpen} onClick={() => setPreviewOpen((o) => !o)}>
              {previewOpen ? 'Hide 3D' : 'Show 3D'}
            </button>
          </div>
          {previewOpen && (
            <div className="preview-canvas">
              <ErrorBoundary section="the 3D preview" compact>
                <Suspense fallback={<StageFallback />}>
                  <StageCanvas mode="seat" seat={seatView} hue={event.poster.hue} label={previewSeat ? `3D preview of the stage as seen from seat ${previewSeat.id}` : '3D overview of the venue'} />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}
        </section>
      </aside>

      {!isDesktop && (
        <div className="hold-bar glass">
          <div className="hold-bar-info">
            <span className="hold-bar-seats">{optimisticSelected.length ? optimisticSelected.join(', ') : 'No seats yet'}</span>
            <strong className="num">{rupees(total)}</strong>
          </div>
          {holdForm}
        </div>
      )}
    </div>
  )
}
