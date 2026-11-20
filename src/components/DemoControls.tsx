import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { demoControls, resetMockDb, stealSeat } from '../lib/api/mock/server'
import { demoBridge } from '../lib/demoBridge'
import { spring } from '../lib/motion'
import { Icon } from './Icon'

/**
 * Presenter panel (mock-API mode only) to trigger the PDF's edge cases on cue
 * during the 8-minute demo. Hidden entirely when VITE_API_BASE_URL is set.
 */
export function DemoControls() {
  const [open, setOpen] = useState(false)
  // Mirror the mutable mock settings in React state: the React Compiler memoises
  // reads of module-level objects, so mutation alone would never re-render.
  const [ctl, setCtl] = useState(() => ({ ...demoControls }))
  const set = <K extends keyof typeof demoControls>(k: K, v: (typeof demoControls)[K], msg: string) => {
    demoControls[k] = v
    setCtl({ ...demoControls })
    toast.info(msg)
  }
  return (
    <div className="demo">
      <button type="button" className="demo-fab" aria-label="Demo controls" aria-expanded={open} aria-controls="demo-panel" onClick={() => setOpen((o) => !o)}>
        <Icon name="wand" size={18} /> <span aria-hidden="true">Demo</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div id="demo-panel" className="demo-panel glass" role="region" aria-label="Demo controls" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} transition={spring.soft}>
            <p className="eyebrow">Simulate the rush (mock API)</p>
            <button type="button" className="btn btn-block" onClick={() => {
              const target = demoBridge.selected[0]
              if (!demoBridge.eventId || !target) { toast.error('Select a seat on a seat map first'); return }
              stealSeat(demoBridge.eventId, target)
              toast.info(`Another student just grabbed ${target}`, { description: 'The next availability refresh will catch it.' })
            }}>Steal my first selected seat</button>
            <button type="button" className="btn btn-block" onClick={() => set('forceConflictNext', true, 'Next hold will hit a conflict')}>Force conflict on next hold</button>
            <button type="button" className="btn btn-block" onClick={() => set('shortHoldNext', true, 'Next hold lasts 75 seconds')}>Next hold lasts 75 s</button>
            <button type="button" className="btn btn-block" onClick={() => set('aiSlowNext', true, 'Next AI request will exceed 8 s')}>AI: slow next reply (timeout)</button>
            <button type="button" className="btn btn-block" onClick={() => set('aiStaleNext', true, 'Next AI reply includes a taken seat')}>AI: include a taken seat</button>
            <label className="demo-toggle">
              <input type="checkbox" checked={ctl.latency === 'fast'} onChange={(e) => set('latency', e.currentTarget.checked ? 'fast' : 'realistic', e.currentTarget.checked ? 'Fast network' : 'Realistic 2–3 s latency')} />
              Fast network (skip 2–3 s delays)
            </label>
            <label className="demo-toggle">
              <input type="checkbox" checked={ctl.failures} onChange={(e) => set('failures', e.currentTarget.checked, e.currentTarget.checked ? 'Random failures on (1 in 20)' : 'Random failures off')} />
              Random failures (1 in 20)
            </label>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => { resetMockDb(); location.reload() }}>Reset demo data</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
