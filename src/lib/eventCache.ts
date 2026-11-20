import type { EventSummary } from './api/types'

/** Summaries from the list, so the detail page can paint its header instantly (shared-element ViewTransition). */
export const summaryCache = new Map<string, EventSummary>()
