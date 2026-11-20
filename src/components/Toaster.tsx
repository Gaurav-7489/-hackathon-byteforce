import { dismiss, useToasts, type ToastTone } from '../lib/toast'
import { Icon } from './Icon'

const ICON: Record<ToastTone, 'check' | 'alert' | 'info' | 'clock'> = { success: 'check', error: 'alert', warning: 'clock', info: 'info' }
const LABEL: Record<ToastTone, string> = { success: 'Done', error: 'Something went wrong', warning: 'Heads up', info: 'Note' }

/** Colour-coded messages: success (green), error (red), warning (amber), info (violet). */
export function Toaster() {
  const items = useToasts()
  return (
    <>
      <div className="toaster" role="region" aria-label="Notifications">
        {items.map((t) => (
          <div key={t.id} className="toast" data-tone={t.tone}>
            <span className="toast-icon" aria-hidden="true">
              <Icon name={ICON[t.tone]} size={16} />
            </span>
            <div className="toast-body">
              <span className="toast-kind">{LABEL[t.tone]}</span>
              <strong>{t.title}</strong>
              {t.description && <p>{t.description}</p>}
            </div>
            <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <Icon name="x" size={14} />
            </button>
            <span className="toast-timer" aria-hidden="true" style={{ animationDuration: t.tone === 'error' || t.tone === 'warning' ? '6.5s' : '4.2s' }} />
          </div>
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {items.filter((t) => t.tone === 'success' || t.tone === 'info').map((t) => `${t.title}. ${t.description ?? ''}`).at(-1)}
      </p>
      <p className="sr-only" role="alert">
        {items.filter((t) => t.tone === 'error' || t.tone === 'warning').map((t) => `${t.title}. ${t.description ?? ''}`).at(-1)}
      </p>
    </>
  )
}
