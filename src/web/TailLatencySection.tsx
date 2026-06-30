// Tail latency, made visible. The histogram shows a latency distribution; drag the tail weight and
// watch p99 pull far away from the median while the mean barely flinches — that's why averages lie.
// Then fan one request out to N servers and watch the "rare" per-server tail become near-certain, and
// hedged requests claw it back. Real percentile + amplification math from taillatency.ts.
import { useMemo, useState } from 'react';
import { percentile, mean, fanoutTail, hedgedTail, sampleLatencies } from './taillatency';

const N_SAMPLES = 240;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function TailLatencySection() {
  const [tailPct, setTailPct] = useState(4);
  const [threshMul, setThreshMul] = useState(3);
  const [fanout, setFanout] = useState(50);
  const [hedge, setHedge] = useState(false);

  const samples = useMemo(() => sampleLatencies(N_SAMPLES, 50, tailPct), [tailPct]);
  const p50 = percentile(samples, 50), p90 = percentile(samples, 90), p99 = percentile(samples, 99);
  const max = Math.max(...samples), avg = mean(samples);
  const threshold = Math.round(p50 * threshMul);
  const pSlow = samples.filter((x) => x > threshold).length / samples.length;

  const bins = useMemo(() => {
    const B = 26, hi = max || 1, arr = new Array(B).fill(0);
    for (const x of samples) arr[Math.min(B - 1, Math.floor((x / hi) * B))]++;
    return arr;
  }, [samples, max]);
  const binMax = Math.max(...bins, 1);
  const xOf = (v: number) => `${Math.min(100, (v / (max || 1)) * 100)}%`;

  const reqTail = hedge ? hedgedTail(pSlow, fanout, 2) : fanoutTail(pSlow, fanout);
  const baseTail = fanoutTail(pSlow, fanout);

  return (
    <div className="tl">
      <div className="tl-hist-wrap">
        <div className="tl-bars">
          {bins.map((c, i) => <div key={i} className="tl-bar" style={{ height: `${(c / binMax) * 100}%` }} />)}
          <div className="tl-mark mean" style={{ left: xOf(avg) }} title={`mean ${Math.round(avg)}ms`}><span>mean</span></div>
          <div className="tl-mark p50" style={{ left: xOf(p50) }} title={`p50 ${p50}ms`}><span>p50</span></div>
          <div className="tl-mark p99" style={{ left: xOf(p99) }} title={`p99 ${p99}ms`}><span>p99</span></div>
        </div>
        <div className="tl-axis"><span>0</span><span>{Math.round(max / 2)}ms</span><span>{max}ms</span></div>
      </div>

      <div className="tl-stats">
        {[['mean', Math.round(avg)], ['p50 (median)', p50], ['p90', p90], ['p99', p99], ['max', max]].map(([l, v]) => (
          <div key={l as string} className={`tl-stat ${l === 'p99' ? 'hot' : ''}`}><span>{l}</span><b>{v}<i>ms</i></b></div>
        ))}
      </div>
      <p className="tl-insight">p99 is <b>{(p99 / p50).toFixed(1)}×</b> the median, but the mean ({Math.round(avg)}ms) sits close to it — the average
        hides the tail that users actually hit. SLOs are written on p99/p99.9 for exactly this reason.</p>

      <div className="tl-controls">
        <label>tail weight <input type="range" min={0} max={15} value={tailPct} onChange={(e) => setTailPct(+e.target.value)} /><b>{tailPct}%</b></label>
        <label>“slow” threshold <input type="range" min={2} max={6} value={threshMul} onChange={(e) => setThreshMul(+e.target.value)} /><b>{threshMul}× median = {threshold}ms</b></label>
      </div>

      <div className="tl-fanout">
        <div className="tl-fanout-h">Fan-out amplification — one request hits many servers and waits for all</div>
        <div className="tl-servers">
          {Array.from({ length: Math.min(fanout, 100) }, (_, i) => {
            // deterministic shading: mark ~pSlow fraction as slow for illustration
            const slow = ((i * 41 + 7) % 100) / 100 < pSlow * (hedge ? pSlow : 1);
            return <span key={i} className={`tl-srv ${slow ? 'slow' : ''}`} />;
          })}
        </div>
        <label className="tl-fanctl">fan-out N <input type="range" min={1} max={100} value={fanout} onChange={(e) => setFanout(+e.target.value)} /><b>{fanout} servers</b></label>
        <label className="tl-hedge"><input type="checkbox" checked={hedge} onChange={(e) => setHedge(e.target.checked)} /> hedge: send 2 copies, take the first (per-server tail → p²)</label>

        <div className="tl-result">
          <div className="tl-resrow">
            <span>per-server slow probability</span><b>{pct(pSlow)}</b>
          </div>
          <div className="tl-resrow big">
            <span>P(request slow) at fan-out {fanout}</span>
            <b className={reqTail > 0.3 ? 'bad' : reqTail > 0.1 ? 'warn' : 'ok'}>{pct(reqTail)}</b>
          </div>
          {hedge && <div className="tl-resrow"><span>without hedging it would be</span><b className="strike">{pct(baseTail)}</b></div>}
        </div>
        <p className="tl-fanout-note">
          1 − (1 − p)<sup>N</sup>: a {pct(pSlow)} per-server tail, fanned out to {fanout} servers, makes the whole request slow
          <b> {pct(reqTail)}</b> of the time{hedge ? ' — hedging restores it by squaring the per-server tail.' : '. Toggle hedging to see the fix.'}
        </p>
      </div>

      <p className="tl-foot">
        At scale, the <strong>median is irrelevant</strong> and the tail is everything: a service that fans a request out to hundreds of leaves
        (search, a sharded DB, a microservice mesh) is as slow as its <em>slowest</em> leaf, so a 99th-percentile event per leaf becomes the common
        case for the user. Google’s answer (Dean &amp; Barroso, “The Tail at Scale”) is <strong>tail tolerance</strong> rather than tail elimination:
        hedged/tied requests, micro-partitioning, and bringing slow replicas back into line — engineering around variability instead of pretending
        it away.
      </p>
    </div>
  );
}
