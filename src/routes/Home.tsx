import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { VenuePhoto } from '../components/Photo'
import type { Mode } from '../booking/data'
import { claimAudio, releaseAudio } from '../lib/audioFocus'
import { setMode } from '../lib/mode'
import { useAuth } from '../lib/auth'
import { PHOTO } from '../lib/photos'
import { useT, type TKey } from '../lib/i18n'
import { sfx, useSoundOn } from '../lib/sound'
import './home.css'

const ROWS: { kind: Mode; title: TKey; body: TKey; cta: TKey }[] = [
  { kind: 'bus', title: 'home.bus.title', body: 'home.bus.body', cta: 'home.bus.cta' },
  { kind: 'cinema', title: 'home.cinema.title', body: 'home.cinema.body', cta: 'home.cinema.cta' },
]

/**
 * Home: two rows, one per venue type. Each row plays its own film (muted
 * until you tap sound on). If the file is missing the venue photo stays.
 */
export function Home() {
  const t = useT()
  const hour = new Date().getHours()
  const { user } = useAuth()
  const greet = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}${user ? `, ${user.name.split(' ')[0]}` : ''}`
  return (
    <div className="container page home">
      <title>SeatLock · Bus and cinema seats</title>
      <meta name="description" content="Pick a bus trip or a cinema show, see seats live, and lock the one you want." />
      <header className="home-head">
        <p className="lk-eyebrow">{greet}</p>
        <h1 className="lk-display page-title">{t('home.eyebrow')}</h1>
      </header>
      <div className="home-rows">
        {ROWS.map((r) => (
          <VideoRow key={r.kind} kind={r.kind} title={t(r.title)} body={t(r.body)} cta={t(r.cta)} />
        ))}
      </div>
    </div>
  )
}

function VideoRow({ kind, title, body, cta }: { kind: Mode; title: string; body: string; cta: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [broken, setBroken] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const globalSound = useSoundOn()
  const t = useT()

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = !soundOn
    if (soundOn) {
      // Only one film plays with sound; turning this one on mutes the other and stops speech.
      claimAudio(`film-${kind}`, () => setSoundOn(false))
      void v.play().catch(() => {})
    } else releaseAudio(`film-${kind}`)
  }, [soundOn, kind])

  const toggleSound = () => {
    sfx.tap()
    setSoundOn((on) => !on)
  }

  return (
    <section className="home-row" data-kind={kind} aria-labelledby={`row-${kind}`}>
      <div className="home-media">
        <VenuePhoto kind={kind} className="home-photo" />
        {!broken && (
          <video
            ref={ref}
            className="home-video"
            src={PHOTO[kind].video}
            poster={PHOTO[kind].src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setBroken(true)}
            aria-hidden="true"
          />
        )}
        <span className="home-shade" aria-hidden="true" />
        {globalSound && (
          <button type="button" className="home-sound" aria-pressed={soundOn} onClick={toggleSound} aria-label={soundOn ? `Mute ${title} film` : `Play ${title} film with sound`}>
            <Icon name={soundOn ? 'volume' : 'mute'} size={18} />
            <span>{soundOn ? t('home.soundOff') : t('home.sound')}</span>
          </button>
        )}
      </div>
      <div className="home-copy">
        <h2 id={`row-${kind}`} className="lk-display home-title">
          {title}
        </h2>
        <p className="home-body">{body}</p>
        <Link
          to={`/book/${kind}`}
          className="lk-btn lk-btn-primary lk-btn-lg home-cta"
          onClick={() => {
            setMode(kind)
            sfx.tap()
          }}
        >
          {cta} <Icon name="arrowRight" size={18} />
        </Link>
      </div>
    </section>
  )
}

