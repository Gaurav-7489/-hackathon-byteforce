import type { Mode } from '../booking/data'

/** Unsplash photography per venue type. Resized on the CDN; falls back to generated art if blocked. */
export const PHOTO: Record<Mode, { id: string; alt: string }> = {
  cinema: { id: '1489599849927-2ee91cede3ba', alt: 'Rows of red cinema seats facing a dark screen' },
  bus: { id: '1544620347-c4fd4a3d5957', alt: 'An intercity coach on an open road' },
}

export const photoSrc = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`

export const photoSet = (id: string) => ({
  src: photoSrc(id, 1100),
  srcSet: `${photoSrc(id, 700)} 700w, ${photoSrc(id, 1100)} 1100w, ${photoSrc(id, 1600)} 1600w`,
})
