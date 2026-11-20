import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Icon } from '../components/Icon'
import { FEATURES, type FeatureMeta } from '../features/catalog'
import { TOOLS } from '../features/tools'
import { useLang } from '../lib/i18n'
import { canSpeak, speak, stopSpeaking } from '../lib/speech'
import { sfx } from '../lib/sound'
import './smart.css'

/** All 20 SeatLock smart features. Each card opens a working tool. */
export function Smart() {
  const lang = useLang()
  const [params, setParams] = useSearchParams()
  const openId = params.get('f')
  const open = FEATURES.find((f) => f.id === openId) ?? null
  const hi = lang === 'hi'

  const show = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('f', id)
    else next.delete('f')
    setParams(next, { replace: !id })
    if (id) sfx.tap()
    else stopSpeaking()
  }

  return (
    <div className="container page smart">
      <title>{hi ? 'स्मार्ट टूल · SeatLock' : 'Smart tools · SeatLock'}</title>
      <meta name="description" content="Twenty smart booking tools: group seats, fair queue, accessibility, waitlist, budget, safety and more." />
      <header className="smart-head">
        <p className="lk-eyebrow">{hi ? '20 स्मार्ट सुविधाएँ' : '20 smart features'}</p>
        <h1 className="lk-display page-title">{hi ? 'हर ज़रूरत के लिए एक टूल' : 'A tool for every booking problem'}</h1>
      </header>
      <ul className="smart-grid">
        {FEATURES.map((f) => (
          <li key={f.id}>
            <button type="button" className="smart-card" onClick={() => show(f.id)} aria-haspopup="dialog">
              <span className="smart-n lk-num">{f.n}</span>
              {f.badge && <span className="smart-badge" data-b={f.badge}>{hi ? (f.badge === 'Priority' ? 'प्राथमिक' : 'ख़ास') : f.badge}</span>}
              <span className="smart-icon" aria-hidden="true">
                <Icon name={f.icon} size={22} />
              </span>
              <strong>{hi ? f.hi.title : f.en.title}</strong>
              <span className="smart-line">{hi ? f.hi.line : f.en.solution}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && <ToolDialog f={open} hi={hi} onClose={() => show(null)} />}
    </div>
  )
}

function ToolDialog({ f, hi, onClose }: { f: FeatureMeta; hi: boolean; onClose: () => void }) {
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
      <div className="smart-dialog-body">
        <header className="smart-dialog-head">
          <span className="smart-n lk-num">{f.n}</span>
          <h2 id="tool-title">{hi ? f.hi.title : f.en.title}</h2>
          {canSpeak() && (
            <button type="button" className="lk-icon-btn" aria-label={hi ? 'सुनें' : 'Listen'} onClick={() => speak(said, hi ? 'hi' : 'en')}>
              <Icon name="volume" size={18} />
            </button>
          )}
          <button type="button" className="lk-icon-btn" aria-label={hi ? 'बंद करें' : 'Close'} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </header>
        <dl className="smart-ps">
          <div>
            <dt>{hi ? 'समस्या' : 'Problem'}</dt>
            <dd>{f.en.problem}</dd>
          </div>
          <div>
            <dt>{hi ? 'समाधान' : 'Solution'}</dt>
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
