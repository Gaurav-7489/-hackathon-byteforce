/** SeatLock wordmark for the light "ledger" surfaces: a seat glyph with a signal-yellow lock dot. */
export function Mark({ invert = false }: { invert?: boolean }) {
  const ink = invert ? '#ffffff' : '#0f1a14'
  return (
    <span className="lk-mark" style={{ color: ink }}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <path d="M6 13V8.5A3.5 3.5 0 0 1 9.5 5h7A3.5 3.5 0 0 1 20 8.5V13" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <rect x="3.5" y="12.5" width="19" height="6.5" rx="2" fill={ink} />
        <path d="M7 19v2.5M19 19v2.5" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="21" cy="5" r="3.2" fill="#f2b705" />
      </svg>
      SeatLock
    </span>
  )
}
