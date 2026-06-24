// Count-Min Sketch, made visible. A d×w grid of counters; type an item and watch its d
// hashed cells light up and increment. Estimating reads the same d cells and takes the
// minimum. A side table compares the sketch's estimate with the exact count, so you can
// see the over-counting from collisions — and never an under-count. Shrink the grid to
// watch error grow. Real logic in countmin.ts (tested for the one-sided guarantee).
import { useMemo, useState } from 'react';
import { create, add, estimate, cells, type Sketch } from './countmin';

const SEED_STREAM = ['apple', 'apple', 'apple', 'banana', 'cherry', 'apple', 'banana', 'date', 'apple'];

export function CountMinSection() {
  const [d, setD] = useState(3);
  const [w, setW] = useState(8);
  const [truth, setTruth] = useState<Record<string, number>>({});
  const [item, setItem] = useState('apple');
  const [highlight, setHighlight] = useState<string | null>('apple');
  const [version, setVersion] = useState(0);

  // rebuild the sketch from the recorded truth whenever d/w/truth change
  const sketch = useMemo<Sketch>(() => {
    const s = create(d, w);
    for (const [k, n] of Object.entries(truth)) add(s, k, n);
    return s;
  }, [d, w, truth, version]);

  const addItem = () => {
    const k = item.trim();
    if (!k) return;
    setTruth((t) => ({ ...t, [k]: (t[k] ?? 0) + 1 }));
    setHighlight(k);
  };
  const seed = () => {
    const t: Record<string, number> = {};
    for (const x of SEED_STREAM) t[x] = (t[x] ?? 0) + 1;
    setTruth(t); setHighlight('apple'); setVersion((v) => v + 1);
  };
  const reset = () => { setTruth({}); setHighlight(null); };

  const hot = highlight ? cells(sketch, highlight) : [];
  const items = Object.keys(truth);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Count-Min Sketch — counting a stream in tiny memory</h2></div>
        <p className="jsec-sub">
          You can’t keep a counter for every distinct item in a billion-event stream. Count-Min keeps a small grid instead: each item
          is hashed to one cell per row and those cells are bumped. To read a count, look at the same cells and take the
          <strong> minimum</strong> — because collisions only ever add, the minimum is the least-polluted estimate, and it is never too
          low. Add items and watch the grid.
        </p>

        <div className="cms-controls">
          <input value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} spellCheck={false} placeholder="item" />
          <button onClick={addItem}>+ add</button>
          <button onClick={seed}>seed a stream</button>
          <button onClick={reset} className="cms-reset">reset</button>
          <label>rows d <input type="range" min={1} max={6} value={d} onChange={(e) => setD(+e.target.value)} /><b>{d}</b></label>
          <label>cols w <input type="range" min={2} max={16} value={w} onChange={(e) => setW(+e.target.value)} /><b>{w}</b></label>
        </div>

        <div className="cms-stage">
          <div className="cms-grid" style={{ gridTemplateColumns: `repeat(${w}, 1fr)` }}>
            {sketch.table.flatMap((rowArr, r) =>
              rowArr.map((v, c) => (
                <div key={`${r}-${c}`} className={`cms-cell ${highlight && hot[r] === c ? 'hot' : ''} ${v > 0 ? 'nz' : ''}`}>{v}</div>
              )),
            )}
          </div>

          <div className="cms-readout">
            <h3>estimate vs. truth</h3>
            {items.length === 0 ? <p className="cms-empty">add some items →</p> : (
              <table className="cms-table">
                <thead><tr><th>item</th><th>est</th><th>true</th></tr></thead>
                <tbody>
                  {items.map((k) => {
                    const est = estimate(sketch, k), tr = truth[k];
                    return (
                      <tr key={k} className={highlight === k ? 'sel' : ''} onMouseEnter={() => setHighlight(k)}>
                        <td>{k}</td><td className={est > tr ? 'over' : 'exact'}>{est}</td><td>{tr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {highlight && <div className="cms-min">“{highlight}” → cells [{hot.join(', ')}] → <b>min = {estimate(sketch, highlight)}</b></div>}
          </div>
        </div>

        <p className="cms-foot">
          The guarantee is one-sided: <code>estimate ≥ true</code>, always. With width <code>w = ⌈e/ε⌉</code> and depth
          <code> d = ⌈ln(1/δ)⌉</code> the overestimate is within <code>ε·N</code> of the truth with probability <code>1−δ</code>. It
          pairs with a heap to track “heavy hitters” (the top-k frequent items) in one pass — used in network telemetry, databases, and
          trending systems. Its cousin HyperLogLog instead counts <em>distinct</em> items in similarly tiny space.
        </p>
      </section>
    </div>
  );
}
