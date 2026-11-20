import type { SVGProps } from 'react'

/** Hand-drawn 24px stroke icon set (original, no external icon dependency). */
const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.35-4.35',
  calendar: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  pin: 'M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  seat: 'M6 11V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v5M4 11h16v5H4zM6 16v4m12-4v4',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  ban: 'M5.6 5.6l12.8 12.8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  sun: 'M12 3v2m0 14v2M5 5l1.4 1.4m11.2 11.2L19 19M3 12h2m14 0h2M5 19l1.4-1.4M17.6 6.4 19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  arrowRight: 'M5 12h14m-5-6 6 6-6 6',
  arrowLeft: 'M19 12H5m5 6-6-6 6-6',
  alert: 'M12 9v4m0 4h.01M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z',
  info: 'M12 16v-5m0-3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4m-4 5a8 8 0 0 0 14.9 3M20 20v-4h-4',
  zoomIn: 'M11 8v6m-3-3h6m-3-7a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.35-4.35',
  zoomOut: 'M8 11h6m-3-7a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.35-4.35',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5',
  ticket: 'M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3v2Zm11-2v12',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm-6-3a6 6 0 0 0 12 0M12 18v3',
  stop: 'M7 7h10v10H7z',
  send: 'M5 12h13M13 6l6 6-6 6',
  palette: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1.4-1.2-1.6-1.2-2.9 0-1 .8-1.5 1.7-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8ZM7.5 12h.01M9 8h.01M14 7h.01',
  play: 'M7 5v14l11-7L7 5Z',
  wand: 'M15 4V2m0 8V8m-4-2H9m12 0h-2m-1.2 4.8L19 12M18.8 3.2 17.6 4.4M3 21l9-9',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
  users: 'M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 9v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  access: 'M12 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM9 8h6m-3 0v5h4l2 5M12 13l-3.5 0a4.5 4.5 0 1 0 5.6 5.5',
  volume: 'M4 10v4h4l5 4V6L8 10H4Zm13-1a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0',
  shield: 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4',
  exit: 'M14 4h5v16h-5M10 8l-4 4 4 4m-4-4h10',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H3',
  queue: 'M4 6h16M4 12h10M4 18h6m8-6 3 3-3 3',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5-1.2L7 21l5-2.5L17 21l-1.5-7.2',
  split: 'M12 3v18M5 8h4M5 12h4m6-4h4m-4 4h4M5 16h4m6 0h4',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.7M19 12.9a10 10 0 0 0-2.6-1.8M2 9a15 15 0 0 1 4.2-2.6M22 9a15 15 0 0 0-10-3.9M12 20h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.3 7.3 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.3 7.3 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
  cube: 'M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5',
  flame: 'M12 21a6 6 0 0 0 6-6c0-4-3-6-4-9-1 2-2 3-3.5 3.5C9 8 8.5 6.5 8.5 5 6.5 7 6 10 6 15a6 6 0 0 0 6 6Z',
  grid: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  upload: 'M12 20V9m-5 5 5-5 5 5M5 4h14',
  copy: 'M8 8h11v12H8zM5 16V4h11',
  menu: 'M4 7h16M4 12h16M4 17h16',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  wallet: 'M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Zm0 0 12-3v3m-1 7h.01',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
} as const

export type IconName = keyof typeof PATHS

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
  label?: string
}

export function Icon({ name, size = 20, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
