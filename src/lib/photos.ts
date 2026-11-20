import type { Mode } from '../booking/data'

/** Local stills cut from the venue films in public/media (no third-party image host). */
export const PHOTO: Record<Mode, { src: string; video: string; alt: string }> = {
  cinema: { src: '/media/cinema.jpg', video: '/media/cinema.mp4', alt: 'A guest relaxing in a red recliner in a cinema hall' },
  bus: { src: '/media/bus.jpg', video: '/media/bus.mp4', alt: 'Choosing a coach seat in the SeatLock app' },
}
