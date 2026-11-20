import { createPortal } from 'react-dom'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { Icon } from './Icon'
import { FEATURES, type FeatureMeta } from '../features/catalog'
import { TOOLS } from '../features/tools'
import { useLang } from '../lib/i18n'
import { photo } from '../lib/photos'
import { canSpeak, narrate, speak } from '../lib/speech'
import { sfx } from '../lib/sound'
import { setToolHighlight, useToolEvent } from '../lib/toolBridge'
import '../routes/smart.css'

/**
 * A smart tool opened from the place it belongs: a small button that opens
 * the working tool in a dialog, right there in the flow.
 */
export function ToolButton({ id, label, hi: hiLabel, look = 'chip' }: { id: string; label: string; hi: string; look?: 'chip' | 'link' }) {
  const lang = useLang()
  const hi = lang === 'hi'
  const [open, setOpen] = useState(false)
  const f = FEATURES.find((x) => x.id === id)!
  return (
    <>
      <button
        type="button"
        className={look === 'link' ? 'tool-link' : 'tool-chip'}
        onClick={() => {
          sfx.tap()
          setOpen(true)
          narrate(hi ? `${f.hi.title}. ${f.hi.line}` : `${f.en.title}. ${f.en.solution}`, lang)
        }}
      >
        <Icon name={f.icon} size={look === 'link' ? 14 : 16} />
        <span>{hi ? hiLabel : label}</span>
      </button>
      {/* Portal: the dialog must not live inside a column the docked layout hides. */}
      {open && createPortal(<ToolDialog f={f} hi={hi} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

/** A labelled row of tool buttons, e.g. “Find the right seat”. */
export function ToolRow({ title, hi, children }: { title: string; hi: string; children: ReactNode }) {
  const lang = useLang()
  return (
    <div className="tool-row-inline" role="group" aria-label={lang === 'hi' ? hi : title}>
      <span className="tool-row-label">
        <Icon name="sparkle" size={14} /> {lang === 'hi' ? hi : title}
      </span>
      {children}
    </div>
  )
}

// Only one docked panel at a time: opening another closes the previous one.
let closeDocked: (() => void) | null = null

export function ToolDialog({ f, hi, onClose }: { f: FeatureMeta; hi: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const Tool = TOOLS[f.id]!
  // On the seat page the tool docks beside the 3D view (non-modal) so its seats can be seen there.
  const docked = useToolEvent() !== null
  useEffect(() => {
    const d = ref.current
    if (!d || d.open) return
    if (docked) {
      if (closeDocked) closeDocked()
      closeDocked = onClose
      document.body.classList.add('tool-docked')
      d.show()
    } else d.showModal()
    const onKey = (e: KeyboardEvent) => docked && e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (closeDocked === onClose) closeDocked = null
      setToolHighlight(null)
      if (docked) document.body.classList.remove('tool-docked')
      d.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.id, docked])
  const said = hi ? `${f.hi.title}. ${f.hi.line}` : `${f.en.title}. ${f.en.problem} ${f.en.solution}`
  return (
    <dialog ref={ref} className={`dialog smart-dialog${docked ? ' is-docked' : ''}`} aria-labelledby="tool-title" onClose={onClose} onClick={(e) => !docked && e.target === e.currentTarget && onClose()}>
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
