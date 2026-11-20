import { useState } from 'react'
import type { Mode } from '../booking/data'
import { PHOTO, photoSet } from '../lib/photos'
import { Poster } from './Poster'
import type { EventSummary } from '../lib/api/types'

/** Venue photo for a card or hero. If the image cannot load, the generated poster art takes its place. */
export function VenuePhoto({ kind, className, sizes = '(min-width: 768px) 33vw, 100vw' }: { kind: Mode; className?: string; sizes?: string }) {
  const [failed, setFailed] = useState(false)
  const p = PHOTO[kind]
  if (failed) return <div className={`venue-fallback ${className ?? ''}`} data-kind={kind} aria-hidden="true" />
  const { src, srcSet } = photoSet(p.id)
  return (
    <img className={`venue-photo ${className ?? ''}`} src={src} srcSet={srcSet} sizes={sizes} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  )
}

/** Event media: the venue photo as the base, with the title-bearing poster art as the fallback. */
export function EventMedia({ event, className }: { event: Pick<EventSummary, 'id' | 'kind' | 'title' | 'category' | 'poster'>; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <Poster event={event} className={className} />
  const p = PHOTO[event.kind]
  const { src, srcSet } = photoSet(p.id)
  return (
    <img className={`venue-photo ${className ?? ''}`} src={src} srcSet={srcSet} sizes="(min-width: 768px) 40vw, 100vw" alt={p.alt} decoding="async" onError={() => setFailed(true)} />
  )
}
