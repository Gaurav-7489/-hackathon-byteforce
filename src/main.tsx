import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller)
    // A new worker took over after a deploy: offer a reload instead of silently mixing versions.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) window.dispatchEvent(new Event('seatlock:sw-updated'))
    })
    void navigator.serviceWorker.register('/sw.js').then(() => {
      // Warm the offline ticket vault's chunk so it opens with no signal later.
      const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
      if (nav.connection?.saveData) return
      const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000))
      idle(() => { void import('./routes/Tickets').catch(() => {}) })
    }).catch(() => {})
  })
}
