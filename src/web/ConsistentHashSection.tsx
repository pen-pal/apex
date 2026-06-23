// Consistent hashing, made visible. Nodes and keys sit on a ring; each key belongs
// to the first node clockwise. Add or remove a node and watch ONLY the keys in the
// affected arc change owner — while the "modulo-N" counter shows how naive sharding
// would reshuffle nearly everything. Real ring math (see consistenthash.ts).
import { useMemo, useState } from 'react';
import { HashRing, hashRing, moduloAssign, movedKeys, RING } from './consistenthash';

const KEYS = Array.from({ length: 28 }, (_, i) => `key-${i}`);
const PALETTE = ['hsl(212 70% 52%)', 'hsl(28 75% 52%)', 'hsl(145 55% 42%)', 'hsl(280 50% 55%)', 'hsl(0 65% 55%)', 'hsl(190 60% 42%)'];
const CX = 200, CY = 200, R = 150;

const pointAt = (pos: number, r = R) => {
  const a = (pos / RING) * 2 * Math.PI - Math.PI / 2;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
};

export function ConsistentHashSection() {
  const [nodes, setNodes] = useState<string[]>(['A', 'B', 'C']);
  const [replicas, setReplicas] = useState(8);
  const [moved, setMoved] = useState<{ action: string; consistent: number; modulo: number } | null>(null);

  const color = useMemo(() => Object.fromEntries(nodes.map((n, i) => [n, PALETTE[i % PALETTE.length]])), [nodes]);
  const ring = useMemo(() => { const r = new HashRing(replicas); nodes.forEach((n) => r.addNode(n)); return r; }, [nodes, replicas]);
  const dist = useMemo(() => ring.distribution(KEYS), [ring]);
  const ownerCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const k of KEYS) c[dist[k]] = (c[dist[k]] ?? 0) + 1;
    return c;
  }, [dist]);

  const apply = (nextNodes: string[], action: string) => {
    const r2 = new HashRing(replicas); nextNodes.forEach((n) => r2.addNode(n));
    const after = r2.distribution(KEYS);
    const consistent = movedKeys(dist, after);
    const modBefore = Object.fromEntries(KEYS.map((k) => [k, moduloAssign(k, nodes)]));
    const modAfter = Object.fromEntries(KEYS.map((k) => [k, moduloAssign(k, nextNodes)]));
    setMoved({ action, consistent, modulo: movedKeys(modBefore, modAfter) });
    setNodes(nextNodes);
  };
  const addNode = () => { const n = String.fromCharCode(65 + nodes.length); if (nodes.length < 6) apply([...nodes, n], `added ${n}`); };
  const removeNode = (n: string) => { if (nodes.length > 1) apply(nodes.filter((x) => x !== n), `removed ${n}`); };

  const vnodes = ring.points;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Consistent hashing — adding a server without reshuffling everything</h2></div>
        <p className="jsec-sub">
          Spread keys across servers with <code>hash(key) mod N</code> and changing N moves almost every key — a cache
          stampede. Consistent hashing places nodes and keys on a ring; a key belongs to the first node clockwise. Add or
          remove a node and <strong>only the keys in that arc move</strong>. Virtual nodes even out the load.
        </p>

        <div className="ch-stage">
          <svg className="ch-ring" viewBox="0 0 400 400" role="img" aria-label="hash ring">
            <circle cx={CX} cy={CY} r={R} className="ch-circle" />
            {/* ownership arcs */}
            {vnodes.map((v, i) => {
              const next = vnodes[(i + 1) % vnodes.length];
              let a1 = (v.pos / RING) * 2 * Math.PI - Math.PI / 2;
              let a2 = (next.pos / RING) * 2 * Math.PI - Math.PI / 2;
              if (a2 <= a1) a2 += 2 * Math.PI; // wrap
              const large = a2 - a1 > Math.PI ? 1 : 0;
              const p1 = { x: CX + R * Math.cos(a1), y: CY + R * Math.sin(a1) };
              const p2 = { x: CX + R * Math.cos(a2), y: CY + R * Math.sin(a2) };
              return <path key={`arc${i}`} d={`M${p1.x},${p1.y} A${R},${R} 0 ${large} 1 ${p2.x},${p2.y}`} stroke={color[next.node]} strokeWidth={5} fill="none" opacity={0.55} />;
            })}
            {/* virtual nodes */}
            {vnodes.map((v, i) => {
              const p = pointAt(v.pos, R);
              return <circle key={`v${i}`} cx={p.x} cy={p.y} r={v.vIndex === 0 ? 7 : 4} fill={color[v.node]} stroke="#fff" strokeWidth={1.5} />;
            })}
            {/* keys */}
            {KEYS.map((k) => {
              const p = pointAt(hashRing(k), R - 22);
              return <circle key={k} cx={p.x} cy={p.y} r={3.5} fill={color[dist[k]]} opacity={0.9} />;
            })}
            <text x={CX} y={CY - 4} className="ch-center">{KEYS.length} keys</text>
            <text x={CX} y={CY + 14} className="ch-center sub">{nodes.length} nodes · {replicas} vnodes</text>
          </svg>

          <div className="ch-side">
            <div className="ch-nodes">
              {nodes.map((n) => (
                <div className="ch-node" key={n}>
                  <span className="ch-dot" style={{ background: color[n] }} />
                  <span className="ch-name">{n}</span>
                  <span className="ch-load">{ownerCounts[n] ?? 0} keys</span>
                  <button className="ch-rm" disabled={nodes.length <= 1} onClick={() => removeNode(n)}>✕</button>
                </div>
              ))}
            </div>
            <div className="ch-actions">
              <button className="ghost small" disabled={nodes.length >= 6} onClick={addNode}>+ add node</button>
              <label className="ch-rep">virtual nodes: {replicas}<input type="range" min={1} max={32} value={replicas} onChange={(e) => setReplicas(+e.target.value)} /></label>
            </div>
            {moved && (
              <div className="ch-moved">
                <div className="ch-moved-h">{moved.action} →</div>
                <div className="ch-moved-row ok">consistent hashing moved <strong>{moved.consistent}</strong> / {KEYS.length} keys</div>
                <div className="ch-moved-row bad">modulo-N would move <strong>{moved.modulo}</strong> / {KEYS.length} keys</div>
              </div>
            )}
          </div>
        </div>
        <p className="enc-note">This is how Memcached clients, Cassandra/DynamoDB, and CDN caches shard data: when a node joins or dies, only
          its neighbours’ keys reshuffle, so the system keeps most of its cache warm instead of cold-starting. More virtual nodes per server →
          smoother balance and smaller disruptions.</p>
      </section>
    </div>
  );
}
