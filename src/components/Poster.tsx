import type { EventSummary } from '../lib/api/types'

/**
 * Procedural event poster — original generative SVG art per event (no image
 * assets, so no licensing concerns and near-zero bytes for Lighthouse).
 */
export function Poster({ event, className }: { event: Pick<EventSummary, 'id' | 'title' | 'category' | 'poster'>; className?: string }) {
  const { hue, accent, motif } = event.poster
  const id = `p-${event.id}`
  const c1 = `hsl(${hue} 70% 18%)`
  const c2 = `hsl(${hue} 80% 48%)`
  const c3 = `hsl(${accent} 90% 66%)`
  return (
    <svg className={className} viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${event.title} poster`}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor="hsl(230 40% 6%)" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.2" r="0.7">
          <stop offset="0" stopColor={c2} stopOpacity="0.95" />
          <stop offset="1" stopColor={c2} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-bg)`} />
      <rect width="400" height="500" fill={`url(#${id}-glow)`} />
      <g fill="none" stroke={c3} strokeWidth="1.5" opacity="0.85">
        {motif === 'rings' && Array.from({ length: 9 }, (_, i) => <circle key={i} cx="200" cy="190" r={18 + i * 22} opacity={1 - i * 0.1} />)}
        {motif === 'orbit' && Array.from({ length: 7 }, (_, i) => (
          <ellipse key={i} cx="200" cy="200" rx={60 + i * 26} ry={20 + i * 9} transform={`rotate(${i * 14 - 40} 200 200)`} opacity={1 - i * 0.12} />
        ))}
        {motif === 'waves' && Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M-10 ${120 + i * 18} Q 100 ${80 + i * 18 + (i % 2) * 40} 200 ${120 + i * 18} T 410 ${120 + i * 18}`} opacity={1 - i * 0.07} />
        ))}
        {motif === 'grid' && (
          <>
            {Array.from({ length: 11 }, (_, i) => <line key={`h${i}`} x1={-200} y1={220 + i * i * 3.2} x2={600} y2={220 + i * i * 3.2} opacity={0.3 + i * 0.06} />)}
            {Array.from({ length: 15 }, (_, i) => <line key={`v${i}`} x1={200} y1={200} x2={-500 + i * 100} y2={520} opacity="0.5" />)}
            <circle cx="200" cy="150" r="70" fill={c3} stroke="none" opacity="0.9" />
          </>
        )}
        {motif === 'bars' && Array.from({ length: 16 }, (_, i) => {
          const h = 40 + ((i * 53) % 170)
          return <rect key={i} x={24 + i * 23} y={330 - h} width="12" height={h} rx="6" fill={c3} stroke="none" opacity={0.35 + (i % 4) * 0.15} />
        })}
        {motif === 'stripes' && Array.from({ length: 14 }, (_, i) => (
          <line key={i} x1={-50 + i * 40} y1={0} x2={150 + i * 40} y2={500} strokeWidth="10" opacity={0.08 + (i % 3) * 0.1} />
        ))}
      </g>
      <text x="28" y="440" fill="#fff" fontFamily="Space Grotesk Variable, sans-serif" fontWeight="700" fontSize="34" letterSpacing="-1">
        {event.title.length > 18 ? `${event.title.slice(0, 17)}…` : event.title}
      </text>
      <text x="28" y="470" fill={c3} fontFamily="Inter Variable, sans-serif" fontWeight="600" fontSize="13" letterSpacing="2.5">
        {event.category.toUpperCase()}
      </text>
    </svg>
  )
}
