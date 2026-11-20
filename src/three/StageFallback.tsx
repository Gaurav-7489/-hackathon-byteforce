import './stage.css'

/** CSS-only venue poster: shown while WebGL loads, when it is unavailable, or after context loss. */
export function StageFallback({ className }: { className?: string }) {
  return (
    <div className={`stage-fb ${className ?? ''}`} aria-hidden="true">
      <div className="stage-fb-glow" />
      <div className="stage-fb-wall">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>
      <span className="stage-fb-beam stage-fb-beam-1" />
      <span className="stage-fb-beam stage-fb-beam-2" />
      <span className="stage-fb-beam stage-fb-beam-3" />
      <span className="stage-fb-beam stage-fb-beam-4" />
      <div className="stage-fb-lip" />
      <div className="stage-fb-seats" />
      <div className="stage-fb-fade" />
    </div>
  )
}
