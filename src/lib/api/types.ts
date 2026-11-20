import * as z from 'zod/mini'

/**
 * Runtime-validated API contract. Every response from the organizer API (or the
 * built-in mock) is parsed through these schemas, so components only ever see
 * typed data. An "event" is one cinema show or one bus departure.
 */

export const UserSchema = z.object({ id: z.string(), name: z.string(), email: z.string() })
export type User = z.infer<typeof UserSchema>

export const LoginResponseSchema = z.object({ token: z.string(), user: UserSchema })
export type LoginResponse = z.infer<typeof LoginResponseSchema>
export const ProfileResponseSchema = z.object({ user: UserSchema })

export const KindSchema = z.enum(['cinema', 'bus'])
export type Kind = z.infer<typeof KindSchema>

export const EventSummarySchema = z.object({
  id: z.string(),
  kind: KindSchema,
  title: z.string(),
  subtitle: z.string(),
  category: z.string(),
  venue: z.string(),
  startsAt: z.string(),
  durationMinutes: z.number(),
  priceFrom: z.number(),
  priceTo: z.number(),
  seatsLeft: z.number(),
  totalSeats: z.number(),
  poster: z.object({ hue: z.number(), accent: z.number(), motif: z.enum(['rings', 'bars', 'grid', 'waves', 'orbit', 'stripes', 'road']) }),
})
export type EventSummary = z.infer<typeof EventSummarySchema>

export const StopSchema = z.object({ name: z.string(), time: z.string(), kind: z.enum(['board', 'drop']) })

export const EventDetailSchema = z.extend(EventSummarySchema, {
  description: z.string(),
  organizer: z.string(),
  tags: z.array(z.string()),
  rating: z.optional(z.string()),
  language: z.optional(z.string()),
  cast: z.optional(z.array(z.string())),
  stops: z.optional(z.array(StopSchema)),
})
export type EventDetail = z.infer<typeof EventDetailSchema>

export const EventsResponseSchema = z.object({ events: z.array(EventSummarySchema) })

/** Server-side seat statuses. "selected" is a purely client-side state. */
export const SeatStatusSchema = z.enum(['available', 'held', 'booked', 'blocked'])
export type ServerSeatStatus = z.infer<typeof SeatStatusSchema>
export type SeatStatus = ServerSeatStatus | 'selected'

export const SeatSchema = z.object({
  id: z.string(),
  row: z.string(),
  /** Row index from the screen / windshield (0 = front). */
  r: z.number(),
  number: z.number(),
  /** Column in the 2D layout grid (aisles leave gaps). */
  col: z.number(),
  /** Tier id: classic / prime / recliner, window / aisle / rear. */
  section: z.string(),
  price: z.number(),
  status: SeatStatusSchema,
  isAisle: z.boolean(),
  tags: z.array(z.string()),
  /** True when the hold on this seat belongs to the current user. */
  heldByMe: z.optional(z.boolean()),
  /** True when the booking on this seat belongs to the current user. */
  mine: z.optional(z.boolean()),
})
export type Seat = z.infer<typeof SeatSchema>

export const SeatsResponseSchema = z.object({ eventId: z.string(), seats: z.array(SeatSchema), updatedAt: z.string() })
export type SeatsResponse = z.infer<typeof SeatsResponseSchema>

export const HoldSchema = z.object({ id: z.string(), eventId: z.string(), seatIds: z.array(z.string()), total: z.number(), expiresAt: z.string() })
export type Hold = z.infer<typeof HoldSchema>
export const HoldResponseSchema = z.object({ hold: HoldSchema, serverTime: z.string() })

export const BookingSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  event: z.object({ kind: KindSchema, title: z.string(), venue: z.string(), startsAt: z.string(), durationMinutes: z.number() }),
  seats: z.array(z.object({ id: z.string(), price: z.number(), tier: z.string() })),
  total: z.number(),
  status: z.enum(['confirmed', 'cancelled']),
  createdAt: z.string(),
})
export type Booking = z.infer<typeof BookingSchema>
export const BookingResponseSchema = z.object({ booking: BookingSchema })
export const BookingsResponseSchema = z.object({ bookings: z.array(BookingSchema) })

export const ErrorBodySchema = z.object({ code: z.string(), message: z.string(), conflictingSeatIds: z.optional(z.array(z.string())) })
export type ErrorBody = z.infer<typeof ErrorBodySchema>

/** AI assistant — request context and streamed result. */
export interface AiSeatContext {
  id: string
  row: string
  r: number
  number: number
  section: string
  price: number
  status: ServerSeatStatus
  isAisle: boolean
  tags: string[]
}

export interface AiAssistRequest {
  eventId: string
  kind: Kind
  prompt: string
  maxSeats: number
  selectedSeatIds: string[]
  seats: AiSeatContext[]
  history: { prompt: string; seatIds: string[] }[]
}

export const AiResultSchema = z.object({ seatIds: z.array(z.string()), reason: z.string() })
export type AiResult = z.infer<typeof AiResultSchema>

export const AiStreamChunkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('progress'), text: z.string() }),
  z.object({ type: z.literal('result'), seatIds: z.array(z.string()), reason: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
])
export type AiStreamChunk = z.infer<typeof AiStreamChunkSchema>
