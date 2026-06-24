// Topological sort, made visible. A small dependency graph laid out in columns by depth;
// step Kahn's algorithm and watch it repeatedly pick a node whose prerequisites are all
// done (in-degree 0), append it to the order, and free up the next ready nodes. Toggle an
// extra edge to create a cycle and watch it become unorderable. Real logic in toposort.ts.
import { useMemo, useState } from 'react';
import { topoSort, type Graph } from './toposort';

const BASE: Graph = {
  nodes: ['boot', 'net', 'db', 'cache', 'api', 'web', 'worker'],
  edges: [['boot', 'net'], ['boot', 'db'], ['net', 'api'], ['db', 'api'], ['db', 'cache'], ['cache', 'api'], ['api', 'web'], ['api', 'worker']],
};
const CYCLE_EDGE: [string, string] = ['web', 'boot']; // makes it cyclic

export function TopoSortSection() {
  const [cycle, setCycle] = useState(false);
  const g = useMemo<Graph>(() => ({ nodes: BASE.nodes, edges: cycle ? [...BASE.edges, CYCLE_EDGE] : BASE.edges }), [cycle]);
  const r = useMemo(() => topoSort(g), [g]);
  const [step, setStep] = useState(1e9);

  const placed = r.order ? r.order.slice(0, Math.min(step, r.order.length)) : [];
  const placedSet = new Set(placed);
  const inCycle = new Set(r.cycleNodes);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Topological sort — ordering by dependency</h2></div>
        <p className="jsec-sub">
          Given “must happen before” arrows, a topological order lines everything up so no arrow ever points backward. Kahn’s algorithm
          is greedy: take any node with <strong>no remaining prerequisites</strong>, output it, remove its arrows — which frees up the
          next batch of ready nodes — and repeat. If you ever get stuck with nodes still left, there’s a <strong>cycle</strong> and no
          order can exist.
        </p>

        <label className="topo-cyclebtn"><input type="checkbox" checked={cycle} onChange={(e) => { setCycle(e.target.checked); setStep(1e9); }} /> add a cyclic dependency (web → boot)</label>

        <div className="topo-nodes">
          {g.nodes.map((n) => {
            const done = placedSet.has(n);
            const order = r.order ? r.order.indexOf(n) : -1;
            return (
              <div key={n} className={`topo-node ${done ? 'done' : ''} ${inCycle.has(n) ? 'cycle' : ''}`}>
                {done && <span className="topo-order">{order + 1}</span>}
                {n}
              </div>
            );
          })}
        </div>

        {!r.hasCycle ? (
          <>
            <div className="topo-controls">
              <button onClick={() => setStep(0)} disabled={step <= 0}>⏮</button>
              <button onClick={() => setStep(Math.max(0, Math.min(step, r.order!.length) - 1))} disabled={placed.length === 0}>◀</button>
              <span className="topo-count">{placed.length} / {r.order!.length} placed</span>
              <button onClick={() => setStep(placed.length + 1)} disabled={placed.length >= r.order!.length}>▶</button>
              <button onClick={() => setStep(r.order!.length)} disabled={placed.length >= r.order!.length}>⏭</button>
            </div>
            <div className="topo-order-row">
              <span className="topo-olabel">order:</span>
              {placed.length === 0 ? <span className="topo-next">— press ▶ to begin</span> : placed.map((n, i) => <span key={i} className="topo-chip">{n}</span>)}
              {placed.length > 0 && placed.length < r.order!.length && r.steps[placed.length - 1] && (
                <span className="topo-next">ready: {r.steps[placed.length - 1].readyAfter.join(', ') || '—'}</span>
              )}
            </div>
          </>
        ) : (
          <div className="topo-cyclemsg">⛔ Cycle detected among {r.cycleNodes.join(', ')} — these nodes never lose all their prerequisites, so no valid order exists. (A real build system would report a circular dependency here.)</div>
        )}

        <p className="topo-foot">
          Kahn’s algorithm runs in O(V+E) and falls out of it for free: if it places fewer than all the nodes, the leftovers are exactly
          those tangled in a cycle. A depth-first variant produces an order by reversing the finish times and detects cycles via a node
          that’s still “on the stack.” Beyond build order, the same idea underlies course-prerequisite planning, dataflow/spreadsheet
          recalculation, deadlock-free lock ordering, and instruction scheduling in compilers.
        </p>
      </section>
    </div>
  );
}
