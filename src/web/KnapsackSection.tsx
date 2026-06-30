// 0/1 knapsack, made visible. The DP table fills row by row: each cell is the best value achievable with
// the first i items inside capacity w. Edit the items and capacity, then read the answer off the bottom-
// right corner and follow the highlighted backtrack path up the table to see WHICH items were chosen.
// The greedy-by-ratio result is shown alongside to prove it loses on the 0/1 problem. Real DP from knapsack.ts.
import { useMemo, useState } from 'react';
import { knapsack, greedyByRatio, type Item } from './knapsack';

const INIT: Item[] = [
  { name: 'A', weight: 1, value: 6 },
  { name: 'B', weight: 2, value: 10 },
  { name: 'C', weight: 3, value: 12 },
];

export function KnapsackSection() {
  const [items, setItems] = useState<Item[]>(INIT);
  const [capacity, setCapacity] = useState(5);

  const r = useMemo(() => knapsack(items, capacity), [items, capacity]);
  const greedy = useMemo(() => greedyByRatio(items, capacity), [items, capacity]);
  const chosen = new Set(r.chosen);

  // recompute the backtrack path cells (i,w) for highlighting
  const pathCells = useMemo(() => {
    const cells = new Set<string>();
    let w = capacity;
    for (let i = items.length; i >= 1; i--) {
      cells.add(`${i},${w}`);
      if (r.table[i][w] !== r.table[i - 1][w]) w -= items[i - 1].weight;
    }
    return cells;
  }, [r, items, capacity]);

  const maxVal = Math.max(1, r.best);
  const setItem = (i: number, patch: Partial<Item>) => setItems((its) => its.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  return (
    <div className="knp">
      <div className="knp-top">
        <div className="knp-items">
          <div className="knp-h">items</div>
          {items.map((it, i) => (
            <div key={it.name} className={`knp-item ${chosen.has(it.name) ? 'on' : ''}`}>
              <span className="knp-iname">{it.name}</span>
              <label>w<input type="number" min={1} max={capacity} value={it.weight} onChange={(e) => setItem(i, { weight: Math.max(1, +e.target.value) })} /></label>
              <label>v<input type="number" min={1} max={99} value={it.value} onChange={(e) => setItem(i, { value: Math.max(1, +e.target.value) })} /></label>
              {chosen.has(it.name) && <span className="knp-taken">✓ taken</span>}
            </div>
          ))}
          <label className="knp-cap">capacity <input type="range" min={1} max={9} value={capacity} onChange={(e) => setCapacity(+e.target.value)} /><b>{capacity}</b></label>
        </div>

        <div className="knp-result">
          <div className="knp-best"><span>optimal value</span><b>{r.best}</b></div>
          <div className="knp-chosen">take {r.chosen.length ? `{${r.chosen.join(', ')}}` : 'nothing'}</div>
          <div className={`knp-greedy ${greedy.value < r.best ? 'lose' : ''}`}>greedy-by-ratio: <b>{greedy.value}</b>{greedy.value < r.best && <span> — loses by {r.best - greedy.value}!</span>}</div>
        </div>
      </div>

      <div className="knp-table-wrap">
        <div className="knp-h">dp[i][w] = best value, first i items within capacity w</div>
        <table className="knp-table">
          <thead>
            <tr><th className="knp-corner">i \ w</th>{Array.from({ length: capacity + 1 }, (_, w) => <th key={w}>{w}</th>)}</tr>
          </thead>
          <tbody>
            {r.table.map((row, i) => (
              <tr key={i}>
                <th>{i === 0 ? '∅' : items[i - 1].name}</th>
                {row.map((v, w) => {
                  const onPath = pathCells.has(`${i},${w}`);
                  const answer = i === items.length && w === capacity;
                  return <td key={w} className={`${answer ? 'answer' : ''} ${onPath ? 'path' : ''}`} style={{ background: v > 0 && !onPath && !answer ? `hsl(212 60% ${96 - (v / maxVal) * 18}%)` : undefined }}>{v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="knp-foot">
        Greedy fails on 0/1 knapsack because taking the best value-per-weight item can crowd out a better
        <em> combination</em> — here grabbing A then B fills the bag and misses B+C. DP wins by remembering the optimum for every smaller
        (items, capacity) subproblem and reusing it: O(n·W) cells, each decided in O(1). It’s <strong>pseudo-polynomial</strong> — fast when W is
        modest, but exponential in the number of <em>bits</em> of W, which is why knapsack is NP-complete yet routinely solved in practice. The
        same table shape powers subset-sum, coin change, and budget/resource allocation. (Note: the <em>fractional</em> knapsack, where you can
        take pieces, IS solved correctly by the greedy ratio rule — it’s only the all-or-nothing 0/1 version that needs DP.)
      </p>
    </div>
  );
}
