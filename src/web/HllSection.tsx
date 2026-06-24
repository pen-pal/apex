// HyperLogLog, made visible. A bar per register showing the largest rank seen for its
// bucket; add items (or a big batch) and watch the registers fill while the cardinality
// estimate tracks the true distinct count — in a fixed few hundred bytes no matter how
// many events flow through. Duplicates visibly do nothing. Real logic in hll.ts (tested).
import { useMemo, useState } from 'react';
import { create, add, estimate, hash, bucketAndRank, type Hll } from './hll';

export function HllSection() {
  const [p, setP] = useState(6); // m = 64 registers
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [item, setItem] = useState('alice');
  const [tick, setTick] = useState(0);

  // rebuild the sketch from the distinct items added so far
  const hll = useMemo<Hll>(() => {
    const h = create(p);
    for (const s of seen) add(h, s);
    return h;
  }, [p, seen, tick]);

  const est = estimate(hll);
  const truth = seen.size;
  const errPct = truth > 0 ? ((est - truth) / truth) * 100 : 0;
  const maxR = Math.max(1, ...hll.registers);

  const addOne = () => { const k = item.trim(); if (k) setSeen((s) => new Set(s).add(k)); };
  const addBatch = (n: number) => setSeen((s) => { const x = new Set(s); for (let i = 0; i < n; i++) x.add(`id-${x.size}-${i}-${(i * 2654435761) >>> 0}`); return x; });
  const reset = () => setSeen(new Set());

  const lastCell = item.trim() ? bucketAndRank(hash(item.trim()), p) : null;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>HyperLogLog — counting the uncountable</h2></div>
        <p className="jsec-sub">
          How many <em>distinct</em> users visited today, out of a billion events, without storing a billion IDs? Hash each item, route
          it to a bucket, and keep just the largest “rank” (leftmost-1 position) seen there. A high rank is rare, so seeing one means
          you’ve probably seen many distinct items. Averaging the {hll.m} small registers gives the estimate — in a fixed
          {' '}{hll.m} bytes, forever.
        </p>

        <div className="hll-controls">
          <input value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOne()} spellCheck={false} />
          <button onClick={addOne}>+ add</button>
          <button onClick={() => addBatch(100)}>+100 distinct</button>
          <button onClick={() => addBatch(1000)}>+1000 distinct</button>
          <button onClick={reset} className="hll-reset">reset</button>
          <label>precision p <input type="range" min={4} max={8} value={p} onChange={(e) => { setP(+e.target.value); setTick((t) => t + 1); }} /><b>m={hll.m}</b></label>
        </div>

        {lastCell && <div className="hll-route">“{item.trim()}” → bucket <b>{lastCell.bucket}</b>, rank <b>{lastCell.rank}</b></div>}

        <div className="hll-registers" style={{ gridTemplateColumns: `repeat(${Math.min(hll.m, 32)}, 1fr)` }}>
          {hll.registers.slice(0, 32).map((r, i) => (
            <div key={i} className="hll-reg" title={`bucket ${i}: rank ${r}`}>
              <div className="hll-bar" style={{ height: `${(r / maxR) * 100}%`, opacity: r ? 1 : 0.15 }} />
            </div>
          ))}
        </div>
        {hll.m > 32 && <div className="hll-more">showing first 32 of {hll.m} registers</div>}

        <div className="hll-readout">
          <div className="hll-stat"><span>estimate</span><b>{Math.round(est)}</b></div>
          <div className="hll-stat"><span>true distinct</span><b>{truth}</b></div>
          <div className={`hll-stat ${Math.abs(errPct) < 5 ? 'good' : 'ok'}`}><span>error</span><b>{truth ? `${errPct > 0 ? '+' : ''}${errPct.toFixed(1)}%` : '—'}</b></div>
          <div className="hll-stat"><span>memory</span><b>{hll.m} B</b></div>
        </div>

        <p className="hll-foot">
          The standard error is about <code>1.04/√m</code> — so 16 KB of registers (m≈16384) estimates cardinalities into the billions
          within ~0.8%. Redis ships it as the <code>PFADD/PFCOUNT</code> commands; databases use it for <code>COUNT(DISTINCT)</code>
          approximations and network monitors for unique-flow counts. It pairs with Count-Min (which counts <em>frequencies</em>) as the
          two staple streaming sketches.
        </p>
      </section>
    </div>
  );
}
