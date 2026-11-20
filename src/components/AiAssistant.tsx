import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { aiAssist } from '../lib/api/client'
import { toApiError } from '../lib/api/errors'
import type { Seat } from '../lib/api/types'
import { money } from '../lib/format'
import { spring } from '../lib/motion'
import { isSelectable, MAX_SEATS, totalFor } from '../lib/seats'
import { Icon } from './Icon'
import './assistant.css'

const TIMEOUT_MS = 8000

const CHIPS = [
  { label: 'Near stage', prompt: '2 seats together near the stage' },
  { label: 'Aisle', prompt: 'aisle seat in the middle section' },
  { label: 'Cheapest', prompt: 'cheapest 2 seats together' },
  { label: '4 in a row', prompt: '4 seats in the same row' },
  { label: 'Best view', prompt: "best view, price doesn't matter" },
  { label: 'Under ₹300', prompt: '2 seats together near the stage under ₹300 each' },
]
const REFINE_CHIPS = [
  { label: 'Cheaper', prompt: 'cheaper' },
  { label: 'Closer', prompt: 'closer to the stage' },
  { label: 'Another option', prompt: 'show me a different option' },
]

type Phase = 'idle' | 'thinking' | 'done' | 'empty' | 'error' | 'timeout' | 'stopped'

export interface Suggestion {
  seatIds: string[]
  reason: string
  dropped: string[]
}

interface Props {
  eventId: string
  seats: Seat[]
  selected: ReadonlySet<string>
  suggestion: Suggestion | null
  onSuggest: (s: Suggestion | null) => void
  onUse: (seatIds: string[]) => void
  /** Pre-filled request (e.g. from the event matchmaker). Never sent automatically. */
  initialPrompt?: string
}

/* Minimal Web Speech API typing (not in lib.dom). */
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechCtor = new () => SpeechRecognitionLike
const speechCtor = (): SpeechCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Validates AI output: seat must exist, be selectable now, and respect the 4-seat limit. */
export function validateSuggestion(ids: string[], seats: Seat[]): { valid: string[]; dropped: string[] } {
  const valid: string[] = []
  const dropped: string[] = []
  for (const id of new Set(ids)) {
    const seat = seats.find((s) => s.id === id)
    if (seat && isSelectable(seat) && valid.length < MAX_SEATS) valid.push(id)
    else dropped.push(id)
  }
  return { valid, dropped }
}

export function AiAssistant({ eventId, seats, selected, suggestion, onSuggest, onUse, initialPrompt = '' }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [phase, setPhase] = useState<Phase>('idle')
  const [steps, setSteps] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<{ prompt: string; seatIds: string[] }[]>([])
  const [listening, setListening] = useState(false)
  const abortRef = useRef<{ ctrl: AbortController; timedOut: boolean } | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canListen = typeof window !== 'undefined' && speechCtor() !== null

  useEffect(() => () => {
    abortRef.current?.ctrl.abort()
    recRef.current?.stop()
  }, [])

  const ask = async (text: string) => {
    const q = text.trim()
    if (!q || phase === 'thinking') return
    abortRef.current?.ctrl.abort()
    const run = { ctrl: new AbortController(), timedOut: false }
    abortRef.current = run
    const timer = setTimeout(() => {
      run.timedOut = true
      run.ctrl.abort()
    }, TIMEOUT_MS)
    setPhase('thinking')
    setSteps([])
    setMessage('')
    onSuggest(null)
    try {
      const result = await aiAssist(
        {
          eventId,
          prompt: q,
          maxSeats: MAX_SEATS,
          selectedSeatIds: [...selected],
          // Current availability + prices as context.
          seats: seats.map(({ id, row, number, section, price, status, isAisle, heldByMe }) => ({
            id, row, number, section, price, isAisle, status: heldByMe ? 'available' : status,
          })),
          history: history.slice(-3),
        },
        (chunk) => { if (chunk.type === 'progress') setSteps((s) => [...s, chunk.text]) },
        run.ctrl.signal,
      )
      const { valid, dropped } = validateSuggestion(result.seatIds, seats)
      setHistory((h) => [...h, { prompt: q, seatIds: valid }])
      if (valid.length === 0) {
        setPhase('empty')
        setMessage(dropped.length
          ? `The assistant suggested ${dropped.join(', ')}, but ${dropped.length > 1 ? 'those seats are' : 'that seat is'} no longer available. Try again or pick manually.`
          : result.reason)
        return
      }
      onSuggest({ seatIds: valid, reason: result.reason, dropped })
      setPhase('done')
      setPrompt('')
    } catch (e) {
      const err = toApiError(e)
      if (run.timedOut) {
        setPhase('timeout')
        setMessage('The assistant took longer than 8 seconds, so we stopped it. The seat map still works — pick seats manually or try a shorter request.')
      } else if (err.code === 'aborted') {
        setPhase('stopped')
        setMessage('Stopped. Your seat selection is unchanged.')
      } else {
        setPhase('error')
        setMessage('The assistant is unavailable right now. You can still choose seats on the map.')
      }
    } finally {
      clearTimeout(timer)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void ask(prompt)
  }

  const toggleVoice = () => {
    const Ctor = speechCtor()
    if (!Ctor) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new Ctor()
    rec.lang = 'en-IN' // handles Hinglish reasonably
    rec.interimResults = true
    rec.onresult = (e) => {
      const text = Array.from({ length: e.results.length }, (_, i) => e.results[i]?.[0]?.transcript ?? '').join(' ')
      setPrompt(text)
    }
    rec.onend = () => { setListening(false); inputRef.current?.focus() }
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  const chips = phase === 'done' && history.length > 0 ? REFINE_CHIPS : CHIPS
  const suggestedSeats = suggestion ? seats.filter((s) => suggestion.seatIds.includes(s.id)) : []

  return (
    <section className="assistant" aria-labelledby="assistant-title">
      <header className="assistant-head">
        <span className="assistant-orb" aria-hidden="true" data-thinking={phase === 'thinking' || undefined} />
        <div>
          <h2 id="assistant-title" className="assistant-title">Seat assistant</h2>
          <p className="assistant-sub">Describe what you want — it suggests, you decide.</p>
        </div>
      </header>

      <form className="assistant-form" onSubmit={onSubmit}>
        <label htmlFor="ai-prompt" className="sr-only">Describe the seats you want</label>
        <div className="assistant-input-wrap" data-active={phase === 'thinking' || undefined}>
          <input
            ref={inputRef}
            id="ai-prompt"
            className="assistant-input"
            value={prompt}
            onChange={(e) => setPrompt(e.currentTarget.value)}
            placeholder={history.length ? 'Refine: “cheaper”, “closer”…' : '“2 seats together near the stage under ₹300”'}
            autoComplete="off"
            enterKeyHint="send"
            disabled={phase === 'thinking'}
          />
          {canListen && phase !== 'thinking' && (
            <button type="button" className="assistant-icon" onClick={toggleVoice} aria-pressed={listening} aria-label={listening ? 'Stop voice input' : 'Speak your request'}>
              <Icon name="mic" size={18} />
            </button>
          )}
          {phase === 'thinking' ? (
            <button type="button" className="assistant-send is-stop" onClick={() => abortRef.current?.ctrl.abort()} aria-label="Stop the assistant">
              <Icon name="stop" size={16} />
            </button>
          ) : (
            <button type="submit" className="assistant-send" disabled={!prompt.trim()} aria-label="Ask the assistant">
              <Icon name="send" size={18} />
            </button>
          )}
        </div>
        <div className="assistant-chips" role="group" aria-label={history.length && phase === 'done' ? 'Refine suggestion' : 'Suggested requests'}>
          {chips.map((c) => (
            <button key={c.label} type="button" className="chip" disabled={phase === 'thinking'} onClick={() => { setPrompt(c.prompt); void ask(c.prompt) }}>
              {c.label}
            </button>
          ))}
        </div>
      </form>

      <div className="assistant-output" aria-live="polite" aria-busy={phase === 'thinking'}>
        <AnimatePresence mode="popLayout" initial={false}>
          {phase === 'thinking' && (
            <motion.ol key="steps" className="assistant-steps" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.soft}>
              {steps.length === 0 && <li className="is-current">Connecting to the assistant…</li>}
              {steps.map((s, i) => (
                <li key={i} className={i === steps.length - 1 ? 'is-current' : 'is-done'}>
                  {i === steps.length - 1 ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={14} />}
                  {s}
                </li>
              ))}
            </motion.ol>
          )}

          {phase === 'done' && suggestion && (
            <motion.div key={suggestion.seatIds.join()} className="suggestion" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring.soft}>
              <div className="suggestion-top">
                <span className="badge badge-ai"><Icon name="sparkle" size={12} /> AI-generated</span>
                <span className="suggestion-total num">{money(totalFor(suggestion.seatIds, seats))}</span>
              </div>
              <ul className="suggestion-seats" aria-label="Suggested seats">
                {suggestedSeats.map((s) => (
                  <li key={s.id}><strong>{s.id}</strong><span>{money(s.price)}</span></li>
                ))}
              </ul>
              <p className="suggestion-reason">{suggestion.reason}</p>
              {suggestion.dropped.length > 0 && (
                <p className="suggestion-note"><Icon name="info" size={14} /> Removed {suggestion.dropped.join(', ')} — no longer available or over the 4-seat limit.</p>
              )}
              <div className="suggestion-actions">
                <button type="button" className="btn btn-primary" onClick={() => onUse(suggestion.seatIds)}>
                  <Icon name="check" size={16} /> Use these seats
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { onSuggest(null); setPhase('idle') }}>Dismiss</button>
              </div>
              <p className="suggestion-fine">Highlighted on the map. Nothing is held until you press Hold seats.</p>
            </motion.div>
          )}

          {(phase === 'empty' || phase === 'error' || phase === 'timeout' || phase === 'stopped') && (
            <motion.div key={phase} className="alert" data-tone={phase === 'stopped' || phase === 'empty' ? 'info' : 'warning'} role={phase === 'error' || phase === 'timeout' ? 'alert' : undefined} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Icon name={phase === 'stopped' ? 'info' : 'alert'} size={18} />
              <div>
                <span>{message}</span>
                {(phase === 'error' || phase === 'timeout') && prompt.trim() && (
                  <button type="button" className="btn btn-ghost assistant-retry" onClick={() => void ask(prompt)}><Icon name="refresh" size={16} /> Retry</button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
