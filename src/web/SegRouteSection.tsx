// Segment Routing, made visible. A weighted topology; pick a segment list and watch the realized path light up
// on the graph — a plain node segment follows the shortest path, a waypoint steers the packet a longer way, and
// an adjacency segment forces a specific link. The direct shortest path is shown faintly for comparison. Real
// model from segroute.ts.
import { useMemo, useState } from 'react';
import { srPath, shortestPath, pathCost, type Graph, type Segment } from './segroute';

const EDGES: Record<string, number> = { 'A-B': 1, 'A-C': 4, 'B-C': 1, 'B-D': 2, 'C-E': 1, 'D-E': 3, 'D-F': 2, 'E-F': 1, 'E-G': 2, 'F-G': 1 };
const POS: Record<string, [number, number]> = { A: [40, 140], B: [155, 66], C: [155, 214], D: [300, 66], E: [300, 214], F: [440, 140], G: [548, 140] };
const G: Graph = (() => { const g: Graph = {}; for (const k in EDGES) { const [a, b] = k.split('-'); (g[a] ??= {}); (g[b] ??= {}); g[a][b] = EDGES[k]; g[b][a] = EDGES[k]; } return g; })();

const PRESETS: { name: string; label: string; segs: Segment[] }[] = [
  { name: 'direct', label: 'shortest [→G]', segs: [{ type: 'node', node: 'G' }] },
  { name: 'viaD', label: 'steer via D [→D, →G]', segs: [{ type: 'node', node: 'D' }, { type: 'node', node: 'G' }] },
  { name: 'forceAC', label: 'force link [A→C, →G]', segs: [{ type: 'adj', from: 'A', to: 'C' }, { type: 'node', node: 'G' }] },
  { name: 'scenic', label: 'scenic [→F, →C, →G]', segs: [{ type: 'node', node: 'F' }, { type: 'node', node: 'C' }, { type: 'node', node: 'G' }] },
];
const START = 'A';
const segLabel = (s: Segment) => (s.type === 'node' ? `node ${s.node}` : `adj ${s.from}→${s.to}`);
const edgeKey = (a: string, b: string) => [a, b].sort().join('-');

export function SegRouteSection() {
  const [preset, setPreset] = useState(PRESETS[1]);
  const res = useMemo(() => srPath(G, START, preset.segs), [preset]);
  const direct = useMemo(() => shortestPath(G, START, 'G'), []);
  const directCost = pathCost(G, direct);

  const pathEdges = new Set<string>();
  for (let i = 1; i < res.hops.length; i++) pathEdges.add(edgeKey(res.hops[i - 1], res.hops[i]));
  const directEdges = new Set<string>();
  for (let i = 1; i < direct.length; i++) directEdges.add(edgeKey(direct[i - 1], direct[i]));
  const waypoints = new Set(preset.segs.flatMap((s) => (s.type === 'node' ? [s.node] : [s.from, s.to])));

  return (
    <div className="sgr">
      <p className="sgr-intro">
        The source writes a <strong>segment list</strong> — a stack of waypoints — into the packet; each router
        forwards toward the top segment and pops it once reached. A <strong>node</strong> segment means "reach
        router X by the shortest path"; an <strong>adjacency</strong> segment forces one specific link. The
        realized route is the shortest paths between segments, stitched together — arbitrary paths, no per-flow
        state in the core. Pick a segment list:
      </p>

      <div className="sgr-presets">
        {PRESETS.map((p) => <button key={p.name} type="button" className={`sgr-preset ${preset.name === p.name ? 'on' : ''}`} onClick={() => setPreset(p)}>{p.label}</button>)}
      </div>

      <svg viewBox="0 0 588 280" className="sgr-graph">
        {/* edges */}
        {Object.keys(EDGES).map((k) => {
          const [a, b] = k.split('-'); const [x1, y1] = POS[a], [x2, y2] = POS[b];
          const onPath = pathEdges.has(edgeKey(a, b)); const onDirect = directEdges.has(edgeKey(a, b));
          return (
            <g key={k}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={`sgr-edge ${onPath ? 'path' : ''} ${onDirect && !onPath ? 'direct' : ''}`} />
              <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 3} className="sgr-w" textAnchor="middle">{EDGES[k]}</text>
            </g>
          );
        })}
        {/* nodes */}
        {Object.entries(POS).map(([n, [x, y]]) => (
          <g key={n}>
            <circle cx={x} cy={y} r={15} className={`sgr-node ${n === START ? 'start' : ''} ${waypoints.has(n) ? 'wp' : ''}`} />
            <text x={x} y={y + 4} className="sgr-nlabel" textAnchor="middle">{n}</text>
          </g>
        ))}
      </svg>

      <div className="sgr-stack">
        <span className="sgr-stack-label">segment list:</span>
        <span className="sgr-seg start">start {START}</span>
        {preset.segs.map((s, i) => <span key={i} className={`sgr-seg ${s.type}`}>{segLabel(s)}</span>)}
      </div>

      <div className="sgr-stats">
        <div className="sgr-stat"><span>realized path</span><b className="sgr-hops">{res.valid ? res.hops.join(' → ') : 'invalid'}</b></div>
        <div className={`sgr-stat ${res.cost > directCost ? 'warn' : 'ok'}`}><span>path cost</span><b>{res.cost}</b></div>
        <div className="sgr-stat"><span>direct shortest ({direct.join('')})</span><b>{directCost}</b></div>
        <div className="sgr-stat"><span>engineered detour</span><b>+{res.cost - directCost}</b></div>
      </div>

      <p className="sgr-foot">
        The elegance is where the <em>state</em> lives. Old RSVP-TE built an explicit tunnel by signalling every
        router on the path to remember this flow — O(flows) state in the core, and a control-plane storm whenever
        anything changed. Segment routing pushes the whole path into the packet header as a label stack, so the
        core routers stay stateless: they only need to know the globally-agreed node labels (flooded once by the
        IGP, like OSPF/IS-IS) and their own local adjacency labels. That makes traffic engineering, fast reroute
        (pre-computed backup segment lists), and service chaining (steer through a firewall, then a load
        balancer) just a matter of what the edge writes. <strong>SR-MPLS</strong> encodes segments as a stack of
        MPLS labels; <strong>SRv6</strong> encodes them as a list of IPv6 addresses in an extension header, so a
        segment can even name a <em>function</em> (a network program), not just a location. The trade-off vs
        plain shortest-path routing is header overhead and the edge needing a topology view to compute the list —
        but no per-flow state, which is exactly what didn't scale before. (RFC 8402; RFC 8660; SRv6 RFC 8986.)
      </p>
    </div>
  );
}
