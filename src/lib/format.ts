const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export const money = (n: number) => (n === 0 ? 'Free' : inr.format(n))
/** Totals always show a figure (₹0), never "Free". */
export const rupees = (n: number) => inr.format(n)

export const dateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

export const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

export const dayParts = (iso: string) => {
  const d = new Date(iso)
  return {
    day: d.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
  }
}

export function relativeDay(iso: string): string {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - start.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return `In ${diff} days`
  return dateLong(iso)
}

export const seatList = (ids: string[]) => ids.join(', ')

/** Builds an .ics file for "Add to calendar" (works offline, no third-party service). */
export function icsFor(b: { id: string; event: { title: string; venue: string; startsAt: string; durationMinutes: number }; seats: { id: string }[] }) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const start = new Date(b.event.startsAt)
  const end = new Date(start.getTime() + b.event.durationMinutes * 60_000)
  const esc = (s: string) => s.replace(/[,;\\]/g, (m) => `\\${m}`)
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SeatLock//Tickets//EN', 'BEGIN:VEVENT',
    `UID:${b.id}@seatlock`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(b.event.title)}`, `LOCATION:${esc(b.event.venue)}`,
    `DESCRIPTION:${esc(`Booking ${b.id} · Seats ${b.seats.map((s) => s.id).join(' ')}`)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs(b: Parameters<typeof icsFor>[0]) {
  const blob = new Blob([icsFor(b)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `seatlock-${b.id}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
