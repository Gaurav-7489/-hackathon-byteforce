import { Vector3 } from 'three'

/**
 * Venue geometry shared by the seating mesh and the "view from your seat"
 * camera. The stage sits at -Z; the audience fans out towards +Z in curved,
 * raked tiers.
 */
export const STAGE_CENTER = new Vector3(0, 0, -10)
export const TIERS = 14
export const ARC = 0.86 // half-angle in radians
const R0 = 9
const ROW_STEP = 1.1
const RISE = 0.42
const SEAT_PITCH = 0.7

export const tierRadius = (t: number) => R0 + t * ROW_STEP
export const tierHeight = (t: number) => 0.2 + t * RISE

export function seatPosition(t: number, theta: number, target = new Vector3()): Vector3 {
  const r = tierRadius(t)
  return target.set(STAGE_CENTER.x + r * Math.sin(theta), tierHeight(t), STAGE_CENTER.z + r * Math.cos(theta))
}

export interface VenueSeat {
  position: Vector3
  rotationY: number
  tier: number
  /** -1..1 position across the arc. */
  u: number
}

export function buildVenueSeats(): VenueSeat[] {
  const seats: VenueSeat[] = []
  for (let t = 0; t < TIERS; t++) {
    const r = tierRadius(t)
    const count = Math.floor((2 * ARC * r) / SEAT_PITCH)
    for (let i = 0; i < count; i++) {
      const u = (i / (count - 1)) * 2 - 1
      // Two radial aisles.
      if (Math.abs(Math.abs(u) - 0.36) < 0.035) continue
      const theta = u * ARC
      seats.push({ position: seatPosition(t, theta), rotationY: theta, tier: t, u })
    }
  }
  return seats
}

/** Map a real seat-map coordinate onto the 3D venue and return eye + look target. */
export function seatEye(
  seat: { rowIndex: number; col: number; totalRows: number; totalCols: number },
  eye = new Vector3(),
  look = new Vector3(),
) {
  const rowFrac = seat.totalRows > 1 ? seat.rowIndex / (seat.totalRows - 1) : 0
  const colFrac = seat.totalCols > 1 ? seat.col / (seat.totalCols - 1) : 0.5
  const t = 1 + rowFrac * (TIERS - 3)
  const theta = (colFrac * 2 - 1) * ARC * 0.9
  seatPosition(t, theta, eye)
  eye.y += 1.15
  look.set(STAGE_CENTER.x + Math.sin(theta) * 1.5, 3.2, STAGE_CENTER.z - 1.5)
  return { eye, look }
}
