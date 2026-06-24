// Reservoir sampling, made visible. Step a stream past a fixed-size reservoir and watch the
// first k items fill it, then each later item keep-with-probability-k/i and evict a random
// slot if kept. A "run 3000 trials" view shows the payoff: every item ends up selected about
// k/n of the time. Real logic in reservoir.ts (tested for mechanics + uniformity).
import { useMemo, useState } from 'react';
import { sample, mulberry32 } from './reservoir';

const N = 14, K = 4;
const STREAM = Array.from({ length: N }, (_, i) => i + 1);

export function ReservoirSection() {
  const [seed, setSeed] = useState(3);
  const [step, setStep] = useState(N);
  const run = useMemo(() => sample(STREAM, K, mulberry32(seed)), [seed]);
  const s = Math.min(step, run.steps.length);

  // reconstruct the reservoir state after `s` steps by replaying the recorded steps
  const reservoir = useMemo(() => {
    const r: number[] = [];
    for (let i = 0; i < s; i++) {
      const st = run.steps[i];
      if (i < K) r.push(st.value);
      else if (st.kept) { const slot = r.indexOf(st.evicted!); if (slot >= 0) r[slot] = st.value; }
    }
    return r;
  }, [run, s]);
  const cur = s > 0 ? run.steps[s - 1] : null;

  // uniformity histogram over many trials
  const hist = useMemo(() => {
    const counts = new Array(N).fill(0); const trials = 3000; const rand = mulberry32(99);
    for (let t = 0; t < trials; t++) for (const v of sample(STREAM, K, rand).reservoir) counts[v - 1]++;
    return { counts, expected: (K / N) * trials };
  }, []);
  const maxC = Math.max(...hist.counts);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Reservoir sampling — fair sampling from a firehose</h2></div>
        <p className="jsec-sub">
          You’re scanning a stream you can’t store and whose length you don’t know, but you need <strong>{K}</strong> items chosen
          uniformly at random. Keep the first {K}; then for the i-th item, keep it with probability <code>{K}/i</code> and, if kept, evict
          a random one already held. Astonishingly, that leaves every item with the same chance of survival. Step through it:
        </p>

        <div className="rsv-controls">
          <button onClick={() => setStep(0)} disabled={s === 0}>⏮</button>
          <button onClick={() => setStep(Math.max(0, s - 1))} disabled={s === 0}>◀</button>
          <span className="rsv-count">item {s} / {N}</span>
          <button onClick={() => setStep(s + 1)} disabled={s >= run.steps.length}>▶</button>
          <button onClick={() => setStep(N)} disabled={s >= run.steps.length}>⏭</button>
          <button onClick={() => { setSeed((x) => x + 1); setStep(N); }} className="rsv-reseed">↻ new run</button>
        </div>

        <div className="rsv-stream">
          {STREAM.map((v, i) => (
            <div key={i} className={`rsv-item ${i < s ? 'seen' : ''} ${cur && i === s - 1 ? 'cur' : ''} ${reservoir.includes(v) ? 'inres' : ''}`}>{v}</div>
          ))}
        </div>

        <div className="rsv-reservoir">
          <span className="rsv-rlabel">reservoir ({K} slots):</span>
          {Array.from({ length: K }, (_, i) => <div key={i} className="rsv-slot">{reservoir[i] ?? '–'}</div>)}
        </div>

        {cur && (
          <div className="rsv-msg">
            {cur.index < K ? `item ${cur.value}: fills slot ${cur.index} (the first ${K} always go in)`
              : cur.kept ? `item ${cur.value}: kept (prob ${K}/${cur.index + 1}) → evicted ${cur.evicted}`
              : `item ${cur.value}: skipped (prob ${cur.index + 1 - K}/${cur.index + 1})`}
          </div>
        )}

        <div className="rsv-hist">
          <div className="rsv-hlabel">over 3000 runs, how often each item was selected (dashed = expected {K}/{N}):</div>
          <div className="rsv-bars">
            {hist.counts.map((c, i) => (
              <div key={i} className="rsv-barwrap" title={`item ${i + 1}: ${c}`}>
                <div className="rsv-bar" style={{ height: `${(c / maxC) * 100}%` }} />
                <span className="rsv-blabel">{i + 1}</span>
              </div>
            ))}
            <div className="rsv-expected" style={{ bottom: `${(hist.expected / maxC) * 100}%` }} />
          </div>
        </div>

        <p className="rsv-foot">
          The bars are nearly flat — that’s uniformity falling out of the k/i rule, provable by induction: if every item among the first i
          is held with probability k/i, the (i+1)-th keep-and-evict step rebalances everyone to k/(i+1). Weighted variants (A-Res, A-ExpJ)
          let items have different selection weights, and distributed reservoir sampling merges per-shard reservoirs. It’s the standard way
          to sample logs, telemetry, and database scans where you get one pass and bounded memory.
        </p>
      </section>
    </div>
  );
}
