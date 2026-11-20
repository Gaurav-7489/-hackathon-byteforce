import { useActionState, useState } from 'react'
import { Icon } from '../components/Icon'
import { SubmitButton } from '../components/SubmitButton'
import { api } from '../lib/api/client'
import { friendlyMessage, toApiError } from '../lib/api/errors'
import { useAuth } from '../lib/auth'
import { toast } from '../lib/toast'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 0–4 score: length, mixed case, digit, symbol. */
export function passwordScore(pw: string): number {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^a-z0-9]/i.test(pw)) s++
  return Math.min(4, s)
}
const STRENGTH = ['Too short', 'Weak', 'Okay', 'Strong', 'Very strong']

interface Fields {
  name?: string
  email?: string
  password?: string
  confirm?: string
  terms?: string
}

function check(v: { name: string; email: string; password: string; confirm: string; terms: boolean }): Fields {
  const f: Fields = {}
  if (v.name.trim().length < 2) f.name = 'Enter your full name.'
  if (!EMAIL_RE.test(v.email.trim())) f.email = v.email ? 'That doesn’t look like an email address.' : 'Enter your email.'
  if (v.password.length < 8 || !/[a-z]/i.test(v.password) || !/\d/.test(v.password)) f.password = 'Use at least 8 characters with a letter and a number.'
  if (v.confirm !== v.password) f.confirm = 'The passwords don’t match.'
  if (!v.terms) f.terms = 'Please accept the terms to continue.'
  return f
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | undefined; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="lk-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="lk-error">
          <Icon name="alert" size={15} />
          {error}
        </p>
      ) : (
        hint && <p className="ob-hint">{hint}</p>
      )}
    </div>
  )
}

/** Create an account: name, email, password (with strength), confirm, terms. */
export function SignUpForm({ onDone, onSignIn }: { onDone: () => void; onSignIn: (email: string) => void }) {
  const { signIn } = useAuth()
  const [v, setV] = useState({ name: '', email: '', password: '', confirm: '', terms: false })
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({})
  const [show, setShow] = useState(false)
  const live = check(v)
  const err = (k: keyof Fields) => (touched[k] ? live[k] : undefined)
  const score = passwordScore(v.password)

  const [state, action] = useActionState<{ error: string | null; taken: boolean }, FormData>(
    async () => {
      setTouched({ name: true, email: true, password: true, confirm: true, terms: true })
      if (Object.keys(check(v)).length) return { error: null, taken: false }
      try {
        const res = await api.register(v.name.trim(), v.email.trim().toLowerCase(), v.password)
        signIn(res.token, res.user)
        toast.success(`Welcome to SeatLock, ${res.user.name.split(' ')[0]}!`, 'Your account is ready. Pick a seat to get started.')
        onDone()
        return { error: null, taken: false }
      } catch (e) {
        const ae = toApiError(e)
        if (ae.code === 'email_taken') return { error: 'An account with this email already exists.', taken: true }
        toast.error('Couldn’t create your account', friendlyMessage(ae))
        return { error: friendlyMessage(ae), taken: false }
      }
    },
    { error: null, taken: false },
  )

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: k === 'terms' ? e.target.checked : e.target.value })
  const blur = (k: keyof Fields) => () => setTouched((t) => ({ ...t, [k]: true }))

  return (
    <form key="signup" className="lk-enter" action={action} noValidate>
      <h1 className="lk-display ob-title">Create your account</h1>
      <p className="ob-sub">It takes a minute. Your tickets and preferences stay with you.</p>
      {state.error && (
        <div className="alert" data-tone="danger" role="alert" style={{ marginBottom: 16 }}>
          <Icon name="alert" size={18} />
          <div>
            {state.error}{' '}
            {state.taken && (
              <button type="button" className="ob-link" onClick={() => onSignIn(v.email)}>
                Sign in instead
              </button>
            )}
          </div>
        </div>
      )}
      <div className="ob-fields">
        <Field id="su-name" label="Full name" error={err('name')} hint="As it should appear on your ticket.">
          <input id="su-name" name="name" className="lk-input" autoComplete="name" placeholder="Asha Rao" value={v.name} onChange={set('name')} onBlur={blur('name')} aria-invalid={err('name') ? true : undefined} />
        </Field>
        <Field id="su-email" label="College email" error={err('email')}>
          <input id="su-email" name="email" type="email" inputMode="email" className="lk-input" autoComplete="email" placeholder="you@college.edu" value={v.email} onChange={set('email')} onBlur={blur('email')} aria-invalid={err('email') ? true : undefined} />
        </Field>
        <Field id="su-pw" label="Password" error={err('password')}>
          <div className="ob-pw">
            <input id="su-pw" name="password" type={show ? 'text' : 'password'} className="lk-input" autoComplete="new-password" value={v.password} onChange={set('password')} onBlur={blur('password')} aria-invalid={err('password') ? true : undefined} aria-describedby="su-strength" />
            <button type="button" className="ob-pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              <Icon name="eye" size={18} />
            </button>
          </div>
          <div className="ob-strength" data-score={v.password ? score : undefined} id="su-strength" aria-live="polite">
            <span />
            <span />
            <span />
            <span />
            <small>{v.password ? STRENGTH[score] : '8+ characters, with a letter and a number'}</small>
          </div>
        </Field>
        <Field id="su-confirm" label="Confirm password" error={err('confirm')}>
          <input id="su-confirm" name="confirm" type={show ? 'text' : 'password'} className="lk-input" autoComplete="new-password" value={v.confirm} onChange={set('confirm')} onBlur={blur('confirm')} aria-invalid={err('confirm') ? true : undefined} />
        </Field>
        <div>
          <label className="ob-terms">
            <input type="checkbox" name="terms" checked={v.terms} onChange={set('terms')} onBlur={blur('terms')} />
            <span>I agree to the booking terms and the privacy policy.</span>
          </label>
          {err('terms') && (
            <p className="lk-error">
              <Icon name="alert" size={15} />
              {err('terms')}
            </p>
          )}
        </div>
      </div>
      <p className="ob-switch">
        Already have an account?{' '}
        <button type="button" className="ob-link" onClick={() => onSignIn(v.email)}>
          Sign in
        </button>
      </p>
      <div className="ob-cta">
        <SubmitButton pendingLabel="Creating your account…" className="lk-btn lk-btn-primary lk-btn-lg lk-btn-block">
          Create account
        </SubmitButton>
      </div>
    </form>
  )
}

/** Forgot password: always answers the same way, so it never reveals which emails exist. */
export function ForgotForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [state, action] = useActionState<{ sent: boolean; error: string | null }, FormData>(
    async () => {
      if (!EMAIL_RE.test(email.trim())) return { sent: false, error: 'Enter the email you signed up with.' }
      await new Promise((r) => setTimeout(r, 900))
      toast('Check your inbox', `If an account exists for ${email.trim()}, a reset link is on its way.`)
      return { sent: true, error: null }
    },
    { sent: false, error: null },
  )
  return (
    <form key="forgot" className="lk-enter" action={action} noValidate>
      <h1 className="lk-display ob-title">Reset your password</h1>
      {state.sent ? (
        <div className="alert" data-tone="success" role="status">
          <Icon name="check" size={18} />
          <div>
            <strong>Check your inbox</strong>
            If an account exists for {email.trim()}, we’ve sent a link to reset your password. It expires in 30 minutes. (Demo build: no email is actually sent.)
          </div>
        </div>
      ) : (
        <>
          <p className="ob-sub">Enter your email and we’ll send you a reset link.</p>
          <div className="ob-fields">
            <Field id="fp-email" label="College email" error={state.error ?? undefined}>
              <input id="fp-email" type="email" inputMode="email" className="lk-input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
        </>
      )}
      <p className="ob-switch">
        <button type="button" className="ob-link" onClick={onBack}>
          ← Back to sign in
        </button>
      </p>
      {!state.sent && (
        <div className="ob-cta">
          <SubmitButton pendingLabel="Sending…" className="lk-btn lk-btn-primary lk-btn-lg lk-btn-block">
            Send reset link
          </SubmitButton>
        </div>
      )}
    </form>
  )
}
