// The Alias method, made visible. Drag the weights and watch the setup chop them into n equal-height
// columns, each holding at most TWO outcomes: a primary (bottom, its own colour) and an alias (top, another
// colour donating its excess). To sample you pick a column (n-sided die) then a height within it (one coin) —
// two O(1) lookups. The probability table on the right confirms every outcome ends up with exactly its
// weight. Real model from aliasmethod.ts.
import { useMemo, useState } from 'react';
import { buildAlias, effectiveProbability } from './aliasmethod';

const NAMES = ['A', 'B', 'C', 'D', 'E'];
const HUES = [212, 150, 28, 280, 340];

export function AliasMethodSection() {
  const [weights, setWeights] = useState([1, 1, 2, 4, 2]);
  const t = useMemo(() => buildAlias(weights), [weights]);
  const total = weights.reduce((a, b) => a + b, 0);
  const n = weights.length;
  const setW = (i: number, v: number) => setWeights((w) => w.map((x, j) => (j === i ? v : x)));
  const color = (i: number) => `hsl(${HUES[i]} 60% 55%)`;

  return (
    <div className="alm">
      <p className="alm-intro">
        Sampling from a <strong>weighted</strong> distribution in <strong>O(1)</strong>. The setup slices the n
        weights into n <strong>equal columns</strong> of probability 1/n each, where every column holds at most
        two outcomes — a <strong>primary</strong> and an <strong>alias</strong>. Then each draw is just: roll an
        n-sided die for a column, flip one coin to pick its primary or alias. Two array lookups.
      </p>

      <div className="alm-weights">
        {weights.map((w, i) => (
          <label key={i} className="alm-w" style={{ borderColor: color(i) }}>
            <span className="alm-wn" style={{ background: color(i) }}>{NAMES[i]}</span>
            <input type="range" min={0} max={10} value={w} onChange={(e) => setW(i, +e.target.value)} />
            <b>{w}</b>
          </label>
        ))}
      </div>

      <div className="alm-table">
        <div className="alm-cols">
          {t.prob.map((p, i) => (
            <div key={i} className="alm-col" title={`column ${i}: ${(p * 100).toFixed(0)}% ${NAMES[i]}${p < 0.999 ? `, ${((1 - p) * 100).toFixed(0)}% ${NAMES[t.alias[i]]}` : ''}`}>
              {p < 0.999 && <div className="alm-seg alias" style={{ height: `${(1 - p) * 100}%`, background: color(t.alias[i]) }}>{NAMES[t.alias[i]]}</div>}
              <div className="alm-seg prim" style={{ height: `${p * 100}%`, background: color(i) }}>{NAMES[i]}</div>
              <span className="alm-cidx">{i}</span>
            </div>
          ))}
        </div>
        <div className="alm-tablelbl">n = {n} equal columns · each ≤ 2 outcomes (primary + alias)</div>
      </div>

      <div className="alm-check">
        <div className="alm-ch-h">every outcome gets exactly its weight:</div>
        {weights.map((w, i) => {
          const eff = effectiveProbability(t, i);
          const want = w / total;
          return (
            <div key={i} className="alm-crow">
              <span className="alm-cn" style={{ color: color(i) }}>{NAMES[i]}</span>
              <div className="alm-cbar"><div className="alm-cfill" style={{ width: `${want * 100}%`, background: color(i) }} /></div>
              <span className="alm-cp">{(eff * 100).toFixed(1)}%</span>
              <span className={`alm-cok ${Math.abs(eff - want) < 1e-9 ? 'ok' : 'bad'}`}>{Math.abs(eff - want) < 1e-9 ? '✓' : '✗'}</span>
            </div>
          );
        })}
      </div>

      <p className="alm-foot">
        The setup is the clever part: keep two worklists, <strong>small</strong> (weight below average) and
        <strong> large</strong> (above). Pair one of each — the small one fills the rest of its column with a
        slice of the large one (that becomes its alias), and the large one, now lighter, goes back to whichever
        list it belongs in. Every step finalizes one column, so it's O(n). The result gives <strong>unbiased
        O(1) samples</strong>, versus O(log n) for cumulative-array + binary search or O(n) for linear scan —
        worth it when you sample the same distribution many times (Monte-Carlo, weighted load balancing, loot
        tables, genetic algorithms). The tradeoff: rebuilding the table is O(n), so it's best for
        <em> static</em> weights; for frequently-changing weights a Fenwick/BIT over the cumulative weights
        supports O(log n) update and sample. (Walker 1977; Vose 1991.)
      </p>
    </div>
  );
}
