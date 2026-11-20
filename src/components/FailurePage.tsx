import type { ReactNode } from 'react'
import { Icon } from './Icon'

/** Shared layout for 404, crash, booking-failed and offline pages: big code, clear cause, next steps. */
export function FailurePage({
  code,
  tone = 'error',
  title,
  children,
  actions,
  details,
}: {
  code: string
  tone?: 'error' | 'warning' | 'info'
  title: string
  children: ReactNode
  actions: ReactNode
  details?: ReactNode
}) {
  return (
    <div className="container page fail" data-tone={tone}>
      <div className="fail-card">
        <div className="fail-art" aria-hidden="true">
          <span className="fail-code lk-num">{code}</span>
          <svg viewBox="0 0 120 70" className="fail-seats">
            {[0, 1, 2, 3].map((i) => (
              <g key={i} transform={`translate(${8 + i * 28} 18)`} opacity={i === 2 ? 1 : 0.35}>
                <rect width="22" height="20" rx="5" />
                <rect y="22" width="22" height="7" rx="3" />
              </g>
            ))}
          </svg>
        </div>
        <div className="fail-copy">
          <span className="fail-kind">
            <Icon name={tone === 'info' ? 'info' : 'alert'} size={14} /> {tone === 'warning' ? 'Heads up' : tone === 'info' ? 'Not found' : 'Something went wrong'}
          </span>
          <h1 className="lk-display fail-title">{title}</h1>
          <div className="fail-body">{children}</div>
          <div className="fail-actions">{actions}</div>
          {details && <details className="fail-details">{details}</details>}
        </div>
      </div>
    </div>
  )
}
