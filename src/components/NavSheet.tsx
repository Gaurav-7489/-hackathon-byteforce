import * as Dialog from '@radix-ui/react-dialog'
import { Link } from 'react-router'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { updateCampus, useCampus } from '../lib/campus/store'
import { Icon, type IconName } from './Icon'
import './navsheet.css'

interface Item { to: string; label: string; icon: IconName; hint: string }

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Discover & book',
    items: [
      { to: '/events', label: 'Events', icon: 'ticket', hint: 'Live seat maps, buddy seating, budget & comfort tools' },
      { to: '/discover', label: 'For you', icon: 'sparkle', hint: 'Explainable event matchmaker' },
      { to: '/waitlist', label: 'Waitlist', icon: 'queue', hint: 'Fair offers when seats are released' },
      { to: '/schedule', label: 'Schedule', icon: 'calendar', hint: 'Class & exam clash detection' },
    ],
  },
  {
    title: 'On the day',
    items: [
      { to: '/bookings', label: 'My bookings', icon: 'wallet', hint: 'Returns, splits and calendar' },
      { to: '/tickets', label: 'Offline tickets', icon: 'wifiOff', hint: 'Tickets that open without signal' },
      { to: '/campus', label: 'Campus map', icon: 'map', hint: 'Routes, gates and step-free paths' },
      { to: '/campus?tab=safety', label: 'SafeExit', icon: 'exit', hint: 'Exits & assembly points (illustrative)' },
    ],
  },
  {
    title: 'Grow & connect',
    items: [
      { to: '/pass', label: 'Opportunity pass', icon: 'award', hint: 'Workshops, skills and demo certificates' },
      { to: '/buddies', label: 'Event buddies', icon: 'heart', hint: 'Opt-in, anonymous companion matching' },
      { to: '/profile', label: 'Profile & preferences', icon: 'settings', hint: 'Accessibility, comfort, effects' },
    ],
  },
  {
    title: 'Organizer (demo role)',
    items: [
      { to: '/organizer', label: 'Overview', icon: 'chart', hint: 'Demand, conflicts, check-ins' },
      { to: '/organizer?tab=twin', label: 'Digital twin', icon: 'cube', hint: '3D venue occupancy' },
      { to: '/organizer?tab=crowd', label: 'Crowd heatmap', icon: 'flame', hint: 'Gate load & redirects' },
      { to: '/organizer?tab=load', label: 'Load & FairQueue lab', icon: 'users', hint: '100 simulated students' },
    ],
  },
]

export function NavSheet({ mode, onClose, onSignOut }: { mode: 'menu' | 'notifications'; onClose: () => void; onSignOut: () => void }) {
  const { user } = useAuth()
  const notifications = useCampus((s) => s.notifications)
  const { resolved, toggle } = useTheme()
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="sheet" aria-describedby={undefined}>
          <div className="sheet-head">
            <Dialog.Title className="sheet-title">{mode === 'menu' ? 'Everything in SeatLock' : 'Notifications'}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label="Close"><Icon name="x" size={18} /></button>
            </Dialog.Close>
          </div>

          {mode === 'menu' ? (
            <nav aria-label="All features" className="sheet-body">
              {user && <p className="sheet-user"><Icon name="user" size={16} /> {user.name}{user.role === 'organizer' ? ' · organizer demo' : ''}</p>}
              {GROUPS.map((g) => (
                <div key={g.title} className="sheet-group">
                  <h2 className="sheet-group-title">{g.title}</h2>
                  <ul className="sheet-list">
                    {g.items.map((i) => (
                      <li key={i.to}>
                        <Link to={i.to} className="sheet-link" onClick={onClose}>
                          <span className="sheet-link-icon"><Icon name={i.icon} size={18} /></span>
                          <span className="sheet-link-copy"><span>{i.label}</span><span className="sheet-link-hint">{i.hint}</span></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-block" onClick={toggle}><Icon name={resolved === 'dark' ? 'sun' : 'moon'} size={16} /> Switch to {resolved === 'dark' ? 'light' : 'dark'} mode</button>
              <button type="button" className="btn btn-ghost btn-block" onClick={onSignOut}><Icon name="logout" size={16} /> Sign out</button>
            </nav>
          ) : (
            <div className="sheet-body">
              {notifications.length === 0 ? (
                <p className="muted small">Nothing yet. Waitlist offers, reminders and returns will appear here.</p>
              ) : (
                <>
                  <div className="row-wrap">
                    <button type="button" className="btn btn-ghost" onClick={() => updateCampus((d) => { d.notifications.forEach((n) => { n.read = true }) })}>Mark all read</button>
                    <button type="button" className="btn btn-ghost" onClick={() => updateCampus((d) => { d.notifications = [] })}>Clear</button>
                  </div>
                  <ul className="ntf-list" aria-label="Notifications">
                    {notifications.map((n) => (
                      <li key={n.id} className="ntf" data-unread={!n.read || undefined}>
                        <p className="ntf-title">{!n.read && <span className="sr-only">Unread: </span>}{n.title}</p>
                        <p className="ntf-body">{n.body}</p>
                        <p className="ntf-meta">
                          <time dateTime={n.at}>{new Date(n.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</time>
                          {n.href && <Link to={n.href} onClick={() => { updateCampus((d) => { const x = d.notifications.find((y) => y.id === n.id); if (x) x.read = true }); onClose() }}>Open</Link>}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
