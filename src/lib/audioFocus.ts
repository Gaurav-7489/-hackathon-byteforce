/**
 * One sound at a time. Whoever starts playing claims focus; the previous
 * owner is stopped (speech is cancelled, a film is muted). Short click
 * sounds never claim focus and are skipped while something is talking.
 */
let owner: { id: string; stop: () => void } | null = null

export function claimAudio(id: string, stop: () => void) {
  if (owner && owner.id !== id) owner.stop()
  owner = { id, stop }
}

export function releaseAudio(id: string) {
  if (owner?.id === id) owner = null
}

export const isTalking = () => typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking
