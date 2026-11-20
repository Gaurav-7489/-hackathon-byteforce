import { SeatLegend } from '../components/SeatMap'
import { Icon } from '../components/Icon'
import './design.css'

const COLORS = [
  ['--lk-canvas', 'Canvas', 'Page background'],
  ['--lk-surface', 'Surface', 'Cards, inputs'],
  ['--lk-elevated', 'Elevated', 'Tracks, chips, hovers'],
  ['--lk-ink', 'Ink', 'Text, primary buttons'],
  ['--lk-muted', 'Muted', 'Secondary text (≥ 4.5:1)'],
  ['--lk-line', 'Line', 'Borders, dividers'],
  ['--lk-signal', 'Signal', 'Your pick, pay, focus glow'],
  ['--lk-gain', 'Gain', 'Live, available, confirmed'],
  ['--lk-coral', 'Coral', 'Held by others, scarcity'],
  ['--lk-danger', 'Danger', 'Errors, destructive'],
  ['--lk-ai', 'AI', 'Assistant suggestions'],
] as const

const SEATS = [
  ['--seat-free', 'Available'],
  ['--seat-held', 'Held by others'],
  ['--seat-booked', 'Booked'],
  ['--seat-mine', 'Yours'],
  ['--seat-blocked', 'Blocked'],
] as const

const TYPE = [
  ['--text-display', 'Display', 'Condensed 800 · wdth 62', true],
  ['--text-3xl', '3XL', 'Page sections', true],
  ['--text-2xl', '2XL', 'Card titles', false],
  ['--text-xl', 'XL', 'Dialog titles', false],
  ['--text-lg', 'LG', 'Lead text', false],
  ['--text-md', 'MD', 'Body', false],
  ['--text-sm', 'SM', 'Meta, table text', false],
  ['--text-xs', 'XS', 'Labels', false],
] as const

const SPACE = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-6', '--space-8', '--space-12', '--space-16']
const RADII = [
  ['--radius-xs', 'XS'],
  ['--radius-sm', 'SM'],
  ['--lk-radius', 'Card'],
  ['--radius-lg', 'LG'],
  ['--radius-seat', 'Seat'],
  ['--radius-pill', 'Pill'],
] as const

function Palette({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className="ds-theme" data-theme={theme}>
      <p className="lk-eyebrow">{theme === 'light' ? 'Ledger · light' : 'Night · dark'}</p>
      <div className="ds-swatches">
        {COLORS.map(([v, name, use]) => (
          <div key={v} className="ds-swatch">
            <span style={{ background: `var(${v})` }} />
            <strong>{name}</strong>
            <code>{v}</code>
            <small>{use}</small>
          </div>
        ))}
      </div>
      <p className="lk-eyebrow" style={{ marginTop: 16 }}>
        Seat states
      </p>
      <div className="ds-swatches">
        {SEATS.map(([v, name]) => (
          <div key={v} className="ds-swatch">
            <span style={{ background: `var(${v})` }} />
            <strong>{name}</strong>
            <code>{v}</code>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Design() {
  return (
    <div className="container page ds">
      <title>Design tokens · SeatLock</title>
      <meta name="description" content="SeatLock design tokens: colour, typography, spacing, radius and seat states in light and dark." />
      <p className="lk-eyebrow">System</p>
      <h1 className="lk-display page-title">Design tokens</h1>
      <p className="ds-lead">Every screen is built from these variables in <code>src/styles/tokens.css</code>. Both themes are shown live; the header toggle switches the whole app.</p>

      <section aria-labelledby="ds-color">
        <h2 id="ds-color" className="ds-h">Colour</h2>
        <div className="ds-themes">
          <Palette theme="light" />
          <Palette theme="dark" />
        </div>
      </section>

      <section aria-labelledby="ds-type">
        <h2 id="ds-type" className="ds-h">Typography</h2>
        <p className="ds-lead">Archivo variable — one file; its width axis gives condensed display type and normal-width reading text.</p>
        <div className="ds-type lk-card">
          {TYPE.map(([v, name, use, display]) => (
            <div key={v} className="ds-type-row">
              <code>{v}</code>
              <span className={display ? 'lk-display' : undefined} style={{ fontSize: `var(${v})`, fontWeight: display ? 800 : 500 }}>
                {name === 'Display' ? 'Lock your seat.' : `${name} · Window seat, row F`}
              </span>
              <small>{use}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="ds-two">
        <section aria-labelledby="ds-space">
          <h2 id="ds-space" className="ds-h">Spacing</h2>
          <div className="ds-space lk-card">
            {SPACE.map((v) => (
              <div key={v}>
                <code>{v}</code>
                <span style={{ width: `var(${v})` }} />
              </div>
            ))}
          </div>
        </section>
        <section aria-labelledby="ds-radius">
          <h2 id="ds-radius" className="ds-h">Corner radius</h2>
          <div className="ds-radius">
            {RADII.map(([v, name]) => (
              <div key={v}>
                <span style={{ borderRadius: `var(${v})` }} />
                <strong>{name}</strong>
                <code>{v}</code>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section aria-labelledby="ds-comp">
        <h2 id="ds-comp" className="ds-h">Components</h2>
        <div className="ds-comp lk-card">
          <div className="ds-row">
            <button type="button" className="lk-btn lk-btn-primary">
              Primary
            </button>
            <button type="button" className="lk-btn lk-btn-signal">
              <Icon name="check" size={16} /> Signal
            </button>
            <button type="button" className="lk-btn">
              Secondary
            </button>
            <button type="button" className="lk-btn lk-btn-ghost">
              Ghost
            </button>
            <button type="button" className="lk-btn lk-btn-danger">
              Destructive
            </button>
            <button type="button" className="lk-btn" disabled>
              Disabled
            </button>
          </div>
          <div className="ds-row">
            <span className="badge badge-ok">Confirmed</span>
            <span className="badge badge-warn">1 min left</span>
            <span className="badge badge-ai">
              <Icon name="sparkle" size={12} /> AI-generated
            </span>
            <span className="tag">UA 13+</span>
            <button type="button" className="chip" aria-pressed="true">
              Selected chip
            </button>
            <button type="button" className="chip">
              Chip
            </button>
          </div>
          <div className="ds-row">
            <div className="alert" data-tone="success">
              <Icon name="check" size={18} /> Seats held for 5 minutes
            </div>
            <div className="alert" data-tone="warning">
              <Icon name="clock" size={18} /> Under a minute left
            </div>
            <div className="alert" data-tone="danger">
              <Icon name="alert" size={18} /> F7 was just taken
            </div>
          </div>
          <div className="ds-row">
            <SeatLegend kind="cinema" />
          </div>
          <p className="ds-lead">Seat states use colour <em>and</em> an icon or pattern: stripes + clock for held, a person for booked, crosshatch + ban for blocked, a check for your pick, a violet ring + sparkle for AI suggestions.</p>
        </div>
      </section>
    </div>
  )
}
