import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Bars, Card, SimBadge, Sparkline, Stat } from '../../components/ui'
import { makeQueueStudents, runQueue, simulateLoad } from '../../lib/campus/algorithms/simulation'

/**
 * Load & FairQueue lab: deterministic, seeded simulations of 100 students.
 * Same seed → same run, so a scenario can be replayed for judges.
 * This models client behaviour; real load balancing happens at the CDN/edge
 * and in the backend, not in React.
 */
export function LoadLab() {
  const [seed, setSeed] = useState(2026)
  const [errorRate, setErrorRate] = useState(5)
  const [t, setT] = useState(60)
  const [playing, setPlaying] = useState(false)
  const run = simulateLoad({ seed, users: 100, seats: 40, durationS: 60, holdTtlS: 20, errorRate: errorRate / 100 })
  const frame = run.frames[Math.min(t, run.frames.length - 1)] ?? run.frames.at(-1)!
  const students = makeQueueStudents(seed)
  const fair = runQueue(students, { mode: 'fair', seats: 40, admitPerSecond: 8, seed })
  const fcfs = runQueue(students, { mode: 'fcfs', seats: 40, admitPerSecond: 8, seed })
  const rate = (r: typeof fair, k: 'fast' | 'average' | 'slow') => Math.round((r.successByConnection[k].served / Math.max(1, r.successByConnection[k].total)) * 100)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => { if (x >= 60) { setPlaying(false); return 60 } return x + 1 }), 120)
    return () => clearInterval(id)
  }, [playing])

  const log = run.events.filter((e) => e.t <= t * 1000).slice(-8).reverse()
  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <Card title="Reservation load simulation" icon="users" badge={<SimBadge>Deterministic · seed {seed}</SimBadge>} actions={
        <div className="row-wrap">
          <label className="field lab-seed"><span className="sr-only">Seed</span><input className="input" type="number" value={seed} onChange={(e) => setSeed(Number(e.currentTarget.value) || 1)} aria-label="Scenario seed" /></label>
          <button type="button" className="btn" onClick={() => { setT(0); setPlaying(true) }}><Icon name="play" size={16} /> Replay</button>
        </div>
      }>
        <p className="small muted">100 students, 40 seats, 60 seconds. Everyone rushes the front rows with a slightly stale view, so conflicts are expected. Failed holds are not retried automatically — the simulated student taps Retry.</p>
        <label className="field"><span className="field-label">Timeline: {t}s</span>
          <input type="range" className="range" min={0} max={60} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.currentTarget.value)) }} />
        </label>
        <label className="field"><span className="field-label">Simulated error rate: {errorRate}%</span>
          <input type="range" className="range" min={0} max={20} value={errorRate} onChange={(e) => setErrorRate(Number(e.currentTarget.value))} />
        </label>
        <div className="stat-grid">
          <Stat label="Available" value={frame.available} tone="ok" />
          <Stat label="Held" value={frame.held} tone="warn" />
          <Stat label="Booked" value={frame.booked} />
          <Stat label="Conflicts" value={frame.conflicts} tone="danger" />
          <Stat label="Errors" value={frame.errors} tone="danger" />
          <Stat label="Holds released" value={frame.released} />
          <Stat label="Holds expired" value={frame.expired} tone="warn" />
          <Stat label="Latency p50 / p95" value={`${frame.p50} / ${frame.p95}`} hint="ms, all responses so far" />
        </div>
        <div className="grid-2">
          <div><p className="small muted">Booked seats over time</p><Sparkline data={run.frames.slice(0, t + 1).map((f) => f.booked)} label="Booked seats" /></div>
          <div><p className="small muted">Cumulative conflicts</p><Sparkline data={run.frames.slice(0, t + 1).map((f) => f.conflicts)} label="Conflicts" /></div>
        </div>
        <ol className="lab-log" aria-label="Recent simulated requests">
          {log.map((e, i) => <li key={`${e.t}-${e.user}-${i}`} data-kind={e.kind}><span className="num">{(e.t / 1000).toFixed(1)}s</span> {e.user} <strong>{e.kind}</strong> {e.seats.join(' ')}{e.latencyMs ? ` · ${e.latencyMs} ms` : ''}</li>)}
        </ol>
        <p className="tiny muted">Totals: {run.totals.requests} requests, {run.totals.holds} holds, {run.totals.confirmed} confirmed, {run.totals.retries} retries.</p>
      </Card>

      <Card title="FairQueue vs first-come-first-served" icon="queue" badge={<SimBadge>Same 100 students</SimBadge>}>
        <p className="small muted">Connection speed decides FCFS. FairQueue gives everyone who arrives in the first 8 seconds a random place, merges duplicate tabs and caps each student at 4 seats — 2 when demand is over 1.5× supply, so more students get in.</p>
        <div className="grid-2">
          <div className="stack">
            <h3 className="small">Students served — FairQueue</h3>
            <Bars label="FairQueue success by connection" unit="%" data={(['fast', 'average', 'slow'] as const).map((k) => ({ label: `${k} connection`, value: rate(fair, k), tone: 'ok' as const }))} />
          </div>
          <div className="stack">
            <h3 className="small">Students served — FCFS</h3>
            <Bars label="FCFS success by connection" unit="%" data={(['fast', 'average', 'slow'] as const).map((k) => ({ label: `${k} connection`, value: rate(fcfs, k), tone: 'warn' as const }))} />
          </div>
        </div>
        <p className="small">Duplicate sessions merged by FairQueue: <strong className="num">{fair.duplicatesMerged}</strong>. Browser-side logic can’t stop real bots — production needs server-issued tokens and rate limits.</p>
      </Card>
    </div>
  )
}
