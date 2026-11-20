import { useActionState, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Mark } from '../booking/Mark'
import { BusArt, CinemaArt } from '../booking/ModeArt'
import type { Mode } from '../booking/data'
import { api, usingMock } from '../lib/api/client'
import { friendlyMessage, toApiError } from '../lib/api/errors'
import { useAuth } from '../lib/auth'
import '../booking/lk.css'
import './onboard.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STEPS = 2

const MODES: { id: Mode; title: string; body: string; facts: string[]; Art: typeof CinemaArt }[] = [
  { id: 'cinema', title: 'Cinema', body: 'Pick the exact seat, see the screen from it.', facts: ['196 seats', '3 tiers', 'Recliners'], Art: CinemaArt },
  { id: 'bus', title: 'Bus', body: 'Window or aisle, front or back — before you pay.', facts: ['45 seats', '2+2 AC', 'Women-only rows'], Art: BusArt },
]

/** Unsplash CDN photography; resized on the CDN, AVIF/WebP via auto=format. */
const PHOTO: Record<Mode, { id: string; alt: string }> = {
  cinema: { id: '1489599849927-2ee91cede3ba', alt: 'Rows of red cinema seats facing a dark screen' },
  bus: { id: '1544620347-c4fd4a3d5957', alt: 'An intercity coach on an open road' },
}
const src = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`

const LINES: Record<Mode, [string, string]> = {
  cinema: ['Pick the seat, not just the show.', 'Your seats lock for five minutes. Nobody else can take them.'],
  bus: ['Window seat. Every trip.', 'Your seats lock for five minutes. Nobody else can take them.'],
}

// Warm the booking chunk and three.js while the user is still deciding.
let prefetched = false
function prefetchBooking() {
  if (prefetched) return
  prefetched = true
  void import('./Book')
  void import('../booking/Scene3D')
}

interface SignInState {
  error: string | null
  fields: { email?: string; password?: string }
  email: string
}

function Panel({ mode, step }: { mode: Mode; step: number }) {
  const p = PHOTO[mode]
  const line = LINES[mode][step]!
  return (
    <div className="ob-aside" aria-hidden="true">
      <img
        key={mode}
        className="ob-photo"
        src={src(p.id, 1100)}
        srcSet={`${src(p.id, 700)} 700w, ${src(p.id, 1100)} 1100w, ${src(p.id, 1600)} 1600w`}
        sizes="(min-width: 768px) 50vw, 100vw"
        alt=""
        decoding="async"
        fetchPriority="high"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <span className="ob-shade" />
      <div className="ob-brand">
        <Mark invert />
      </div>
      <div className="ob-story" key={`${mode}-${step}`}>
        <p className="lk-display ob-line">{line}</p>
        <p className="ob-count lk-num">
          Step {step + 1} of {STEPS}
        </p>
      </div>
    </div>
  )
}

export function Onboard() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return localStorage.getItem('seatlock-mode') === 'bus' ? 'bus' : 'cinema'
    } catch {
      return 'cinema'
    }
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const go = (m: Mode) => {
    try {
      localStorage.setItem('seatlock-mode', m)
    } catch {
      /* storage blocked */
    }
    void navigate(`/book/${m}`)
  }

  const [state, signInAction, pending] = useActionState<SignInState, FormData>(
    async (_prev, form) => {
      const e = String(form.get('email') ?? '').trim()
      const pw = String(form.get('password') ?? '')
      const fields: SignInState['fields'] = {}
      if (!EMAIL_RE.test(e)) fields.email = e ? 'That doesn’t look like an email address.' : 'Enter your email.'
      if (pw.length < 6) fields.password = pw ? 'Passwords are at least 6 characters.' : 'Enter your password.'
      if (fields.email || fields.password) return { error: null, fields, email: e }
      try {
        const res = await api.login(e, pw)
        signIn(res.token, res.user)
        go(mode)
        return { error: null, fields: {}, email: e }
      } catch (err) {
        const ae = toApiError(err)
        return { error: ae.code === 'invalid_credentials' ? 'Wrong email or password.' : friendlyMessage(ae), fields: {}, email: e }
      }
    },
    { error: null, fields: {}, email: '' },
  )

  const continueFromMode = (e: React.FormEvent) => {
    e.preventDefault()
    if (user) go(mode)
    else setStep(1)
  }

  return (
    <main className="lk ob">
      <title>Sign in · SeatLock</title>
      <meta name="description" content="Choose cinema or bus, sign in and lock the exact seat you want in a live 3D view." />
      <Panel mode={mode} step={step} />

      <div className="ob-main">
        <div className="ob-form">
          <div className="ob-progress">
            {step === 0 ? (
              <Link to="/events" className="lk-icon-btn" aria-label="Back to events">
                <Chevron />
              </Link>
            ) : (
              <button type="button" className="lk-icon-btn" aria-label="Back" onClick={() => setStep(0)}>
                <Chevron />
              </button>
            )}
            <div className="ob-bars" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS}`}>
              {Array.from({ length: STEPS }, (_, i) => (
                <span key={i} data-state={i < step ? 'done' : i === step ? 'now' : 'todo'} />
              ))}
            </div>
          </div>

          {step === 0 ? (
            <form key="mode" className="lk-enter" onSubmit={continueFromMode}>
              <h1 className="lk-display ob-title">Where are you headed?</h1>
              <fieldset className="ob-modes">
                <legend className="sr-only">Booking type</legend>
                {MODES.map(({ id, title, body, facts, Art }) => (
                  <label key={id} className="ob-mode" data-on={mode === id || undefined} onPointerEnter={prefetchBooking} onFocus={prefetchBooking}>
                    <input type="radio" name="mode" value={id} checked={mode === id} onChange={() => setMode(id)} className="sr-only" />
                    <span className="ob-art">
                      <Art />
                    </span>
                    <span className="ob-mode-title">{title}</span>
                    <span className="ob-mode-body">{body}</span>
                    <span className="ob-facts">
                      {facts.map((f) => (
                        <span key={f}>{f}</span>
                      ))}
                    </span>
                    <span className="ob-check" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </label>
                ))}
              </fieldset>
              <ul className="ob-points">
                <li>Live 3D view of the {mode === 'cinema' ? 'hall' : 'coach'} — watch seats go in real time</li>
                <li>Seats you pick are locked to you for 5 minutes</li>
                <li>All-in prices, no fees added at checkout</li>
              </ul>
              <div className="ob-cta">
                <button type="submit" className="lk-btn lk-btn-primary lk-btn-lg">
                  {user ? `Open ${mode === 'cinema' ? 'cinema' : 'bus'} seats` : 'Continue'}
                </button>
              </div>
            </form>
          ) : (
            <form key="auth" className="lk-enter" action={signInAction} noValidate>
              <h1 className="lk-display ob-title">Sign in to lock seats</h1>
              <p className="ob-sub">
                Booking <strong>{mode === 'cinema' ? 'cinema seats' : 'a bus seat'}</strong>.{' '}
                <button type="button" className="ob-link" onClick={() => setStep(0)}>
                  Change
                </button>
              </p>
              {state.error && (
                <p className="ob-alert" role="alert">
                  {state.error}
                </p>
              )}
              <div className="ob-fields">
                <div>
                  <label className="lk-label" htmlFor="ob-email">
                    College email
                  </label>
                  <input
                    id="ob-email"
                    name="email"
                    type="email"
                    className="lk-input"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={state.fields.email ? true : undefined}
                    aria-describedby={state.fields.email ? 'ob-email-err' : undefined}
                  />
                  {state.fields.email && (
                    <p id="ob-email-err" className="lk-error">
                      {state.fields.email}
                    </p>
                  )}
                </div>
                <div>
                  <label className="lk-label" htmlFor="ob-pw">
                    Password
                  </label>
                  <input
                    id="ob-pw"
                    name="password"
                    type="password"
                    className="lk-input"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={state.fields.password ? true : undefined}
                    aria-describedby={state.fields.password ? 'ob-pw-err' : undefined}
                  />
                  {state.fields.password && (
                    <p id="ob-pw-err" className="lk-error">
                      {state.fields.password}
                    </p>
                  )}
                </div>
              </div>
              {usingMock && (
                <button
                  type="button"
                  className="ob-demo"
                  onClick={() => {
                    setEmail('student@seatlock.dev')
                    setPassword('seatlock123')
                  }}
                >
                  <span>Use the demo account</span>
                  <span className="lk-num">student@seatlock.dev</span>
                </button>
              )}
              <div className="ob-cta">
                <button type="submit" className="lk-btn lk-btn-primary lk-btn-lg" disabled={pending}>
                  {pending ? 'Signing in…' : 'Sign in'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

function Chevron() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
