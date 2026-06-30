// Strongly connected components, made visible. The digraph's nodes are coloured by the SCC they belong
// to — each maximal group where everyone can reach everyone. Collapse each group to a point and you get
// the condensation, always a DAG: the cycle-free skeleton of the graph's cycle structure. Found by
// Kosaraju's two-pass DFS in scc.ts (CLRS ch.22.5).
import { useMemo } from 'react';
import { kosaraju, type DiEdge } from './scc';

const POS: Record<string, { x: number; y: number }> = {
  a: { x: 60, y: 55 }, b: { x: 155, y: 95 }, e: { x: 60, y: 150 },
  c: { x: 255, y: 60 }, d: { x: 255, y: 150 }, f: { x: 165, y: 235 }, g: { x: 270, y: 235 }, h: { x: 375, y: 150 },
};
const G: DiEdge[] = [
  { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'b', to: 'e' }, { from: 'b', to: 'f' },
  { from: 'c', to: 'd' }, { from: 'c', to: 'g' }, { from: 'd', to: 'c' }, { from: 'd', to: 'h' },
  { from: 'e', to: 'a' }, { from: 'e', to: 'f' }, { from: 'f', to: 'g' }, { from: 'g', to: 'f' },
];
const COMP_HUE = [212, 150, 280, 28, 340, 90];
const R = 18;

export function SccSection() {
  const r = useMemo(() => kosaraju(G, ['h']), []);
  const hue = (node: string) => COMP_HUE[r.compOf[node] % COMP_HUE.length];

  return (
    <div className="scc">
      <div className="scc-diagram">
        <svg viewBox="0 0 430 290" className="scc-svg">
          <defs>
            <marker id="scc-ah" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="scc-ahp" /></marker>
          </defs>
          {G.map((e, i) => {
            const p = POS[e.from], q = POS[e.to];
            const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len;
            const intra = r.compOf[e.from] === r.compOf[e.to];
            return <line key={i} x1={p.x + ux * R} y1={p.y + uy * R} x2={q.x - ux * R} y2={q.y - uy * R} className={`scc-edge ${intra ? 'intra' : ''}`} markerEnd="url(#scc-ah)" />;
          })}
          {Object.keys(POS).map((nd) => {
            const p = POS[nd];
            return (
              <g key={nd}>
                <circle cx={p.x} cy={p.y} r={R} style={{ fill: `hsl(${hue(nd)} 60% 92%)`, stroke: `hsl(${hue(nd)} 55% 50%)` }} className="scc-node" />
                <text x={p.x} y={p.y} dy={5} className="scc-nl" style={{ fill: `hsl(${hue(nd)} 60% 30%)` }}>{nd}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="scc-side">
        <div className="scc-comps">
          <div className="scc-h">{r.components.length} strongly connected components</div>
          {r.components.map((c, i) => (
            <div key={i} className="scc-comp">
              <span className="scc-dot" style={{ background: `hsl(${COMP_HUE[i % COMP_HUE.length]} 60% 55%)` }} />
              <span className="scc-members">{'{' + c.join(', ') + '}'}</span>
              <span className="scc-kind">{c.length > 1 ? 'a cycle' : 'single node'}</span>
            </div>
          ))}
        </div>
        <div className="scc-cond">
          <div className="scc-h">condensation (a DAG)</div>
          <div className="scc-cond-edges">
            {r.condensation.length === 0 ? <span className="scc-none">no edges between components</span>
              : r.condensation.map(([a, b], i) => (
                <span key={i} className="scc-ce">
                  <span className="scc-cchip" style={{ background: `hsl(${COMP_HUE[a % COMP_HUE.length]} 60% 90%)`, color: `hsl(${COMP_HUE[a % COMP_HUE.length]} 60% 30%)` }}>{'{' + r.components[a].join('') + '}'}</span>
                  →
                  <span className="scc-cchip" style={{ background: `hsl(${COMP_HUE[b % COMP_HUE.length]} 60% 90%)`, color: `hsl(${COMP_HUE[b % COMP_HUE.length]} 60% 30%)` }}>{'{' + r.components[b].join('') + '}'}</span>
                </span>
              ))}
          </div>
        </div>
      </div>

      <p className="scc-foot">
        Kosaraju runs DFS twice. <strong>Pass 1</strong> on the original graph records each node's finish time; <strong>pass 2</strong> runs DFS
        on the <em>transpose</em> (all edges reversed), picking roots in reverse-finish order — and each resulting tree is exactly one SCC. The
        trick is that reverse-finish order hands you a sink component of the original graph first, and on the transpose its edges all point inward,
        so the DFS can't leak into another component. Collapsing each SCC to a single vertex always yields a <strong>DAG</strong> (the condensation),
        which is why SCC-finding is the first step in 2-SAT, dependency cycle detection, and dataflow analysis. Tarjan's algorithm gets the same
        answer in a single pass using a lowlink stack. (CLRS ch.22.5.)
      </p>
    </div>
  );
}
