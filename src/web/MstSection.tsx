// Minimum spanning tree, made visible. Pick Kruskal or Prim and step through it: Kruskal walks the
// edges cheapest-first, accepting (green) or rejecting cycle-formers (red dashed); Prim grows one tree
// outward from a node, the in-tree nodes filling in. Both land on the same total weight. Real
// union-find / cut-property model from mst.ts.
import { useMemo, useState } from 'react';
import { kruskal, prim, nodes, type Edge } from './mst';

const POS: Record<string, { x: number; y: number }> = {
  A: { x: 80, y: 55 }, B: { x: 300, y: 50 }, C: { x: 180, y: 165 }, D: { x: 350, y: 215 }, E: { x: 60, y: 225 },
};
const G: Edge[] = [
  { u: 'A', v: 'B', w: 1 }, { u: 'A', v: 'C', w: 3 }, { u: 'B', v: 'C', w: 3 },
  { u: 'B', v: 'D', w: 6 }, { u: 'C', v: 'D', w: 4 }, { u: 'C', v: 'E', w: 2 }, { u: 'D', v: 'E', w: 5 },
];
const ekey = (e: { u: string; v: string }) => [e.u, e.v].sort().join('-');

export function MstSection() {
  const [algo, setAlgo] = useState<'kruskal' | 'prim'>('kruskal');
  const [step, setStep] = useState(0);

  const result = useMemo(() => (algo === 'kruskal' ? kruskal(G) : prim(G, 'A')), [algo]);
  const n = result.steps.length;
  const done = step >= n;
  const processed = result.steps.slice(0, step);
  const treeKeys = new Set(processed.filter((s) => s.accepted).map((s) => ekey(s.edge)));
  const rejKeys = new Set(processed.filter((s) => !s.accepted).map((s) => ekey(s.edge)));
  const cur = step > 0 ? result.steps[step - 1] : null;
  const weightSoFar = processed.filter((s) => s.accepted).reduce((a, s) => a + s.edge.w, 0);

  const inTree = new Set<string>();
  if (algo === 'prim') { inTree.add('A'); for (const s of processed) if (s.accepted) { inTree.add(s.edge.u); inTree.add(s.edge.v); } }

  const reset = () => setStep(0);
  const setAlgoReset = (a: 'kruskal' | 'prim') => { setAlgo(a); setStep(0); };

  return (
    <div className="mst">
      <div className="mst-top">
        <div className="mst-seg">
          {(['kruskal', 'prim'] as const).map((a) => (
            <button key={a} type="button" className={algo === a ? 'on' : ''} onClick={() => setAlgoReset(a)}>{a === 'kruskal' ? 'Kruskal' : 'Prim (from A)'}</button>
          ))}
        </div>
        <div className="mst-steps">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
          <button type="button" className="primary" onClick={() => setStep((s) => Math.min(n, s + 1))} disabled={done}>{step === 0 ? 'start ▶' : done ? 'done' : 'step ▶'}</button>
          <button type="button" onClick={() => setStep(n)} disabled={done}>skip</button>
          <button type="button" onClick={reset} disabled={step === 0}>reset</button>
        </div>
        <div className="mst-weight">weight <b>{weightSoFar}</b>{done && <span className="mst-final"> = MST ({result.weight})</span>}</div>
      </div>

      <div className="mst-stepinfo">
        {!cur ? `${algo === 'kruskal' ? 'Kruskal sorts every edge and adds the cheapest that doesn’t close a cycle.' : 'Prim grows one tree from A, always taking the cheapest edge that leaves it.'}`
          : <>Edge <b>{cur.edge.u}–{cur.edge.v}</b> (w {cur.edge.w}): <span className={cur.accepted ? 'mst-acc' : 'mst-rej'}>{cur.accepted ? '✓ accept' : '✗ reject'}</span> — {cur.reason}</>}
      </div>

      <div className="mst-diagram">
        <svg viewBox="0 0 420 280" className="mst-svg">
          {G.map((e, i) => {
            const p = POS[e.u], q = POS[e.v], k = ekey(e);
            const cls = treeKeys.has(k) ? 'mst-edge tree' : rejKeys.has(k) ? 'mst-edge rej' : cur && ekey(cur.edge) === k ? 'mst-edge cur' : 'mst-edge';
            return (
              <g key={i}>
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={cls} />
                <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2} dy={-4} className="mst-w">{e.w}</text>
              </g>
            );
          })}
          {nodes(G).map((nd) => {
            const p = POS[nd];
            const on = algo === 'prim' && inTree.has(nd);
            return (
              <g key={nd}>
                <circle cx={p.x} cy={p.y} r={19} className={`mst-node ${on ? 'in' : ''}`} />
                <text x={p.x} y={p.y} dy={5} className={`mst-nl ${on ? 'in' : ''}`}>{nd}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {algo === 'kruskal' && (
        <div className="mst-queue">
          <div className="mst-queue-h">edges, sorted cheapest-first</div>
          <div className="mst-chips">
            {result.steps.map((s, i) => (
              <span key={i} className={`mst-chip ${i < step ? (s.accepted ? 'acc' : 'rej') : ''} ${i === step - 1 ? 'cur' : ''}`}>{s.edge.u}{s.edge.v}<i>{s.edge.w}</i></span>
            ))}
          </div>
        </div>
      )}

      <p className="mst-foot">
        Both are greedy yet provably optimal, thanks to the <strong>cut property</strong>: for any way of splitting the nodes into two sides, the
        single lightest edge crossing the split is always in some MST — so neither algorithm can paint itself into a corner. Kruskal needs a
        <strong> union-find</strong> to test "would this close a cycle?" in near-constant time; Prim needs a priority queue of the frontier.
        MSTs underlie network design, clustering (cut the k−1 heaviest tree edges to get k clusters), and approximate TSP. With distinct weights
        the tree is unique — the two algorithms can add edges in different orders but always end at the same one. (CLRS ch.23.)
      </p>
    </div>
  );
}
