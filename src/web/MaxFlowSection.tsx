// Max-flow / min-cut, made visible. Step through Edmonds-Karp: each click finds a shortest augmenting
// path (highlighted), pushes its bottleneck, and the edge flow/cap labels update. When no path remains
// you've hit the maximum flow — and the min-cut reveals itself as the saturated edges leaving the set
// of nodes still reachable from the source. Real model from maxflow.ts (anchored to CLRS, max flow 23).
import { useMemo, useState } from 'react';
import { maxflow, type Edge } from './maxflow';

const POS: Record<string, { x: number; y: number }> = {
  s: { x: 40, y: 150 }, v1: { x: 175, y: 64 }, v2: { x: 175, y: 236 },
  v3: { x: 320, y: 64 }, v4: { x: 320, y: 236 }, t: { x: 455, y: 150 },
};
const EDGES: Edge[] = [
  { u: 's', v: 'v1', cap: 16 }, { u: 's', v: 'v2', cap: 13 },
  { u: 'v1', v: 'v3', cap: 12 }, { u: 'v2', v: 'v1', cap: 4 },
  { u: 'v3', v: 'v2', cap: 9 }, { u: 'v2', v: 'v4', cap: 14 },
  { u: 'v4', v: 'v3', cap: 7 }, { u: 'v3', v: 't', cap: 20 }, { u: 'v4', v: 't', cap: 4 },
];
const R = 21;
const onPath = (path: string[] | null, u: string, v: string) => {
  if (!path) return false;
  for (let i = 0; i + 1 < path.length; i++) if (path[i] === u && path[i + 1] === v) return true;
  return false;
};

export function MaxFlowSection() {
  const result = useMemo(() => maxflow(EDGES, 's', 't'), []);
  const [step, setStep] = useState(0); // 0 = empty; k = after the k-th augmenting path
  const n = result.steps.length;
  const atEnd = step === n;

  const flows: Record<string, number> = step === 0 ? {} : result.steps[step - 1].flows;
  const total = step === 0 ? 0 : result.steps[step - 1].totalAfter;
  const curPath = step >= 1 ? result.steps[step - 1].path : null;
  const cutSet = new Set(result.minCutS);
  const isCutEdge = (u: string, v: string) => atEnd && cutSet.has(u) && !cutSet.has(v) && result.cutEdges.some((e) => e.u === u && e.v === v);

  return (
    <div className="mf">
      <div className="mf-top">
        <div className="mf-steps">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀ back</button>
          <button type="button" className="primary" onClick={() => setStep((s) => Math.min(n, s + 1))} disabled={atEnd}>
            {step === 0 ? 'find augmenting path ▶' : atEnd ? 'maximum reached' : 'next path ▶'}
          </button>
          <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
          <button type="button" onClick={() => setStep(n)} disabled={atEnd}>skip to max</button>
        </div>
        <div className="mf-total">flow <b>{total}</b>{atEnd && <span className="mf-max"> = max flow</span>}</div>
      </div>

      <div className="mf-stepinfo">
        {step === 0 ? 'Click “find augmenting path” to push flow from s to t along a shortest residual path.'
          : <>Path {step}/{n}: <b className="mf-pathtxt">{curPath!.join(' → ')}</b>, bottleneck <b>{result.steps[step - 1].bottleneck}</b>{atEnd && ' — no augmenting path remains, so this is the maximum.'}</>}
      </div>

      <div className="mf-diagram">
        <svg viewBox="0 0 495 300" className="mf-svg">
          <defs>
            <marker id="mf-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="mf-ah" /></marker>
            <marker id="mf-arrow-hot" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="mf-ah hot" /></marker>
            <marker id="mf-arrow-cut" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="mf-ah cut" /></marker>
          </defs>
          {EDGES.map((e, i) => {
            const p = POS[e.u], q = POS[e.v];
            const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
            const ux = dx / len, uy = dy / len;
            const x1 = p.x + ux * R, y1 = p.y + uy * R, x2 = q.x - ux * R, y2 = q.y - uy * R;
            const f = flows[`${e.u}->${e.v}`] ?? 0;
            const hot = onPath(curPath, e.u, e.v);
            const cut = isCutEdge(e.u, e.v);
            const cls = cut ? 'mf-edge cut' : hot ? 'mf-edge hot' : f > 0 ? 'mf-edge used' : 'mf-edge';
            const mk = cut ? 'url(#mf-arrow-cut)' : hot ? 'url(#mf-arrow-hot)' : 'url(#mf-arrow)';
            const mx = (x1 + x2) / 2 + uy * 11, my = (y1 + y2) / 2 - ux * 11;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} className={cls} markerEnd={mk} />
                <text x={mx} y={my} className={`mf-flbl ${f > 0 ? 'on' : ''}`}>{f}/{e.cap}</text>
              </g>
            );
          })}
          {Object.entries(POS).map(([id, p]) => {
            const inS = atEnd && cutSet.has(id);
            return (
              <g key={id}>
                <circle cx={p.x} cy={p.y} r={R} className={`mf-node ${id === 's' || id === 't' ? 'st' : ''} ${inS ? 'inS' : ''}`} />
                <text x={p.x} y={p.y} dy={4} className={`mf-nlbl ${id === 's' || id === 't' ? 'st' : ''}`}>{id}</text>
              </g>
            );
          })}
        </svg>
        {atEnd && <div className="mf-cutnote">min cut: S = {'{'}{result.minCutS.join(', ')}{'}'} — the red saturated edges crossing it carry exactly {result.maxFlow}, the max flow.</div>}
      </div>

      <p className="mf-foot">
        Edmonds-Karp always augments along a <strong>shortest</strong> residual path (BFS), which bounds it to O(VE²) regardless of capacities.
        Each push also adds a <em>reverse</em> residual edge, letting later paths “cancel” earlier flow — that’s what lets a greedy method reach
        the true optimum. When the BFS can no longer reach the sink, the nodes it <em>can</em> still reach form one side of the
        <strong> minimum cut</strong>, and by the max-flow min-cut theorem the capacity of the edges crossing it equals the maximum flow exactly.
        The same machinery solves bipartite matching, image segmentation, and project-selection. (CLRS ch.26.)
      </p>
    </div>
  );
}
