import type { Mode } from '../booking/data'

/** Local stills cut from the venue films in public/media. */
export const PHOTO: Record<Mode, { src: string; video: string; alt: string }> = {
  cinema: { src: '/media/cinema.jpg', video: '/media/cinema.mp4', alt: 'A guest relaxing in a red recliner in a cinema hall' },
  bus: { src: '/media/bus.jpg', video: '/media/bus.mp4', alt: 'Choosing a coach seat in the SeatLock app' },
}

/**
 * Photos bundled in public/media/photos (Unsplash licence; sources in README).
 * Bus trips show the destination, films show their mood.
 */
const SCENES: Record<string, string> = {
  hyderabad: 'Charminar in Hyderabad',
  chennai: 'A South Indian temple tower in Chennai',
  goa: 'A palm-lined beach in Goa',
  mumbai: 'The Gateway of India in Mumbai at sunset',
  northbound: 'Northern lights over a dark forest',
  monsoon: 'Rain drops on a window with city lights behind',
  kites: 'Hawa Mahal in Jaipur, the city of the kite festival',
  saffron: 'A warm-lit stage in front of a crowd',
  orbit: 'A space station above the Earth',
}

const FILM_KEY: Record<string, string> = {
  Northbound: 'northbound',
  'The Monsoon Ledger': 'monsoon',
  'Paper Kites': 'kites',
  'Saffron Nights': 'saffron',
  'Low Orbit': 'orbit',
}

export const photo = (key: string) => `/media/photos/${key}.jpg`

/** Photo for one show or trip; falls back to the venue still. */
export function eventPhoto(e: { kind: Mode; title: string }): { src: string; alt: string } {
  const key = e.kind === 'bus' ? (e.title.split('→')[1] ?? '').trim().toLowerCase() : FILM_KEY[e.title]
  if (key && SCENES[key]) return { src: photo(key), alt: SCENES[key]! }
  return { src: PHOTO[e.kind].src, alt: PHOTO[e.kind].alt }
}
