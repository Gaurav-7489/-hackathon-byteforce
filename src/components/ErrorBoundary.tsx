import { Component, type ErrorInfo, type ReactNode } from 'react'
import { friendlyMessage } from '../lib/api/errors'
import { Icon } from './Icon'

interface Props {
  children: ReactNode
  /** Short name of the isolated section, used in the message. */
  section: string
  onReset?: () => void
  compact?: boolean
}
interface State {
  error: unknown
}

/** Isolates a major section so one failure never blanks the page. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[SeatLock] ${this.props.section} crashed`, error, info.componentStack)
  }

  reset = () => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  override render() {
    if (this.state.error === null) return this.props.children
    return (
      <div className="state-panel" data-tone="error" role="alert" style={this.props.compact ? { padding: 24 } : undefined}>
        <span className="state-icon">
          <Icon name="alert" size={26} />
        </span>
        <h2>Couldn’t load {this.props.section}</h2>
        <p>{friendlyMessage(this.state.error)}</p>
        <button type="button" className="lk-btn lk-btn-primary" onClick={this.reset}>
          <Icon name="refresh" size={18} /> Retry
        </button>
      </div>
    )
  }
}
