// Quickselect, made visible. Pick which order statistic you want (k), then step the partitions: each one
// drops a pivot at its final sorted index and THROWS AWAY the half that can't contain k, so the search
// window collapses toward the answer. The index axis shows the live [lo,hi] window shrinking; the tally
// shows it finishing in ~2n comparisons instead of the n·log n a full sort would cost. Real model from
// quickselect.ts.
import { useMemo, useState } from 'react';
import { quickselect } from './quickselect';

const DATA = [37, 12, 88, 5, 63, 21, 95, 8, 50, 29, 74, 41, 3, 66, 18, 80];

export function QuickselectSection() {
  const n = DATA.length;
  const [k, setK] = useState(Math.floor(n / 2));
  const res = useMemo(() => quickselect(DATA, k), [k]);
  const [step, setStep] = useState(0);
  const s = res.steps[Math.min(step, res.steps.length - 1)];
  const sorted = useMemo(() => [...DATA].sort((a, b) => a - b), []);
  const fullSortCmp = Math.ceil(n * Math.log2(n));

  // clamp step when k changes
  const si = Math.min(step, res.steps.length - 1);

  return (
    <div className="qsel">
      <p className="qsel-intro">
        To find the <strong>k-th smallest</strong> value you don't need to sort everything. Quickselect
        partitions around a pivot — which lands at its <strong>final sorted position</strong> — then keeps
        only the side that contains k and repeats. Throwing away half each time gives <strong>O(n)</strong>
        average, versus O(n·log n) to sort just to read one element.
      </p>

      <div className="qsel-pick">
        <label>k (0-indexed) <input type="range" min={0} max={n - 1} value={k} onChange={(e) => { setK(+e.target.value); setStep(0); }} /><b>{k}</b></label>
        <div className="qsel-answer">the {k === 0 ? 'minimum' : k === n - 1 ? 'maximum' : k === Math.floor((n - 1) / 2) ? 'median' : `#${k + 1} smallest`} is <b>{res.value}</b></div>
      </div>

      <div className="qsel-array">
        {sorted.map((v, i) => (
          <span key={i} className={`qsel-cell ${i === k ? 'target' : ''} ${i < k ? 'less' : i > k ? 'more' : ''}`}>{v}</span>
        ))}
      </div>
      <div className="qsel-arrlbl">the data sorted (for reference) — quickselect never computes this; it finds index {k} directly</div>

      <div className="qsel-window">
        <div className="qsel-wh">search window — partition {si + 1} of {res.steps.length}</div>
        <div className="qsel-axis">
          <div className="qsel-discard" style={{ left: 0, width: `${(s.lo / n) * 100}%` }} />
          <div className="qsel-active" style={{ left: `${(s.lo / n) * 100}%`, width: `${((s.hi - s.lo + 1) / n) * 100}%` }} />
          <div className="qsel-discard" style={{ left: `${((s.hi + 1) / n) * 100}%`, right: 0 }} />
          <div className="qsel-pivot" style={{ left: `${((s.landedAt + 0.5) / n) * 100}%` }} title={`pivot ${s.pivotValue} landed at index ${s.landedAt}`} />
          <div className="qsel-kmark" style={{ left: `${((k + 0.5) / n) * 100}%` }} title={`k = ${k}`}><span>k</span></div>
        </div>
        <div className="qsel-wmsg">
          pivot <b>{s.pivotValue}</b> landed at index <b>{s.landedAt}</b> — {s.goesLeft === null ? '🎯 that IS index k, done.' : s.goesLeft ? `k is to the left, discard indices ≥ ${s.landedAt}` : `k is to the right, discard indices ≤ ${s.landedAt}`}
        </div>
        <div className="qsel-stepctl">
          <button type="button" disabled={si === 0} onClick={() => setStep((x) => Math.max(0, x - 1))}>‹ prev</button>
          <button type="button" disabled={si >= res.steps.length - 1} onClick={() => setStep((x) => Math.min(res.steps.length - 1, x + 1))}>next ›</button>
        </div>
      </div>

      <div className="qsel-tally">
        <div className="qsel-stat ok"><span>quickselect comparisons</span><b>{res.comparisons}</b></div>
        <div className="qsel-stat"><span>full sort (~n·log n)</span><b>≈ {fullSortCmp}</b></div>
        <div className="qsel-stat"><span>partitions</span><b>{res.steps.length}</b></div>
      </div>

      <p className="qsel-foot">
        Average O(n) hinges on the pivot roughly halving the window; a bad pivot (always the smallest) decays
        to O(n²), which is why real implementations pick smartly — median-of-three (used here), or
        <strong> median-of-medians</strong> for a guaranteed-linear worst case (introselect falls back to it).
        The same partition step is the heart of quicksort; quickselect just recurses one side instead of both.
        Use it for medians, percentiles (p50/p95/p99), top-k, and trimmed means — anywhere you need one order
        statistic, not the whole order. (Hoare's FIND, 1961; CLRS §9.)
      </p>
    </div>
  );
}
