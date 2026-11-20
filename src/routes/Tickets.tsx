import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { Empty, PageHead, SimBadge } from '../components/ui'
import { QrPlaceholder } from '../components/Ticket'
import { useOnline } from '../hooks/useOnline'
import { api } from '../lib/api/client'
import { saveToVault } from '../lib/campus/engine'
import { useCampus } from '../lib/campus/store'
import { dateLong, money, time } from '../lib/format'
import './campus.css'

/**
 * Offline Ticket Vault. Works with no network once the app shell has been
 * cached by the service worker. Tickets shown here are a *local copy*: they are
 * not cryptographically signed and offer no anti-replay protection. Entry is
 * validated by the organizer's scanner, not by this screen.
 */
export function Tickets() {
  const vault = useCampus((s) => s.vault)
  const online = useOnline()
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!online) return
    let live = true
    setSyncing(true)
    api.bookings()
      .then((bs) => {
        if (!live) return
        bs.filter((b) => b.status === 'confirmed' && Date.parse(b.event.startsAt) + b.event.durationMinutes * 60_000 > Date.now()).forEach(saveToVault)
        setSyncedAt(new Date().toISOString())
      })
      .catch(() => {})
      .finally(() => { if (live) setSyncing(false) })
    return () => { live = false }
  }, [online])

  const upcoming = [...vault].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  return (
    <div className="container page-pad">
      <title>Offline tickets · SeatLock</title>
      <PageHead eyebrow="Offline ticket vault" icon="wifiOff" title="Your tickets, even with no signal" lead="Tickets you’ve opened are saved on this device so they still open at a crowded gate with no network." />
      <div className="vault-status" role="status" data-online={online || undefined}>
        <Icon name={online ? 'check' : 'wifiOff'} size={16} />
        {online ? (syncing ? 'Online — syncing your tickets…' : `Online — up to date${syncedAt ? ` (${time(syncedAt)})` : ''}`) : 'Offline — showing tickets saved on this device'}
      </div>
      <div className="alert" data-tone="warning" role="note" style={{ marginBottom: 'var(--space-6)' }}>
        <Icon name="shield" size={18} />
        <div><strong>Locally displayed ticket — not proof of entry</strong>The QR below is a placeholder generated on your phone. It isn’t signed, can be copied, and is only valid once the organizer’s scanner checks your booking ID against their system.</div>
      </div>
      {upcoming.length === 0 ? (
        <Empty icon="ticket" title="No saved tickets yet" action={<Link className="btn btn-primary" to="/events">Find an event</Link>}>{online ? 'Book seats and they’ll be saved here automatically.' : 'Connect once to save your tickets for offline use.'}</Empty>
      ) : (
        <div className="vault">
          {upcoming.map((t) => (
            <article key={t.bookingId} className="vault-card card" aria-label={`Ticket ${t.bookingId}, ${t.title}`}>
              <div className="vault-main">
                <p className="ph-eyebrow">{dateLong(t.startsAt)} · {time(t.startsAt)}</p>
                <h2 className="panel-title">{t.title}</h2>
                <p className="muted small">{t.venue}</p>
                <dl className="vault-facts">
                  <div><dt>Seats</dt><dd className="num">{t.seats.join(', ')}</dd></div>
                  <div><dt>Paid</dt><dd className="num">{money(t.total)}</dd></div>
                  <div><dt>Booking</dt><dd className="num">{t.bookingId}</dd></div>
                </dl>
                <div className="row-wrap">
                  <Link className="btn btn-ghost" to={`/campus?venue=${encodeURIComponent(t.venue)}`}><Icon name="route" size={16} /> Route</Link>
                  <Link className="btn btn-ghost" to={`/campus?tab=safety&venue=${encodeURIComponent(t.venue)}`}><Icon name="exit" size={16} /> Exits</Link>
                </div>
              </div>
              <div className="vault-qr">
                <QrPlaceholder seed={t.bookingId} />
                <SimBadge>Not validated</SimBadge>
                <span className="tiny muted">Saved {new Date(t.savedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
