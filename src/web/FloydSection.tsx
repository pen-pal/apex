// Floyd-Warshall, made visible. The distance matrix IS the algorithm: step through the intermediate
// vertices k one at a time, and watch every cell [i][j] relax to the cheaper of "what we had" and
// "i→k→j". The pivot row and column (everything through k) are highlighted; cells that just improved
// flash. Edit edge weights — including negatives — and a vertex whose distance to itself goes negative
// flags a negative cycle. Real DP from floyd.ts.
import { useMemo, useState } from 'react';
import { floydWarshall, type DiEdge } from './floyd';

const INIT: DiEdge[] = [
  { from: 'A', to: 'B', w: 3 }, { from: 'B', to: 'C', w: 1 }, { from: 'A', to: 'C', w: 7 },
  { from: 'C', to: 'D', w: 2 }, { from: 'B', to: 'D', w: 5 },
];
const cell = (v: number) => (v === Infinity ? '∞' : v);

export function FloydSection() {
  const [edges, setEdges] = useState<DiEdge[]>(INIT);
  const [step, setStep] = useState(0);

  const r = useMemo(() => floydWarshall(edges), [edges]);
  const n = r.nodes.length;
  const cur = r.steps[Math.min(step, r.steps.length - 1)];
  const prev = step > 0 ? r.steps[step - 1] : null;
  const k = cur.k; // the intermediate vertex just considered (null at step 0)

  const setW = (i: number, w: number) => setEdges((es) => es.map((e, idx) => (idx === i ? { ...e, w } : e)));

  return (
    <div className="fw">
      <div className="fw-top">
        <div className="fw-edges">
          {edges.map((e, i) => (
            <label key={i} className="fw-edge">{e.from}→{e.to}
              <input type="number" value={e.w} min={-20} max={20} onChange={(ev) => setW(i, +ev.target.value)} />
            </label>
          ))}
        </div>
        <div className="fw-steps">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
          <button type="button" className="primary" onClick={() => setStep((s) => Math.min(n, s + 1))} disabled={step >= n}>{step === 0 ? 'start ▶' : step >= n ? 'done' : 'next k ▶'}</button>
          <button type="button" onClick={() => setStep(n)} disabled={step >= n}>all</button>
          <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
        </div>
      </div>

      <div className="fw-caption">
        {k === null ? 'Initial matrix — only the direct edges (no intermediate vertices yet).'
          : <>Allowing paths through <b className="fw-kname">{r.nodes[k]}</b> as a waypoint: each cell becomes min(itself, [i→{r.nodes[k]}] + [{r.nodes[k]}→j]).</>}
      </div>

      <div className="fw-matrix-wrap">
        <table className="fw-matrix">
          <thead>
            <tr><th className="fw-corner">i\j</th>{r.nodes.map((nd, j) => <th key={j} className={k === j ? 'piv' : ''}>{nd}</th>)}</tr>
          </thead>
          <tbody>
            {r.nodes.map((nd, i) => (
              <tr key={i}>
                <th className={k === i ? 'piv' : ''}>{nd}</th>
                {r.nodes.map((_, j) => {
                  const v = cur.dist[i][j];
                  const changed = prev && prev.dist[i][j] !== v;
                  const onPivot = k !== null && (i === k || j === k);
                  const diag = i === j;
                  return (
                    <td key={j} className={`${changed ? 'changed' : ''} ${onPivot ? 'pivot' : ''} ${diag ? 'diag' : ''} ${v < 0 && diag ? 'neg' : ''}`}>{cell(v)}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.negativeCycle && <div className="fw-negcycle">⚠ negative cycle detected — a vertex can reach itself at negative cost, so "shortest path" is undefined (you could loop forever getting cheaper).</div>}

      <p className="fw-foot">
        One triple loop, O(V³): for each waypoint <strong>k</strong>, relax every pair through it. After the last vertex the table holds the
        shortest distance between <em>all</em> pairs at once — cheaper than running a single-source algorithm from every vertex when the graph is
        dense, and unlike Dijkstra it tolerates <strong>negative edges</strong>. It’s really the same closure idea as Warshall’s transitive-closure
        and the regex-to-automaton constructions: “reachable/cheapest using an ever-larger set of intermediates.” Routing protocols, the
        small-world diameter of a network, and game-AI distance tables all lean on it. (CLRS ch.25.2.)
      </p>
    </div>
  );
}
