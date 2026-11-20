import type { Booking, EventDetail, Seat, Section } from '../types'

/** Deterministic PRNG so every visitor sees the same seeded venue. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = 86_400_000

function at(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date(Date.now() + daysFromNow * DAY)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

type Seed = Omit<EventDetail, 'seatsLeft' | 'totalSeats' | 'priceFrom' | 'priceTo' | 'startsAt'> & {
  day: number
  hour: number
  basePrice: number
  demand: number
  /** Force every seat to booked (a sold-out show for the waitlist demo). */
  soldOut?: boolean
}

const SEEDS: Seed[] = [
  {
    id: 'neon-monsoon', title: 'Neon Monsoon', subtitle: 'Indie night with 4 campus bands', category: 'Music',
    venue: 'Open Air Theatre', day: 0, hour: 19, basePrice: 300, demand: 0.55, durationMinutes: 180,
    organizer: 'Music Society', lineup: ['Paper Kites Club', 'Velvet Static', 'Monsoon Theory', 'The 3 AM Library'],
    description: 'Four student bands, one rain-soaked stage. Expect reverb, string lights and a closing set that ends under the stars.',
    poster: { hue: 258, accent: 195, motif: 'waves' },
  },
  {
    id: 'midnight-verses', title: 'Midnight Verses', subtitle: 'Kavi sammelan & spoken word', category: 'Literature',
    venue: 'Seminar Hall B', day: 2, hour: 20, basePrice: 150, demand: 0.35, durationMinutes: 120,
    organizer: 'Literary Circle', lineup: ['Open mic', 'Guest poets', 'Hindi & Urdu ghazal set'],
    description: 'Poetry in Hindi, Urdu and English — candlelit, intimate and gloriously unplugged.',
    poster: { hue: 32, accent: 350, motif: 'stripes' },
  },
  {
    id: 'synthwave-convocation', title: 'Synthwave Convocation', subtitle: 'Electronic live set', category: 'Music',
    venue: 'Convocation Hall', day: 4, hour: 21, basePrice: 400, demand: 0.7, durationMinutes: 150,
    organizer: 'E-Cell × DJ Club', lineup: ['Analog Hearts', 'NULLPTR', 'Sinewave Sisters'], highDemand: true, tags: ['electronic', 'music'],
    description: 'Retro-futurist synths, laser lighting and a hall-wide light show synced to the beat.',
    poster: { hue: 290, accent: 185, motif: 'grid' },
  },
  {
    id: 'hackathon-finals', title: 'Hack Finals Live', subtitle: 'Watch 12 teams pitch', category: 'Tech',
    venue: 'Main Auditorium', day: 6, hour: 15, basePrice: 0, demand: 0.25, durationMinutes: 210,
    organizer: 'Coding Club', lineup: ['12 finalist teams', 'Industry jury', 'Live voting'],
    description: 'The final 12 teams demo live on stage. Audience vote decides the people’s choice award.',
    poster: { hue: 150, accent: 80, motif: 'bars' },
  },
  {
    id: 'retro-orchestra', title: 'Retro Bollywood Orchestra', subtitle: '60 musicians, golden-era hits', category: 'Music',
    venue: 'Main Auditorium', day: 9, hour: 18, basePrice: 250, demand: 0.6, durationMinutes: 160,
    organizer: 'Cultural Committee', lineup: ['Campus Symphony', 'Guest vocalists'],
    description: 'A 60-piece student orchestra reimagines classics from the golden era of Hindi film music.',
    poster: { hue: 12, accent: 45, motif: 'orbit' },
  },
  {
    id: 'hostel-diaries', title: 'Hostel Diaries', subtitle: 'Stand-up comedy night', category: 'Comedy',
    venue: 'Seminar Hall B', day: 12, hour: 19, basePrice: 200, demand: 0.45, durationMinutes: 100,
    organizer: 'Comedy Collective', lineup: ['5 student comics', 'Alumni headliner'],
    description: 'Mess food, 8 AM labs and roommate disasters — the comedy night everyone quotes for a year.',
    poster: { hue: 48, accent: 210, motif: 'rings' },
  },
  {
    id: 'strings-at-dusk', title: 'Strings at Dusk', subtitle: 'Sitar, violin & cello', category: 'Classical',
    venue: 'Open Air Theatre', day: 17, hour: 18, basePrice: 180, demand: 0.3, durationMinutes: 120,
    organizer: 'SPIC MACAY Chapter', lineup: ['Sitar recital', 'String trio'],
    description: 'An evening raga meets a string trio as the sun goes down over the amphitheatre.',
    poster: { hue: 200, accent: 30, motif: 'waves' },
  },
  {
    id: 'robo-grand-prix', title: 'Robo Grand Prix', subtitle: 'Robotics league finals', category: 'Tech',
    venue: 'Convocation Hall', day: 24, hour: 11, basePrice: 100, demand: 0.4, durationMinutes: 240,
    organizer: 'Robotics Society', lineup: ['Line followers', 'Robo-soccer', 'Combat bots'],
    description: 'Autonomous racers, robo-soccer and a combat-bot finale — ear protection recommended.',
    poster: { hue: 220, accent: 95, motif: 'grid' },
  },
  {
    id: 'campus-unplugged', title: 'Campus Unplugged', subtitle: 'Acoustic sets by the lake', category: 'Music',
    venue: 'Open Air Theatre', day: 3, hour: 18, basePrice: 220, demand: 0.9, durationMinutes: 140, soldOut: true,
    organizer: 'Music Society', lineup: ['Lakeside Trio', 'Two Strings & a Story', 'Open jam'], tags: ['indie', 'music'],
    description: 'Sold out in eleven minutes. Returns and no-show releases go to the waitlist first.',
    poster: { hue: 168, accent: 40, motif: 'rings' },
  },
  {
    id: 'design-sprint', title: 'Design Sprint Workshop', subtitle: 'Prototype an app in 3 hours', category: 'Tech',
    venue: 'Seminar Hall B', day: 5, hour: 10, basePrice: 0, demand: 0.2, durationMinutes: 180,
    organizer: 'Design Club', lineup: ['Problem framing', 'Crazy 8s', 'Figma prototyping'], tags: ['workshop', 'tech', 'startups'],
    description: 'A hands-on sprint: frame a campus problem, sketch, prototype and test it with real students.',
    poster: { hue: 320, accent: 160, motif: 'stripes' },
  },
]

export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'] as const
const SECTION_LAYOUT: { section: Section; count: number }[] = [
  { section: 'left', count: 5 },
  { section: 'center', count: 10 },
  { section: 'right', count: 5 },
]

export function priceFor(base: number, rowIndex: number): number {
  if (base === 0) return 0
  if (rowIndex < 3) return Math.round((base * 1.5) / 10) * 10
  if (rowIndex < 7) return base
  return Math.round((base * 0.6) / 10) * 10
}

/** Venue layout: 10 rows × (5 | aisle | 10 | aisle | 5) = 200 seats. */
export function generateSeats(eventId: string, basePrice: number, demand: number): Seat[] {
  const rand = mulberry32([...eventId].reduce((h, c) => h * 31 + c.charCodeAt(0), 7))
  const seats: Seat[] = []
  ROWS.forEach((row, r) => {
    let col = 0
    let number = 1
    SECTION_LAYOUT.forEach(({ section, count }, s) => {
      for (let i = 0; i < count; i++) {
        const isAisle = (i === count - 1 && s < 2) || (i === 0 && s > 0)
        const roll = rand()
        // Front rows sell out first.
        const pressure = demand * (1.25 - r / ROWS.length)
        const status = roll < 0.03 ? 'blocked' : roll < 0.03 + pressure * 0.7 ? 'booked' : 'available'
        seats.push({ id: `${row}${number}`, row, number, section, col, price: priceFor(basePrice, r), status, isAisle })
        col++
        number++
      }
      col++ // aisle gap
    })
  })
  return seats
}

export function seedEvents(): { events: EventDetail[]; seats: Record<string, Seat[]> } {
  const seats: Record<string, Seat[]> = {}
  const events = SEEDS.map(({ day, hour, basePrice, demand, soldOut, ...rest }) => {
    const s = generateSeats(rest.id, basePrice, demand)
    if (soldOut) for (const seat of s) if (seat.status === 'available') seat.status = 'booked'
    seats[rest.id] = s
    const prices = s.map((x) => x.price)
    return {
      ...rest,
      startsAt: at(day, hour),
      priceFrom: Math.min(...prices),
      priceTo: Math.max(...prices),
      totalSeats: s.length,
      seatsLeft: s.filter((x) => x.status === 'available').length,
    }
  })
  return { events, seats }
}

export function seedPastBookings(): Booking[] {
  return [
    {
      id: 'BK-PAST01', eventId: 'freshers-2026', status: 'confirmed', total: 500, createdAt: at(-40, 10),
      event: { title: 'Freshers Night 2026', venue: 'Open Air Theatre', startsAt: at(-32, 19), durationMinutes: 180 },
      seats: [{ id: 'D6', price: 250 }, { id: 'D7', price: 250 }],
    },
    {
      id: 'BK-PAST02', eventId: 'tedx-campus', status: 'confirmed', total: 200, createdAt: at(-20, 12),
      event: { title: 'TEDx Campus: Small Bets', venue: 'Main Auditorium', startsAt: at(-14, 16), durationMinutes: 240 },
      seats: [{ id: 'B11', price: 200 }],
    },
  ]
}

export const SEEDED_STUDENT = { id: 'stu_42', name: 'Aarav Sharma', email: 'student@seatlock.dev', password: 'seatlock123', role: 'student' as const }
/** Demo organizer account — a presentation role only, not real authorization. */
export const SEEDED_ORGANIZER = { id: 'org_7', name: 'Meera Iyer (Organizer)', email: 'organizer@seatlock.dev', password: 'organizer123', role: 'organizer' as const }
