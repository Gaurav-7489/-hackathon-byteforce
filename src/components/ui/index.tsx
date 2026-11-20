import type { ReactNode } from 'react'
import { Icon, type IconName } from '../Icon'
import './ui.css'

/** Shared building blocks for the campus screens. Plain DOM + CSS: no animation cost. */

export function PageHead({ eyebrow, title, lead, actions, icon }: { eyebrow?: string; title: string; lead?: ReactNode; actions?: ReactNode; icon?: IconName }) {
  return (
    <header className="ph">
      <div className="ph-copy">
        {eyebrow && <p className="ph-eyebrow">{icon && <Icon name={icon} size={14} />}{eyebrow}</p>}
        <h1 className="ph-title">{title}</h1>
        {lead && <p className="ph-lead">{lead}</p>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </header>
  )
}

/** Marks anything driven by simulated or demo data. Required wherever results could be mistaken for real. */
export function SimBadge({ children = 'Simulated', title }: { children?: ReactNode; title?: string }) {
  return (
    <span className="sim-badge" title={title}>
      <Icon name="info" size={12} />
      {children}
    </span>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label className="toggle" data-disabled={disabled || undefined}>
      <span className="toggle-copy">
        <span className="toggle-label">{label}</span>
        {description && <span className="toggle-desc">{description}</span>}
      </span>
      <input type="checkbox" role="switch" className="toggle-input" checked={checked} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
    </label>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label, size }: {
  value: T
  options: readonly { value: T; label: string; icon?: IconName }[]
  onChange: (v: T) => void
  label: string
  size?: 'sm'
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label} data-size={size}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="seg-btn"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
            e.preventDefault()
            const i = options.findIndex((x) => x.value === value)
            const next = options[(i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length]
            if (next) {
              onChange(next.value)
              const group = e.currentTarget.parentElement
              requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus())
            }
          }}
          tabIndex={o.value === value ? 0 : -1}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, hint, tone, icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'ok' | 'warn' | 'danger' | 'brand'; icon?: IconName }) {
  return (
    <div className="stat" data-tone={tone}>
      <span className="stat-label">{icon && <Icon name={icon} size={14} />}{label}</span>
      <span className="stat-value num">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}

export function Sparkline({ data, label, height = 44, projection = [] }: { data: readonly number[]; label: string; height?: number; projection?: readonly number[] }) {
  const all = [...data, ...projection]
  if (all.length < 2) return <div className="spark-empty" role="img" aria-label={`${label}: not enough data yet`}>Collecting data…</div>
  const w = 200
  const max = Math.max(...all, 1)
  const min = Math.min(...all, 0)
  const x = (i: number) => (i / (all.length - 1)) * w
  const y = (v: number) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8)
  const path = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const proj = projection.length
    ? [`M${x(data.length - 1).toFixed(1)} ${y(data.at(-1) ?? 0).toFixed(1)}`, ...projection.map((v, i) => `L${x(data.length + i).toFixed(1)} ${y(v).toFixed(1)}`)].join(' ')
    : ''
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${label}: from ${data[0]} to ${data.at(-1)}${projection.length ? `, forecast ${Math.round(projection.at(-1) ?? 0)}` : ''}`}>
      <path d={`${path} L${x(data.length - 1)} ${height} L0 ${height} Z`} className="spark-fill" />
      <path d={path} className="spark-line" />
      {proj && <path d={proj} className="spark-proj" />}
    </svg>
  )
}

export function Bars({ data, label, unit = '' }: { data: readonly { label: string; value: number; tone?: 'ok' | 'warn' | 'danger' | 'brand' | 'muted' }[]; label: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="bars" aria-label={label}>
      {data.map((d) => (
        <li key={d.label} className="bar" data-tone={d.tone}>
          <span className="bar-label">{d.label}</span>
          <span className="bar-track" aria-hidden="true"><span className="bar-fill" style={{ transform: `scaleX(${d.value / max})` }} /></span>
          <span className="bar-value num">{d.value}{unit}</span>
        </li>
      ))}
    </ul>
  )
}

export function Meter({ value, max = 1, label, tone }: { value: number; max?: number; label: string; tone?: 'ok' | 'warn' | 'danger' | 'brand' }) {
  const pct = Math.max(0, Math.min(1, value / max))
  return (
    <div className="meter" data-tone={tone} role="meter" aria-label={label} aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span className="meter-fill" style={{ transform: `scaleX(${pct})` }} />
    </div>
  )
}

export function Card({ title, icon, actions, children, className, badge }: { title?: string; icon?: IconName; actions?: ReactNode; children: ReactNode; className?: string; badge?: ReactNode }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || actions) && (
        <div className="panel-head">
          {title && <h2 className="panel-title">{icon && <Icon name={icon} size={18} />}{title}</h2>}
          {badge}
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Empty({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <p className="empty-title">{title}</p>
      {children && <p className="empty-body">{children}</p>}
      {action}
    </div>
  )
}
