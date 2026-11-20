import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function StatePanel({ icon, title, children, action, tone }: {
  icon: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
  tone?: 'error'
}) {
  return (
    <div className="state-panel" data-tone={tone} role={tone === 'error' ? 'alert' : undefined}>
      <span className="state-icon"><Icon name={icon} size={26} /></span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}
