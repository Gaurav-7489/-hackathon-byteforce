import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { Card, PageHead, Toggle } from '../components/ui'
import { usingMock } from '../lib/api/client'
import { useAuth } from '../lib/auth'
import { resetCampus, updateCampus, useCampus } from '../lib/campus/store'
import type { AccessibilityPreference, ComfortPreference } from '../lib/campus/types'
import { useTheme } from '../lib/theme'
import './campus.css'

const ACCESS: [keyof AccessibilityPreference, string][] = [
  ['wheelchair', 'Wheelchair space'], ['companion', 'Companion seat'], ['stepFree', 'Step-free access'], ['easyExit', 'Easy entry and exit'],
  ['shortWalk', 'Less walking'], ['lowStimulation', 'Lower-stimulation area'], ['clearSightline', 'Clear sightline'], ['accessibleRestroom', 'Accessible restroom nearby'],
]
const COMFORT: [keyof ComfortPreference, string][] = [
  ['quieter', 'Quieter zones'], ['lessCrowded', 'Less crowded'], ['easyExit', 'Easy exit'], ['lowNoise', 'Lower noise'], ['personalSpace', 'Personal space'],
]

export function Profile() {
  const { user } = useAuth()
  const prefs = useCampus((s) => s.prefs)
  const { pref, setPref } = useTheme()
  const [confirmReset, setConfirmReset] = useState(false)
  return (
    <div className="container page-pad">
      <title>Profile & preferences · SeatLock</title>
      <PageHead eyebrow={user?.role === 'organizer' ? 'Organizer demo account' : 'Student profile'} icon="user" title={user?.name ?? 'Your profile'} lead={<>{user?.email} · Preferences are stored only in this browser — not a secure or synced database.</>} />
      <div className="grid-2">
        <Card title="Accessibility" icon="access">
          <p className="small muted">Optional. Used only to recommend seats and routes. We never ask for medical details.</p>
          <div className="toggle-grid">{ACCESS.map(([k, l]) => <Toggle key={k} label={l} checked={prefs.access[k]} onChange={(v) => updateCampus((d) => { d.prefs.access[k] = v })} />)}</div>
        </Card>
        <Card title="Comfort (QuietZone)" icon="volume">
          <div className="toggle-grid">{COMFORT.map(([k, l]) => <Toggle key={k} label={l} checked={prefs.comfort[k]} onChange={(v) => updateCampus((d) => { d.prefs.comfort[k] = v })} />)}</div>
        </Card>
        <Card title="Performance & display" icon="settings">
          <Toggle checked={prefs.reducedEffects} onChange={(v) => updateCampus((d) => { d.prefs.reducedEffects = v })} label="Reduce visual effects" description="Turns off 3D scenes, blur and decorative animation. Good for older phones and slow data." />
          <label className="field"><span className="field-label">Theme</span>
            <select className="select" value={pref} onChange={(e) => setPref(e.currentTarget.value as typeof pref)}>
              <option value="system">Match device</option><option value="dark">Dark</option><option value="light">Light</option>
            </select>
          </label>
          <Toggle checked={prefs.reminders} onChange={(v) => updateCampus((d) => { d.prefs.reminders = v })} label="Arrival reminders" description="In-app, plus a system notification if you allow it." />
        </Card>
        <Card title="Your data" icon="shield">
          <ul className="list-plain small">
            <li><Link to="/schedule">Schedule</Link> · <Link to="/waitlist">Waitlist</Link> · <Link to="/tickets">Offline tickets</Link> · <Link to="/buddies">Buddy privacy</Link></li>
          </ul>
          {usingMock && <p className="small muted">Resetting clears campus preferences, schedule, waitlist, vault and demo bookings, and re-seeds the mock venue.</p>}
          <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}><Icon name="refresh" size={16} /> Reset demo data</button>
        </Card>
      </div>
      <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset} title="Reset all demo data?" description="This clears everything stored by SeatLock in this browser and reloads the app." confirmLabel="Reset" cancelLabel="Cancel" onConfirm={async () => {
        resetCampus()
        if (usingMock) (await import('../lib/api/mock/server')).resetMockDb()
        toast.success('Demo data reset')
        location.reload()
      }} />
    </div>
  )
}
