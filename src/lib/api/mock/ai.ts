import type { AiAssistRequest, AiResult, AiSeatContext } from '../types'

/**
 * Stand-in for the organizer's /ai/assist endpoint: a small intent parser
 * (English + common Hinglish) and a seat-group scorer. The real endpoint may be
 * an LLM; the client treats both the same and validates every suggestion.
 */

export interface Intent {
  count: number
  budget: number | null
  front: boolean
  back: boolean
  aisle: boolean
  window: boolean
  women: boolean
  recliner: boolean
  cheapest: boolean
  together: boolean
  middle: boolean
  bestView: boolean
  cheaper: boolean
  closer: boolean
}

const WORD_NUM: Record<string, number> = {
  one: 1, single: 1, ek: 1, two: 2, pair: 2, couple: 2, do: 2, dono: 2, three: 3, teen: 3, four: 4, char: 4, chaar: 4,
}

export function parseIntent(raw: string, previous?: Intent): Intent {
  const p = raw.toLowerCase()
  const has = (re: RegExp) => re.test(p)
  let count = 0
  const digit = p.match(/\b([1-9])\s*(?:seats?|tickets?|log|people|friends|jan[ae]?)\b/) ?? p.match(/^\s*([1-9])\b/)
  if (digit?.[1]) count = Number(digit[1])
  if (!count) {
    for (const [w, n] of Object.entries(WORD_NUM)) {
      if (new RegExp(`\\b${w}\\b`).test(p)) {
        count = n
        break
      }
    }
  }
  const budgetMatch =
    p.match(/(?:under|below|less than|max|upto|up to|within|<)\s*(?:₹|rs\.?|inr)?\s*(\d{2,5})/) ??
    p.match(/(?:₹|rs\.?|inr)?\s*(\d{2,5})\s*(?:se kam|ke andar|tak|or less|max)/)
  const refine = Boolean(previous) && has(/\b(cheaper|sasta|closer|aage|instead|another|different|aur|more)\b/)
  const base: Intent =
    refine && previous
      ? { ...previous }
      : { count: 0, budget: null, front: false, back: false, aisle: false, window: false, women: false, recliner: false, cheapest: false, together: false, middle: false, bestView: false, cheaper: false, closer: false }
  return {
    count: count || base.count || (has(/\bseat\b/) && !has(/seats/) ? 1 : 2),
    budget: budgetMatch?.[1] ? Number(budgetMatch[1]) : base.budget,
    front: base.front || has(/near (the )?(stage|screen)|front|close to|paas|aage|first rows?|driver/),
    back: has(/\bback\b|peeche|last rows?|rear/),
    aisle: base.aisle || has(/aisle|corner|edge|kinare|leg ?room/),
    window: base.window || has(/window|khidki|view outside|sunrise|sunset/),
    women: base.women || has(/women|ladies|lady|female|mahila/),
    recliner: base.recliner || has(/recliner|luxury|premium|lie back/),
    cheapest: base.cheapest || has(/cheap|budget|sast[aie]|lowest|kam (?:price|daam)/),
    together: base.together || has(/together|same row|saath|side by side|adjacent|ek (?:hi )?row|next to/),
    middle: base.middle || has(/middle|cent(?:er|re)|beech|central/),
    bestView: base.bestView || has(/best view|price doesn.?t matter|achh?a view|best seats?/),
    cheaper: refine && has(/cheaper|sasta/),
    closer: refine && has(/closer|aage/),
  }
}

function scoreGroup(group: AiSeatContext[], intent: Intent, kind: AiAssistRequest['kind'], rows: number, cols: number, prevTotal: number | null): number {
  const avgRow = group.reduce((s, x) => s + x.r, 0) / group.length
  const total = group.reduce((s, x) => s + x.price, 0)
  const centre = (cols - 1) / 2
  const centredness = 1 - group.reduce((s, x) => s + Math.abs(x.number - 1 - centre), 0) / group.length / Math.max(1, centre)
  const ideal = kind === 'cinema' ? rows * 0.62 : rows * 0.3
  let score = 0
  if (intent.front || intent.closer) score += (rows - avgRow) * 6
  if (intent.back) score += avgRow * 4
  if (intent.bestView) score += (rows - Math.abs(avgRow - ideal)) * 5 + centredness * 30
  if (intent.middle) score += centredness * 40
  if (intent.aisle) score += group.some((x) => x.isAisle) ? 30 : -20
  if (intent.window) score += group.some((x) => x.tags.includes('Window')) ? 40 : -30
  if (intent.women) score += group.every((x) => x.tags.includes('Women only')) ? 60 : -10
  if (intent.recliner) score += group.every((x) => x.section === 'recliner') ? 60 : -20
  if (intent.cheapest || intent.cheaper) score -= total / 10
  if (intent.cheaper && prevTotal !== null && total >= prevTotal) score -= 200
  if (!intent.front && !intent.back && !intent.bestView) score += (rows - Math.abs(avgRow - ideal)) * 2 + centredness * 8
  if (!intent.women && group.some((x) => x.tags.includes('Women only'))) score -= 15
  return score
}

export function recommend(req: AiAssistRequest): AiResult {
  const previous = req.history.at(-1)
  const prevIntent = previous ? parseIntent(previous.prompt) : undefined
  const intent = parseIntent(req.prompt, prevIntent)
  const n = Math.min(Math.max(intent.count, 1), req.maxSeats)
  const open = req.seats.filter((s) => s.status === 'available' && (intent.budget === null || s.price <= intent.budget))
  const prevTotal = previous ? previous.seatIds.reduce((s, id) => s + (req.seats.find((x) => x.id === id)?.price ?? 0), 0) : null
  const rows = Math.max(1, ...req.seats.map((s) => s.r + 1))
  const cols = Math.max(1, ...req.seats.map((s) => s.number))

  // Contiguous runs inside one row (bus: same side of the aisle counts as together).
  const byRow = new Map<number, AiSeatContext[]>()
  for (const s of open) byRow.set(s.r, [...(byRow.get(s.r) ?? []), s])
  const groups: AiSeatContext[][] = []
  for (const seats of byRow.values()) {
    seats.sort((a, b) => a.number - b.number)
    for (let i = 0; i + n <= seats.length; i++) {
      const g = seats.slice(i, i + n)
      if (g.every((s, k) => k === 0 || s.number === (g[k - 1]?.number ?? 0) + 1)) groups.push(g)
    }
  }

  const budgetText = intent.budget !== null ? ` under ₹${intent.budget}` : ''
  if (groups.length === 0) {
    if (n > 1 && open.length >= n && !intent.together) {
      const loose = [...open].sort((a, b) => a.price - b.price).slice(0, n)
      return { seatIds: loose.map((s) => s.id), reason: `No ${n} adjacent seats${budgetText}, so these are the closest separate options.` }
    }
    return { seatIds: [], reason: `I couldn't find ${n} seat${n > 1 ? 's' : ''} together${budgetText} right now. Try a higher budget or fewer seats.` }
  }

  groups.sort((a, b) => scoreGroup(b, intent, req.kind, rows, cols, prevTotal) - scoreGroup(a, intent, req.kind, rows, cols, prevTotal))
  const best = groups[0] ?? []
  const first = best[0]
  const total = best.reduce((s, x) => s + x.price, 0)
  const why: string[] = []
  const front = first ? first.r < rows * 0.3 : false
  if (intent.front || intent.closer) why.push(front ? (req.kind === 'cinema' ? 'close to the screen' : 'near the front') : 'as close to the front as is free')
  if (intent.window && best.some((s) => s.tags.includes('Window'))) why.push('with a window')
  if (intent.aisle && best.some((s) => s.isAisle)) why.push('on the aisle')
  if (intent.women && best.every((s) => s.tags.includes('Women only'))) why.push('in the women-only rows')
  if (intent.recliner && best.every((s) => s.section === 'recliner')) why.push('powered recliners')
  if (intent.bestView) why.push(req.kind === 'cinema' ? 'centred with the best sightline' : 'smooth ride ahead of the rear axle')
  if (intent.cheapest || intent.cheaper) why.push('cheapest matching option')
  if (n > 1) why.push('side by side')
  const where = first ? (req.kind === 'cinema' ? `Row ${first.row}` : `Row ${first.row}`) : ''
  const reason = `${where}: ${why.length ? why.join(', ') : 'balanced view and price'} — ₹${total} total${budgetText ? ` (₹${first?.price ?? 0} each)` : ''}.`
  return { seatIds: best.map((s) => s.id), reason }
}
