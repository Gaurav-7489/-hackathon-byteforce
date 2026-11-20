import { useSyncExternalStore } from 'react'

/**
 * Small synthesised UI sounds (Web Audio, no files to download). Sounds only
 * ever play as a reaction to a tap, so browsers allow them. Toggle in the header.
 */
const KEY = 'seatlock-sound'
const listeners = new Set<() => void>()
let ctx: AudioContext | null = null

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(subscribe, soundOn, () => true)
}

function audio(): AudioContext | null {
  if (!soundOn()) return null
  try {
    if (!ctx) {
      const w = window as unknown as { webkitAudioContext?: typeof AudioContext }
      const Ctor = window.AudioContext ?? w.webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tones(freqs: number[], dur: number, type: OscillatorType, gain: number, gap: number) {
  const c = audio()
  if (!c) return
  const t0 = c.currentTime + 0.01
  freqs.forEach((f, i) => {
    const start = t0 + i * gap
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.value = f
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(gain, start + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(g).connect(c.destination)
    osc.start(start)
    osc.stop(start + dur + 0.03)
  })
}

export const sfx = {
  tap: () => tones([880], 0.05, 'triangle', 0.04, 0),
  select: () => tones([659, 988], 0.09, 'sine', 0.07, 0.05),
  deselect: () => tones([523, 392], 0.08, 'sine', 0.05, 0.05),
  success: () => tones([523, 659, 784, 1046], 0.22, 'sine', 0.08, 0.09),
  error: () => tones([220, 165], 0.22, 'square', 0.03, 0.12),
  warn: () => tones([660, 550], 0.16, 'triangle', 0.06, 0.1),
  ai: () => tones([784, 1175], 0.18, 'sine', 0.05, 0.08),
  chime: () => tones([1319, 1568], 0.3, 'sine', 0.04, 0.12),
}
