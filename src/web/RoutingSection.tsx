// Routing & paths — make the invisible routing decision visible. A link-state
// network (like OSPF/IS-IS): every router knows the full topology and the cost of
// each link, then runs Dijkstra to build the lowest-cost tree to every other
// router. Pick a source and destination, step through the algorithm, and change a
// link cost to watch traffic reroute. The math is real (see dijkstra.ts).
import { useEffect, useMemo, useState } from 'react';
import { dijkstra, shortestPath, pathEdgeKeys, type Edge, type Graph } from './dijkstra';

interface Node { id: string; label: string; x: number; y: number }
const NODES: Node[] = [
  { id: 'A', label: 'Core-1', x: 90, y: 90 },
  { id: 'B', label: 'Core-2', x: 300, y: 58 },
  { id: 'C', label: 'Edge-E', x: 510, y: 90 },
  { id: 'G', label: 'Transit', x: 300, y: 185 },
  { id: 'D', label: 'Agg-W', x: 110, y: 290 },
  { id: 'E', label: 'Agg-C', x: 320, y: 305 },
  { id: 'F', label: 'Edge-S', x: 520, y: 275 },
];
const DEFAULT_EDGES: Edge[] = [
  { a: 'A', b: 'B', cost: 2 }, { a: 'A', b: 'D', cost: 3 }, { a: 'B', b: 'G', cost: 1 },
  { a: 'B', b: 'C', cost: 4 }, { a: 'G', b: 'D', cost: 2 }, { a: 'G', b: 'E', cost: 2 },
  { a: 'G', b: 'C', cost: 2 }, { a: 'D', b: 'E', cost: 3 }, { a: 'C', b: 'F', cost: 2 },
  { a: 'E', b: 'F', cost: 3 },
];
const pos = (id: string) => NODES.find((n) => n.id === id)!;
const ekey = (a: string, b: string) => [a, b].sort().join('|');

export function RoutingSection() {
  const [edges, setEdges] = useState<Edge[]>(DEFAULT_EDGES.map((e) => ({ ...e })));
  const [source, setSource] = useState('A');
  const [dest, setDest] = useState('F');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const graph: Graph = useMemo(() => ({ nodes: NODES.map((n) => n.id), edges }), [edges]);
  const result = useMemo(() => dijkstra(graph, source), [graph, source]);
  const path = useMemo(() => shortestPath(result, source, dest) ?? [], [result, source, dest]);
  const pathKeys = useMemo(() => pathEdgeKeys(path), [path]);
  const maxStep = result.order.length;

  // clamp the step whenever the topology/source changes
  useEffect(() => { setStep((s) => Math.min(s, result.order.length)); }, [result.order.length]);

  useEffect(() => {
    if (!playing) return;
    if (step >= maxStep) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, maxStep)), 700);
    return () => clearTimeout(id);
  }, [playing, step, maxStep]);

  const settled = new Set(result.order.slice(0, step));
  const frontier = step > 0 ? new Set(result.steps[step - 1].relaxed) : new Set<string>();
  const dist = step > 0 ? result.steps[step - 1].dist : NODES.reduce((m, n) => ((m[n.id] = n.id === source ? 0 : Infinity), m), {} as Record<string, number>);
  const prev = step > 0 ? result.steps[step - 1].prev : {};
  const justSettled = step > 0 ? result.order[step - 1] : null;

  const bumpEdge = (a: string, b: string, delta: number) => {
    setEdges((es) => es.map((e) => (ekey(e.a, e.b) === ekey(a, b) ? { ...e, cost: Math.max(1, Math.min(9, e.cost + delta)) } : e)));
    setStep(0); setPlaying(false);
  };
  const reset = () => { setEdges(DEFAULT_EDGES.map((e) => ({ ...e }))); setStep(0); setPlaying(false); };
  const pickSource = (id: string) => { setSource(id); setStep(0); setPlaying(false); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Routing &amp; paths — Dijkstra, live</h2></div>
        <p className="jsec-sub">
          This is what a link-state router (OSPF, IS-IS) does. Every router floods the cost of its links until all
          share one map, then each runs <strong>Dijkstra</strong> to find the lowest-cost path to everywhere. Pick a
          source and destination, step through it, and <strong>click a link’s cost (+ / −) to watch the path reroute</strong>.
        </p>

        <div className="rt-controls">
          <label>source
            <select value={source} onChange={(e) => pickSource(e.target.value)}>
              {NODES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <label>destination
            <select value={dest} onChange={(e) => { setDest(e.target.value); }}>
              {NODES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <div className="rt-play">
            <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮ reset</button>
            <button className="ghost small" disabled={step === 0} onClick={() => { setStep((s) => Math.max(0, s - 1)); setPlaying(false); }}>‹ step</button>
            <button className="ghost small" disabled={step >= maxStep} onClick={() => { setStep((s) => Math.min(maxStep, s + 1)); setPlaying(false); }}>step ›</button>
            <button className="ghost small" onClick={() => { if (step >= maxStep) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸ pause' : '▶ play'}</button>
          </div>
          <button className="ghost small" onClick={reset}>↺ default costs</button>
        </div>

        <svg className="rt-svg" viewBox="0 0 600 360" role="img" aria-label="network topology">
          {edges.map((e) => {
            const p1 = pos(e.a), p2 = pos(e.b);
            const onPath = pathKeys.has(ekey(e.a, e.b));
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            return (
              <g key={ekey(e.a, e.b)}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={`rt-edge ${onPath ? 'on' : ''}`} />
                <g className="rt-cost" transform={`translate(${mx},${my})`}>
                  <circle r="13" className={onPath ? 'on' : ''} />
                  <text className="rt-cost-val">{e.cost}</text>
                  <text className="rt-cost-btn minus" x="-22" y="1" onClick={() => bumpEdge(e.a, e.b, -1)}>−</text>
                  <text className="rt-cost-btn plus" x="22" y="1" onClick={() => bumpEdge(e.a, e.b, 1)}>+</text>
                </g>
              </g>
            );
          })}
          {NODES.map((n) => {
            const isSettled = settled.has(n.id);
            const cls = [
              'rt-node',
              n.id === source ? 'src' : '',
              n.id === dest ? 'dst' : '',
              isSettled ? 'settled' : '',
              n.id === justSettled ? 'active' : '',
              path.includes(n.id) ? 'onpath' : '',
            ].join(' ');
            return (
              <g key={n.id} className={cls} transform={`translate(${n.x},${n.y})`} onClick={() => setDest(n.id)}>
                <circle r="22" />
                <text className="rt-label" y="-30">{n.label}</text>
                <text className="rt-id">{n.id}</text>
                {Number.isFinite(dist[n.id]) && <text className="rt-d" y="38">d={dist[n.id]}</text>}
              </g>
            );
          })}
        </svg>

        <div className="rt-status">
          {justSettled
            ? <span>Settled <strong>{pos(justSettled).label}</strong> at cost <strong>{dist[justSettled]}</strong>{result.steps[step - 1].relaxed.length ? ` · improved ${result.steps[step - 1].relaxed.map((r) => pos(r).label).join(', ')}` : ''}.</span>
            : <span>Click <strong>step ›</strong> to settle the source, then watch the frontier expand by lowest cost.</span>}
          {step >= maxStep && (
            path.length
              ? <span className="rt-final">  ✓ shortest path {pos(source).label} → {pos(dest).label}: <strong>{path.map((p) => pos(p).label).join(' → ')}</strong> = cost {result.dist[dest]}.</span>
              : <span className="rt-final bad">  {pos(dest).label} is unreachable from {pos(source).label}.</span>)}
        </div>

        <table className="rt-table">
          <thead><tr><th>router</th><th>cost from {pos(source).label}</th><th>via</th><th>state</th></tr></thead>
          <tbody>
            {NODES.map((n) => (
              <tr key={n.id} className={settled.has(n.id) ? 'done' : ''}>
                <td>{n.label} <span className="rt-mono">({n.id})</span></td>
                <td className="rt-mono">{Number.isFinite(dist[n.id]) ? dist[n.id] : '∞'}</td>
                <td className="rt-mono">{prev[n.id] ? pos(prev[n.id]!).label : (n.id === source ? '— (source)' : '—')}</td>
                <td>{settled.has(n.id) ? 'settled ✓' : frontier.has(n.id) ? 'frontier' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="enc-note">A lower link cost means a more preferred path — exactly how OSPF cost (inversely proportional to
          bandwidth) steers traffic. Raise the cost on a link in the current path and the next-best route takes over.</p>
      </section>
    </div>
  );
}
