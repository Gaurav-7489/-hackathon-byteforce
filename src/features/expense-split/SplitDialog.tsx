import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '../../components/Icon'
import { Segmented, Toggle } from '../../components/ui'
import type { Booking } from '../../lib/api/types'
import { computeSplit, outstanding, splitSummaryText, validateSplit } from '../../lib/campus/algorithms/planning'
import { getCampus, uid, updateCampus } from '../../lib/campus/store'
import type { SplitParticipant, SplitPlan } from '../../lib/campus/types'
import { rupees } from '../../lib/format'
import './split.css'

/**
 * One-tap group expense splitting. Generates payment *requests* as text — no
 * payment gateway, and nothing here means money has moved.
 */
export function SplitDialog({ booking, open, onOpenChange }: { booking: Booking; open: boolean; onOpenChange: (o: boolean) => void }) {
  const prices = Object.fromEntries(booking.seats.map((s) => [s.id, s.price]))
  const initial = (): SplitPlan => getCampus().splits[booking.id] ?? {
    bookingId: booking.id,
    mode: 'equal',
    total: booking.total,
    updatedAt: new Date().toISOString(),
    participants: computeSplit('equal', booking.total, booking.seats.map((s, i) => ({ id: uid('p'), name: i === 0 ? 'You' : `Friend ${i}`, seatId: s.id, amount: 0, settled: i === 0 })), prices),
  }
  const [plan, setPlan] = useState<SplitPlan>(initial)
  const errors = validateSplit(plan.total, plan.participants)
  const setParticipants = (ps: SplitParticipant[], mode = plan.mode) => setPlan({ ...plan, mode, participants: mode === 'custom' ? ps : computeSplit(mode, plan.total, ps, prices) })
  const save = () => {
    if (errors.length) return
    updateCampus((d) => { d.splits[booking.id] = { ...plan, updatedAt: new Date().toISOString() } })
    toast.success('Split saved', { description: `${rupees(outstanding(plan.participants))} still outstanding.` })
    onOpenChange(false)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(splitSummaryText(booking.event.title, plan.total, plan.participants))
      toast.success('Payment requests copied', { description: 'Paste them into your group chat.' })
    } catch {
      toast.error('Couldn’t copy to the clipboard')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog split-dialog">
          <Dialog.Title>Split the cost</Dialog.Title>
          <Dialog.Description asChild><p>{booking.event.title} · {rupees(plan.total)} for {booking.seats.length} seat{booking.seats.length > 1 ? 's' : ''}. Requests only — SeatLock doesn’t move money.</p></Dialog.Description>
          <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
            <Segmented label="Split mode" value={plan.mode} onChange={(m) => setParticipants(plan.participants, m)} options={[{ value: 'equal', label: 'Equal' }, { value: 'seat', label: 'By seat' }, { value: 'custom', label: 'Custom' }]} />
            <ul className="split-list">
              {plan.participants.map((p, i) => (
                <li key={p.id} className="split-row">
                  <input className="input" aria-label={`Person ${i + 1} name`} value={p.name} onChange={(e) => { const v = e.currentTarget.value; setParticipants(plan.participants.map((x) => (x.id === p.id ? { ...x, name: v } : x))) }} />
                  {plan.mode === 'seat' ? (
                    <select className="select" aria-label={`Seat for ${p.name}`} value={p.seatId ?? ''} onChange={(e) => { const v = e.currentTarget.value; setParticipants(plan.participants.map((x) => (x.id === p.id ? { ...x, seatId: v } : x))) }}>
                      {booking.seats.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                    </select>
                  ) : null}
                  <input className="input split-amt num" type="number" min={0} inputMode="numeric" aria-label={`Amount for ${p.name}`} value={p.amount} readOnly={plan.mode !== 'custom'} onChange={(e) => { const v = Math.max(0, Math.round(Number(e.currentTarget.value) || 0)); setParticipants(plan.participants.map((x) => (x.id === p.id ? { ...x, amount: v } : x))) }} />
                  <Toggle checked={p.settled} onChange={(v) => setPlan({ ...plan, participants: plan.participants.map((x) => (x.id === p.id ? { ...x, settled: v } : x)) })} label="Settled" />
                  {plan.participants.length > 1 && <button type="button" className="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => setParticipants(plan.participants.filter((x) => x.id !== p.id))}><Icon name="trash" size={16} /></button>}
                </li>
              ))}
            </ul>
            {plan.participants.length < 8 && <button type="button" className="btn btn-ghost" onClick={() => setParticipants([...plan.participants, { id: uid('p'), name: `Friend ${plan.participants.length}`, amount: 0, settled: false, ...(booking.seats[0] ? { seatId: booking.seats[0].id } : {}) }])}><Icon name="plus" size={16} /> Add person</button>}
            {errors.map((e) => <p key={e} className="field-error" role="alert"><Icon name="alert" size={16} /> {e}</p>)}
            <p className="small">Outstanding: <strong className="num">{rupees(outstanding(plan.participants))}</strong></p>
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={() => void copy()} disabled={errors.length > 0}><Icon name="copy" size={16} /> Copy requests</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={errors.length > 0}>Save split</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
