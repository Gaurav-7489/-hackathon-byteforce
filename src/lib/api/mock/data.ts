import { hash, layoutFor, rng, type Layout } from '../../../booking/data'
import type { Booking, EventDetail, Seat } from '../types'

/** Fictional films, operators and venues for the in-browser mock API. */

export const SEEDED_STUDENT = { id: 'stu_42', name: 'Aarav Sharma', email: 'student@seatlock.dev', password: 'seatlock123' }

const DAY = 86_400_000

function at(dayOffset: number, hh: number, mm: number): string {
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  let t = d.getTime() + dayOffset * DAY
  // Keep "today" listings in the future whatever time the demo runs.
  if (dayOffset >= 0 && t < Date.now() + 20 * 60_000) t += DAY
  return new Date(t).toISOString()
}
const hhmm = (iso: string, plusMin = 0) => new Date(Date.parse(iso) + plusMin * 60_000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

interface Film {
  key: string
  title: string
  subtitle: string
  genre: string
  rating: string
  language: string
  minutes: number
  cast: string[]
  description: string
  poster: EventDetail['poster']
  shows: { day: number; h: number; m: number; hall: number; fill: number }[]
}

const HALLS = [
  { name: 'Hall 4 · Lumen Cinemas, Koramangala', tag: 'Dolby Atmos', mult: 1 },
  { name: 'IMAX · Lumen Cinemas, Whitefield', tag: 'IMAX laser', mult: 1.45 },
  { name: 'Screen 2 · Lumen Cinemas, Indiranagar', tag: '4K laser', mult: 0.9 },
]

const FILMS: Film[] = [
  {
    key: 'northbound', title: 'Northbound', subtitle: 'A cartographer follows a signal into the polar dark.', genre: 'Sci-fi · Drama', rating: 'UA 13+', language: 'English', minutes: 138,
    cast: ['Meera Iyer', 'Jonah Vale', 'Ishaan Rao'],
    description: 'When a dead research station starts transmitting again, a disgraced map-maker joins the relief crew heading north. A quiet, enormous film about distance — best seen from the centre of rows F to K.',
    poster: { hue: 205, accent: 48, motif: 'rings' },
    shows: [{ day: 0, h: 16, m: 40, hall: 0, fill: 0.48 }, { day: 0, h: 21, m: 10, hall: 1, fill: 0.72 }, { day: 1, h: 19, m: 55, hall: 1, fill: 0.6 }, { day: 3, h: 13, m: 15, hall: 2, fill: 0.25 }],
  },
  {
    key: 'monsoon', title: 'The Monsoon Ledger', subtitle: 'One rainy week. One missing account book.', genre: 'Thriller', rating: 'UA 16+', language: 'Hindi', minutes: 124,
    cast: ['Kabir Sethi', 'Tara Menon'],
    description: 'A junior auditor in Mumbai finds a ledger that should not exist. Tight, rain-soaked and twisty.',
    poster: { hue: 168, accent: 12, motif: 'waves' },
    shows: [{ day: 0, h: 19, m: 30, hall: 2, fill: 0.66 }, { day: 2, h: 22, m: 30, hall: 0, fill: 0.4 }, { day: 4, h: 18, m: 0, hall: 0, fill: 0.3 }],
  },
  {
    key: 'kites', title: 'Paper Kites', subtitle: 'Two siblings, one rooftop, the biggest kite festival in town.', genre: 'Family · Animation', rating: 'U', language: 'Hindi · English', minutes: 102,
    cast: ['Voices of Anaya Kapoor', 'Rohan Das'],
    description: 'A hand-drawn adventure over the rooftops of Ahmedabad during Uttarayan. Bright, warm, perfect for a weekend matinee.',
    poster: { hue: 32, accent: 190, motif: 'stripes' },
    shows: [{ day: 1, h: 11, m: 0, hall: 2, fill: 0.35 }, { day: 2, h: 14, m: 20, hall: 0, fill: 0.55 }, { day: 5, h: 10, m: 30, hall: 2, fill: 0.2 }],
  },
  {
    key: 'saffron', title: 'Saffron Nights', subtitle: 'A wedding band. A last tour. A song they never finished.', genre: 'Musical · Romance', rating: 'UA', language: 'Hindi', minutes: 146,
    cast: ['Diya Kulkarni', 'Arjun Bhatt', 'Neel Shah'],
    description: 'A big-hearted musical about a brass band on its final wedding season. Turn it up.',
    poster: { hue: 340, accent: 45, motif: 'bars' },
    shows: [{ day: 1, h: 21, m: 0, hall: 0, fill: 0.82 }, { day: 3, h: 18, m: 45, hall: 1, fill: 0.5 }],
  },
  {
    key: 'orbit', title: 'Low Orbit', subtitle: 'Ninety minutes to bring a station down safely.', genre: 'Action', rating: 'UA 13+', language: 'English', minutes: 131,
    cast: ['Sara Qureshi', 'Vikram Anand'],
    description: 'Real-time orbital rescue shot for IMAX. Sit high and central for the full frame.',
    poster: { hue: 258, accent: 180, motif: 'orbit' },
    shows: [{ day: 0, h: 22, m: 45, hall: 1, fill: 0.58 }, { day: 2, h: 20, m: 15, hall: 1, fill: 0.7 }, { day: 6, h: 17, m: 30, hall: 0, fill: 0.15 }],
  },
]

interface Route {
  key: string
  from: string
  to: string
  minutes: number
  km: number
  operator: string
  coach: string
  mult: number
  hue: number
  board: string[]
  drop: string[]
  trips: { day: number; h: number; m: number; fill: number }[]
}

const ROUTES: Route[] = [
  {
    key: 'blr-hyd', from: 'Bengaluru', to: 'Hyderabad', minutes: 580, km: 574, operator: 'Nightjar Coaches', coach: 'Volvo B11R · AC Seater 2+2', mult: 1, hue: 150,
    board: ['Majestic', 'Hebbal'], drop: ['Kukatpally', 'Ameerpet'],
    trips: [{ day: 0, h: 21, m: 15, fill: 0.62 }, { day: 1, h: 22, m: 30, fill: 0.8 }, { day: 3, h: 19, m: 45, fill: 0.3 }],
  },
  {
    key: 'blr-maa', from: 'Bengaluru', to: 'Chennai', minutes: 360, km: 346, operator: 'Kestrel Travels', coach: 'Scania Metrolink · AC Seater 2+2', mult: 0.72, hue: 25,
    board: ['Silk Board', 'Electronic City'], drop: ['Koyambedu', 'Guindy'],
    trips: [{ day: 0, h: 23, m: 0, fill: 0.45 }, { day: 2, h: 6, m: 30, fill: 0.2 }, { day: 4, h: 22, m: 0, fill: 0.55 }],
  },
  {
    key: 'blr-goa', from: 'Bengaluru', to: 'Goa', minutes: 690, km: 560, operator: 'Ghat Express', coach: 'Volvo 9600 · AC Seater 2+2', mult: 1.18, hue: 190,
    board: ['Majestic', 'Yeshwanthpur'], drop: ['Mapusa', 'Panaji'],
    trips: [{ day: 1, h: 20, m: 0, fill: 0.7 }, { day: 4, h: 20, m: 30, fill: 0.4 }],
  },
  {
    key: 'pnq-bom', from: 'Pune', to: 'Mumbai', minutes: 210, km: 150, operator: 'Kestrel Travels', coach: 'Eicher · AC Seater 2+2', mult: 0.48, hue: 280,
    board: ['Wakad', 'Hinjewadi'], drop: ['Dadar', 'Sion'],
    trips: [{ day: 0, h: 18, m: 30, fill: 0.5 }, { day: 2, h: 7, m: 0, fill: 0.3 }, { day: 5, h: 9, m: 15, fill: 0.25 }],
  },
]

const round10 = (n: number) => Math.round(n / 10) * 10

function priceFor(layout: Layout, tier: string, mult: number): number {
  return round10((layout.tiers.find((t) => t.id === tier)?.price ?? 0) * mult)
}

/** Live seat inventory from a physical layout, seeded deterministically per event. */
function seedSeats(id: string, layout: Layout, mult: number, fill: number): Seat[] {
  const rand = rng(hash(id))
  const colOf = new Map<number, number>()
  layout.grid.forEach((row) => row.forEach((i, c) => i !== null && colOf.set(i, c)))
  const blockedIds = new Set(
    layout.mode === 'cinema'
      ? layout.seats.filter((s) => s.tags.includes('Wheelchair')).map((s) => s.id).concat(['G1', 'C16'])
      : ['11C'],
  )
  return layout.seats.map((s, i) => {
    const bias = layout.mode === 'cinema' ? (s.tags.includes('Sweet spot') ? 0.18 : 0) - (s.row < 2 ? 0.2 : 0) : s.tags.includes('Window') ? 0.12 : -0.05
    const p = rand()
    const status: Seat['status'] = blockedIds.has(s.id) ? 'blocked' : p < fill + bias ? 'booked' : p < fill + bias + 0.03 ? 'held' : 'available'
    return {
      id: s.id,
      row: layout.rowLabels[s.row]!,
      r: s.row,
      number: s.col + 1,
      col: colOf.get(i) ?? s.col,
      section: s.tier,
      price: priceFor(layout, s.tier, mult),
      status,
      isAisle: s.tags.includes('Aisle'),
      tags: blockedIds.has(s.id) ? [...s.tags, s.tags.includes('Wheelchair') ? 'Wheelchair space' : 'Out of service'] : s.tags,
    }
  })
}

export function seedEvents(): { events: EventDetail[]; seats: Record<string, Seat[]> } {
  const events: EventDetail[] = []
  const seats: Record<string, Seat[]> = {}
  const cinema = layoutFor('cinema')
  const bus = layoutFor('bus')

  for (const f of FILMS) {
    for (const sh of f.shows) {
      const hall = HALLS[sh.hall]!
      const evening = sh.h >= 18 ? 1.12 : sh.h < 12 ? 0.85 : 1
      const mult = hall.mult * evening
      const startsAt = at(sh.day, sh.h, sh.m)
      const id = `${f.key}-${sh.day}${sh.h}${sh.m}`
      const s = seedSeats(id, cinema, mult, sh.fill)
      seats[id] = s
      const prices = cinema.tiers.map((t) => priceFor(cinema, t.id, mult))
      events.push({
        id, kind: 'cinema', title: f.title, subtitle: f.subtitle, category: f.genre, venue: hall.name, startsAt, durationMinutes: f.minutes,
        priceFrom: Math.min(...prices), priceTo: Math.max(...prices), seatsLeft: s.filter((x) => x.status === 'available').length, totalSeats: s.length,
        poster: f.poster, description: f.description, organizer: 'Lumen Cinemas', tags: [hall.tag, f.language, `${f.minutes} min`],
        rating: f.rating, language: f.language, cast: f.cast,
      })
    }
  }

  for (const r of ROUTES) {
    for (const t of r.trips) {
      const startsAt = at(t.day, t.h, t.m)
      const id = `${r.key}-${t.day}${t.h}${t.m}`
      const s = seedSeats(id, bus, r.mult, t.fill)
      seats[id] = s
      const prices = bus.tiers.map((x) => priceFor(bus, x.id, r.mult))
      const stops = [
        { name: r.board[0]!, time: hhmm(startsAt), kind: 'board' as const },
        { name: r.board[1]!, time: hhmm(startsAt, 35), kind: 'board' as const },
        { name: r.drop[0]!, time: hhmm(startsAt, r.minutes - 30), kind: 'drop' as const },
        { name: r.drop[1]!, time: hhmm(startsAt, r.minutes), kind: 'drop' as const },
      ]
      events.push({
        id, kind: 'bus', title: `${r.from} → ${r.to}`, subtitle: `${r.operator} · ${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m · ${r.km} km`, category: r.coach,
        venue: `${r.board[0]}, ${r.from}`, startsAt, durationMinutes: r.minutes,
        priceFrom: Math.min(...prices), priceTo: Math.max(...prices), seatsLeft: s.filter((x) => x.status === 'available').length, totalSeats: s.length,
        poster: { hue: r.hue, accent: 48, motif: 'road' },
        description: `${r.coach.split(' · ')[0]} with reclining seats, charging points and a rest stop midway. Boarding opens 15 minutes before departure.`,
        organizer: r.operator, tags: ['Live tracking', 'Charging point', 'Water bottle', 'Blanket'], stops,
      })
    }
  }

  events.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  return { events, seats }
}

export function seedPastBookings(): Booking[] {
  return [
    {
      id: 'BK-7Q2M4X', eventId: 'past-1',
      event: { kind: 'cinema', title: 'Paper Kites', venue: HALLS[2]!.name, startsAt: at(-9, 14, 20), durationMinutes: 102 },
      seats: [{ id: 'H8', price: 260, tier: 'prime' }, { id: 'H9', price: 260, tier: 'prime' }], total: 520, status: 'confirmed', createdAt: at(-11, 10, 0),
    },
    {
      id: 'BK-3RT9LA', eventId: 'past-2',
      event: { kind: 'bus', title: 'Pune → Mumbai', venue: 'Wakad, Pune', startsAt: at(-21, 7, 0), durationMinutes: 210 },
      seats: [{ id: '3A', price: 550, tier: 'window' }], total: 550, status: 'cancelled', createdAt: at(-24, 18, 0),
    },
  ]
}
