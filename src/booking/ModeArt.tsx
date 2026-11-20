/** Tiny inline illustrations for the mode cards — vector, ~1 KB, no requests. */
export function CinemaArt() {
  return (
    <svg viewBox="0 0 160 84" width="100%" height="100%" aria-hidden="true">
      <path d="M22 10 Q80 2 138 10 L136 18 Q80 11 24 18 Z" fill="currentColor" opacity="0.9" />
      {Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 10 + (r > 2 ? 0 : 0) }, (_, c) => {
          const w = 9
          const gap = c >= 2 ? (c >= 8 ? 12 : 6) : 0
          const x = 20 + c * (w + 2) + gap
          const y = 30 + r * 10
          const hot = (r === 2 && c >= 4 && c <= 5) || (r === 3 && c === 6)
          const sold = (r * 7 + c * 3) % 5 === 0
          return <rect key={`${r}-${c}`} x={x} y={y} width={w} height={7} rx={2} fill={hot ? '#f2b705' : 'currentColor'} opacity={hot ? 1 : sold ? 0.2 : 0.55} />
        }),
      )}
    </svg>
  )
}

export function BusArt() {
  return (
    <svg viewBox="0 0 160 84" width="100%" height="100%" aria-hidden="true">
      <rect x="12" y="14" width="136" height="58" rx="12" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      <rect x="18" y="22" width="12" height="18" rx="3" fill="currentColor" opacity="0.85" />
      <circle cx="24" cy="54" r="5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      {Array.from({ length: 9 }, (_, c) =>
        [0, 1, 3, 4].map((r) => {
          const x = 40 + c * 11.5
          const y = 20 + r * 10
          const hot = c === 3 && r === 0
          const sold = (c * 5 + r * 3) % 4 === 0
          return <rect key={`${c}-${r}`} x={x} y={y} width={8} height={8} rx={2} fill={hot ? '#f2b705' : 'currentColor'} opacity={hot ? 1 : sold ? 0.2 : 0.55} />
        }),
      )}
    </svg>
  )
}
