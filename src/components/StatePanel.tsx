import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/** Empty / error / success state with an optional action. */
export function StatePanel({ icon, title, children, action, tone }: { icon: IconName; title: string; children: ReactNode; action?: ReactNode; tone?: 'error' }) {
  return (
    <div className="state-panel" data-tone={tone} role={tone === 'error' ? 'alert' : undefined}>
      <span className="state-icon" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  )
}
