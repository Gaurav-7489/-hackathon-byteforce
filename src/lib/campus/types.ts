import * as z from 'zod/mini'

/**
 * Typed contracts for SeatLock's campus-intelligence layer. Everything here is
 * browser-local demo state: it is validated on load (so a corrupted or
 * outdated localStorage entry can never crash the app) but it is NOT a secure
 * or authoritative store.
 */

export const TimeOfDaySchema = z.enum(['morning', 'afternoon', 'evening', 'night'])
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>

export const AccessibilityPreferenceSchema = z.object({
  wheelchair: z.boolean(),
  companion: z.boolean(),
  stepFree: z.boolean(),
  easyExit: z.boolean(),
  shortWalk: z.boolean(),
  lowStimulation: z.boolean(),
  clearSightline: z.boolean(),
  accessibleRestroom: z.boolean(),
})
export type AccessibilityPreference = z.infer<typeof AccessibilityPreferenceSchema>

export const ComfortPreferenceSchema = z.object({
  quieter: z.boolean(),
  lessCrowded: z.boolean(),
  easyExit: z.boolean(),
  lowNoise: z.boolean(),
  personalSpace: z.boolean(),
})
export type ComfortPreference = z.infer<typeof ComfortPreferenceSchema>

export const PreferencesSchema = z.object({
  interests: z.array(z.string()),
  categories: z.array(z.string()),
  budget: z.number(),
  times: z.array(TimeOfDaySchema),
  access: AccessibilityPreferenceSchema,
  comfort: ComfortPreferenceSchema,
  reducedEffects: z.boolean(),
  reminders: z.boolean(),
})
export type Preferences = z.infer<typeof PreferencesSchema>

export const ScheduleKindSchema = z.enum(['class', 'exam', 'commitment'])
export type ScheduleKind = z.infer<typeof ScheduleKindSchema>

/**
 * A class repeats weekly (weekday + time). Exams and commitments are one-off
 * date-time ranges. Times are local "HH:MM" strings, dates "YYYY-MM-DD".
 */
export const ScheduleItemSchema = z.object({
  id: z.string(),
  kind: ScheduleKindSchema,
  title: z.string(),
  weekday: z.optional(z.number()), // 0 = Sunday, classes only
  date: z.optional(z.string()), // exams + commitments
  start: z.string(),
  end: z.string(),
  source: z.optional(z.enum(['manual', 'ics'])),
})
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>

export const WaitlistStatusSchema = z.enum(['waiting', 'offered', 'accepted', 'declined', 'expired', 'left'])
export type WaitlistStatus = z.infer<typeof WaitlistStatusSchema>

export const WaitlistEntrySchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventTitle: z.string(),
  seats: z.number(),
  joinedAt: z.string(),
  /** Simulated students ahead of you. Goes down as offers resolve. */
  ahead: z.number(),
  status: WaitlistStatusSchema,
  offer: z.optional(z.object({ seatIds: z.array(z.string()), expiresAt: z.string() })),
})
export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>

export const ExchangeRecordSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  eventId: z.string(),
  eventTitle: z.string(),
  seatIds: z.array(z.string()),
  kind: z.enum(['returned', 'reissued_to_waitlist', 'released_to_inventory', 'failed']),
  refundPercent: z.number(),
  amount: z.number(),
  at: z.string(),
  note: z.string(),
})
export type ExchangeRecord = z.infer<typeof ExchangeRecordSchema>

export const NotificationSchema = z.object({
  id: z.string(),
  kind: z.enum(['waitlist', 'reminder', 'exchange', 'companion', 'queue', 'system', 'noshow']),
  title: z.string(),
  body: z.string(),
  at: z.string(),
  read: z.boolean(),
  href: z.optional(z.string()),
})
export type AppNotification = z.infer<typeof NotificationSchema>

export const SplitParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  seatId: z.optional(z.string()),
  amount: z.number(),
  settled: z.boolean(),
})
export type SplitParticipant = z.infer<typeof SplitParticipantSchema>

export const SplitPlanSchema = z.object({
  bookingId: z.string(),
  mode: z.enum(['equal', 'custom', 'seat']),
  total: z.number(),
  participants: z.array(SplitParticipantSchema),
  updatedAt: z.string(),
})
export type SplitPlan = z.infer<typeof SplitPlanSchema>

export const CompanionStatusSchema = z.enum(['none', 'pending', 'accepted', 'declined', 'incoming', 'blocked', 'reported'])
export type CompanionStatus = z.infer<typeof CompanionStatusSchema>

export const CompanionSettingsSchema = z.object({
  optIn: z.boolean(),
  showInterests: z.boolean(),
  showYear: z.boolean(),
  allowRequests: z.boolean(),
  shareHandleOnAccept: z.boolean(),
  requests: z.record(z.string(), CompanionStatusSchema),
})
export type CompanionSettings = z.infer<typeof CompanionSettingsSchema>

export const QueueTokenSchema = z.object({
  eventId: z.string(),
  token: z.string(),
  joinedAt: z.number(),
  startPosition: z.number(),
  admittedAt: z.optional(z.number()),
  /** Booking window after admission. */
  windowEndsAt: z.optional(z.number()),
})
export type QueueToken = z.infer<typeof QueueTokenSchema>

export const VaultTicketSchema = z.object({
  bookingId: z.string(),
  eventId: z.string(),
  title: z.string(),
  venue: z.string(),
  startsAt: z.string(),
  durationMinutes: z.number(),
  seats: z.array(z.string()),
  total: z.number(),
  savedAt: z.string(),
})
export type VaultTicket = z.infer<typeof VaultTicketSchema>

export const ReminderSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  title: z.string(),
  fireAt: z.number(),
  fired: z.boolean(),
})
export type Reminder = z.infer<typeof ReminderSchema>

export const CampusStateSchema = z.object({
  version: z.literal(1),
  prefs: PreferencesSchema,
  schedule: z.array(ScheduleItemSchema),
  waitlist: z.array(WaitlistEntrySchema),
  exchange: z.array(ExchangeRecordSchema),
  notifications: z.array(NotificationSchema),
  splits: z.record(z.string(), SplitPlanSchema),
  companion: CompanionSettingsSchema,
  opportunities: z.object({ registered: z.array(z.string()), volunteered: z.array(z.string()) }),
  checkIns: z.record(z.string(), z.string()),
  vault: z.array(VaultTicketSchema),
  queue: z.record(z.string(), QueueTokenSchema),
  reminders: z.array(ReminderSchema),
})
export type CampusState = z.infer<typeof CampusStateSchema>

/* ---------- Static (bundled) campus data contracts ---------- */

export type SeatSection = 'left' | 'center' | 'right'

export interface VenueExit {
  id: string
  label: string
  /** Seat-map grid coordinates the exit sits beside (col may be -1 / 22 for side walls). */
  rowIndex: number
  col: number
  stepFree: boolean
}

export interface VenueProfile {
  /** Matches EventSummary.venue */
  name: string
  buildingId: string
  /** Organizer-designated spaces. Accessibility is never inferred from location. */
  wheelchairSpaces: string[]
  companionSeats: string[]
  stepFreeRows: string[]
  exits: VenueExit[]
  quietZones: { label: string; rows: string[]; sections: SeatSection[] }[]
  /** Simulated loudspeaker positions, used only for a labelled noise *estimate*. */
  speakers: { rowIndex: number; col: number }[]
  obstructions: { seatIds: string[]; note: string }[]
  accessibleRestroom: { distanceM: number; note: string } | null
  gates: string[]
  assemblyPoint: string
  safetyInstructions: string[]
  /** True only when exits come from an approved venue plan. All demo data is false. */
  verifiedPlan: boolean
  /** Distance from row A to the stage edge in metres (approximation for seat preview). */
  stageDistanceM: number
  rowDepthM: number
  seatWidthM: number
  rakeM: number
}

export interface Opportunity {
  id: string
  kind: 'workshop' | 'talk' | 'volunteer' | 'competition'
  title: string
  host: string
  eventId?: string
  date: string
  skills: string[]
  hours: number
  description: string
}

export interface CompanionProfile {
  id: string
  handle: string
  year: string
  interests: string[]
  vibe: string
  eventIds: string[]
  /** Deterministic simulated response to a request. */
  respondsWith: 'accepted' | 'declined'
}

export interface CrowdZone {
  id: string
  label: string
  x: number
  y: number
  capacityPerMin: number
}
