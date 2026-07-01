// DDSketch, made visible. A stream of latency-like values is bucketed on a LOGARITHMIC scale — bucket edges a
// constant factor γ apart — so the bars are even-width on a log axis. Pick a quantile and watch the estimate
// read straight off the bucket counts land within α of the true value, every time, at any magnitude. Drag α to
// trade accuracy for buckets. Real model from ddsketch.ts.
import { useMemo, useState } from 'react';
import { DDSketch, exactQuantile } from './ddsketch';

const N = 20000;
const DATA = (() => { // seeded latency-like values spanning ~e^1..e^4 ms
  let s = 20240701; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; };
  return Array.from({ length: N }, () => Math.exp(1 + 3 * rnd()) + rnd() * 5);
})();
const QUANTILES = [0.5, 0.9, 0.95, 0.99, 0.999];

export function DdSketchSection() {
  const [alpha, setAlpha] = useState(0.02);
  const [q, setQ] = useState(0.99);

  const { sketch, bars, maxCount } = useMemo(() => {
    const sk = new DDSketch(alpha);
    for (const v of DATA) sk.add(v);
    const keys = [...sk.buckets.keys()].sort((a, b) => a - b);
    const bars = keys.map((i) => ({ i, count: sk.buckets.get(i)!, value: sk.representative(i) }));
    return { sketch: sk, bars, maxCount: Math.max(1, ...bars.map((b) => b.count)) };
  }, [alpha]);

  const est = sketch.quantile(q);
  const tru = exactQuantile(DATA, q);
  const relErr = Math.abs(est - tru) / tru;
  const estBucket = sketch.key(est);

  return (
    <div className="dds">
      <p className="dds-intro">
        Percentiles over data that spans orders of magnitude (5ms to 5s) need <strong>relative</strong>, not
        absolute, accuracy. DDSketch buckets values on a log scale — edges a constant factor
        <b> γ = (1+α)/(1−α)</b> apart — so every value sits within <b>α</b> of its bucket's representative, and
        any quantile read from the counts inherits that ≤α error. {N.toLocaleString()} samples, drag α:
      </p>

      <label className="dds-slider">
        relative accuracy α = <b>{(alpha * 100).toFixed(0)}%</b> &nbsp;(γ = {sketch.gamma.toFixed(3)})
        <input type="range" min={0.005} max={0.1} step={0.005} value={alpha} onChange={(e) => setAlpha(+e.target.value)} />
      </label>

      <div className="dds-hist">
        {bars.map((b) => (
          <div key={b.i} className={`dds-bar-wrap ${b.i === estBucket ? 'sel' : ''}`} title={`~${b.value.toFixed(1)}ms · ${b.count}`}>
            <div className="dds-bar" style={{ height: `${(b.count / maxCount) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="dds-axis"><span>← log scale (each bucket ×γ larger) →</span></div>

      <div className="dds-qsel">
        {QUANTILES.map((qq) => <button key={qq} type="button" className={`dds-q ${q === qq ? 'on' : ''}`} onClick={() => setQ(qq)}>p{(qq * 100).toString().replace('.', '')}</button>)}
      </div>

      <div className="dds-result">
        <div className="dds-rrow"><span>estimate</span><b>{est.toFixed(2)} ms</b></div>
        <div className="dds-rrow"><span>true (exact)</span><b>{tru.toFixed(2)} ms</b></div>
        <div className="dds-rrow"><span>relative error</span><b className={relErr <= alpha + 1e-9 ? 'ok' : 'bad'}>{(relErr * 100).toFixed(3)}%</b></div>
        <div className="dds-rrow"><span>guarantee</span><b className="ok">≤ {(alpha * 100).toFixed(0)}% {relErr <= alpha + 1e-9 ? '✓' : ''}</b></div>
      </div>

      <div className="dds-stats">
        <div className="dds-stat"><span>values added</span><b>{N.toLocaleString()}</b></div>
        <div className="dds-stat ok"><span>buckets stored</span><b>{sketch.size}</b></div>
        <div className="dds-stat"><span>memory vs raw</span><b>{(N / sketch.size).toFixed(0)}× less</b></div>
      </div>

      <p className="dds-foot">
        Two properties make this the default in modern observability. <strong>Mergeability</strong>: a sketch is
        just a map of bucket→count, so every server keeps its own and a collector <em>sums</em> them into a
        global p99 — no raw samples shipped, and the merge is exact (unlike averaging per-host percentiles, which
        is statistically meaningless). <strong>Bounded, guaranteed error</strong>: the answer is always within α
        relatively, at every magnitude — so alerting on “p99 &gt; 1s” is trustworthy whether your latencies are
        microseconds or minutes. Contrast the neighbours: a plain fixed-width histogram (e.g. Prometheus’s
        classic <code>histogram_quantile</code> over pre-set buckets) gives good results only where you happened
        to place buckets and interpolates between them; <strong>HdrHistogram</strong> gives a fixed <em>absolute</em>
        precision across a huge range by tracking every value to a set number of significant digits; and
        <strong> t-digest</strong> adapts bin sizes to be densest at the tails, often smaller but without
        DDSketch’s hard relative-error guarantee. The costs here: only positive values (you keep a second sketch
        for negatives, and a zero count), and a bucket per occupied magnitude-band — bounded in practice because
        real latencies live in a limited range of magnitudes. (Masson et al., DDSketch, VLDB 2019.)
      </p>
    </div>
  );
}
