import { useEffect, useRef, useState, type FormEvent } from 'react'
import { aiAssist } from '../lib/api/client'
import { toApiError } from '../lib/api/errors'
import type { Kind, Seat } from '../lib/api/types'
import { money } from '../lib/format'
import { useLang, type Lang } from '../lib/i18n'
import { sfx } from '../lib/sound'
import { canSpeak, listenLang, normalizeHindi, setReadAloud, speak, stopSpeaking, useReadAloud } from '../lib/speech'
import { isSelectable, MAX_SEATS, tierLabel } from '../lib/seats'
import { Icon } from './Icon'
import './assistant.css'

const TIMEOUT_MS = 8000

type Chip = { label: string; hi: string; prompt: string }
const CHIPS: Record<Kind, Chip[]> = {
  cinema: [
    { label: 'Best view', hi: 'बढ़िया व्यू', prompt: "2 seats, best view, price doesn't matter" },
    { label: 'Together', hi: 'साथ में', prompt: '2 seats together near the screen' },
    { label: 'Cheapest', hi: 'सबसे सस्ती', prompt: 'cheapest 2 seats together' },
    { label: 'Recliners', hi: 'रिक्लाइनर', prompt: '2 recliner seats together' },
    { label: 'Wheelchair', hi: 'व्हीलचेयर', prompt: 'wheelchair space with a companion seat' },
    { label: 'Hinglish', hi: 'हिंग्लिश', prompt: 'do sasti seats saath mein, beech mein' },
  ],
  bus: [
    { label: 'Window', hi: 'खिड़की', prompt: '1 window seat near the front' },
    { label: 'Aisle', hi: 'गलियारा', prompt: 'aisle seat for legroom' },
    { label: 'Together', hi: 'साथ में', prompt: '2 seats together' },
    { label: 'Women only', hi: 'महिला सीट', prompt: '1 seat in the women only rows' },
    { label: 'Cheapest', hi: 'सबसे सस्ती', prompt: 'cheapest seat' },
    { label: 'Hinglish', hi: 'हिंग्लिश', prompt: 'ek khidki wali seat aage' },
  ],
}
const REFINE_CHIPS: Chip[] = [
  { label: 'Cheaper', hi: 'और सस्ती', prompt: 'cheaper' },
  { label: 'Closer to front', hi: 'और आगे', prompt: 'closer to the front' },
  { label: 'Another option', hi: 'दूसरा विकल्प', prompt: 'show me a different option' },
]

const TIER_HI: Record<string, string> = { classic: 'क्लासिक', prime: 'प्राइम', recliner: 'रिक्लाइनर', window: 'खिड़की', aisle: 'गलियारा', rear: 'पिछली बेंच' }

const COPY = {
  en: {
    hello: (k: Kind) => (k === 'cinema' ? 'Tell me the seats you want, in English, Hindi or Hinglish. I suggest, you choose.' : 'Tell me the seat you want, in English, Hindi or Hinglish. I suggest, you choose.'),
    gone: (ids: string[]) => `${ids.join(', ')} ${ids.length > 1 ? 'are' : 'is'} no longer available. Try again, or pick on the map.`,
    none: 'I could not find seats for that. Try a different request.',
    slow: 'That took over 8 seconds, so I stopped. You can still pick seats on the map.',
    stopped: 'Stopped. Your seats are unchanged.',
    down: 'I am unavailable right now. You can still choose seats on the map.',
    retry: 'Try again',
    use: 'Use these seats',
    picked: 'Selected',
    title: 'Seat assistant',
    placeholder: (k: Kind) => (k === 'cinema' ? '“2 seats together near the screen”' : '“window seat near the front”'),
    speakOn: 'Read replies aloud',
    speakOff: 'Stop reading replies aloud',
  },
  hi: {
    hello: () => 'बताइए आपको कैसी सीट चाहिए — हिंदी, अंग्रेज़ी या हिंग्लिश में। मैं सुझाव दूँगा, फ़ैसला आपका।',
    gone: (ids: string[]) => `${ids.join(', ')} अब उपलब्ध नहीं ${ids.length > 1 ? 'हैं' : 'है'}। दोबारा पूछें या मैप पर चुनें।`,
    none: 'इसके लिए सीटें नहीं मिलीं। कुछ और पूछकर देखें।',
    slow: '8 सेकंड से ज़्यादा लगे, इसलिए रोक दिया। आप मैप पर सीट चुन सकते हैं।',
    stopped: 'रोक दिया। आपकी सीटें नहीं बदलीं।',
    down: 'अभी सहायक उपलब्ध नहीं है। आप मैप पर सीट चुन सकते हैं।',
    retry: 'फिर कोशिश करें',
    use: 'इन सीटों को चुनें',
    picked: 'चुनी गईं',
    title: 'सीट सहायक',
    placeholder: (k: Kind) => (k === 'cinema' ? '“दो सीटें साथ में, स्क्रीन के पास”' : '“आगे खिड़की वाली सीट”'),
    speakOn: 'जवाब सुनाएँ',
    speakOff: 'जवाब सुनाना बंद करें',
  },
}

function hindiReply(ids: string[], seats: Seat[]): string {
  const picked = ids.map((id) => seats.find((s) => s.id === id)).filter((s): s is Seat => Boolean(s))
  const total = picked.reduce((n, s) => n + s.price, 0)
  const tiers = [...new Set(picked.map((s) => TIER_HI[s.section] ?? s.section))].join(', ')
  return `मैंने ${ids.length} सीट${ids.length > 1 ? 'ें' : ''} चुनी हैं: ${ids.join(', ')} (${tiers}) — कुल ₹${total.toLocaleString('en-IN')}। पसंद हों तो “इन सीटों को चुनें” दबाएँ।`
}

export interface Suggestion {
  seatIds: string[]
  reason: string
  dropped: string[]
}

interface Props {
  kind: Kind
  eventId: string
  seats: Seat[]
  selected: ReadonlySet<string>
  suggestion: Suggestion | null
  onSuggest: (s: Suggestion | null) => void
  onUse: (seatIds: string[]) => void
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

interface Msg {
  id: number
  from: 'me' | 'ai'
  text: string
  seatIds?: string[]
  error?: boolean
  retry?: string
}

/** Chat-only seat assistant: the conversation and suggestions, nothing about how it works. */
export function AiAssistant({ kind, eventId, seats, selected, suggestion, onSuggest, onUse }: Props) {
  const lang = useLang()
  const c = COPY[lang]
  const readAloud = useReadAloud()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [history, setHistory] = useState<{ prompt: string; seatIds: string[] }[]>([])
  const [listening, setListening] = useState(false)
  const seq = useRef(0)
  const abortRef = useRef<{ ctrl: AbortController; timedOut: boolean } | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const canListen = typeof window !== 'undefined' && speechCtor() !== null

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs.length, busy])

  useEffect(
    () => () => {
      abortRef.current?.ctrl.abort()
      recRef.current?.stop()
      stopSpeaking()
    },
    [],
  )

  const push = (m: Omit<Msg, 'id'>) => {
    setMsgs((cur) => [...cur, { ...m, id: ++seq.current }])
    if (m.from === 'ai' && readAloud) speak(m.text, lang)
  }

  const ask = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    abortRef.current?.ctrl.abort()
    const run = { ctrl: new AbortController(), timedOut: false }
    abortRef.current = run
    const timer = setTimeout(() => {
      run.timedOut = true
      run.ctrl.abort()
    }, TIMEOUT_MS)
    push({ from: 'me', text: q })
    setPrompt('')
    setBusy(true)
    onSuggest(null)
    try {
      const result = await aiAssist(
        {
          eventId,
          kind,
          prompt: normalizeHindi(q),
          maxSeats: MAX_SEATS,
          selectedSeatIds: [...selected],
          seats: seats.map(({ id, row, r, number, section, price, status, isAisle, heldByMe, tags }) => ({
            id, row, r, number, section, price, isAisle, tags, status: heldByMe ? 'available' : status,
          })),
          history: history.slice(-3),
        },
        () => {},
        run.ctrl.signal,
      )
      const { valid, dropped } = validateSuggestion(result.seatIds, seats)
      setHistory((h) => [...h, { prompt: q, seatIds: valid }])
      if (valid.length === 0) {
        push({ from: 'ai', text: dropped.length ? c.gone(dropped) : lang === 'hi' ? c.none : result.reason || c.none })
      } else {
        onSuggest({ seatIds: valid, reason: result.reason, dropped })
        push({ from: 'ai', text: lang === 'hi' ? hindiReply(valid, seats) : result.reason, seatIds: valid })
        sfx.ai()
      }
    } catch (e) {
      const err = toApiError(e)
      if (run.timedOut) push({ from: 'ai', error: true, text: c.slow, retry: q })
      else if (err.code === 'aborted') push({ from: 'ai', text: c.stopped })
      else push({ from: 'ai', error: true, text: c.down, retry: q })
    } finally {
      clearTimeout(timer)
      setBusy(false)
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
    rec.lang = listenLang(lang) // hi-IN when the UI is in Hindi; en-IN handles Hinglish
    rec.interimResults = true
    rec.onresult = (e) => {
      setPrompt(Array.from({ length: e.results.length }, (_, i) => e.results[i]?.[0]?.transcript ?? '').join(' '))
    }
    rec.onend = () => {
      setListening(false)
      inputRef.current?.focus()
    }
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  const chips = suggestion && history.length > 0 ? REFINE_CHIPS : CHIPS[kind]

  return (
    <section className="assistant chat" aria-labelledby="assistant-title">
      <header className="chat-head">
        <span className="assistant-orb" aria-hidden="true" data-thinking={busy || undefined} />
        <h2 id="assistant-title" className="chat-title">
          {c.title}
        </h2>
        {canSpeak() && (
          <button type="button" className="lk-icon-btn" aria-pressed={readAloud} aria-label={readAloud ? c.speakOff : c.speakOn} title={readAloud ? c.speakOff : c.speakOn} onClick={() => setReadAloud(!readAloud)}>
            <Icon name={readAloud ? 'volume' : 'mute'} size={17} />
          </button>
        )}
        <span className="badge badge-ai">AI</span>
      </header>

      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
        <div className="bubble-row" data-from="ai">
          <div className="bubble">
            <p>{c.hello(kind)}</p>
          </div>
        </div>
        {msgs.map((m) => (
          <div key={m.id} className="bubble-row" data-from={m.from}>
            <div className="bubble" data-error={m.error || undefined}>
              <p>{m.text}</p>
              {m.seatIds && m.seatIds.length > 0 && <SeatChips ids={m.seatIds} seats={seats} selected={selected} onUse={onUse} lang={lang} />}
              {m.retry && (
                <button type="button" className="chat-retry" onClick={() => void ask(m.retry!)}>
                  <Icon name="refresh" size={14} /> {c.retry}
                </button>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="bubble-row" data-from="ai">
            <div className="bubble is-typing" role="status" aria-label="Assistant is replying">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <div className="chat-chips" role="group" aria-label="Quick requests">
        {chips.map((chip) => (
          <button key={chip.label} type="button" className="chip" disabled={busy} onClick={() => { setPrompt(chip.prompt); void ask(chip.prompt) }}>
            {lang === 'hi' ? chip.hi : chip.label}
          </button>
        ))}
      </div>

      <form className="chat-input" onSubmit={onSubmit}>
        <label htmlFor="ai-prompt" className="sr-only">
          Describe the seats you want
        </label>
        <input
          ref={inputRef}
          id="ai-prompt"
          className="assistant-input"
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          placeholder={c.placeholder(kind)}
          autoComplete="off"
          enterKeyHint="send"
        />
        {canListen && !busy && (
          <button type="button" className="lk-icon-btn assistant-icon" onClick={toggleVoice} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak your request'}>
            <Icon name="mic" size={18} />
          </button>
        )}
        {busy ? (
          <button type="button" className="assistant-send is-stop" onClick={() => abortRef.current?.ctrl.abort()} aria-label="Stop">
            <Icon name="stop" size={16} />
          </button>
        ) : (
          <button type="submit" className="assistant-send" disabled={!prompt.trim()} aria-label="Send">
            <Icon name="send" size={18} />
          </button>
        )}
      </form>
    </section>
  )
}

function SeatChips({ ids, seats, selected, onUse, lang }: { ids: string[]; seats: Seat[]; selected: ReadonlySet<string>; onUse: (ids: string[]) => void; lang: Lang }) {
  const c = COPY[lang]
  const picked = ids.filter((id) => seats.some((s) => s.id === id))
  const allTaken = picked.length > 0 && picked.every((id) => selected.has(id))
  const total = picked.reduce((n, id) => n + (seats.find((s) => s.id === id)?.price ?? 0), 0)
  return (
    <div className="seat-suggest">
      <ul aria-label="Suggested seats">
        {picked.map((id) => {
          const s = seats.find((x) => x.id === id)!
          return (
            <li key={id}>
              <strong>{id}</strong>
              <span>
                {tierLabel(s.section)} · {money(s.price)}
              </span>
            </li>
          )
        })}
      </ul>
      {allTaken ? (
        <span className="seat-suggest-done">
          <Icon name="check" size={14} /> {c.picked} · {money(total)}
        </span>
      ) : (
        <button type="button" className="lk-btn lk-btn-primary lk-btn-sm" onClick={() => onUse(picked)}>
          {c.use} · {money(total)}
        </button>
      )}
    </div>
  )
}
