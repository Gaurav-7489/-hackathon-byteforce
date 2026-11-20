export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="sl-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand)" />
            <stop offset="1" stopColor="var(--ice)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#sl-g)" />
        <path d="M9 16v-4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <rect x="7" y="16" width="18" height="6" rx="2" fill="#fff" />
        <circle cx="16" cy="19" r="1.6" fill="var(--brand)" />
      </svg>
      <span className="logo-word">SeatLock</span>
    </span>
  )
}
