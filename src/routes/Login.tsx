import { useActionState, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { ThemeToggle } from '../components/AppShell'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import { SubmitButton } from '../components/SubmitButton'
import { api, usingMock } from '../lib/api/client'
import { friendlyMessage, toApiError } from '../lib/api/errors'
import { useAuth } from '../lib/auth'
import { fadeUp, stagger } from '../lib/motion'
import './login.css'

interface LoginState {
  error: string | null
  fieldErrors: { email?: string; password?: string }
  email: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(email: string, password: string): LoginState['fieldErrors'] {
  const errors: LoginState['fieldErrors'] = {}
  if (!email) errors.email = 'Enter your college email.'
  else if (!EMAIL_RE.test(email)) errors.email = 'That doesn’t look like an email address.'
  if (!password) errors.password = 'Enter your password.'
  else if (password.length < 6) errors.password = 'Passwords are at least 6 characters.'
  return errors
}

export function Login() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/events'
  const [touched, setTouched] = useState<{ email?: string; password?: string }>({})
  const [showPw, setShowPw] = useState(false)

  // React 19 Action: pending/result/error all come from useActionState.
  const [state, formAction] = useActionState<LoginState, FormData>(
    async (_prev, form) => {
      const email = String(form.get('email') ?? '').trim()
      const password = String(form.get('password') ?? '')
      const fieldErrors = validate(email, password)
      if (fieldErrors.email || fieldErrors.password) return { error: null, fieldErrors, email }
      try {
        const res = await api.login(email, password)
        signIn(res.token, res.user)
        await navigate(from, { replace: true })
        return { error: null, fieldErrors: {}, email }
      } catch (e) {
        const err = toApiError(e)
        return {
          error: err.code === 'invalid_credentials' ? 'Wrong email or password. Check for typos and try again.' : friendlyMessage(err),
          fieldErrors: {},
          email,
        }
      }
    },
    { error: null, fieldErrors: {}, email: '' },
  )

  if (user) return <Navigate to={from} replace />

  // Inline validation: re-validate a field live once the user has left it.
  const live = validate(touched.email ?? '', touched.password ?? '')
  const emailError = (touched.email !== undefined ? live.email : undefined) ?? state.fieldErrors.email
  const passwordError = (touched.password !== undefined ? live.password : undefined) ?? state.fieldErrors.password

  return (
    <div className="login">
      <title>Sign in · SeatLock</title>
      <meta name="description" content="Sign in to SeatLock to book seats for campus events." />
      <div className="login-stage" aria-hidden="true">
        <span className="beam beam-1" />
        <span className="beam beam-2" />
        <span className="beam beam-3" />
        <div className="login-rows">
          {Array.from({ length: 7 }, (_, r) => (
            <div key={r} className="login-row" style={{ ['--r' as string]: r }}>
              {Array.from({ length: 14 - r }, (_, i) => <span key={i} />)}
            </div>
          ))}
        </div>
      </div>

      <div className="login-top">
        <Logo />
        <ThemeToggle />
      </div>

      <motion.div className="login-panel" variants={stagger(0.06)} initial="hidden" animate="show">
        <motion.h1 variants={fadeUp} className="login-title">
          <span className="login-line">Your moment.</span>
          <span className="login-line">Your seat.</span>
        </motion.h1>
        <motion.p variants={fadeUp} className="login-sub">Sign in with your college email to book seats for campus events.</motion.p>

        <motion.form variants={fadeUp} action={formAction} noValidate className="login-form">
          {state.error && (
            <div className="alert" data-tone="danger" role="alert">
              <Icon name="alert" size={18} />
              <span>{state.error}</span>
            </div>
          )}
          <div className="field">
            <label htmlFor="email" className="field-label">College email</label>
            <input
              id="email" name="email" type="email" className="input" autoComplete="email" inputMode="email"
              defaultValue={state.email} placeholder="you@college.edu"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'email-error' : undefined}
              onBlur={(e) => { const v = e.currentTarget.value.trim(); setTouched((t) => ({ ...t, email: v })) }}
              onChange={(e) => { const v = e.currentTarget.value.trim(); if (touched.email !== undefined) setTouched((t) => ({ ...t, email: v })) }}
            />
            {emailError && <p id="email-error" className="field-error"><Icon name="alert" size={16} />{emailError}</p>}
          </div>
          <div className="field">
            <label htmlFor="password" className="field-label">Password</label>
            <div className="pw-wrap">
              <input
                id="password" name="password" type={showPw ? 'text' : 'password'} className="input" autoComplete="current-password"
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? 'password-error' : undefined}
                onBlur={(e) => { const v = e.currentTarget.value; setTouched((t) => ({ ...t, password: v })) }}
                onChange={(e) => { const v = e.currentTarget.value; if (touched.password !== undefined) setTouched((t) => ({ ...t, password: v })) }}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-pressed={showPw} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordError && <p id="password-error" className="field-error"><Icon name="alert" size={16} />{passwordError}</p>}
          </div>
          <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
        </motion.form>

        {usingMock && (
          <motion.p variants={fadeUp} className="login-hint">
            Demo student: student@seatlock.dev / seatlock123 · Demo organizer: organizer@seatlock.dev / organizer123
          </motion.p>
        )}
      </motion.div>
    </div>
  )
}
