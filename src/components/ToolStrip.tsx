import { Suspense, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { Icon } from './Icon'
import { FEATURES, type FeatureMeta } from '../features/catalog'
import { TOOLS } from '../features/tools'
import { useLang } from '../lib/i18n'
import { photo } from '../lib/photos'
import { canSpeak, narrate, speak } from '../lib/speech'
import { sfx } from '../lib/sound'
import '../routes/smart.css'

/**
 * Smart tools live inside the booking flow: a row of tool chips on the seat
 * page and on My tickets. Each opens its working tool in a dialog, in place.
 */
export function ToolStrip({ ids, title, hiTitle }: { ids?: string[]; title: string; hiTitle: string }) {
  const lang = useLang()
  const hi = lang === 'hi'
  const [open, setOpen] = useState<string | null>(null)
  const list = ids ? ids.map((id) => FEATURES.find((f) => f.id === id)!).filter(Boolean) : FEATURES
  const f = FEATURES.find((x) => x.id === open) ?? null
  return (
    <section className="tool-strip lk-card" aria-labelledby={`ts-${title}`}>
      <h2 id={`ts-${title}`} className="tool-strip-title">
        <Icon name="sparkle" size={16} /> {hi ? hiTitle : title}
      </h2>
      <ul className="tool-strip-list">
        {list.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className="tool-chip"
              onClick={() => {
                sfx.tap()
                setOpen(t.id)
                narrate(hi ? `${t.hi.title}. ${t.hi.line}` : `${t.en.title}. ${t.en.solution}`, lang)
              }}
            >
              <img src={photo(t.photo)} alt="" loading="lazy" />
              <span>
                <strong>{hi ? t.hi.title : t.en.title}</strong>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {f && <ToolDialog f={f} hi={hi} onClose={() => setOpen(null)} />}
    </section>
  )
}

export function ToolDialog({ f, hi, onClose }: { f: FeatureMeta; hi: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const Tool = TOOLS[f.id]!
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    return () => d?.close()
  }, [f.id])
  const said = hi ? `${f.hi.title}. ${f.hi.line}` : `${f.en.title}. ${f.en.problem} ${f.en.solution}`
  return (
    <dialog ref={ref} className="dialog smart-dialog" aria-labelledby="tool-title" onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <header className="smart-hero">
        <img src={photo(f.photo)} alt="" />
        <span className="smart-hero-shade" aria-hidden="true" />
        <div className="smart-hero-actions">
          {canSpeak() && (
            <button type="button" className="smart-hero-btn" aria-label={hi ? 'सुनें' : 'Listen'} onClick={() => speak(said, hi ? 'hi' : 'en')}>
              <Icon name="volume" size={18} />
            </button>
          )}
          <button type="button" className="smart-hero-btn" aria-label={hi ? 'बंद करें' : 'Close'} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="smart-hero-text">
          <span className="smart-hero-n lk-num">
            <Icon name={f.icon} size={16} /> {f.n}
            {f.badge && <em>{hi ? (f.badge === 'Priority' ? 'प्राथमिक' : 'ख़ास') : f.badge}</em>}
          </span>
          <h2 id="tool-title">{hi ? f.hi.title : f.en.title}</h2>
        </div>
      </header>
      <div className="smart-dialog-body">
        <dl className="smart-ps">
          <div data-k="problem">
            <dt>
              <Icon name="alert" size={14} /> {hi ? 'समस्या' : 'Problem'}
            </dt>
            <dd>{f.en.problem}</dd>
          </div>
          <div data-k="solution">
            <dt>
              <Icon name="check" size={14} /> {hi ? 'समाधान' : 'Solution'}
            </dt>
            <dd>{hi ? f.hi.line : f.en.solution}</dd>
          </div>
        </dl>
        <ErrorBoundary section="this tool" compact>
          <Suspense fallback={<p className="tool-loading">Loading…</p>}>
            <Tool />
          </Suspense>
        </ErrorBoundary>
      </div>
    </dialog>
  )
}
