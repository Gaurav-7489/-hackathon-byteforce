import type { Seat } from '../../api/types'
import { isSelectable, rowIndex } from '../../seats'
import type { AccessibilityPreference, ComfortPreference, VenueProfile } from '../types'

/**
 * Pure, deterministic seat intelligence used by Buddy Seating, Accessibility
 * matching, QuietZone, AutoRescue, Budget and the SeatView comparison. All
 * inputs come from current mock availability plus organizer-supplied venue
 * metadata; nothing here holds or selects seats.
 */

export const GRID_CENTER_COL = 10.5

export interface SeatTraits {
  wheelchair: boolean
  companion: boolean
  stepFree: boolean
  /** Metres to the nearest exit / nearest step-free exit. */
  exitM: number
  stepFreeExitM: number
  nearestExit: string
  /** 0..1 simulated noise-exposure estimate from listed speaker positions (not a measurement). */
  noise: number
  quietZone: string | null
  obstruction: string | null
  /** 0..1 share of occupied neighbours (row ±1, seat ±2). */
  crowding: number
  /** Free seats directly beside this one (0–2). */
  freeNeighbours: number
}

const metresBetween = (p: VenueProfile, r1: number, c1: number, r2: number, c2: number) =>
  Math.hypot((c1 - c2) * p.seatWidthM, (r1 - r2) * p.rowDepthM)

export function buildIndex(seats: readonly Seat[]): Map<string, Seat> {
  return new Map(seats.map((s) => [s.id, s]))
}

/** Occupancy grid keyed by `row:col` for O(1) neighbour checks. */
function occupancy(seats: readonly Seat[]) {
  const m = new Map<string, Seat>()
  for (const s of seats) m.set(`${rowIndex(s.row)}:${s.col}`, s)
  return m
}

export function computeTraits(seats: readonly Seat[], profile: VenueProfile): Map<string, SeatTraits> {
  const grid = occupancy(seats)
  const wheel = new Set(profile.wheelchairSpaces)
  const comp = new Set(profile.companionSeats)
  const stepRows = new Set(profile.stepFreeRows)
  const obstruction = new Map<string, string>()
  for (const o of profile.obstructions) for (const id of o.seatIds) obstruction.set(id, o.note)
  const out = new Map<string, SeatTraits>()
  for (const s of seats) {
    const r = rowIndex(s.row)
    let exitM = Infinity
    let stepFreeExitM = Infinity
    let nearestExit = ''
    for (const e of profile.exits) {
      const d = metresBetween(profile, r, s.col, e.rowIndex, e.col)
      if (d < exitM) { exitM = d; nearestExit = e.label }
      if (e.stepFree && d < stepFreeExitM) stepFreeExitM = d
    }
    let noise = 0
    for (const sp of profile.speakers) noise += 1 / (1 + metresBetween(profile, r, s.col, sp.rowIndex, sp.col) / 2.5)
    noise = Math.min(1, noise / 1.4)
    const zone = profile.quietZones.find((z) => z.rows.includes(s.row) && z.sections.includes(s.section))
    let occ = 0
    let total = 0
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (!dr && !dc) continue
        const n = grid.get(`${r + dr}:${s.col + dc}`)
        if (!n) continue
        total++
        if (n.status === 'booked' || (n.status === 'held' && !n.heldByMe)) occ++
      }
    }
    let freeNeighbours = 0
    for (const dc of [-1, 1]) {
      const n = grid.get(`${r}:${s.col + dc}`)
      if (n && isSelectable(n)) freeNeighbours++
    }
    out.set(s.id, {
      wheelchair: wheel.has(s.id),
      companion: comp.has(s.id),
      stepFree: stepRows.has(s.row),
      exitM: Number.isFinite(exitM) ? exitM : 99,
      stepFreeExitM: Number.isFinite(stepFreeExitM) ? stepFreeExitM : 99,
      nearestExit,
      noise,
      quietZone: zone?.label ?? null,
      obstruction: obstruction.get(s.id) ?? null,
      crowding: total ? occ / total : 0,
      freeNeighbours,
    })
  }
  return out
}

/* ---------- View approximation (SeatView Reality Preview) ---------- */

export interface ViewEstimate {
  distanceM: number
  angleDeg: number
  elevationM: number
  score: number
  obstruction: string | null
  summary: string
}

export function estimateView(seat: Seat, profile: VenueProfile): ViewEstimate {
  const r = rowIndex(seat.row)
  const depth = profile.stageDistanceM + r * profile.rowDepthM
  const lateral = (seat.col - GRID_CENTER_COL) * profile.seatWidthM
  const distanceM = Math.hypot(depth, lateral)
  const angleDeg = (Math.atan2(Math.abs(lateral), depth) * 180) / Math.PI
  const elevationM = r * profile.rakeM
  const obstruction = profile.obstructions.find((o) => o.seatIds.includes(seat.id))?.note ?? null
  const ideal = profile.stageDistanceM + 3.5 * profile.rowDepthM
  let score = 100 - Math.abs(distanceM - ideal) * 3.2 - angleDeg * 1.1 - (obstruction ? 22 : 0)
  if (r === 0) score -= 6 // neck strain in the very front row
  score = Math.round(Math.max(5, Math.min(100, score)))
  const parts = [
    `≈${distanceM.toFixed(1)} m from the stage`,
    angleDeg < 8 ? 'straight on' : angleDeg < 20 ? `${Math.round(angleDeg)}° off-centre` : `wide angle (${Math.round(angleDeg)}°)`,
  ]
  if (obstruction) parts.push('partial obstruction listed')
  return { distanceM, angleDeg, elevationM, score, obstruction, summary: parts.join(', ') }
}

/* ---------- Smart Buddy Seating ---------- */

export interface Arrangement {
  id: string
  seatIds: string[]
  total: number
  maxSeatPrice: number
  together: boolean
  sameRow: boolean
  score: number
  label: string
  reasons: string[]
}

export interface GroupOptions {
  size: number
  maxPricePerSeat: number | null
  preferSameRow: boolean
  preferAdjacent: boolean
  /** Seats to leave out (e.g. already in another arrangement). */
  exclude?: ReadonlySet<string>
}

function contiguousWindows(open: Seat[], size: number): Seat[][] {
  const byRow = new Map<string, Seat[]>()
  for (const s of open) {
    const k = `${s.row}|${s.section}`
    const list = byRow.get(k)
    if (list) list.push(s)
    else byRow.set(k, [s])
  }
  const out: Seat[][] = []
  for (const list of byRow.values()) {
    list.sort((a, b) => a.number - b.number)
    for (let i = 0; i + size <= list.length; i++) {
      const w = list.slice(i, i + size)
      if (w.every((s, k) => k === 0 || s.number === (w[k - 1]?.number ?? -9) + 1)) out.push(w)
    }
  }
  return out
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

function viewish(group: Seat[]): number {
  const avgRow = sum(group.map((s) => rowIndex(s.row))) / group.length
  const avgCol = sum(group.map((s) => s.col)) / group.length
  return 60 - Math.abs(avgRow - 3.5) * 5 - Math.abs(avgCol - GRID_CENTER_COL) * 1.6
}

function describe(group: Seat[]): string {
  const rows = [...new Set(group.map((s) => s.row))]
  const first = group[0]
  if (!first) return ''
  const block = first.section === 'center' ? 'centre' : first.section
  return rows.length === 1 ? `Row ${rows[0]}, ${block} block` : `Rows ${rows.join(' & ')}, ${block} block`
}

export function findGroupArrangements(seats: readonly Seat[], opts: GroupOptions, limit = 3): Arrangement[] {
  const size = Math.max(1, Math.min(4, opts.size))
  const open = seats.filter(
    (s) => isSelectable(s) && !opts.exclude?.has(s.id) && (opts.maxPricePerSeat === null || s.price <= opts.maxPricePerSeat),
  )
  if (open.length < size) return []
  const candidates: Arrangement[] = []
  const push = (group: Seat[], together: boolean, sameRow: boolean, kind: string) => {
    const ids = group.map((s) => s.id).sort()
    const total = sum(group.map((s) => s.price))
    let score = viewish(group) - total / (size * 25)
    if (together) score += opts.preferAdjacent ? 60 : 25
    if (sameRow) score += opts.preferSameRow ? 40 : 15
    const reasons: string[] = []
    if (together) reasons.push(size > 1 ? `All ${size} seats side by side` : 'Single seat')
    else if (kind === 'split') reasons.push('Front-and-back pairs — the closest you can sit together right now')
    else reasons.push('Nearest free seats to each other')
    if (opts.maxPricePerSeat !== null) reasons.push(`Every seat within ₹${opts.maxPricePerSeat}`)
    reasons.push(`₹${total} total · ₹${Math.ceil(total / size)} each`)
    candidates.push({
      id: ids.join('-'),
      seatIds: group.map((s) => s.id),
      total,
      maxSeatPrice: Math.max(...group.map((s) => s.price)),
      together,
      sameRow,
      score,
      label: describe(group),
      reasons,
    })
  }

  for (const w of contiguousWindows(open, size)) push(w, true, true, 'row')

  if (size >= 3) {
    // Split: a pair in one row + the rest directly behind, same block.
    const pairs = contiguousWindows(open, 2)
    const rest = size - 2
    const restWins = rest === 1 ? open.map((s) => [s]) : contiguousWindows(open, rest)
    for (const p of pairs) {
      const p0 = p[0]
      if (!p0) continue
      for (const w of restWins) {
        const w0 = w[0]
        if (!w0 || w0.section !== p0.section || rowIndex(w0.row) !== rowIndex(p0.row) + 1) continue
        if (Math.abs(w0.col - p0.col) > 1) continue
        if (w.some((s) => p.some((x) => x.id === s.id))) continue
        push([...p, ...w], false, false, 'split')
      }
    }
  }

  if (candidates.length < limit) {
    // Closest cluster around each anchor.
    for (const anchor of open) {
      const ar = rowIndex(anchor.row)
      const near = open
        .filter((s) => s.id !== anchor.id)
        .map((s) => ({ s, d: Math.abs(rowIndex(s.row) - ar) * 2 + Math.abs(s.col - anchor.col) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, size - 1)
        .map((x) => x.s)
      if (near.length === size - 1) push([anchor, ...near], false, false, 'cluster')
    }
  }

  const seen = new Set<string>()
  const ranked = candidates.sort((a, b) => b.score - a.score).filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
  const picks: Arrangement[] = []
  const used = new Set<string>()
  for (const c of ranked) {
    if (picks.length >= limit) break
    if (c.seatIds.some((id) => used.has(id))) continue
    picks.push(c)
    c.seatIds.forEach((id) => used.add(id))
  }
  return picks
}

/* ---------- Accessibility-first matching ---------- */

export interface AccessMatch {
  seatIds: string[]
  score: number
  reasons: string[]
  warnings: string[]
}

export function accessibilityAvailability(seats: readonly Seat[], profile: VenueProfile) {
  const idx = buildIndex(seats)
  const wheelchair = profile.wheelchairSpaces.map((id) => idx.get(id)).filter((s): s is Seat => Boolean(s))
  const companion = profile.companionSeats.map((id) => idx.get(id)).filter((s): s is Seat => Boolean(s))
  return {
    wheelchairTotal: wheelchair.length,
    wheelchairFree: wheelchair.filter(isSelectable).length,
    companionTotal: companion.length,
    companionFree: companion.filter(isSelectable).length,
    stepFreeFree: seats.filter((s) => profile.stepFreeRows.includes(s.row) && isSelectable(s)).length,
  }
}

export function matchAccessible(
  seats: readonly Seat[],
  profile: VenueProfile,
  prefs: AccessibilityPreference,
  count: number,
  traits = computeTraits(seats, profile),
): AccessMatch[] {
  const idx = buildIndex(seats)
  const n = Math.max(1, Math.min(4, count))
  const open = seats.filter(isSelectable)
  const results: AccessMatch[] = []

  const scoreSeat = (s: Seat) => {
    const t = traits.get(s.id)
    if (!t) return { score: -999, reasons: [] as string[], warnings: [] as string[] }
    let score = estimateView(s, profile).score / 4
    const reasons: string[] = []
    const warnings: string[] = []
    if (prefs.stepFree) {
      if (t.stepFree) { score += 30; reasons.push('Step-free row') } else score -= 40
    }
    if (prefs.easyExit || prefs.shortWalk) {
      score -= t.stepFreeExitM * 1.5
      if (t.stepFreeExitM < 6) reasons.push(`≈${Math.round(t.stepFreeExitM)} m to a step-free exit`)
    }
    if (prefs.lowStimulation) {
      if (t.quietZone) { score += 20; reasons.push(t.quietZone) }
      score -= t.noise * 20
    }
    if (prefs.clearSightline) {
      if (t.obstruction) { score -= 40; warnings.push(t.obstruction) } else reasons.push('No listed obstruction')
    }
    return { score, reasons, warnings }
  }

  if (prefs.wheelchair) {
    for (const id of profile.wheelchairSpaces) {
      const space = idx.get(id)
      if (!space || !isSelectable(space)) continue
      const ids = [space.id]
      const reasons = ['Designated wheelchair space (organizer-listed)']
      const warnings: string[] = []
      if (prefs.companion || n > 1) {
        const comp = profile.companionSeats
          .map((c) => idx.get(c))
          .filter((c): c is Seat => Boolean(c) && c!.row === space.row && Math.abs(c!.col - space.col) <= 1 && isSelectable(c!))
        if (comp[0]) { ids.push(comp[0].id); reasons.push(`Companion seat ${comp[0].id} beside it`) } else if (prefs.companion) warnings.push('The companion seat beside this space is taken')
      }
      // Fill remaining group seats nearest in the same row.
      const extra = open
        .filter((s) => s.row === space.row && !ids.includes(s.id))
        .sort((a, b) => Math.abs(a.col - space.col) - Math.abs(b.col - space.col))
      while (ids.length < n && extra.length) ids.push(extra.shift()!.id)
      const base = scoreSeat(space)
      results.push({ seatIds: ids, score: base.score + 100, reasons: [...reasons, ...base.reasons], warnings: [...warnings, ...base.warnings] })
    }
    if (results.length === 0) {
      return [{ seatIds: [], score: 0, reasons: [], warnings: ['All designated wheelchair spaces are taken. Join the waitlist or contact the organizer — they can often open extra spaces.'] }]
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 3)
  }

  // Non-wheelchair: contiguous windows scored by the average of their seats.
  const windows = n === 1 ? open.map((s) => [s]) : contiguousWindows(open, n)
  for (const w of windows) {
    const scored = w.map(scoreSeat)
    const reasons = [...new Set(scored.flatMap((x) => x.reasons))]
    const warnings = [...new Set(scored.flatMap((x) => x.warnings))]
    results.push({ seatIds: w.map((s) => s.id), score: sum(scored.map((x) => x.score)) / w.length, reasons, warnings })
  }
  results.sort((a, b) => b.score - a.score)
  const picks: AccessMatch[] = []
  const used = new Set<string>()
  for (const r of results) {
    if (picks.length >= 3) break
    if (r.seatIds.some((id) => used.has(id))) continue
    picks.push(r)
    r.seatIds.forEach((id) => used.add(id))
  }
  return picks
}

/* ---------- QuietZone comfort ranking ---------- */

export function rankComfort(
  seats: readonly Seat[],
  profile: VenueProfile,
  prefs: ComfortPreference,
  count: number,
  traits = computeTraits(seats, profile),
): AccessMatch[] {
  const n = Math.max(1, Math.min(4, count))
  const open = seats.filter(isSelectable)
  const windows = n === 1 ? open.map((s) => [s]) : contiguousWindows(open, n)
  const scored = windows.map((w) => {
    let score = 0
    const reasons = new Set<string>()
    for (const s of w) {
      const t = traits.get(s.id)
      if (!t) continue
      score += estimateView(s, profile).score / 6
      if (prefs.quieter && t.quietZone) { score += 35; reasons.add(t.quietZone) }
      if (prefs.lowNoise) { score -= t.noise * 50; if (t.noise < 0.3) reasons.add('Far from listed speakers (simulated estimate)') }
      if (prefs.lessCrowded) { score -= t.crowding * 45; if (t.crowding < 0.25) reasons.add('Few occupied seats around it right now') }
      if (prefs.easyExit) { score -= t.exitM * 1.6; if (t.exitM < 5) reasons.add(`≈${Math.round(t.exitM)} m to ${t.nearestExit}`) }
      if (prefs.personalSpace) { score += t.freeNeighbours * 8; if (t.freeNeighbours === 2 && n === 1) reasons.add('Both neighbouring seats free') }
    }
    return { seatIds: w.map((s) => s.id), score: score / w.length, reasons: [...reasons], warnings: [] as string[] }
  })
  scored.sort((a, b) => b.score - a.score)
  const picks: AccessMatch[] = []
  const used = new Set<string>()
  for (const r of scored) {
    if (picks.length >= 3) break
    if (r.seatIds.some((id) => used.has(id))) continue
    picks.push(r)
    r.seatIds.forEach((id) => used.add(id))
  }
  return picks
}

/* ---------- AutoRescue: ranked replacements for a lost seat ---------- */

export interface Replacement {
  seat: Seat
  priceDiff: number
  reasons: string[]
  score: number
}

export function rankReplacements(
  lost: Seat,
  seats: readonly Seat[],
  opts: { kept: readonly string[]; exclude: ReadonlySet<string>; profile?: VenueProfile; access?: AccessibilityPreference },
  limit = 3,
): Replacement[] {
  const idx = buildIndex(seats)
  const kept = opts.kept.map((id) => idx.get(id)).filter((s): s is Seat => Boolean(s))
  const r0 = rowIndex(lost.row)
  const stepRows = new Set(opts.profile?.stepFreeRows ?? [])
  const wheel = new Set(opts.profile?.wheelchairSpaces ?? [])
  const out: Replacement[] = []
  for (const s of seats) {
    if (!isSelectable(s) || opts.exclude.has(s.id) || s.id === lost.id) continue
    if (wheel.has(lost.id) && !wheel.has(s.id)) continue // a lost wheelchair space is only replaced by another one
    let score = Math.abs(rowIndex(s.row) - r0) * 3 + Math.abs(s.col - lost.col) + (s.section === lost.section ? 0 : 2) + Math.abs(s.price - lost.price) / 100
    const reasons: string[] = []
    const besideKept = kept.find((k) => k.row === s.row && Math.abs(k.col - s.col) === 1 && k.section === s.section)
    if (besideKept) { score -= 4; reasons.push(`Next to ${besideKept.id}, keeps your group together`) }
    if (s.row === lost.row) reasons.push('Same row')
    else reasons.push(`Row ${s.row}, ${Math.abs(rowIndex(s.row) - r0)} row${Math.abs(rowIndex(s.row) - r0) > 1 ? 's' : ''} ${rowIndex(s.row) > r0 ? 'back' : 'closer'}`)
    if (opts.access?.stepFree) {
      if (stepRows.has(s.row)) reasons.push('Step-free row')
      else score += 10
    }
    const priceDiff = s.price - lost.price
    out.push({ seat: s, priceDiff, reasons, score })
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit)
}

export const priceDiffLabel = (d: number) => (d === 0 ? 'same price' : d > 0 ? `₹${d} more` : `₹${-d} cheaper`)

/* ---------- Budget planner ---------- */

export type PriceTier = 'any' | 'premium' | 'standard' | 'economy'

export const tierOf = (row: string): Exclude<PriceTier, 'any'> => {
  const r = rowIndex(row)
  return r < 3 ? 'premium' : r < 7 ? 'standard' : 'economy'
}

export interface BudgetInput {
  budget: number
  tickets: number
  tier: PriceTier
  travelPerPerson: number
  foodPerPerson: number
}

export interface BudgetPlan {
  perSeatCap: number
  ticketCost: number | null
  extras: number
  total: number | null
  remaining: number | null
  status: 'ok' | 'tight' | 'over' | 'none'
  warnings: string[]
  tierPrices: Record<Exclude<PriceTier, 'any'>, number | null>
  recommended: Arrangement | null
  cheaper: Arrangement | null
}

export function planBudget(input: BudgetInput, seats: readonly Seat[]): BudgetPlan {
  const tickets = Math.max(1, Math.min(4, Math.round(input.tickets)))
  const extras = Math.max(0, input.travelPerPerson + input.foodPerPerson) * tickets
  const perSeatCap = Math.floor((input.budget - extras) / tickets)
  const open = seats.filter(isSelectable)
  const tierPrices: BudgetPlan['tierPrices'] = { premium: null, standard: null, economy: null }
  for (const s of open) {
    const t = tierOf(s.row)
    const cur = tierPrices[t]
    if (cur === null || s.price < cur) tierPrices[t] = s.price
  }
  const inTier = (s: Seat) => input.tier === 'any' || tierOf(s.row) === input.tier
  const warnings: string[] = []
  if (perSeatCap < 0) warnings.push('Travel and food alone exceed your budget.')
  const tierSeats = seats.filter((s) => !isSelectable(s) || inTier(s))
  const recommended = perSeatCap >= 0
    ? findGroupArrangements(tierSeats, { size: tickets, maxPricePerSeat: perSeatCap, preferAdjacent: true, preferSameRow: true }, 1)[0] ?? null
    : null
  const cheapestAll = findGroupArrangements(seats, { size: tickets, maxPricePerSeat: null, preferAdjacent: true, preferSameRow: true }, 12)
    .sort((a, b) => a.total - b.total)[0] ?? null
  const cheaper = cheapestAll && (!recommended || cheapestAll.total < recommended.total) ? cheapestAll : null
  const ticketCost = recommended?.total ?? null
  const total = ticketCost === null ? null : ticketCost + extras
  const remaining = total === null ? null : input.budget - total
  let status: BudgetPlan['status'] = 'none'
  if (total !== null && remaining !== null) status = remaining < 0 ? 'over' : remaining < input.budget * 0.1 ? 'tight' : 'ok'
  if (!recommended && perSeatCap >= 0) {
    warnings.push(`No ${tickets > 1 ? `${tickets} seats together` : 'seat'} at ₹${perSeatCap} or less${input.tier !== 'any' ? ` in ${input.tier}` : ''} right now.`)
  }
  if (status === 'tight') warnings.push('Less than 10% of your budget is left for surprises.')
  if (input.travelPerPerson === 0 && input.foodPerPerson === 0) warnings.push('Add travel and food — they are usually the costs students forget.')
  return { perSeatCap, ticketCost, extras, total, remaining, status, warnings, tierPrices, recommended, cheaper }
}
