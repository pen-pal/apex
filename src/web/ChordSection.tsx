// Chord DHT, made visible. Nodes sit on an identifier ring; pick a start node and a key
// and watch the lookup leap along finger-table shortcuts to the owning node in O(log n)
// hops, instead of crawling node-by-node. The selected node's finger table is shown. Real
// routing in chord.ts (tested on the classic m=3 example).
import { useMemo, useState } from 'react';
import { create, responsible, fingerTable, lookup } from './chord';

const M = 4; // ring of 16
const NODES = [0, 2, 4, 6, 9, 12, 14];

export function ChordSection() {
  const ring = useMemo(() => create(M, NODES), []);
  const [start, setStart] = useState(0);
  const [key, setKey] = useState(11);

  const result = useMemo(() => lookup(ring, start, key), [ring, start, key]);
  const fingers = useMemo(() => fingerTable(ring, start), [ring, start]);
  const owner = responsible(ring, key);

  const R = 96, CX = 130, CY = 130;
  const pos = (id: number) => {
    const ang = (id / ring.size) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + R * Math.cos(ang), y: CY + R * Math.sin(ang) };
  };
  const hopSet = new Set(result.hops);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Chord — find the owner in O(log n) hops</h2></div>
        <p className="jsec-sub">
          Nodes and keys hash onto a ring of {ring.size} identifiers; a key belongs to its <strong>successor</strong>, the first node
          clockwise. To find that node fast, each node keeps a <strong>finger table</strong> — shortcuts to the successors of n+1, n+2,
          n+4, n+8 — so a lookup can jump roughly halfway to the target each hop. Pick a start node and a key:
        </p>

        <div className="chord-controls">
          <label>start node <select value={start} onChange={(e) => setStart(+e.target.value)}>{NODES.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>key <input type="range" min={0} max={ring.size - 1} value={key} onChange={(e) => setKey(+e.target.value)} /><b>{key}</b></label>
        </div>

        <div className="chord-stage">
          <svg viewBox="0 0 260 260" width={260} height={260} className="chord-ring">
            <circle cx={CX} cy={CY} r={R} className="chord-orbit" />
            {/* key marker */}
            <circle cx={pos(key).x} cy={pos(key).y} r={5} className="chord-key" />
            <text x={pos(key).x} y={pos(key).y - 9} className="chord-keylabel" textAnchor="middle">key {key}</text>
            {/* hop path */}
            {result.hops.map((_, i) => i < result.hops.length - 1 && (
              <line key={i} x1={pos(result.hops[i]).x} y1={pos(result.hops[i]).y} x2={pos(result.hops[i + 1]).x} y2={pos(result.hops[i + 1]).y} className="chord-hop" markerEnd="url(#chord-arr)" />
            ))}
            {result.hops.length > 0 && (
              <line x1={pos(result.hops[result.hops.length - 1]).x} y1={pos(result.hops[result.hops.length - 1]).y} x2={pos(result.target).x} y2={pos(result.target).y} className="chord-hop final" markerEnd="url(#chord-arr)" />
            )}
            <defs><marker id="chord-arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="chord-arrhead" /></marker></defs>
            {NODES.map((n) => {
              const p = pos(n);
              return (
                <g key={n}>
                  <circle cx={p.x} cy={p.y} r={13} className={`chord-node ${n === start ? 'start' : ''} ${n === owner ? 'owner' : ''} ${hopSet.has(n) ? 'hop' : ''}`} />
                  <text x={p.x} y={p.y + 4} className="chord-nlabel" textAnchor="middle">{n}</text>
                </g>
              );
            })}
          </svg>

          <div className="chord-side">
            <div className="chord-finger">
              <h4>finger table of node {start}</h4>
              {fingers.map((f, i) => (
                <div key={i} className="chord-frow"><span>+2<sup>{i}</sup> = {f.start}</span><b>→ node {f.node}</b></div>
              ))}
            </div>
            <div className="chord-result">
              key {key} is owned by <b>node {result.target}</b><br />
              route: {result.hops.join(' → ')}{result.hops[result.hops.length - 1] !== result.target ? ` → ${result.target}` : ''}
              <span className="chord-hops">{result.hops.length === 1 && result.hops[0] === result.target ? 'owned locally' : `${result.hops.length} hop${result.hops.length === 1 ? '' : 's'}`}</span>
            </div>
          </div>
        </div>

        <p className="chord-foot">
          With n nodes the finger table has log₂(N) entries and each hop at least halves the distance to the key, so lookups finish in
          O(log n) hops — 20 hops for a million nodes. When a node joins or leaves, only O(log²n) fingers need fixing, and each key moves
          to its new successor (the same minimal-movement property as consistent hashing, which Chord generalises). DHTs like this power
          BitTorrent’s trackerless lookups, IPFS, and the routing layer of several distributed databases.
        </p>
      </section>
    </div>
  );
}
