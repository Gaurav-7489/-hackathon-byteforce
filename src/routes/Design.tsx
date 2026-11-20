import { useEffect, useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { duration, ease, spring } from '../lib/motion'
import { useTheme } from '../lib/theme'
import './design.css'

const GROUPS: { title: string; tokens: string[]; text?: boolean }[] = [
  { title: 'Surfaces', tokens: ['--bg', '--surface', '--surface-2', '--surface-3', '--glass', '--border', '--border-strong'] },
  { title: 'Text', tokens: ['--text', '--text-2', '--text-3', '--brand-text'], text: true },
  { title: 'Brand & accents', tokens: ['--brand', '--brand-strong', '--on-brand', '--ice', '--lime', '--on-lime'] },
  { title: 'Feedback', tokens: ['--success', '--warning', '--danger', '--on-danger'], text: true },
  { title: 'Seat states', tokens: ['--seat-available', '--seat-selected', '--seat-held', '--seat-booked', '--seat-blocked', '--seat-ai'] },
]
const TYPE_SCALE = ['--text-display', '--text-3xl', '--text-2xl', '--text-xl', '--text-lg', '--text-md', '--text-sm', '--text-xs']
const SPACING = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8', '--space-10', '--space-12', '--space-16', '--space-24']
const RADII = ['--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-pill', '--radius-seat']
const SHADOWS = ['--shadow-sm', '--shadow-md', '--shadow-lg', '--glow-brand']
const DURATIONS = ['--dur-instant', '--dur-fast', '--dur-base', '--dur-panel', '--dur-page']
const EASINGS = ['--ease-out', '--ease-in-out', '--ease-emphasis']
const FONTS = [
  { token: '--font-display', sample: 'Your moment. Your seat.' },
  { token: '--font-ui', sample: 'Hold 2 seats · Row C, centre block' },
  { token: '--font-mono', sample: 'BK-7Q2X9A · 04:59' },
]

const ALL = [
  ...GROUPS.flatMap((g) => g.tokens),
  ...TYPE_SCALE, ...SPACING, ...RADII, ...SHADOWS, ...DURATIONS, ...EASINGS, ...FONTS.map((f) => f.token),
  '--seat-size', '--seat-gap', '--gutter', '--content-max',
]

/** WCAG relative luminance contrast for #rrggbb / rgb() values. */
function parseColor(v: string): [number, number, number] | null {
  const s = v.trim()
  const hex = s.match(/^#([0-9a-f]{6})$/i)
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const rgb = s.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}
function luminance([r, g, b]: [number, number, number]) {
  const f = (c: number) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrast(a: string, b: string): number | null {
  const ca = parseColor(a)
  const cb = parseColor(b)
  if (!ca || !cb) return null
  const [l1, l2] = [luminance(ca), luminance(cb)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

function readTokens(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement)
  return Object.fromEntries(ALL.map((t) => [t, cs.getPropertyValue(t).trim()]))
}

function bezierPath(value: string): string | null {
  const m = value.match(/cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/)
  if (!m) return null
  const [x1, y1, x2, y2] = m.slice(1, 5).map(Number) as [number, number, number, number]
  const S = 100
  const y = (v: number) => S - v * S
  return `M0 ${S} C ${x1 * S} ${y(y1)}, ${x2 * S} ${y(y2)}, ${S} 0`
}

const SEAT_STATES: { key: string; label: string; icon: IconName | null; desc: string }[] = [
  { key: 'available', label: 'Available', icon: null, desc: 'Outlined seat, tinted fill' },
  { key: 'selected', label: 'Selected', icon: 'check', desc: 'Solid lime + check' },
  { key: 'held', label: 'Held by others', icon: 'clock', desc: 'Amber diagonal stripes + clock' },
  { key: 'booked', label: 'Booked', icon: 'x', desc: 'Muted solid + cross' },
  { key: 'blocked', label: 'Blocked', icon: 'ban', desc: 'Crosshatch + no-entry' },
]

export function Design() {
  const { resolved } = useTheme()
  const [tokens, setTokens] = useState<Record<string, string>>({})

  useEffect(() => {
    // Re-read after the theme attribute is applied.
    const id = requestAnimationFrame(() => setTokens(readTokens()))
    return () => cancelAnimationFrame(id)
  }, [resolved])

  const v = (t: string) => tokens[t] ?? ''

  return (
    <div className="container page-pad design">
      <title>Design tokens · SeatLock</title>
      <meta name="description" content="SeatLock design tokens: colour, typography, spacing, radius, shadows and motion, shown with live values." />

      <header className="design-hero">
        <p className="eyebrow">System · {resolved} theme · live values</p>
        <h1>Design tokens</h1>
        <p>
          Every value below is read live from <code className="mono">src/styles/tokens.css</code> via computed styles.
          Toggle the theme in the header and watch them update.
        </p>
      </header>

      <nav className="design-toc" aria-label="Token sections">
        {['Colour', 'Typography', 'Spacing', 'Radius', 'Elevation', 'Motion', 'Seat states', 'Components'].map((s) => (
          <a key={s} href={`#${s.toLowerCase().replace(' ', '-')}`} className="chip">{s}</a>
        ))}
      </nav>

      <section id="colour" className="design-section" aria-labelledby="h-colour">
        <SectionHead id="h-colour" n="01" title="Colour" note="Text tokens show WCAG contrast against --bg (AA needs 4.5:1)." />
        {GROUPS.map((g) => (
          <div key={g.title} className="swatch-group">
            <h3>{g.title}</h3>
            <ul className="swatches">
              {g.tokens.map((t) => {
                const ratio = g.text ? contrast(v(t), v('--bg')) : null
                return (
                  <li key={t} className="swatch">
                    <span className="swatch-chip" style={{ background: `var(${t})` }}>
                      {g.text && <span style={{ color: `var(${t})`, background: 'var(--bg)' }} className="swatch-aa">Aa</span>}
                    </span>
                    <span className="swatch-meta">
                      <code className="mono">{t}</code>
                      <span className="mono swatch-value">{v(t) || '—'}</span>
                      {ratio !== null && (
                        <span className={`badge ${ratio >= 4.5 ? 'badge-ok' : 'badge-warn'}`}>
                          {ratio.toFixed(1)}:1 {ratio >= 4.5 ? 'AA' : 'large only'}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      <section id="typography" className="design-section" aria-labelledby="h-typography">
        <SectionHead id="h-typography" n="02" title="Typography" note="Space Grotesk for display, Inter for interface, system mono for codes and timers." />
        <div className="font-cards">
          {FONTS.map((f) => (
            <div key={f.token} className="card font-card">
              <code className="mono token-name">{f.token}</code>
              <p style={{ fontFamily: `var(${f.token})` }} className="font-sample">{f.sample}</p>
              <p className="mono token-value">{v(f.token).split(',')[0]}</p>
            </div>
          ))}
        </div>
        <ol className="type-scale">
          {TYPE_SCALE.map((t) => (
            <li key={t}>
              <span className="type-meta">
                <code className="mono token-name">{t}</code>
                <span className="mono token-value">{v(t)}</span>
              </span>
              <span className="type-sample" style={{ fontSize: `var(${t})`, fontFamily: t === '--text-display' || t === '--text-3xl' ? 'var(--font-display)' : undefined }}>
                {t === '--text-display' ? 'Seat.' : 'Front row energy'}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section id="spacing" className="design-section" aria-labelledby="h-spacing">
        <SectionHead id="h-spacing" n="03" title="Spacing" note="4px base grid. Gutter is fluid: clamp(1rem, …, 2.5rem)." />
        <ul className="space-list">
          {SPACING.map((t) => (
            <li key={t}>
              <code className="mono token-name">{t}</code>
              <span className="space-bar" style={{ width: `var(${t})` }} />
              <span className="mono token-value">{v(t)}</span>
            </li>
          ))}
        </ul>
        <p className="design-note mono">--seat-size {v('--seat-size')} · --seat-gap {v('--seat-gap')} · --gutter {v('--gutter')} · --content-max {v('--content-max')}</p>
      </section>

      <section id="radius" className="design-section" aria-labelledby="h-radius">
        <SectionHead id="h-radius" n="04" title="Radius" />
        <ul className="token-grid">
          {RADII.map((t) => (
            <li key={t} className="token-tile">
              <span className="radius-box" style={{ borderRadius: `var(${t})` }} />
              <code className="mono token-name">{t}</code>
              <span className="mono token-value">{v(t)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="elevation" className="design-section" aria-labelledby="h-elevation">
        <SectionHead id="h-elevation" n="05" title="Elevation & glow" />
        <ul className="token-grid">
          {SHADOWS.map((t) => (
            <li key={t} className="token-tile">
              <span className="shadow-box" style={{ boxShadow: `var(${t})` }} />
              <code className="mono token-name">{t}</code>
            </li>
          ))}
        </ul>
      </section>

      <section id="motion" className="design-section" aria-labelledby="h-motion">
        <SectionHead id="h-motion" n="06" title="Motion" note="Small interactions are quick; navigation is fluid; booking feedback is immediate. All durations collapse to 0 under prefers-reduced-motion." />
        <div className="motion-grid">
          <div className="card motion-card">
            <h3>Durations</h3>
            <ul className="dur-list">
              {DURATIONS.map((t) => {
                const ms = parseFloat(v(t)) || 0
                return (
                  <li key={t}>
                    <code className="mono token-name">{t}</code>
                    <span className="dur-track"><span className="dur-fill" style={{ width: `${Math.max(2, (ms / 520) * 100)}%` }} /></span>
                    <span className="mono token-value">{v(t)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="card motion-card">
            <h3>Easing curves</h3>
            <ul className="ease-list">
              {EASINGS.map((t) => {
                const d = bezierPath(v(t))
                return (
                  <li key={t}>
                    <svg viewBox="-6 -6 112 112" className="ease-svg" aria-hidden="true">
                      <rect x="0" y="0" width="100" height="100" className="ease-frame" />
                      {d && <path d={d} className="ease-path" />}
                    </svg>
                    <code className="mono token-name">{t}</code>
                    <span className="mono token-value">{v(t).replace('cubic-bezier', '')}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="card motion-card">
            <h3>Spring presets <span className="mono token-value">src/lib/motion.ts</span></h3>
            <table className="spring-table">
              <thead>
                <tr><th scope="col">Preset</th><th scope="col">Stiffness</th><th scope="col">Damping</th><th scope="col">Mass</th></tr>
              </thead>
              <tbody>
                {Object.entries(spring).map(([name, s]) => (
                  <tr key={name}>
                    <th scope="row" className="mono">spring.{name}</th>
                    <td className="mono">{s.stiffness}</td>
                    <td className="mono">{s.damping}</td>
                    <td className="mono">{'mass' in s ? s.mass : 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="design-note mono">
              JS durations: {Object.entries(duration).map(([k, d]) => `${k} ${d * 1000}ms`).join(' · ')}
              <br />
              JS eases: {Object.entries(ease).map(([k, e]) => `${k} [${e.join(', ')}]`).join(' · ')}
            </p>
          </div>
        </div>
      </section>

      <section id="seat-states" className="design-section" aria-labelledby="h-seat-states">
        <SectionHead id="h-seat-states" n="07" title="Seat states" note="Every state uses colour plus an icon or pattern, so it never relies on colour alone." />
        <ul className="seat-legend">
          {SEAT_STATES.map((s) => (
            <li key={s.key}>
              <span className={`demo-seat demo-seat-${s.key}`} aria-hidden="true">
                {s.icon && <Icon name={s.icon} size={18} />}
              </span>
              <span>
                <strong>{s.label}</strong>
                <span className="seat-desc">{s.desc}</span>
              </span>
            </li>
          ))}
          <li>
            <span className="demo-seat demo-seat-ai" aria-hidden="true"><Icon name="sparkle" size={18} /></span>
            <span><strong>AI suggestion</strong><span className="seat-desc">Dashed indigo ring + sparkle</span></span>
          </li>
        </ul>
      </section>

      <section id="components" className="design-section" aria-labelledby="h-components">
        <SectionHead id="h-components" n="08" title="Components" />
        <div className="component-grid">
          <div className="card comp-card">
            <h3>Buttons</h3>
            <div className="comp-row">
              <button type="button" className="btn btn-primary">Hold seats</button>
              <button type="button" className="btn btn-lime">Confirm</button>
              <button type="button" className="btn">Default</button>
              <button type="button" className="btn btn-ghost">Ghost</button>
              <button type="button" className="btn btn-danger">Cancel booking</button>
              <button type="button" className="btn btn-primary" disabled><span className="spinner" aria-hidden="true" />Holding…</button>
            </div>
          </div>
          <div className="card comp-card">
            <h3>Chips & badges</h3>
            <div className="comp-row">
              <button type="button" className="chip" aria-pressed="true">This week</button>
              <button type="button" className="chip" aria-pressed="false">Weekend</button>
              <span className="badge">Default</span>
              <span className="badge badge-ai"><Icon name="sparkle" size={12} />AI-generated</span>
              <span className="badge badge-ok">Confirmed</span>
              <span className="badge badge-warn">12 left</span>
              <span className="badge badge-muted">Cancelled</span>
            </div>
          </div>
          <div className="card comp-card">
            <h3>Input</h3>
            <div className="field">
              <label htmlFor="demo-input" className="field-label">College email</label>
              <input id="demo-input" className="input" placeholder="you@college.edu" />
            </div>
            <div className="field">
              <label htmlFor="demo-input-err" className="field-label">Password</label>
              <input id="demo-input-err" className="input" type="password" aria-invalid="true" aria-describedby="demo-err" defaultValue="123" />
              <p id="demo-err" className="field-error"><Icon name="alert" size={16} />Passwords are at least 6 characters.</p>
            </div>
          </div>
          <div className="card comp-card">
            <h3>Alerts</h3>
            <div className="alert" data-tone="info"><Icon name="info" size={18} /><span>Seats are held for 5 minutes.</span></div>
            <div className="alert" data-tone="warning"><Icon name="clock" size={18} /><span>1 minute left on your hold.</span></div>
            <div className="alert" data-tone="danger"><Icon name="alert" size={18} /><span>Seat C7 was just taken.</span></div>
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionHead({ id, n, title, note }: { id: string; n: string; title: string; note?: string }) {
  return (
    <div className="section-head">
      <span className="mono section-n">{n}</span>
      <h2 id={id}>{title}</h2>
      {note && <p>{note}</p>}
    </div>
  )
}
