import * as z from 'zod/mini'

/**
 * Runtime-validated API contract. Every response from the organizer API (or the
 * built-in mock adapter) is parsed through these schemas, so components only
 * ever see typed data. If the organizer's field names differ, adapt them in
 * `client.ts` — components never touch raw JSON.
 */

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  /** Presentation role for the demo (organizer screens). Not an authorization boundary. */
  role: z.optional(z.enum(['student', 'organizer'])),
})
export type User = z.infer<typeof UserSchema>

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
})
export type LoginResponse = z.infer<typeof LoginResponseSchema>

export const EventSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  category: z.string(),
  venue: z.string(),
  startsAt: z.string(),
  priceFrom: z.number(),
  priceTo: z.number(),
  seatsLeft: z.number(),
  totalSeats: z.number(),
  poster: z.object({
    hue: z.number(),
    accent: z.number(),
    motif: z.enum(['rings', 'bars', 'grid', 'waves', 'orbit', 'stripes']),
  }),
  /** Optional organizer flags; absent on APIs that don't send them. */
  highDemand: z.optional(z.boolean()),
  tags: z.optional(z.array(z.string())),
})
export type EventSummary = z.infer<typeof EventSummarySchema>

export const EventDetailSchema = z.extend(EventSummarySchema, {
  description: z.string(),
  durationMinutes: z.number(),
  organizer: z.string(),
  lineup: z.array(z.string()),
})
export type EventDetail = z.infer<typeof EventDetailSchema>

export const EventsResponseSchema = z.object({ events: z.array(EventSummarySchema) })

/** Server-side seat statuses. "selected" is a purely client-side state. */
export const SeatStatusSchema = z.enum(['available', 'held', 'booked', 'blocked'])
export type ServerSeatStatus = z.infer<typeof SeatStatusSchema>
export type SeatStatus = ServerSeatStatus | 'selected'

export const SectionSchema = z.enum(['left', 'center', 'right'])
export type Section = z.infer<typeof SectionSchema>

export const SeatSchema = z.object({
  id: z.string(),
  row: z.string(),
  number: z.number(),
  section: SectionSchema,
  /** Column index in the layout grid (aisles leave gaps). */
  col: z.number(),
  price: z.number(),
  status: SeatStatusSchema,
  isAisle: z.boolean(),
  /** True when the hold on this seat belongs to the current student. */
  heldByMe: z.optional(z.boolean()),
})
export type Seat = z.infer<typeof SeatSchema>

export const SeatsResponseSchema = z.object({
  eventId: z.string(),
  seats: z.array(SeatSchema),
  updatedAt: z.string(),
})
export type SeatsResponse = z.infer<typeof SeatsResponseSchema>

export const HoldSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  seatIds: z.array(z.string()),
  total: z.number(),
  expiresAt: z.string(),
})
export type Hold = z.infer<typeof HoldSchema>

export const HoldResponseSchema = z.object({ hold: HoldSchema, serverTime: z.string() })
export type HoldResponse = z.infer<typeof HoldResponseSchema>

export const BookingSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  event: z.object({ title: z.string(), venue: z.string(), startsAt: z.string(), durationMinutes: z.number() }),
  seats: z.array(z.object({ id: z.string(), price: z.number() })),
  total: z.number(),
  status: z.enum(['confirmed', 'cancelled']),
  createdAt: z.string(),
})
export type Booking = z.infer<typeof BookingSchema>

export const BookingResponseSchema = z.object({ booking: BookingSchema })
export const BookingsResponseSchema = z.object({ bookings: z.array(BookingSchema) })

export const ErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  conflictingSeatIds: z.optional(z.array(z.string())),
})
export type ErrorBody = z.infer<typeof ErrorBodySchema>

/** AI assistant — request context and streamed result. */
export interface AiSeatContext {
  id: string
  row: string
  number: number
  section: Section
  price: number
  status: ServerSeatStatus
  isAisle: boolean
}

export interface AiAssistRequest {
  eventId: string
  prompt: string
  maxSeats: number
  selectedSeatIds: string[]
  seats: AiSeatContext[]
  history: { prompt: string; seatIds: string[] }[]
}

export const AiResultSchema = z.object({
  seatIds: z.array(z.string()),
  reason: z.string(),
})
export type AiResult = z.infer<typeof AiResultSchema>

export const AiStreamChunkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('progress'), text: z.string() }),
  z.object({ type: z.literal('result'), seatIds: z.array(z.string()), reason: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
])
export type AiStreamChunk = z.infer<typeof AiStreamChunkSchema>
