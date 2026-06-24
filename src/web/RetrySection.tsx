// Retry resilience, made visible. Panel 1: a fleet of clients all fail at once and retry — flip
// between no-backoff, fixed, exponential, and exponential+full-jitter and watch the synchronized
// retry spikes (a thundering herd that keeps the upstream down) flatten into a spread-out trickle.
// Panel 2: a circuit breaker trips OPEN after repeated failures, sheds load while the upstream is
// down, then HALF-OPENs to probe before closing. All from retry.ts (deterministic, tested).
import { useMemo, useState } from 'react';
import { simulateFleet, runBreaker, type Strategy, type Req } from './retry';

const STRATS: { id: Strategy; label: string }[] = [
  { id: 'none', label: 'no backoff' }, { id: 'fixed', label: 'fixed' }, { id: 'exp', label: 'exponential' }, { id: 'jitter', label: 'exp + full jitter' },
];
const FLEET = { clients: 120, baseMs: 500, capMs: 8000, healMs: 6000, maxAttempts: 9, horizonMs: 8000, bucketMs: 250, seed: 7 };

// breaker demo: a request every 20ms; the upstream is down during a draggable window
function breakerTrace(downEndMs: number): Req[] {
  const reqs: Req[] = [];
  for (let t = 0; t <= 600; t += 20) reqs.push({ t, upstream: t >= 80 && t < downEndMs ? 'failure' : 'success' });
  return reqs;
}
const COLORS: Record<string, string> = { closed: 'hsl(150 50% 45%)', open: 'hsl(0 65% 55%)', 'half-open': 'hsl(40 85% 50%)' };

export function RetrySection() {
  const [strat, setStrat] = useState<Strategy>('exp');
  const [downEnd, setDownEnd] = useState(320);

  const fleet = useMemo(() => simulateFleet(strat, FLEET), [strat]);
  const allPeaks = useMemo(() => STRATS.map((s) => ({ id: s.id, label: s.label, retryPeak: simulateFleet(s.id, FLEET).retryPeak })), []);
  const maxBar = Math.max(...fleet.buckets, 1);

  const cfg = { failThreshold: 3, cooldownMs: 120 };
  const steps = useMemo(() => runBreaker(breakerTrace(downEnd), cfg), [downEnd]);
  const shed = steps.filter((s) => s.result === 'shed').length;
  const tmax = 600;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Retry resilience — backoff, jitter &amp; the circuit breaker</h2></div>
        <p className="jsec-sub">
          When an upstream fails, a fleet that retries in lockstep becomes a <strong>thundering herd</strong> that keeps it down. Two cures:
          space retries out with <strong>exponential backoff + jitter</strong>, and <strong>stop trying entirely</strong> with a circuit
          breaker that fails fast while the upstream heals.
        </p>

        <h3 className="rty-h3">1 · Backoff &amp; jitter — spreading the retry storm</h3>
        <div className="rty-strats">
          {STRATS.map((s) => <button key={s.id} className={`rty-strat ${strat === s.id ? 'on' : ''}`} onClick={() => setStrat(s.id)}>{s.label}</button>)}
        </div>
        <div className="rty-histo" role="img" aria-label="retry attempts over time">
          {fleet.buckets.map((b, i) => (
            <div key={i} className="rty-bar" style={{ height: `${(b / maxBar) * 100}%` }} title={`t≈${i * FLEET.bucketMs}ms: ${b} attempts`}>
              <i style={{ background: i === 0 ? 'hsl(215 15% 70%)' : strat === 'jitter' ? 'hsl(150 55% 45%)' : 'hsl(0 65% 58%)' }} />
            </div>
          ))}
        </div>
        <div className="rty-axis"><span>t=0 (all fail together)</span><span>upstream heals → {FLEET.healMs / 1000}s</span></div>
        <p className="rty-note">
          Busiest <em>retry</em> wave (after the shared initial failure): <b>{fleet.retryPeak}</b> of {FLEET.clients} clients at once.
          {strat === 'jitter' ? ' Jitter de-synchronizes the fleet, so no instant carries the whole herd.' : strat === 'none' ? ' With no backoff, clients hammer continuously — the worst case.' : ' Without jitter, every client retries at the same instants → full-fleet spikes.'}
        </p>
        <div className="rty-compare">
          <span className="rty-cmplbl">retry-wave peak by strategy:</span>
          {allPeaks.map((p) => (
            <span key={p.id} className={`rty-cmp ${p.id === strat ? 'on' : ''} ${p.id === 'jitter' ? 'best' : ''}`}><b>{p.retryPeak}</b>{p.label}</span>
          ))}
        </div>

        <h3 className="rty-h3">2 · Circuit breaker — fail fast, then probe</h3>
        <div className="rty-bkctrl">
          <label>outage length <input type="range" min={120} max={520} step={20} value={downEnd} onChange={(e) => setDownEnd(+e.target.value)} /><b>{downEnd - 80} ms</b></label>
          <span className="rty-shed">{shed} requests shed (failed fast, never hit the upstream)</span>
        </div>
        <div className="rty-bktimeline">
          <div className="rty-bkstates">
            {steps.map((s, i) => {
              const w = ((i < steps.length - 1 ? steps[i + 1].t : tmax + 20) - s.t) / (tmax + 20) * 100;
              return <span key={i} className="rty-bkstate" style={{ width: `${w}%`, background: COLORS[s.state] }} title={`${s.t}ms: ${s.state}`} />;
            })}
          </div>
          <div className="rty-bkreqs">
            {steps.map((s, i) => (
              <span key={i} className={`rty-bkreq ${s.result}`} style={{ left: `${(s.t / (tmax + 20)) * 100}%` }} title={`${s.t}ms: ${s.result}`} />
            ))}
          </div>
        </div>
        <div className="rty-bklegend">
          <span><i style={{ background: COLORS.closed }} /> closed (passing)</span>
          <span><i style={{ background: COLORS.open }} /> open (shedding)</span>
          <span><i style={{ background: COLORS['half-open'] }} /> half-open (probing)</span>
          <span><i className="rty-dot success" /> success</span><span><i className="rty-dot failure" /> failure</span><span><i className="rty-dot shed" /> shed</span>
        </div>

        <p className="rty-foot">
          The breaker’s win is twofold: it stops the caller wasting time and threads on a dead dependency (fail fast), and it gives the
          upstream room to recover instead of being pinned by retries. The half-open probe is the careful part — it lets exactly one request
          through to test the water, closing on success or re-opening on failure. Backoff+jitter and a breaker compose: jitter spreads the
          load you do send, the breaker cuts off the load you shouldn’t. This is the spine of resilient clients — gRPC, Envoy, Polly, Hystrix,
          and the AWS SDKs all ship versions of both.
        </p>
      </section>
    </div>
  );
}
