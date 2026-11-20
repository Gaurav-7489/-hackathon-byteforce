import type { AiAssistRequest, AiResult, AiSeatContext } from '../types'

/**
 * Stand-in for the organizer's /ai/assist endpoint. A small intent parser
 * (English + common Hinglish) and a seat-group scorer. The real endpoint may be
 * an LLM; the client treats both identically and validates every suggestion.
 */

interface Intent {
  count: number
  budget: number | null
  nearStage: boolean
  back: boolean
  aisle: boolean
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
      if (new RegExp(`\\b${w}\\b`).test(p)) { count = n; break }
    }
  }
  const budgetMatch =
    p.match(/(?:under|below|less than|max|upto|up to|within|<)\s*(?:₹|rs\.?|inr)?\s*(\d{2,5})/) ??
    p.match(/(?:₹|rs\.?|inr)?\s*(\d{2,5})\s*(?:se kam|ke andar|tak|or less|max)/)
  const refine = Boolean(previous) && has(/\b(cheaper|sasta|closer|aage|instead|another|different|aur|more)\b/)
  const base: Intent = refine && previous ? { ...previous } : {
    count: 0, budget: null, nearStage: false, back: false, aisle: false, cheapest: false,
    together: false, middle: false, bestView: false, cheaper: false, closer: false,
  }
  return {
    count: count || base.count || (has(/\bseat\b/) && !has(/seats/) ? 1 : 2),
    budget: budgetMatch?.[1] ? Number(budgetMatch[1]) : base.budget,
    nearStage: base.nearStage || has(/near (the )?stage|front|close to|stage ke paas|aage|paas|first rows?/),
    back: has(/\bback\b|peeche|last rows?|rear/),
    aisle: base.aisle || has(/aisle|corner|edge|kinare|side seat/),
    cheapest: base.cheapest || has(/cheap|budget|sasta|lowest|kam (?:price|daam)/),
    together: base.together || has(/together|same row|saath|side by side|adjacent|ek (?:hi )?row|next to/),
    middle: base.middle || has(/middle|cent(?:er|re)|beech|central/),
    bestView: base.bestView || has(/best view|price doesn.?t matter|premium|achh?a view|best seats?/),
    cheaper: refine && has(/cheaper|sasta/),
    closer: refine && has(/closer|aage/),
  }
}

function rowIndex(row: string) {
  return 'ABCDEFGHJK'.indexOf(row)
}

function scoreGroup(group: AiSeatContext[], intent: Intent, prevTotal: number | null): number {
  const avgRow = group.reduce((s, x) => s + rowIndex(x.row), 0) / group.length
  const total = group.reduce((s, x) => s + x.price, 0)
  const centerness = group.filter((x) => x.section === 'center').length / group.length
  let score = 0
  if (intent.nearStage || intent.closer) score += (10 - avgRow) * 6
  if (intent.back) score += avgRow * 4
  if (intent.bestView) score += (10 - Math.abs(avgRow - 3)) * 5 + centerness * 25
  if (intent.middle) score += centerness * 40
  if (intent.aisle) score += group.some((x) => x.isAisle) ? 30 : -20
  if (intent.cheapest || intent.cheaper) score -= total / 10
  if (intent.cheaper && prevTotal !== null && total >= prevTotal) score -= 200
  if (!intent.nearStage && !intent.back && !intent.bestView) score += (10 - Math.abs(avgRow - 4)) * 2 + centerness * 8
  return score
}

export function recommend(req: AiAssistRequest): AiResult {
  const previous = req.history.at(-1)
  const prevIntent = previous ? parseIntent(previous.prompt) : undefined
  const intent = parseIntent(req.prompt, prevIntent)
  const n = Math.min(Math.max(intent.count, 1), req.maxSeats)
  const open = req.seats.filter((s) => s.status === 'available' && (intent.budget === null || s.price <= intent.budget))
  const prevTotal = previous
    ? previous.seatIds.reduce((s, id) => s + (req.seats.find((x) => x.id === id)?.price ?? 0), 0)
    : null

  // Contiguous groups in the same row and section.
  const byRow = new Map<string, AiSeatContext[]>()
  for (const s of open) {
    const key = `${s.row}-${s.section}`
    byRow.set(key, [...(byRow.get(key) ?? []), s])
  }
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

  groups.sort((a, b) => scoreGroup(b, intent, prevTotal) - scoreGroup(a, intent, prevTotal))
  const best = groups[0] ?? []
  const first = best[0]
  const total = best.reduce((s, x) => s + x.price, 0)
  const where = first ? `Row ${first.row}${first.section === 'center' ? ', centre block' : `, ${first.section} block`}` : ''
  const why: string[] = []
  if (intent.nearStage || intent.closer) why.push(rowIndex(first?.row ?? 'K') < 3 ? 'right by the stage' : 'as close to the stage as is free')
  if (intent.aisle && best.some((s) => s.isAisle)) why.push('on the aisle')
  if (intent.bestView) why.push('centred with a clear sightline')
  if (intent.cheapest || intent.cheaper) why.push('cheapest matching option')
  if (n > 1) why.push('side by side')
  const reason = `${where}: ${why.length ? why.join(', ') : 'balanced view and price'} — ₹${total} total${budgetText ? ` (₹${best[0]?.price ?? 0} each)` : ''}.`
  return { seatIds: best.map((s) => s.id), reason }
}
