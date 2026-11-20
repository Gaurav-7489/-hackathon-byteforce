import { lazy, Suspense, use, useRef, useState, useTransition, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { EventCard, EventCardSkeleton } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { MagneticLink } from '../components/MagneticButton'
import { Poster } from '../components/Poster'
import { StatePanel } from '../components/StatePanel'
import { useWebGLReady } from '../hooks/useIdle'
import { useLenis } from '../hooks/useLenis'
import { useFinePointer, useReducedMotion } from '../hooks/useMediaQuery'
import { api } from '../lib/api/client'
import type { EventSummary } from '../lib/api/types'
import { summaryCache } from '../lib/eventCache'
import { dateLong, money, relativeDay, time } from '../lib/format'
import { stagger } from '../lib/motion'
import { invalidate, resource } from '../lib/resource'
import { StageFallback } from '../three/StageFallback'
import { sceneStore, setPointer } from '../three/sceneStore'
import './events.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const StageCanvas = lazy(() => import('../three/StageCanvas'))

type DateFilter = 'all' | 'today' | 'week' | 'weekend' | 'month'
const FILTERS: { id: DateFilter; label: string }[] = [
  { id: 'all', label: 'Any date' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'month', label: 'Next 30 days' },
]

function matchesDate(iso: string, f: DateFilter, picked: string): boolean {
  const d = new Date(iso)
  if (picked) return d.toDateString() === new Date(`${picked}T00:00`).toDateString()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = (d.getTime() - startOfToday.getTime()) / 86_400_000
  switch (f) {
    case 'all': return true
    case 'today': return days >= 0 && days < 1
    case 'week': return days >= 0 && days < 7
    case 'month': return days >= 0 && days < 30
    case 'weekend': {
      // The coming Saturday/Sunday (or today, if it is the weekend).
      const day = d.getDay()
      const untilSunday = (7 - startOfToday.getDay()) % 7
      return days >= 0 && days < untilSunday + 1 && (day === 6 || day === 0)
    }
  }
}

const eventsPromise = () => resource('events', async () => {
  const events = await api.events()
  events.forEach((e) => summaryCache.set(e.id, e))
  return events
})

export function Events() {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const fine = useFinePointer()
  const [query, setQuery] = useState('')
  const [deferredQuery, setDeferredQuery] = useState('')
  const [filter, setFilter] = useState<DateFilter>('all')
  const [picked, setPicked] = useState('')
  const [isPending, startTransition] = useTransition()
  const [retryKey, setRetryKey] = useState(0)

  const idle = useWebGLReady()
  useLenis(true)

  // Section-level choreography (GSAP). Component-level motion stays in Motion.
  useGSAP(
    () => {
      if (reduced) {
        sceneStore.progress = 0
        sceneStore.featured = 0
        return
      }
      // Transform-only reveals (the mask hides the words) so LCP is never delayed by opacity.
      gsap.from('.hero-word', { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.07, delay: 0.05 })
      gsap.from('.hero-fade', { y: 18, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 0.3 })
      ScrollTrigger.create({
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (s) => { sceneStore.progress = s.progress },
      })
      gsap.to('.hero-copy', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })

      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } })
      })
    },
    { scope: root, dependencies: [reduced] },
  )

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!fine || reduced) return
    setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
  }

  const words = ['Your', 'moment.', 'Your', 'seat.']

  return (
    <div ref={root} className="events-page" onPointerMove={onPointer}>
      <title>Events · SeatLock</title>
      <meta name="description" content="Discover campus events and book seats live with SeatLock." />

      <div className="stage-layer" aria-hidden="true">
        {idle ? (
          <Suspense fallback={<StageFallback />}>
            <StageCanvas mode="world" />
          </Suspense>
        ) : <StageFallback />}
      </div>

      {/* Chapter 1 — Arrival */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-copy">
          <p className="eyebrow hero-fade">Live seat booking · Campus events</p>
          <h1 id="hero-title" className="hero-title" aria-label="Your moment. Your seat.">
            {words.map((w, i) => (
              <span key={i} className="hero-word-mask" aria-hidden="true">
                <span className={`hero-word ${i % 2 ? 'is-accent' : ''}`}>{w}</span>
              </span>
            ))}
          </h1>
          <p className="hero-lede hero-fade">Watch seats change in real time, hold up to four for five minutes, and let the AI assistant find the good ones.</p>
          <div className="hero-ctas hero-fade">
            <MagneticLink href="#discover" className="btn btn-primary btn-lg">
              Find events <Icon name="arrowRight" size={18} />
            </MagneticLink>
            <MagneticLink href="#featured" className="btn btn-ghost btn-lg glass">
              <Icon name="sparkle" size={18} /> Tonight’s headliner
            </MagneticLink>
          </div>
        </div>
        <a href="#discover" className="hero-scroll hero-fade">
          <span>Scroll</span><span className="hero-scroll-line" aria-hidden="true" />
        </a>
      </section>

      {/* Chapter 2 — Discover (functional list: search, date filter, cards) */}
      <section id="discover" className="discover" aria-labelledby="discover-title">
        <div className="container">
          <div className="discover-head">
            <div>
              <p className="eyebrow">Chapter 02 — Discover</p>
              <h2 id="discover-title" className="section-title">What’s on</h2>
            </div>
            <div className="discover-tools" role="search">
              <label className="search">
                <Icon name="search" size={18} />
                <span className="sr-only">Search events</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Search events, venues, artists"
                  value={query}
                  onChange={(e) => {
                    const v = e.currentTarget.value
                    setQuery(v) // urgent: keep typing instant
                    startTransition(() => setDeferredQuery(v)) // non-urgent: filtering
                  }}
                />
                {isPending && <span className="spinner search-spinner" aria-hidden="true" />}
              </label>
            </div>
          </div>
          <div className="filters" role="group" aria-label="Filter by date">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="chip"
                aria-pressed={!picked && filter === f.id}
                onClick={() => startTransition(() => { setFilter(f.id); setPicked('') })}
              >
                {!picked && filter === f.id && (
                  <motion.span layoutId="filter-pill" className="chip-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                )}
                <span className="chip-label">{f.label}</span>
              </button>
            ))}
            <label className={`chip chip-date ${picked ? 'is-set' : ''}`}>
              <Icon name="calendar" size={16} />
              <span className="sr-only">Pick a specific date</span>
              <input type="date" value={picked} onChange={(e) => { const v = e.currentTarget.value; startTransition(() => setPicked(v)) }} />
            </label>
          </div>

          <ErrorBoundary section="events" key={retryKey} onReset={() => { invalidate('events'); setRetryKey((k) => k + 1) }}>
            <Suspense fallback={<GridSkeleton />}>
              <EventGrid promise={eventsPromise()} query={deferredQuery} filter={filter} picked={picked} pending={isPending} onClear={() => { setQuery(''); startTransition(() => { setDeferredQuery(''); setFilter('all'); setPicked('') }) }} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </section>

      {/* Chapter 3 — Featured (pinned scroll sequence driving the 3D camera) */}
      <section id="featured" className="featured" aria-labelledby="featured-title">
        <ErrorBoundary section="the featured event" compact>
          <Suspense fallback={<div className="featured-placeholder" />}>
            <Featured promise={eventsPromise()} />
          </Suspense>
        </ErrorBoundary>
      </section>
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="event-grid" role="status" aria-label="Loading events">
      {Array.from({ length: 6 }, (_, i) => <EventCardSkeleton key={i} />)}
    </div>
  )
}

function EventGrid({ promise, query, filter, picked, pending, onClear }: {
  promise: Promise<EventSummary[]>
  query: string
  filter: DateFilter
  picked: string
  pending: boolean
  onClear: () => void
}) {
  const events = use(promise) // Suspense + use()
  const q = query.trim().toLowerCase()
  const visible = events
    .filter((e) => matchesDate(e.startsAt, filter, picked))
    .filter((e) => !q || [e.title, e.subtitle, e.venue, e.category].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))

  if (events.length === 0) {
    return <StatePanel icon="calendar" title="No events yet">New events are announced every week — check back soon.</StatePanel>
  }
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">{visible.length} event{visible.length === 1 ? '' : 's'} found</p>
      {visible.length === 0 ? (
        <StatePanel icon="search" title="No events match" action={<button type="button" className="btn" onClick={onClear}>Clear search and filters</button>}>
          Try another date or a broader search.
        </StatePanel>
      ) : (
        <motion.div
          className="event-grid"
          style={{ opacity: pending ? 0.6 : 1 }}
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
          key={`${filter}-${picked}-${q}`}
        >
          {visible.map((e) => <EventCard key={e.id} event={e} />)}
        </motion.div>
      )}
    </>
  )
}

function Featured({ promise }: { promise: Promise<EventSummary[]> }) {
  const events = use(promise)
  const track = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const upcoming = events.filter((e) => Date.parse(e.startsAt) > Date.now() && e.seatsLeft > 0)
  const featured = [...upcoming].sort((a, b) => a.seatsLeft / a.totalSeats - b.seatsLeft / b.totalSeats)[0]

  // Chapter 3 choreography lives here so it only runs once its content exists.
  // GSAP pins `.featured-pin`; its pin-spacer sits inside the React-owned `track`.
  useGSAP(
    () => {
      if (!featured) return
      sceneStore.hue = featured.poster.hue
      if (reduced) return
      const mm = gsap.matchMedia()
      mm.add('(min-width: 768px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: track.current,
            start: 'top top',
            end: '+=140%',
            pin: '.featured-pin',
            scrub: 0.6,
            onUpdate: (s) => { sceneStore.featured = s.progress },
          },
        })
        tl.fromTo('.featured-kicker', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.2 })
          .fromTo('.featured-title', { opacity: 0, scale: 1.25, filter: 'blur(12px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.35 }, '<0.05')
          .fromTo('.featured-poster', { clipPath: 'inset(50% 50% 50% 50% round 24px)' }, { clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 0.35 }, '<0.15')
          .fromTo('.featured-detail', { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.2 }, '>-0.1')
          .to({}, { duration: 0.2 })
      })
      mm.add('(max-width: 767px)', () => {
        ScrollTrigger.create({
          trigger: track.current, start: 'top bottom', end: 'bottom top', scrub: true,
          onUpdate: (s) => { sceneStore.featured = s.progress },
        })
      })
      ScrollTrigger.refresh()
    },
    { scope: track, dependencies: [featured?.id, reduced] },
  )

  if (!featured) return null
  return (
    <div ref={track} className="featured-track">
    <div className="featured-pin">
      <div className="container featured-grid">
        <div className="featured-copy">
          <p className="eyebrow featured-kicker">Chapter 03 — Headliner · selling fastest</p>
          <h2 id="featured-title" className="featured-title">{featured.title}</h2>
          <p className="featured-detail featured-sub">{featured.subtitle}</p>
          <ul className="featured-facts featured-detail">
            <li><Icon name="calendar" size={16} /> {relativeDay(featured.startsAt)} · {dateLong(featured.startsAt)}, {time(featured.startsAt)}</li>
            <li><Icon name="pin" size={16} /> {featured.venue}</li>
            <li><Icon name="seat" size={16} /> {featured.seatsLeft} of {featured.totalSeats} seats left · from {money(featured.priceFrom)}</li>
          </ul>
          {/* Chapter 4 — Enter booking */}
          <div className="featured-detail featured-ctas">
            <Link to={`/events/${featured.id}`} className="btn btn-lime btn-lg" onClick={() => summaryCache.set(featured.id, featured)}>
              Choose your seat <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        </div>
        <div className="featured-poster">
          <Poster event={featured} />
        </div>
      </div>
    </div>
    </div>
  )
}
