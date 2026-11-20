import {
  Activity,
  lazy,
  Suspense,
  use,
  useActionState,
  useEffect,
  useEffectEvent,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  ViewTransition,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { layoutFor, type Layout } from '../booking/data'
import type { View } from '../booking/Scene3D'
import { AiAssistant, validateSuggestion, type Suggestion } from '../components/AiAssistant'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon } from '../components/Icon'
import { EventMedia } from '../components/Photo'
import { SeatLegend, SeatMap } from '../components/SeatMap'
import { SubmitButton } from '../components/SubmitButton'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { api } from '../lib/api/client'
import { friendlyMessage, toApiError } from '../lib/api/errors'
import type { Booking, EventDetail, EventSummary, Kind, Seat, SeatsResponse } from '../lib/api/types'
import { useDemo } from '../lib/demo'
import { summaryCache } from '../lib/eventCache'
import { dateLong, money, rupees, time } from '../lib/format'
import { useLang, useT } from '../lib/i18n'
import { canSpeak, narrate, speak } from '../lib/speech'
import { readLang } from '../lib/i18n'
import { ToolButton, ToolRow } from '../components/ToolStrip'
import { ToolEventContext, setToolHighlight, useToolHighlight } from '../lib/toolBridge'
import { setMode as applyEventMode } from '../lib/mode'
import { sfx } from '../lib/sound'
import { useHold } from '../lib/hold'
import { invalidate, resource } from '../lib/resource'
import { isSelectable, MAX_SEATS, STATUS_LABEL, suggestAlternative, tierLabel, totalFor } from '../lib/seats'
import { toast } from '../lib/toast'
import './event.css'

// three.js + the scene download only when a seat map opens.
const Scene3D = lazy(() => import('../booking/Scene3D'))

let webgl: boolean | null = null
function hasWebGL() {
  if (webgl !== null) return webgl
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    webgl = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webgl = false
  }
  return webgl
}

export function EventPage() {
  const { id = '' } = useParams()
  const summary = summaryCache.get(id)
  const [attempt, setAttempt] = useState(0)
  const [mountKey] = useState(() => Date.now())

  const eventPromise = resource(`event:${id}`, () => api.event(id))
  const seatsPromise = resource(`seats:${id}:${mountKey}:${attempt}`, () => api.seats(id))
  const kind = summary?.kind ?? 'cinema'
  useEffect(() => applyEventMode(kind), [kind])

  return (
    <div className="container page ep">
      <title>{`${summary?.title ?? 'Choose seats'} · SeatLock`}</title>
      <meta name="description" content={summary ? `${summary.title} — ${summary.venue}. Pick your seat live in 3D.` : 'Pick your seat live on SeatLock.'} />
      <Link to={`/book/${kind}`} className="ep-back">
        <Icon name="arrowLeft" size={18} /> {kind === 'bus' ? 'All trips' : 'All shows'}
      </Link>

      <ErrorBoundary section="this listing" compact onReset={() => invalidate(`event:${id}`)}>
        <Suspense fallback={summary ? <EventHero event={summary} /> : <HeroSkeleton />}>
          <EventHeroLoader promise={eventPromise} />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary
        key={attempt}
        section="the seat map"
        onReset={() => {
          invalidate(`event:${id}`)
          setAttempt((a) => a + 1)
        }}
      >
        <Suspense fallback={<BookingSkeleton />}>
          <BookingPanel eventPromise={eventPromise} seatsPromise={seatsPromise} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

function EventHeroLoader({ promise }: { promise: Promise<EventDetail> }) {
  return <EventHero event={use(promise)} />
}

/** Short, generated summary of the listing (bonus: "event AI summaries"). */
function aiSummary(e: EventDetail): string {
  const pct = 1 - e.seatsLeft / e.totalSeats
  const demand = pct > 0.75 ? 'Selling fast' : pct > 0.45 ? 'Steady demand' : 'Plenty of choice'
  if (e.kind === 'bus') return `${demand}: ${e.seatsLeft} of ${e.totalSeats} seats left. Window seats on the left get the morning sun; rows 2–3 are reserved for women.`
  return `${demand}: ${e.seatsLeft} of ${e.totalSeats} seats left. ${e.tags[0] === 'IMAX laser' ? 'For IMAX, rows H–K centre fill your view.' : 'Rows F–K centre have the best sightline.'} Recliners sit at the back.`
}

function aiSummaryHi(e: EventDetail): string {
  const pct = 1 - e.seatsLeft / e.totalSeats
  const demand = pct > 0.75 ? 'तेज़ी से बिक रहा है' : pct > 0.45 ? 'माँग ठीक-ठाक है' : 'काफ़ी सीटें खाली हैं'
  if (e.kind === 'bus') return `${demand}: ${e.totalSeats} में से ${e.seatsLeft} सीटें बची हैं। बाईं खिड़की पर सुबह की धूप आती है; पंक्ति 2–3 महिलाओं के लिए आरक्षित है।`
  return `${demand}: ${e.totalSeats} में से ${e.seatsLeft} सीटें बची हैं। बीच की पंक्तियाँ (F–K) से सबसे अच्छा दिखता है। रिक्लाइनर सबसे पीछे हैं।`
}

function SummaryText({ detail }: { detail: EventDetail }) {
  const lang = useLang()
  const text = lang === 'hi' ? aiSummaryHi(detail) : aiSummary(detail)
  return (
    <>
      {text}
      {canSpeak() && (
        <button type="button" className="ep-listen" onClick={() => speak(text, lang)} aria-label={lang === 'hi' ? 'सारांश सुनें' : 'Listen to the summary'}>
          <Icon name="volume" size={15} /> {lang === 'hi' ? 'सुनें' : 'Listen'}
        </button>
      )}
    </>
  )
}

function EventHero({ event }: { event: EventSummary | EventDetail }) {
  const detail = 'description' in event ? event : null
  return (
    <header className="ep-hero">
      <ViewTransition name={`poster-${event.id}`} share="poster-morph">
        <div className="ep-poster">
          <EventMedia event={event} />
        </div>
      </ViewTransition>
      <div className="ep-copy">
        <p className="lk-eyebrow">
          <Icon name={event.kind === 'bus' ? 'bus' : 'film'} size={14} /> {event.kind === 'bus' ? 'Bus' : 'Cinema'} · {event.category}
        </p>
        <h1 className="lk-display ep-title">{event.title}</h1>
        <p className="ep-sub">{event.subtitle}</p>
        <ul className="ep-facts">
          <li>
            <Icon name="calendar" size={16} /> {dateLong(event.startsAt)}, {time(event.startsAt)}
          </li>
          <li>
            <Icon name="pin" size={16} /> {event.venue}
          </li>
          <li>
            <Icon name="ticket" size={16} /> {money(event.priceFrom)}–{money(event.priceTo)}
          </li>
        </ul>
        {detail && (
          <>
            <div className="ep-tags">
              {detail.rating && <span className="tag">{detail.rating}</span>}
              {detail.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
            {detail.stops && (
              <ol className="ep-route" aria-label="Boarding and drop points">
                {detail.stops.map((s) => (
                  <li key={s.name} data-kind={s.kind}>
                    <span className="ep-route-time lk-num">{s.time}</span>
                    <span className="ep-route-dot" aria-hidden="true" />
                    <span>
                      {s.name}
                      <small>{s.kind === 'board' ? 'Boarding' : 'Drop'}</small>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {detail.cast && <p className="ep-cast">Starring {detail.cast.join(', ')}</p>}
            <p className="ep-desc">{detail.description}</p>
            <p className="ep-ai">
              <span className="badge badge-ai">
                <Icon name="sparkle" size={12} /> AI summary
              </span>
              <SummaryText detail={detail} />
            </p>
          </>
        )}
      </div>
    </header>
  )
}

function HeroSkeleton() {
  return (
    <div className="ep-hero" aria-hidden="true">
      <div className="ep-poster skeleton" />
      <div className="ep-copy">
        <span className="skeleton" style={{ height: 14, width: 140 }} />
        <span className="skeleton" style={{ height: 56, width: '70%' }} />
        <span className="skeleton" style={{ height: 18, width: '50%' }} />
      </div>
    </div>
  )
}

function BookingSkeleton() {
  return (
    <div className="ep-grid" role="status" aria-label="Loading seat map">
      <div className="ep-main">
        <span className="skeleton" style={{ height: 'clamp(340px, 58vh, 620px)', borderRadius: 14 }} />
      </div>
      <div className="ep-side">
        <span className="skeleton" style={{ height: 220, borderRadius: 14 }} />
        <span className="skeleton" style={{ height: 260, borderRadius: 14 }} />
      </div>
    </div>
  )
}

function StageSkeleton({ kind }: { kind: string }) {
  return (
    <div className="ep-stage-skel" role="status">
      <span className="spinner" aria-hidden="true" />
      Loading 3D {kind === 'bus' ? 'coach' : 'hall'}…
    </div>
  )
}

interface Conflict {
  kind: 'hold' | 'poll'
  lost: Seat[]
  kept: string[]
  alternatives: Record<string, Seat | null>
}

interface FeedItem {
  id: number
  at: number
  kind: 'held' | 'booked' | 'released'
  seats: string[]
  who: string
}
const NAMES = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Isha', 'Vikram', 'Ananya', 'Arjun', 'Sara', 'Neel', 'Tara', 'Zoya', 'Dev']

type ViewMode = '3d' | 'easy' | 'map'
type SelectAction = { type: 'add' | 'remove'; id: string } | { type: 'replace'; ids: string[] }
function reduceSelection(cur: string[], a: SelectAction): string[] {
  switch (a.type) {
    case 'add':
      return cur.includes(a.id) ? cur : [...cur, a.id]
    case 'remove':
      return cur.filter((x) => x !== a.id)
    case 'replace':
      return a.ids
  }
}

function BookingPanel({ eventPromise, seatsPromise }: { eventPromise: Promise<EventDetail>; seatsPromise: Promise<SeatsResponse> }) {
  const event = use(eventPromise)
  const initial = use(seatsPromise) // Suspense + use()
  const navigate = useNavigate()
  const location = useLocation()
  const { active, setActive } = useHold()
  const demo = useDemo()
  const t = useT()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const coarse = useMediaQuery('(pointer: coarse)')
  const layout = layoutFor(event.kind)
  const routeState = location.state as { expired?: boolean; reselect?: string[] } | null

  const [seats, setSeats] = useState<Seat[]>(initial.seats)
  const [stale, setStale] = useState(false)
  const [selected, setSelected] = useState<string[]>(() => {
    const wanted = routeState?.reselect ?? (active?.hold.eventId === event.id ? active.hold.seatIds : [])
    return wanted.filter((sid) => {
      const s = initial.seats.find((x) => x.id === sid)
      return s ? isSelectable(s) : false
    })
  })
  // useOptimistic: taps render instantly; the live re-check runs in the background.
  const [optimisticSelected, applyOptimistic] = useOptimistic(selected, reduceSelection)
  const [, startTransition] = useTransition()
  const [lost, setLost] = useState<Set<string>>(new Set())
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [announce, setAnnounce] = useState('')
  const [limitHit, setLimitHit] = useState(false)
  const [focusSeat, setFocusSeat] = useState<string | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [budget, setBudget] = useState('')
  const [clash, setClash] = useState<string | null>(null)
  const [expiredNotice, setExpiredNotice] = useState(Boolean(routeState?.expired))
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem('seatlock-view')
      if (v === '3d' || v === 'easy' || v === 'map') return v !== 'map' && !hasWebGL() ? 'map' : v
    } catch {
      /* ignore */
    }
    return hasWebGL() && !(window.innerWidth < 640 && window.matchMedia('(pointer: coarse)').matches) ? '3d' : 'map'
  })
  const [camera, setCamera] = useState<View>('overview')
  const inflight = useRef<Promise<Seat[] | null> | null>(null)
  const lastSeats = useRef(initial.seats)
  const feedId = useRef(0)

  const selectedSet = new Set(optimisticSelected)
  // Seats a smart tool is talking about light up in 3D and on the map (same look as AI picks).
  const toolHi = useToolHighlight()
  const toolLive = toolHi && toolHi.eventId === event.id ? toolHi : null
  const suggestedSet = new Set([...(suggestion?.seatIds ?? []), ...(toolLive?.seatIds ?? [])])
  const total = totalFor(optimisticSelected, seats)
  const selectedSeats = optimisticSelected.map((sid) => seats.find((s) => s.id === sid)).filter((s): s is Seat => Boolean(s))

  // Conflict check: another booking within about 3 hours of this one.
  useEffect(() => {
    let alive = true
    api
      .bookings()
      .then((list: Booking[]) => {
        if (!alive) return
        const me = Date.parse(event.startsAt)
        const hit = list.find((b) => b.event.title !== event.title && Math.abs(Date.parse(b.event.startsAt) - me) < 3 * 3600_000)
        setClash(hit ? hit.event.title : null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [event.id, event.startsAt])

  const switchMode = (m: ViewMode) => {
    setMode(m)
    try {
      localStorage.setItem('seatlock-view', m)
    } catch {
      /* ignore */
    }
  }

  const flagLost = (ids: string[]) => {
    setLost(new Set(ids))
    setTimeout(() => setLost(new Set()), 6000)
  }

  /** Remove seats that others took, keep the rest, suggest nearby alternatives. */
  const handleLostSeats = (lostIds: string[], latest: Seat[], kind: Conflict['kind'], base: string[] = selected) => {
    const remaining = base.filter((sid) => !lostIds.includes(sid))
    const exclude = new Set(remaining)
    const lostSeats = lostIds.map((sid) => latest.find((s) => s.id === sid)).filter((s): s is Seat => Boolean(s))
    const alternatives: Record<string, Seat | null> = {}
    for (const s of lostSeats) {
      const alt = suggestAlternative(s, latest, exclude)
      alternatives[s.id] = alt
      if (alt) exclude.add(alt.id)
    }
    setSelected(remaining)
    flagLost(lostIds)
    setConflict({ kind, lost: lostSeats, kept: remaining, alternatives })
    const msg = `${lostIds.join(', ')} ${lostIds.length > 1 ? 'were' : 'was'} just taken by someone else${remaining.length ? `. Kept ${remaining.join(', ')}` : ''}.`
    setAnnounce(msg)
    toast.warning('A seat was taken', msg)
  }

  /** Turn the difference between two polls into human-readable activity. */
  const diffToFeed = (prev: Seat[], next: Seat[]) => {
    const before = new Map(prev.map((s) => [s.id, s.status]))
    const groups: Record<FeedItem['kind'], Map<string, string[]>> = { held: new Map(), booked: new Map(), released: new Map() }
    for (const s of next) {
      const was = before.get(s.id)
      if (!was || was === s.status || s.heldByMe || s.mine) continue
      const k: FeedItem['kind'] | null = s.status === 'held' && was === 'available' ? 'held' : s.status === 'booked' ? 'booked' : s.status === 'available' ? 'released' : null
      if (!k) continue
      const row = groups[k].get(s.row) ?? []
      row.push(s.id)
      groups[k].set(s.row, row)
    }
    const items: FeedItem[] = []
    for (const k of ['booked', 'held', 'released'] as const) {
      for (const ids of groups[k].values()) {
        const id = ++feedId.current
        items.push({ id, at: Date.now(), kind: k, seats: ids, who: NAMES[(id * 7 + ids.length) % NAMES.length]! })
      }
    }
    if (items.length) setFeed((f) => [...items, ...f].slice(0, 24))
  }

  const refreshSeats = (): Promise<Seat[] | null> => {
    inflight.current ??= api
      .seats(event.id)
      .then((r) => {
        setStale(false)
        diffToFeed(lastSeats.current, r.seats)
        lastSeats.current = r.seats
        // Plain update: a page-wide view transition on every poll made the map stutter.
        setSeats(r.seats)
        return r.seats
      })
      .catch(() => {
        setStale(true)
        return null
      })
      .finally(() => {
        inflight.current = null
      })
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

  const pollMs = demo.live ? 2500 : 5000
  useEffect(() => {
    let timer = setInterval(() => void onPoll(), pollMs)
    // Hidden-tab retention: pause polling while hidden, refresh straight away on return.
    const onVis = () => {
      clearInterval(timer)
      if (document.visibilityState === 'visible') {
        void onPoll()
        timer = setInterval(() => void onPoll(), pollMs)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [pollMs])

  const toggleSeatById = (id: string) => {
    const seat = seats.find((s) => s.id === id)
    if (seat) toggleSeat(seat)
  }

  const toggleSeat = (seat: Seat) => {
    setLimitHit(false)
    setFocusSeat(seat.id)
    if (optimisticSelected.includes(seat.id)) {
      sfx.deselect()
      narrate(readLang() === 'hi' ? `सीट ${seat.id} हटाई गई।` : `Seat ${seat.id} removed.`, readLang())
      setSelected((cur) => cur.filter((x) => x !== seat.id))
      setAnnounce(`${seat.id} removed. ${optimisticSelected.length - 1} of ${MAX_SEATS} seats selected.`)
      return
    }
    if (!isSelectable(seat)) {
      sfx.error()
      const why = seat.status === 'held' ? 'is being held by someone else' : seat.status === 'booked' ? (seat.mine ? 'is already yours' : 'is already booked') : 'is not for sale'
      setAnnounce(`${seat.id} ${why}.`)
      toast(`${seat.id} ${why}`, 'Pick a light seat with a number on it.')
      return
    }
    if (optimisticSelected.length >= MAX_SEATS) {
      sfx.warn()
      setLimitHit(true)
      setAnnounce(`You can select up to ${MAX_SEATS} seats. Remove one to choose ${seat.id}.`)
      toast.error(`Maximum ${MAX_SEATS} seats per booking`, `Remove a seat to choose ${seat.id} instead.`)
      return
    }
    sfx.select()
    narrate(
      readLang() === 'hi'
        ? `सीट ${seat.id} चुनी गई, ${seat.price} रुपये। कुल ${total + seat.price} रुपये।`
        : `Seat ${seat.id} selected, ${seat.price} rupees. Total ${total + seat.price} rupees.`,
      readLang(),
    )
    setAnnounce(`${seat.id} selected, ${money(seat.price)}. ${optimisticSelected.length + 1} of ${MAX_SEATS} seats selected.`)
    // Select at once so rapid taps all register; the live re-check below can still take it back.
    setSelected((cur) => (cur.length >= MAX_SEATS ? cur : reduceSelection(cur, { type: 'add', id: seat.id })))
    startTransition(async () => {
      applyOptimistic({ type: 'add', id: seat.id })
      const latest = await refreshSeats()
      const fresh = latest?.find((s) => s.id === seat.id)
      if (latest && (!fresh || !isSelectable(fresh))) {
        startTransition(() => {
          setSelected((cur) => reduceSelection(cur, { type: 'remove', id: seat.id }))
          flagLost([seat.id])
          const alt = suggestAlternative(seat, latest, new Set(selected))
          setConflict({ kind: 'poll', lost: [seat], kept: selected, alternatives: { [seat.id]: alt } })
          setAnnounce(`${seat.id} was just taken by someone else.`)
          toast.warning(`${seat.id} was just taken`, alt ? `${alt.id} next to it is free.` : 'Try another seat.')
        })
      }
    })
  }

  const applySuggestion = (ids: string[]) => {
    const { valid, dropped } = validateSuggestion(ids, seats)
    setSelected(valid)
    setSuggestion(null)
    setConflict(null)
    setFocusSeat(valid[0] ?? null)
    const msg = `Selected ${valid.join(', ')} from the AI suggestion.${dropped.length ? ` ${dropped.join(', ')} ${dropped.length > 1 ? 'are' : 'is'} no longer available.` : ''}`
    setAnnounce(msg)
    toast.success(`${valid.length} seat${valid.length > 1 ? 's' : ''} selected`, 'Review them, then hold.')
  }

  const swapIn = (lostId: string, alt: Seat) => {
    if (selected.length >= MAX_SEATS) return
    setSelected((cur) => [...cur, alt.id])
    setConflict((c) => {
      if (!c) return c
      const alternatives = { ...c.alternatives }
      delete alternatives[lostId]
      return Object.values(alternatives).some(Boolean) ? { ...c, alternatives } : null
    })
    setFocusSeat(alt.id)
    setAnnounce(`${alt.id} added in place of ${lostId}.`)
  }

  // Actions + useActionState: Hold seats.
  const [holdState, holdAction] = useActionState<{ error: string | null }, FormData>(
    async (_prev, form) => {
      const ids = String(form.get('seatIds') ?? '')
        .split(',')
        .filter(Boolean)
      if (ids.length === 0) return { error: 'Select at least one seat to hold.' }
      try {
        const hold = await api.hold(event.id, ids)
        setActive({ hold, event, seats: ids.map((sid) => seats.find((s) => s.id === sid)).filter((s): s is Seat => Boolean(s)) })
        setConflict(null)
        toast.success('Seats held for 5 minutes', `${ids.join(', ')} are yours until the timer runs out.`)
        narrate(readLang() === 'hi' ? `${ids.join(', ')} पाँच मिनट के लिए आपकी हैं।` : `${ids.join(', ')} are held for you for five minutes.`, readLang())
        await navigate('/checkout')
        return { error: null }
      } catch (e) {
        const err = toApiError(e)
        if (err.code === 'conflict') {
          const latest = (await refreshSeats()) ?? seats
          const lostIds = err.conflictingSeatIds.length ? err.conflictingSeatIds : ids.filter((sid) => !latest.find((s) => s.id === sid && isSelectable(s)))
          handleLostSeats(lostIds, latest, 'hold', ids)
          return { error: null }
        }
        toast.error('Couldn’t hold seats', friendlyMessage(err))
        return { error: friendlyMessage(err) }
      }
    },
    { error: null },
  )

  // Live numbers for the data strip.
  const counts = { available: 0, held: 0, booked: 0, blocked: 0 }
  for (const s of seats) counts[s.heldByMe ? 'available' : s.status]++

  const focusId = toolLive?.focusId ?? optimisticSelected.at(-1) ?? focusSeat ?? suggestion?.seatIds[0] ?? defaultFocus(seats, event.kind)

  // When a tool publishes seats: show them in 3D (if the device can), move the camera, keep the stage in view.
  const toolKey = toolLive ? `${toolLive.label}|${toolLive.seatIds.join()}|${toolLive.camera ?? ''}` : ''
  useEffect(() => {
    if (!toolLive) return
    if (mode === 'map' && hasWebGL()) setMode('3d')
    setCamera(toolLive.camera ?? 'overview')
    // Put the stage just under the header so it sits above the tool sheet (phones) or beside the panel.
    const t = setTimeout(() => {
      const stage = document.querySelector('.ep-viewport') ?? document.querySelector('.ep-stage')
      if (stage) window.scrollTo({ top: stage.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' })
    }, 60)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolKey])
  useEffect(() => () => setToolHighlight(null), [])

  // Imperative 3D tooltip: hovering never re-renders the page or the scene.
  const tipRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const seatsRef = useRef(seats)
  useEffect(() => {
    seatsRef.current = seats
  })
  const hover = (id: string | null, x: number, y: number) => {
    const tip = tipRef.current
    const box = stageRef.current?.getBoundingClientRect()
    if (!tip || !box) return
    const s = id ? seatsRef.current.find((q) => q.id === id) : null
    if (!s) {
      tip.hidden = true
      return
    }
    const st = s.heldByMe ? 'available' : s.status
    tip.hidden = false
    tip.innerHTML = `<strong>${s.id}</strong><span>${tierLabel(s.section)} · ${money(s.price)}</span><em data-s="${st}">${s.mine && st === 'booked' ? 'Your seat' : STATUS_LABEL[st][0]!.toUpperCase() + STATUS_LABEL[st].slice(1)}</em>${s.tags.length ? `<small>${s.tags.join(' · ')}</small>` : ''}`
    tip.style.transform = `translate(${Math.max(8, Math.min(x - box.left + 14, box.width - 190))}px, ${Math.min(y - box.top + 14, box.height - 110)}px)`
  }

  const holdForm = (
    <form action={holdAction} className="ep-hold-form">
      <input type="hidden" name="seatIds" value={optimisticSelected.join(',')} />
      {holdState.error && (
        <div className="alert" data-tone="danger" role="alert">
          <Icon name="alert" size={18} />
          <div>
            <strong>Couldn’t hold seats</strong>
            {holdState.error}
          </div>
        </div>
      )}
      <SubmitButton pendingLabel="Holding seats…" disabled={optimisticSelected.length === 0} className="lk-btn lk-btn-primary lk-btn-lg lk-btn-block">
        {holdState.error ? (
          <>
            <Icon name="refresh" size={18} /> Retry hold
          </>
        ) : optimisticSelected.length ? (
          <>
            <Icon name="lock" size={18} /> Hold {optimisticSelected.length} seat{optimisticSelected.length === 1 ? '' : 's'} · {rupees(total)}
          </>
        ) : (
          'Select seats to hold'
        )}
      </SubmitButton>
    </form>
  )

  return (
    <ToolEventContext value={event.id}>
    <div className="ep-grid">
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <div className="ep-main">
        {expiredNotice && (
          <div className="alert" data-tone="warning" role="alert">
            <Icon name="clock" size={18} />
            <div>
              <strong>Your 5-minute hold expired</strong>
              The seats were released. We re-selected the ones still free — hold again when you’re ready.
            </div>
            <button type="button" className="lk-icon-btn" aria-label="Dismiss" onClick={() => setExpiredNotice(false)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        )}

        {conflict && (
          <div className="alert ep-conflict" data-tone="danger" role="alert">
            <Icon name="alert" size={20} />
            <div className="ep-conflict-body">
              <strong>
                {conflict.lost.map((s) => s.id).join(', ')} {conflict.lost.length > 1 ? 'were' : 'was'} just taken{conflict.kind === 'hold' ? ' before your hold went through' : ''}.
              </strong>
              <span>{conflict.kept.length ? `We kept ${conflict.kept.join(', ')} for you.` : 'Your other choices are unaffected.'}</span>
              <div className="ep-conflict-alts">
                {conflict.lost.map((s) => {
                  const alt = conflict.alternatives[s.id]
                  return alt ? (
                    <button key={s.id} type="button" className="lk-btn lk-btn-primary lk-btn-sm" onClick={() => swapIn(s.id, alt)} disabled={selected.length >= MAX_SEATS}>
                      Swap in {alt.id} · {money(alt.price)}
                    </button>
                  ) : null
                })}
              </div>
            </div>
            <button type="button" className="lk-icon-btn" aria-label="Dismiss conflict message" onClick={() => setConflict(null)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        )}

        <div className="ep-happening" aria-live="off">
          <span>
            <strong className="lk-num">{counts.available}</strong> free
          </span>
          <span>
            <strong className="lk-num">{counts.booked}</strong> booked
          </span>
          {counts.held > 0 && (
            <span>
              <strong className="lk-num">{counts.held}</strong> being held
            </span>
          )}
          <span className="ep-happening-now">
            {feed[0] ? (
              <>
                <strong>{feed[0].who}</strong> {feed[0].kind === 'held' ? 'is holding' : feed[0].kind === 'booked' ? 'booked' : 'released'}{' '}
                <span className="lk-num">{feed[0].seats.join(', ')}</span>
              </>
            ) : (
              'Nothing has changed just now'
            )}
          </span>
        </div>

        <section className="ep-stage lk-card" data-kind={event.kind} aria-labelledby="map-title">
          <div className="ep-toolbar">
            <h2 id="map-title" className="sr-only">
              Seat map
            </h2>
            <div className="seg" role="tablist" aria-label="Map view">
              <button type="button" role="tab" aria-selected={mode === '3d'} onClick={() => switchMode('3d')} disabled={!hasWebGL()}>
                <Icon name="cube" size={16} /> {t('ev.view3d')} {event.kind === 'bus' ? 'coach' : 'hall'}
              </button>
              <button type="button" role="tab" aria-selected={mode === 'easy'} onClick={() => switchMode('easy')} disabled={!hasWebGL()}>
                <Icon name="eye" size={16} /> {t('ev.easy')}
              </button>
              <button type="button" role="tab" aria-selected={mode === 'map'} onClick={() => switchMode('map')}>
                <Icon name="grid" size={16} /> {t('ev.map')}
              </button>
            </div>
            <span className="live" data-off={!demo.live || undefined} data-stale={stale || undefined}>
              <span className="live-dot" aria-hidden="true" />
              {stale ? 'Reconnecting…' : t('ev.live')}
            </span>
          </div>

          {mode !== 'map' ? (
            <div className="ep-viewport" ref={stageRef} data-easy={mode === 'easy' || undefined}>
              <ErrorBoundary section="the 3D view" compact onReset={() => switchMode('map')}>
                <Suspense fallback={<StageSkeleton kind={event.kind} />}>
                  <Scene3D
                    layout={layout}
                    seats={seats}
                    selected={selectedSet}
                    suggested={suggestedSet}
                    lost={lost}
                    view={camera}
                    focusId={focusId}
                    people={demo.people && mode === '3d'}
                    simple={mode === 'easy'}
                    screenTitle={event.title}
                    onPick={toggleSeatById}
                    onHover={hover}
                  />
                </Suspense>
              </ErrorBoundary>
              <div className="ep-tip" ref={tipRef} hidden role="tooltip" />
              {toolLive && (
                <div className="ep-tool-badge" role="status">
                  <Icon name="sparkle" size={14} />
                  <span>
                    <strong>{toolLive.label}</strong>
                    {toolLive.seatIds.length > 0 && <small>{toolLive.seatIds.length > 6 ? `${toolLive.seatIds.length} seats` : toolLive.seatIds.join(', ')}</small>}
                  </span>
                </div>
              )}
              <div className="seg ep-cams" role="group" aria-label="Camera">
                {(['overview', 'top', 'seat'] as View[]).map((v) => (
                  <button key={v} type="button" aria-pressed={camera === v} onClick={() => setCamera(v)}>
                    <Icon name={v === 'overview' ? 'cube' : v === 'top' ? 'grid' : 'eye'} size={15} />
                    {v === 'overview' ? 'Overview' : v === 'top' ? 'Top' : `From ${focusId}`}
                  </button>
                ))}
              </div>
              <p className="ep-hint">{coarse ? 'Drag to turn · pinch to zoom · tap a seat' : 'Drag to turn · scroll to zoom · click a seat'}</p>
              <p className="sr-only">The 3D view is visual only. Keyboard and screen-reader users can book with the Seat map tab.</p>
            </div>
          ) : (
            <div className="ep-map">
              <SeatMap kind={event.kind} seats={seats} selected={selectedSet} suggested={suggestedSet} lost={lost} onToggle={toggleSeat} focusSeatId={focusSeat} />
            </div>
          )}
          <div className="ep-legend">
            <SeatLegend kind={event.kind} />
          </div>
        </section>

        {/* Seat-finding tools sit right under the map they help with. */}
        <ToolRow title="Find the right seat" hi="सही सीट खोजें">
          <ToolButton id="access" label="Accessible seats" hi="सुलभ सीटें" />
          <ToolButton id="quiet" label="Quiet zone" hi="शांत ज़ोन" />
          <ToolButton id="view" label="View from a seat" hi="सीट से नज़ारा" />
          <ToolButton id="rescue" label="Backup seats" hi="बैकअप सीटें" />
        </ToolRow>

      </div>

      <aside className="ep-side" aria-label="Your selection">
        {/* Lives in the side column so it never shifts the seat map when it loads. */}
        {clash && (
          <div className="alert" data-tone="warning" role="status">
            <Icon name="clock" size={18} />
            <div>
              <strong>Time clash</strong>
              You also have “{clash}” around this time.{' '}
              <ToolButton id="conflict" label="Check my timetable" hi="टाइम-टेबल देखें" look="link" />
            </div>
          </div>
        )}
        <section className="ep-summary lk-card" aria-labelledby="summary-title">
          <div className="ep-summary-head">
            <h2 id="summary-title">{t('ev.yourSeats')}</h2>
            <span className="ep-pips" aria-label={`${optimisticSelected.length} of ${MAX_SEATS} selected`}>
              {Array.from({ length: MAX_SEATS }, (_, i) => (
                <span key={i} data-on={i < optimisticSelected.length || undefined} />
              ))}
            </span>
          </div>
          {selectedSeats.length === 0 ? (
            <p className="ep-empty">{event.kind === 'cinema' ? 'Tap seats in the hall, or ask the assistant. Up to 4 per booking.' : 'Tap seats in the coach, or ask the assistant. Up to 4 per booking.'}</p>
          ) : (
            <ul className="ep-lines">
              {selectedSeats.map((s) => (
                <ViewTransition key={s.id} enter="summary-enter" exit="summary-exit">
                  <li>
                    <span className="ep-chip lk-num">{s.id}</span>
                    <span className="ep-line-text">
                      {tierLabel(s.section)}
                      <small>
                        Row {s.row}
                        {s.isAisle ? ' · aisle' : ''}
                        {s.tags.includes('Window') ? ' · window' : ''}
                      </small>
                    </span>
                    <span className="lk-num">{money(s.price)}</span>
                    <button type="button" className="lk-icon-btn" aria-label={`Remove ${s.id}`} onClick={() => toggleSeat(s)}>
                      <Icon name="x" size={14} />
                    </button>
                  </li>
                </ViewTransition>
              ))}
            </ul>
          )}
          {limitHit && (
            <p className="lk-error" role="alert">
              <Icon name="info" size={16} /> Up to {MAX_SEATS} seats per booking — remove one to swap.
            </p>
          )}
          <div className="ep-total">
            <span>{t('ev.total')}</span>
            <strong className="lk-num" key={total}>
              {rupees(total)}
            </strong>
          </div>
          <label className="ep-budget">
            <span>{t('ev.budget')}</span>
            <span className="ep-budget-field">
              ₹
              <input type="number" inputMode="numeric" min="0" step="10" value={budget} placeholder="500" onChange={(e) => setBudget(e.currentTarget.value)} />
            </span>
          </label>
          {budget !== '' && optimisticSelected.length > 0 && total > Number(budget) && (
            <p className="lk-error" role="status">
              <Icon name="info" size={16} /> {t('ev.overBudget')} by {rupees(total - Number(budget))}
            </p>
          )}
          <ToolButton id="budget" label="Plan the whole outing: ticket, travel, food" hi="पूरा बजट: टिकट, सफ़र, खाना" look="link" />
          <p className="ep-fine">All-in price, no booking fee. Seats lock for 5 minutes once held.</p>
          <div className="ep-facts-card">
            <h3>{t('ev.goodToKnow')}</h3>
            <ul>
              {goodToKnow(layout, event.kind).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="ep-know-tools">
              <ToolButton id="nav" label="How to get there" hi="कैसे पहुँचें" look="link" />
              <ToolButton id="crowd" label="Which gate is quiet now" hi="कौन-सा गेट खाली है" look="link" />
              <ToolButton id="exit" label="Nearest emergency exit" hi="सबसे पास का निकास" look="link" />
            </div>
          </div>
          {isDesktop && holdForm}
          {/* Group tools next to the hold button: book together, find company, split later. */}
          <ToolRow title="Going with others?" hi="दूसरों के साथ जा रहे हैं?">
            <ToolButton id="buddy" label="Book with friends" hi="दोस्तों के साथ" />
            <ToolButton id="companion" label="Find a companion" hi="साथी खोजें" />
            <ToolButton id="split" label="Split the bill" hi="बिल बाँटें" />
          </ToolRow>
        </section>

        {!isDesktop && (
          <button type="button" className="lk-btn lk-btn-block ep-ai-toggle" aria-expanded={assistantOpen} aria-controls="assistant-panel" onClick={() => setAssistantOpen((o) => !o)}>
            <Icon name="sparkle" size={18} /> {assistantOpen ? 'Hide seat assistant' : t('ev.askAi')}
          </button>
        )}
        <div id="assistant-panel">
          {/* <Activity> keeps the assistant's conversation alive while hidden. */}
          <Activity mode={assistantOpen || isDesktop ? 'visible' : 'hidden'}>
            <ErrorBoundary section="the seat assistant" compact>
              <AiAssistant kind={event.kind} eventId={event.id} seats={seats} selected={selectedSet} suggestion={suggestion} onSuggest={setSuggestion} onUse={applySuggestion} />
            </ErrorBoundary>
          </Activity>
        </div>

        <Feed feed={feed} live={demo.live} />
      </aside>

      {!isDesktop && (
        <div className="ep-holdbar">
          <div className="ep-holdbar-info">
            <span>{optimisticSelected.length ? optimisticSelected.join(', ') : 'No seats yet'}</span>
            <strong className="lk-num">{rupees(total)}</strong>
          </div>
          {holdForm}
        </div>
      )}
    </div>
    </ToolEventContext>
  )
}

function goodToKnow(layout: Layout, kind: Kind): string[] {
  const out: string[] = []
  const wheel = layout.seats.filter((x) => x.tags.includes('Wheelchair')).map((x) => x.id)
  if (wheel.length) out.push(`Wheelchair spaces: ${wheel.join(', ')}`)
  const exit = layout.seats.find((x) => x.tags.includes('Emergency exit'))
  if (exit) out.push(`Emergency exit beside seat ${exit.id}`)
  const women = [...new Set(layout.seats.filter((x) => x.tags.includes('Women only')).map((x) => x.row + 1))]
  if (women.length) out.push(`Women-only rows: ${women.join(', ')}`)
  out.push(kind === 'cinema' ? 'Best sightline: the middle rows' : 'Board at the front door')
  return out
}

function defaultFocus(seats: Seat[], kind: string): string {
  const best = seats.find((s) => s.status === 'available' && (kind === 'cinema' ? s.tags.includes('Sweet spot') : s.tags.includes('Window')))
  return (best ?? seats[Math.floor(seats.length / 2)])?.id ?? ''
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

function Feed({ feed, live }: { feed: FeedItem[]; live: boolean }) {
  const now = useNow(5000)
  const ago = (ms: number) => (ms < 5000 ? 'now' : ms < 60000 ? `${Math.floor(ms / 1000)}s` : `${Math.floor(ms / 60000)}m`)
  return (
    <section className="lk-card ep-feed" aria-labelledby="feed-title">
      <div className="ep-summary-head">
        <h2 id="feed-title">Live activity</h2>
        <span className="live" data-off={!live || undefined}>
          <span className="live-dot" aria-hidden="true" />
          {live ? 'Live' : 'Quiet'}
        </span>
      </div>
      {feed.length === 0 ? (
        <p className="ep-empty">{live ? 'Watching for other bookings…' : 'Live demo is off — turn it on in the header to see others booking.'}</p>
      ) : (
        <ol className="ep-feed-list">
          {feed.slice(0, 7).map((f) => (
            <li key={f.id} data-kind={f.kind}>
              <span className="ep-feed-dot" aria-hidden="true" />
              <span className="ep-feed-text">
                <strong>{f.who}</strong> {f.kind === 'held' ? 'is holding' : f.kind === 'booked' ? 'booked' : 'released'} <span className="lk-num">{f.seats.join(', ')}</span>
              </span>
              <time className="lk-num">{ago(now - f.at)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
