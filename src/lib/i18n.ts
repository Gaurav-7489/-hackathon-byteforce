import { useSyncExternalStore } from 'react'

/** English / Hindi UI strings for the main screens. Toggle in the header. */
export type Lang = 'en' | 'hi'
const KEY = 'seatlock-lang'
const listeners = new Set<() => void>()

const EN = {
  'nav.home': 'Home',
  'nav.tickets': 'My tickets',
  'home.eyebrow': 'Pick a ride or a show',
  'home.bus.title': 'Bus',
  'home.bus.body': 'Window or aisle, front or back — before you pay.',
  'home.bus.cta': 'Choose a trip',
  'home.cinema.title': 'Cinema',
  'home.cinema.body': 'Pick the exact seat. See the screen from it.',
  'home.cinema.cta': 'Choose a show',
  'home.sound': 'Sound',
  'home.soundOff': 'Sound off',
  'browse.back': 'Back',
  'browse.bus': 'Trips',
  'browse.cinema': 'Shows',
  'browse.search': 'Search',
  'browse.empty': 'Nothing matches. Try another search.',
  'ev.yourSeats': 'Your seats',
  'ev.total': 'Total',
  'ev.hold': 'Hold seats',
  'ev.live': 'Live',
  'ev.view3d': '3D',
  'ev.easy': 'Easy 3D',
  'ev.map': 'Seat map',
  'ev.budget': 'Your budget',
  'ev.overBudget': 'Over your budget',
  'ev.goodToKnow': 'Good to know',
  'ev.askAi': 'Ask the seat assistant',
  'ev.happening': 'What’s happening',
  'co.title': 'Review and pay',
  'ok.title': 'You’re in.',
  'ok.split': 'Split the bill',
  'ok.perPerson': 'Each person pays',
}

const HI: typeof EN = {
  'nav.home': 'होम',
  'nav.tickets': 'मेरे टिकट',
  'home.eyebrow': 'सवारी या शो चुनें',
  'home.bus.title': 'बस',
  'home.bus.body': 'खिड़की या गलियारा, आगे या पीछे — पैसे देने से पहले चुनें।',
  'home.bus.cta': 'यात्रा चुनें',
  'home.cinema.title': 'सिनेमा',
  'home.cinema.body': 'सटीक सीट चुनें। स्क्रीन वहीं से देखें।',
  'home.cinema.cta': 'शो चुनें',
  'home.sound': 'आवाज़',
  'home.soundOff': 'आवाज़ बंद',
  'browse.back': 'वापस',
  'browse.bus': 'यात्राएँ',
  'browse.cinema': 'शो',
  'browse.search': 'खोजें',
  'browse.empty': 'कुछ नहीं मिला। दूसरी खोज आज़माएँ।',
  'ev.yourSeats': 'आपकी सीटें',
  'ev.total': 'कुल',
  'ev.hold': 'सीटें रोकें',
  'ev.live': 'लाइव',
  'ev.view3d': '3D',
  'ev.easy': 'आसान 3D',
  'ev.map': 'सीट मैप',
  'ev.budget': 'आपका बजट',
  'ev.overBudget': 'बजट से ज़्यादा',
  'ev.goodToKnow': 'जानने योग्य',
  'ev.askAi': 'AI सीट सहायक से पूछें',
  'ev.happening': 'अभी क्या हो रहा है',
  'co.title': 'समीक्षा करें और भुगतान करें',
  'ok.title': 'आप तैयार हैं।',
  'ok.split': 'बिल बाँटें',
  'ok.perPerson': 'हर व्यक्ति देगा',
}

export type TKey = keyof typeof EN
const DICT: Record<Lang, Record<TKey, string>> = { en: EN, hi: HI }

export function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en'
  } catch {
    return 'en'
  }
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* storage blocked */
  }
  document.documentElement.lang = l === 'hi' ? 'hi-IN' : 'en-IN'
  listeners.forEach((cb) => cb())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Returns a translator bound to the current language; re-renders on change. */
export function useT(): (key: TKey) => string {
  const lang = useSyncExternalStore(subscribe, readLang, () => 'en' as Lang)
  return (key) => DICT[lang][key]
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, readLang, () => 'en' as Lang)
}

document.documentElement.lang = readLang() === 'hi' ? 'hi-IN' : 'en-IN'
