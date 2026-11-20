import { useSyncExternalStore } from 'react'
import { claimAudio, releaseAudio } from './audioFocus'
import type { Lang } from './i18n'

/**
 * Voice layer on the browser's Web Speech APIs:
 * - speechSynthesis reads AI replies, summaries and tickets aloud (hi-IN / en-IN)
 * - SpeechRecognition (in AiAssistant) listens in the selected language
 * Nothing is sent to a third party by this code.
 */
const KEY = 'seatlock-read-aloud'
const listeners = new Set<() => void>()

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function readAloudOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function setReadAloud(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* storage blocked */
  }
  if (!on) stopSpeaking()
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useReadAloud(): boolean {
  return useSyncExternalStore(subscribe, readAloudOn, () => false)
}

export function speak(text: string, lang: Lang) {
  if (!canSpeak()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const code = lang === 'hi' ? 'hi-IN' : 'en-IN'
  u.lang = code
  const voices = synth.getVoices()
  const voice = voices.find((v) => v.lang === code) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang))
  if (voice) u.voice = voice
  u.rate = lang === 'hi' ? 0.95 : 1
  // Speech takes audio focus: a film playing with sound is muted first.
  claimAudio('speech', () => synth.cancel())
  u.onend = () => releaseAudio('speech')
  synth.speak(u)
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}

/** Speech-recognition language for the current UI language. */
export const listenLang = (lang: Lang) => (lang === 'hi' ? 'hi-IN' : 'en-IN')

const HI_WORDS: [RegExp, string][] = [
  [/एक/g, '1'],
  [/दो/g, '2'],
  [/तीन/g, '3'],
  [/चार/g, '4'],
  [/सीटें|सीटों|सीट/g, 'seats'],
  [/खिड़की|खिडकी/g, 'window'],
  [/गलियारा|गलियारे/g, 'aisle'],
  [/सस्ती|सस्ते|सस्ता|कम दाम/g, 'cheapest'],
  [/साथ में|साथ/g, 'together'],
  [/आगे/g, 'front'],
  [/पीछे/g, 'back'],
  [/बीच/g, 'middle'],
  [/महिला|महिलाओं/g, 'women only'],
  [/रिक्लाइनर|आराम/g, 'recliner'],
  [/अच्छा व्यू|बढ़िया व्यू|सबसे अच्छा/g, 'best view'],
  [/स्क्रीन/g, 'screen'],
  [/पास/g, 'near'],
  [/व्हीलचेयर/g, 'wheelchair'],
]

/** Turns spoken or typed Hindi (Devanagari) into the Hinglish/English terms the seat parser understands. */
export function normalizeHindi(text: string): string {
  let out = text.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
  for (const [re, en] of HI_WORDS) out = out.replace(re, ` ${en} `)
  return out.replace(/\s+/g, ' ').trim()
}

/** Voice guide: speaks only when the user turned voice on in the header. */
export function narrate(text: string, lang: Lang) {
  if (readAloudOn()) speak(text, lang)
}
