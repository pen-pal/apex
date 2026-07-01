// HdrHistogram, made visible. Generate a stream of latencies with a heavy tail, record them into a
// log-linear histogram, and read off p50/p90/p99/p99.9 — the numbers that actually matter for user
// experience. The buckets get wider as the value grows (constant *relative* resolution), so the histogram
// covers microseconds to seconds in a fixed, tiny amount of memory no matter how many samples you record.
// Real model from hdrhist.ts.
import { useMemo, useState } from 'react';
import { HdrHist, relativeError } from './hdrhist';

const N = 4000;
const S = 16; // ~6% relative error

// deterministic LCG so the demo is reproducible (no Math.random)
function samplesFor(tailPct: number): number[] {
  let s = 123456789;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; };
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const slow = rnd() * 100 < tailPct;
    // fast cluster ~8–40ms; slow tail ~150–4000ms
    out.push(slow ? Math.round(150 + rnd() * rnd() * 3850) : Math.round(8 + rnd() * 32));
  }
  return out;
}

const PCTS: [number, string][] = [[50, 'p50'], [90, 'p90'], [99, 'p99'], [99.9, 'p99.9'], [100, 'max']];

export function HdrHistSection() {
  const [tail, setTail] = useState(5);
  const { hist, buckets, maxCount, pvals } = useMemo(() => {
    const h = new HdrHist(S);
    for (const v of samplesFor(tail)) h.record(v);
    const b = h.buckets();
    return { hist: h, buckets: b, maxCount: Math.max(...b.map((x) => x.count), 1), pvals: PCTS.map(([p, l]) => ({ p, l, v: h.percentile(p) })) };
  }, [tail]);

  const maxLo = Math.max(...buckets.map((b) => b.lo), 1);
  const logX = (v: number) => (Math.log2(Math.max(1, v)) / Math.log2(maxLo)) * 100;

  return (
    <div className="hdrh">
      <p className="hdrh-intro">
        The <strong>average</strong> latency hides everything that matters; users feel the <strong>tail</strong>
        (p99, p99.9). To measure it you need a histogram that spans microseconds to seconds. HdrHistogram uses
        <strong> log-linear</strong> buckets — wider as values grow — giving <strong>constant relative
        resolution</strong> (~{Math.round(relativeError(S) * 100)}% here) across the whole range, in fixed memory
        no matter how many samples.
      </p>

      <div className="hdrh-controls">
        <label>slow-request rate <input type="range" min={0} max={40} value={tail} onChange={(e) => setTail(+e.target.value)} /><b>{tail}%</b></label>
        <span className="hdrh-n">{N.toLocaleString()} samples recorded</span>
      </div>

      <div className="hdrh-chart">
        {buckets.map((b, i) => (
          <div key={i} className="hdrh-bar" style={{ left: `${logX(b.lo)}%`, height: `${(b.count / maxCount) * 100}%` }} title={`~${b.lo}ms: ${b.count}`} />
        ))}
        {pvals.filter((x) => x.p !== 100).map((x) => (
          <div key={x.p} className="hdrh-pline" style={{ left: `${logX(x.v)}%` }}>
            <span className="hdrh-plbl">{x.l}</span>
          </div>
        ))}
        <div className="hdrh-xaxis">
          {[1, 10, 100, 1000].filter((t) => t <= maxLo).map((t) => <span key={t} style={{ left: `${logX(t)}%` }}>{t}ms</span>)}
        </div>
      </div>

      <div className="hdrh-pcts">
        {pvals.map((x) => (
          <div key={x.p} className={`hdrh-pcell ${x.p >= 99 ? 'tail' : ''}`}>
            <span>{x.l}</span><b>{x.v.toLocaleString()}<i>ms</i></b>
          </div>
        ))}
      </div>

      <div className="hdrh-mem">
        <div className="hdrh-mstat ok"><span>buckets (memory)</span><b>{hist.bucketCount()}</b></div>
        <div className="hdrh-mstat"><span>if you stored every sample</span><b>{N.toLocaleString()}</b></div>
        <div className="hdrh-mstat ok"><span>saved</span><b>{Math.round(N / Math.max(1, hist.bucketCount()))}×</b></div>
      </div>

      <p className="hdrh-foot">
        Two things this design gets right that a naïve histogram doesn't. <strong>Fixed relative error</strong>:
        a 3% error at 10ms and at 10s, so a linear-bucket histogram doesn't have to choose between resolution
        at the low end and reach at the high end. <strong>Bounded memory</strong>: buckets scale with the
        <em>range</em> (a couple hundred), not the sample count — record billions and it never grows. Watch out
        for <strong>coordinated omission</strong>: if your load generator waits for a slow response before
        sending the next request, it silently under-samples the tail — wrk2 and HdrHistogram correct for it by
        back-filling the requests that <em>should</em> have been sent. Merging histograms across machines is
        just adding bucket counts, which is how you get a fleet-wide p99.9. (Gil Tene, HdrHistogram.)
      </p>
    </div>
  );
}
