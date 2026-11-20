import { Link } from 'react-router'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Icon } from '../components/Icon'
import { StatePanel } from '../components/StatePanel'
import { Ticket } from '../components/Ticket'
import { downloadIcs } from '../lib/format'
import { useHold } from '../lib/hold'
import { fadeUp, stagger } from '../lib/motion'
import './success.css'

export function Success() {
  const { lastBooking: booking } = useHold()

  if (!booking) {
    return (
      <div className="container page-pad">
        <title>Booking · SeatLock</title>
        <StatePanel icon="ticket" title="No recent booking" action={<Link className="btn btn-primary" to="/bookings">View my bookings</Link>}>
          Your confirmed tickets are always in My bookings.
        </StatePanel>
      </div>
    )
  }

  return (
    <div className="container page-pad success">
      <title>{`You’re going to ${booking.event.title} · SeatLock`}</title>
      <motion.div className="success-head" variants={stagger(0.08)} initial="hidden" animate="show">
        <motion.span variants={fadeUp} className="success-check" aria-hidden="true"><Icon name="check" size={28} /></motion.span>
        <motion.p variants={fadeUp} className="success-status" role="status">Booking confirmed</motion.p>
        <motion.h1 variants={fadeUp} className="success-title">You’re going.</motion.h1>
        <motion.p variants={fadeUp} className="success-sub">
          {booking.seats.length} seat{booking.seats.length > 1 ? 's' : ''} locked in for {booking.event.title}. Show this ticket at the door.
        </motion.p>
      </motion.div>

      <Ticket booking={booking} />

      <motion.div className="success-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <button type="button" className="btn btn-lg" onClick={() => { downloadIcs(booking); toast.success('Calendar file downloaded') }}>
          <Icon name="calendar" size={18} /> Add to calendar
        </button>
        <Link to="/bookings" className="btn btn-primary btn-lg">View my bookings</Link>
      </motion.div>
    </div>
  )
}
