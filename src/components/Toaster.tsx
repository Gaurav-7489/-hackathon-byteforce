import { dismiss, useToasts } from '../lib/toast'
import { Icon } from './Icon'

/** Success / failure toasts. Errors and warnings are announced assertively. */
export function Toaster() {
  const items = useToasts()
  return (
    <>
      <div className="toaster" role="region" aria-label="Notifications">
        {items.map((t) => (
          <div key={t.id} className="toast" data-tone={t.tone}>
            <span className="toast-dot" aria-hidden="true" />
            <div>
              <strong>{t.title}</strong>
              {t.description && <p>{t.description}</p>}
            </div>
            <button type="button" className="lk-icon-btn" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <Icon name="x" size={14} />
            </button>
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
