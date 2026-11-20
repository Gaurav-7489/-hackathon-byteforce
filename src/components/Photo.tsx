import { useState } from 'react'
import type { Mode } from '../booking/data'
import type { EventSummary } from '../lib/api/types'
import { PHOTO } from '../lib/photos'
import { Poster } from './Poster'

/** Venue photo for a row or card. Falls back to a brand gradient if it cannot load. */
export function VenuePhoto({ kind, className }: { kind: Mode; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <div className={`venue-fallback ${className ?? ''}`} data-kind={kind} aria-hidden="true" />
  return <img className={`venue-photo ${className ?? ''}`} src={PHOTO[kind].src} alt="" decoding="async" onError={() => setFailed(true)} />
}

/** Event media: the venue photo, with the generated poster as the fallback. */
export function EventMedia({ event, className }: { event: Pick<EventSummary, 'id' | 'kind' | 'title' | 'category' | 'poster'>; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <Poster event={event} className={className} />
  const p = PHOTO[event.kind]
  return <img className={`venue-photo ${className ?? ''}`} src={p.src} alt={p.alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
}
