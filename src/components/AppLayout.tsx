import { useRef, useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth'
import { useDemo } from '../lib/demo'
import { useBackendLog } from '../lib/backendLog'
import { readLang, setLang, useLang } from '../lib/i18n'
import { narrate, setReadAloud, speak, useReadAloud } from '../lib/speech'
import { setSound, sfx, useSoundOn } from '../lib/sound'
import { useTheme } from '../lib/theme'
import { toast } from '../lib/toast'
import { Icon } from './Icon'
import { Mark } from './Mark'
import { Toaster } from './Toaster'
import { ToolButton } from './ToolStrip'
import './layout.css'

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <button type="button" className="lk-icon-btn theme-btn" onClick={toggle} aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title="Theme">
      <Icon name={resolved === 'dark' ? 'sun' : 'moon'} size={19} />
    </button>
  )
}

export function LangToggle() {
  const lang = useLang()
  return (
    <button type="button" className="lang-toggle" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label={lang === 'en' ? 'Switch to Hindi' : 'Switch to English'} title="Language">
      {lang === 'en' ? 'हिं' : 'EN'}
    </button>
  )
}

/** Voice guide: the app talks you through each screen and every booking step. */
export function VoiceToggle() {
  const on = useReadAloud()
  const lang = useLang()
  return (
    <button
      type="button"
      className="voice-toggle"
      data-on={on || undefined}
      aria-pressed={on}
      aria-label={on ? 'Turn voice guide off' : 'Turn voice guide on'}
      title="Voice guide"
      onClick={() => {
        setReadAloud(!on)
        if (!on) speak(lang === 'hi' ? 'वॉइस गाइड चालू है। मैं हर कदम पर आपको बताऊँगा।' : 'Voice guide is on. I will talk you through every step.', lang)
      }}
    >
      <Icon name="mic" size={17} />
      <span>{lang === 'hi' ? 'आवाज़' : 'Voice'}</span>
    </button>
  )
}

const SCREEN_EN: [RegExp, string][] = [
  [/^\/$/, 'Home. Choose bus or cinema.'],
  [/^\/book\/bus/, 'Bus trips. Pick a trip to choose your seat.'],
  [/^\/book\/cinema/, 'Cinema shows. Pick a show to choose your seat.'],
  [/^\/e\//, 'Seat booking. Tap a seat, or ask the seat assistant. Smart tools are below the map.'],
  [/^\/checkout/, 'Checkout. Your seats are locked for five minutes. Confirm to pay.'],
  [/^\/bookings/, 'My tickets.'],
]
const SCREEN_HI: [RegExp, string][] = [
  [/^\/$/, 'होम। बस या सिनेमा चुनें।'],
  [/^\/book\/bus/, 'बस यात्राएँ। सीट चुनने के लिए यात्रा चुनें।'],
  [/^\/book\/cinema/, 'सिनेमा शो। सीट चुनने के लिए शो चुनें।'],
  [/^\/e\//, 'सीट बुकिंग। सीट पर टैप करें या सीट सहायक से पूछें। स्मार्ट टूल मैप के नीचे हैं।'],
  [/^\/checkout/, 'चेकआउट। आपकी सीटें पाँच मिनट के लिए रुकी हैं। भुगतान के लिए पुष्टि करें।'],
  [/^\/bookings/, 'मेरे टिकट।'],
]

export function SoundToggle() {
  const on = useSoundOn()
  return (
    <button
      type="button"
      className="lk-icon-btn"
      aria-pressed={on}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
      title="Sound effects"
      onClick={() => {
        setSound(!on)
        if (!on) sfx.tap()
      }}
    >
      <Icon name={on ? 'volume' : 'mute'} size={19} />
    </button>
  )
}

/**
 * Presenter panel for the demo. Turning the live crowd on also opens the
 * backend log, so you can see every organizer-API request as it happens.
 */
function DemoMenu() {
  const demo = useDemo()
  const log = useBackendLog()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!demo.available) return null

  const once = async (key: 'forceConflictNext' | 'shortHoldNext' | 'aiSlowNext' | 'aiStaleNext', msg: string) => {
    const { demoControls } = await import('../lib/api/mock/server')
    demoControls[key] = true
    toast(msg)
  }

  return (
    <div className="demo" ref={ref}>
      <button
        type="button"
        className="demo-pill"
        data-on={demo.live || undefined}
        aria-pressed={demo.live}
        aria-expanded={open}
        aria-controls="demo-panel"
        onClick={() => {
          demo.set({ live: !demo.live })
          setOpen(true)
        }}
        title="Other people keep booking seats while you watch"
      >
        <span className="demo-led" aria-hidden="true" />
        <span>Live demo</span>
        <span className="demo-state">{demo.live ? 'On' : 'Off'}</span>
      </button>
      <button type="button" className="lk-icon-btn" aria-label="Demo settings" aria-expanded={open} aria-controls="demo-panel" onClick={() => setOpen((o) => !o)}>
        <Icon name="sliders" size={19} />
      </button>
      {open && (
        <div id="demo-panel" className="demo-panel lk-card" role="group" aria-label="Demo settings">
          <p className="lk-eyebrow">Backend</p>
          <p className="demo-api">
            Organizer API (mock) · {demo.fast ? 'fast' : '2–3 s'} responses · {demo.failures ? '1 in 20 fails' : 'no failures'}
          </p>
          <ol className="demo-log" aria-label="Recent requests" aria-live="off">
            {log.length === 0 && <li className="demo-log-empty">Requests appear here as you browse.</li>}
            {log.slice(0, 8).map((e) => (
              <li key={e.id} data-status={e.status === 'network' || e.status >= 400 ? 'error' : 'ok'}>
                <span className="demo-method">{e.method}</span>
                <span className="demo-path">{e.path}</span>
                <span className="demo-status lk-num">{e.status}</span>
                <span className="demo-ms lk-num">{e.ms} ms</span>
              </li>
            ))}
          </ol>

          <p className="lk-eyebrow">Demo data</p>
          <label className="switch">
            <input type="checkbox" checked={demo.live} onChange={(e) => demo.set({ live: e.target.checked })} />
            <span>
              Live crowd<small>Others hold and book seats every few seconds</small>
            </span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={demo.people} onChange={(e) => demo.set({ people: e.target.checked })} />
            <span>
              People in 3D<small>Show who is sitting in booked seats</small>
            </span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={demo.fast} onChange={(e) => demo.set({ fast: e.target.checked })} />
            <span>
              Fast network<small>Skip the 2–3 s API delay</small>
            </span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={demo.failures} onChange={(e) => demo.set({ failures: e.target.checked })} />
            <span>
              Random failures<small>About 1 in 20 requests fail</small>
            </span>
          </label>
          <p className="lk-eyebrow">Organizer view</p>
          <div className="demo-once">
            <ToolButton id="twin" label="Digital twin" hi="डिजिटल ट्विन" />
            <ToolButton id="noshow" label="No-show recovery" hi="नो-शो रिकवरी" />
            <ToolButton id="crowd" label="Gate crowds" hi="गेट की भीड़" />
          </div>
          <p className="lk-eyebrow">Next action only</p>
          <div className="demo-once">
            <button type="button" className="chip" onClick={() => void once('forceConflictNext', 'Next hold will hit a conflict')}>
              Conflict on hold
            </button>
            <button type="button" className="chip" onClick={() => void once('shortHoldNext', 'Next hold lasts 75 seconds')}>
              75 s hold
            </button>
            <button type="button" className="chip" onClick={() => void once('aiSlowNext', 'Next AI request will time out')}>
              Slow AI
            </button>
            <button type="button" className="chip" onClick={() => void once('aiStaleNext', 'Next AI answer includes a taken seat')}>
              Stale AI seat
            </button>
          </div>
          <button
            type="button"
            className="lk-btn lk-btn-sm"
            onClick={async () => {
              const { resetMockDb } = await import('../lib/api/mock/server')
              resetMockDb()
              location.reload()
            }}
          >
            <Icon name="refresh" size={15} /> Reset demo data
          </button>
        </div>
      )}
    </div>
  )
}

/** Profile menu: who is signed in, edit name, tickets, sign out. */
function AccountMenu() {
  const { user, signOut, updateUser } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!user) return null
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const next = name.trim().replace(/\s+/g, ' ')
    if (next.length < 2) {
      toast.error('Name too short', 'Use at least 2 characters.')
      return
    }
    setSaving(true)
    try {
      const { api } = await import('../lib/api/client')
      const updated = await api.updateProfile(next)
      updateUser(updated)
      setEditing(false)
      setOpen(false)
      toast.success('Name updated', `Tickets will now show “${updated.name}”.`)
    } catch {
      toast.error('Couldn’t save your name', 'Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="acct" ref={ref}>
      <button type="button" className="app-avatar" aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${user.name}`} onClick={() => setOpen((o) => !o)}>
        {initials}
      </button>
      {open && (
        <div className="acct-panel lk-card" role="menu" aria-label="Account">
          <div className="acct-head">
            <span className="acct-avatar" aria-hidden="true">
              {initials}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          {editing ? (
            <form className="acct-edit" onSubmit={(e) => void save(e)}>
              <label className="lk-label" htmlFor="acct-name">
                Your name
              </label>
              <input id="acct-name" className="lk-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
              <div className="acct-edit-actions">
                <button type="submit" className="lk-btn lk-btn-primary lk-btn-sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="lk-btn lk-btn-ghost lk-btn-sm" onClick={() => { setEditing(false); setName(user.name) }}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" role="menuitem" className="acct-item" onClick={() => { setName(user.name); setEditing(true) }}>
              <Icon name="person" size={16} /> Edit name
            </button>
          )}
          <button type="button" role="menuitem" className="acct-item" onClick={() => { setOpen(false); void navigate('/bookings') }}>
            <Icon name="ticket" size={16} /> My tickets
          </button>
          <button
            type="button"
            role="menuitem"
            className="acct-item acct-out"
            onClick={() => {
              signOut()
              toast('Signed out', 'See you soon. Your tickets are saved to your account.')
              void navigate('/login')
            }}
          >
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

const NAV = [
  { to: '/', label: 'Home', hi: 'होम', icon: 'grid' as const, end: true },
  { to: '/bookings', label: 'My tickets', hi: 'मेरे टिकट', icon: 'ticket' as const, end: false },
]

export function AppLayout() {
  const { user } = useAuth()
  const lang = useLang()
  const hi = lang === 'hi'
  const { pathname } = useLocation()
  // Connection messages: tell people when they drop offline and when they are back.
  useEffect(() => {
    const off = () => toast.warning('You’re offline', 'Saved tickets still open. Booking resumes when you reconnect.')
    const on = () => toast.success('Back online', 'Seat availability is live again.')
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [])
  // Voice guide: announce each screen when it opens.
  useEffect(() => {
    const l = readLang()
    const hit = (l === 'hi' ? SCREEN_HI : SCREEN_EN).find(([re]) => re.test(pathname))
    if (hit) narrate(hit[1], l)
  }, [pathname])
  const label = (en: string, h: string) => (hi ? h : en)
  return (
    <>
      <a href="#main" className="skip-link">
        {label('Skip to content', 'मुख्य सामग्री पर जाएँ')}
      </a>
      <header className="app-top">
        <div className="app-top-inner">
          <Link to="/" aria-label="SeatLock home" className="app-brand">
            <Mark />
          </Link>
          <nav aria-label="Primary" className="app-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {label(n.label, n.hi)}
              </NavLink>
            ))}
          </nav>
          <div className="app-actions">
            <DemoMenu />
            <VoiceToggle />
            <SoundToggle />
            <LangToggle />
            <ThemeToggle />
            {user && <AccountMenu />}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <nav aria-label="Primary" className="app-tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <Icon name={n.icon} size={20} />
            <span>{label(n.label, n.hi)}</span>
          </NavLink>
        ))}
      </nav>
      <Toaster />
    </>
  )
}
