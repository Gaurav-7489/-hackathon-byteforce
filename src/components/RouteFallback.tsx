export function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
