// Link-state routing (OSPF), made visible. Every router floods an LSA about its own links until all
// of them share one identical map; then each runs Dijkstra over that map. Pick a source router to see
// its shortest-path tree light up and its routing table fill; drag the link-cost sliders and watch
// the tree (and which paths win) recompute. Real flooding + SPF model from linkstate.ts.
import { useMemo, useState } from 'react';
import { flood, spf, routers, type Topology } from './linkstate';

const POS: Record<string, { x: number; y: number }> = {
  A: { x: 90, y: 60 }, B: { x: 360, y: 60 }, C: { x: 90, y: 250 }, D: { x: 360, y: 250 },
};
const INIT: Topology = [
  { a: 'A', b: 'B', cost: 1 }, { a: 'A', b: 'C', cost: 4 },
  { a: 'B', b: 'C', cost: 2 }, { a: 'B', b: 'D', cost: 7 }, { a: 'C', b: 'D', cost: 3 },
];
const ekey = (a: string, b: string) => [a, b].sort().join('|');

export function LinkStateSection() {
  const [topo, setTopo] = useState<Topology>(INIT);
  const [source, setSource] = useState('A');

  const all = useMemo(() => routers(topo), [topo]);
  const flooding = useMemo(() => flood(topo), [topo]);
  const routes = useMemo(() => spf(topo, source), [topo, source]);

  const treeEdges = useMemo(() => {
    const set = new Set<string>();
    for (const r of all) { const p = routes[r]?.path ?? []; for (let i = 0; i + 1 < p.length; i++) set.add(ekey(p[i], p[i + 1])); }
    return set;
  }, [routes, all]);

  const setCost = (i: number, cost: number) => setTopo((t) => t.map((l, k) => (k === i ? { ...l, cost } : l)));

  return (
    <div className="ls">
      <div className="ls-main">
        <div className="ls-diagram">
          <svg viewBox="0 0 450 310" className="ls-svg">
            {topo.map((l, i) => {
              const p = POS[l.a], q = POS[l.b];
              const tree = treeEdges.has(ekey(l.a, l.b));
              return (
                <g key={i}>
                  <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={tree ? 'ls-edge tree' : 'ls-edge'} />
                  <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2} className="ls-cost" dy={-4}>{l.cost}</text>
                </g>
              );
            })}
            {all.map((r) => {
              const p = POS[r];
              const isSrc = r === source;
              const route = routes[r];
              return (
                <g key={r} className="ls-node" onClick={() => setSource(r)} style={{ cursor: 'pointer' }}>
                  <circle cx={p.x} cy={p.y} r={24} className={isSrc ? 'ls-router src' : 'ls-router'} />
                  <text x={p.x} y={p.y} className={isSrc ? 'ls-rlabel src' : 'ls-rlabel'} dy={5}>{r}</text>
                  {!isSrc && route && <text x={p.x} y={p.y + 38} className="ls-rcost">cost {route.cost}</text>}
                  {isSrc && <text x={p.x} y={p.y + 38} className="ls-rcost src">source</text>}
                </g>
              );
            })}
          </svg>
          <div className="ls-hint">click any router to compute shortest paths from it</div>
        </div>

        <div className="ls-side">
          <div className="ls-flood">
            <div className="ls-flood-h">LSA flooding</div>
            <p>Every router floods one LSA about its own links. After <b>{flooding.rounds} rounds</b> all {all.length} routers hold the
              <b> identical</b> database — the full map. {flooding.converged ? '✓ converged' : 'not converged'}.</p>
            <div className="ls-lsdb">{all.map((r) => <span key={r} className="ls-lsdb-row"><b>{r}</b>: {flooding.have[r].join(' ')}</span>)}</div>
          </div>

          <div className="ls-costs">
            <div className="ls-costs-h">Link costs</div>
            {topo.map((l, i) => (
              <label key={i} className="ls-costrow">
                <span>{l.a}–{l.b}</span>
                <input type="range" min={1} max={10} value={l.cost} onChange={(e) => setCost(i, +e.target.value)} />
                <b>{l.cost}</b>
              </label>
            ))}
          </div>
        </div>
      </div>

      <table className="ls-table">
        <thead><tr><th>destination</th><th>cost</th><th>next hop</th><th>path (SPF tree)</th></tr></thead>
        <tbody>
          {all.filter((r) => r !== source).map((r) => (
            <tr key={r}>
              <td>{r}</td><td>{routes[r].cost}</td><td>{routes[r].nextHop}</td><td className="ls-path">{routes[r].path.join(' → ')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="ls-foot">
        This is the opposite of <strong>distance-vector</strong>: there, routers tell neighbours their <em>routes</em> and can be fooled into
        a count-to-infinity loop. Here each router advertises only its own links, floods them everywhere, and computes paths itself from the
        complete map — so a stale or lying neighbour can’t poison anyone’s math, and convergence is fast and loop-free. The price is that every
        router stores the whole topology and reruns Dijkstra on any change; OSPF tames that with <strong>areas</strong>, summarising one area’s
        internals into a single advertisement at the border so the database doesn’t grow without bound. (RFC 2328.)
      </p>
    </div>
  );
}
