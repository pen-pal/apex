// Spanning Tree Protocol, made visible. A looped switch topology would flood
// broadcasts forever; STP elects a root bridge, finds each bridge's shortest path to
// it, and blocks the redundant ports — leaving a loop-free tree. Drag the bridge IDs
// and link costs and watch the root, the root ports, and the blocked port move. Real
// logic in stp.ts (tested).
import { useMemo, useState } from 'react';
import { spanningTree, type Link, type Role } from './stp';

// A square loop: 1—2 / 2—3 / 3—4 / 4—1, plus a diagonal 2—4 to make it a richer mesh.
const BRIDGES = [1, 2, 3, 4];
const INIT: Link[] = [
  { a: 1, b: 2, cost: 1 },
  { a: 2, b: 3, cost: 1 },
  { a: 3, b: 4, cost: 1 },
  { a: 4, b: 1, cost: 1 },
  { a: 2, b: 4, cost: 1 },
];

// fixed layout positions for the four bridges (percent of the canvas)
const POS: Record<number, { x: number; y: number }> = {
  1: { x: 22, y: 18 }, 2: { x: 78, y: 18 }, 3: { x: 78, y: 82 }, 4: { x: 22, y: 82 },
};

const roleColor: Record<Role, string> = {
  'root-port': 'hsl(150 60% 42%)',
  designated: 'hsl(212 70% 50%)',
  blocked: 'hsl(0 72% 55%)',
};
const roleLabel: Record<Role, string> = { 'root-port': 'root port', designated: 'designated', blocked: 'BLOCKED' };

export function StpSection() {
  const [links, setLinks] = useState<Link[]>(INIT);
  const r = useMemo(() => spanningTree(BRIDGES, links), [links]);

  const setCost = (i: number, c: number) =>
    setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, cost: Math.max(1, c) } : l)));

  // per-link the two end roles (for drawing each half of the edge)
  const endRole = (l: Link, bridge: number): Role =>
    r.ports.find((p) => p.link === l && p.bridge === bridge)!.role;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Spanning Tree — break the loops</h2></div>
        <p className="jsec-sub">
          Redundant links keep a LAN alive when one fails — but a loop makes broadcasts circle forever (a broadcast storm). STP
          elects a <strong>root bridge</strong> (lowest ID), every other bridge points its <strong>root port</strong> down its
          cheapest path to the root, each segment elects a <strong>designated</strong> port, and whatever’s left is{' '}
          <strong>blocked</strong> — exactly enough to leave a single loop-free tree. Raise a link’s cost and watch the tree re-form.
        </p>

        <div className="stp-canvas">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="stp-edges">
            {links.map((l, i) => {
              const p = POS[l.a], q = POS[l.b];
              const blocked = endRole(l, l.a) === 'blocked' || endRole(l, l.b) === 'blocked';
              const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
              return (
                <g key={i}>
                  {/* half toward a, half toward b — coloured by each end's role */}
                  <line x1={p.x} y1={p.y} x2={mx} y2={my} stroke={roleColor[endRole(l, l.a)]}
                    strokeWidth={blocked ? 0.8 : 1.4} strokeDasharray={blocked ? '2 1.5' : undefined} vectorEffect="non-scaling-stroke" />
                  <line x1={mx} y1={my} x2={q.x} y2={q.y} stroke={roleColor[endRole(l, l.b)]}
                    strokeWidth={blocked ? 0.8 : 1.4} strokeDasharray={blocked ? '2 1.5' : undefined} vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}
          </svg>
          {BRIDGES.map((b) => (
            <div key={b} className={`stp-node ${b === r.root ? 'root' : ''}`} style={{ left: `${POS[b].x}%`, top: `${POS[b].y}%` }}>
              <div className="stp-bid">{b}</div>
              <div className="stp-meta">{b === r.root ? '★ root' : `cost ${r.dist[b]}`}</div>
            </div>
          ))}
        </div>

        <div className="stp-legend">
          {(['root-port', 'designated', 'blocked'] as Role[]).map((role) => (
            <span key={role}><i style={{ background: roleColor[role] }} /> {roleLabel[role]}</span>
          ))}
        </div>

        <div className="stp-links">
          {links.map((l, i) => (
            <div key={i} className="stp-link">
              <span className="stp-link-name">{l.a} — {l.b}</span>
              <input type="range" min={1} max={12} value={l.cost} onChange={(e) => setCost(i, +e.target.value)} />
              <span className="stp-link-cost">cost {l.cost}</span>
              <span className="stp-link-roles">
                <em style={{ color: roleColor[endRole(l, l.a)] }}>{l.a}:{roleLabel[endRole(l, l.a)]}</em>
                <em style={{ color: roleColor[endRole(l, l.b)] }}>{l.b}:{roleLabel[endRole(l, l.b)]}</em>
              </span>
            </div>
          ))}
        </div>

        <div className="stp-verdict">
          Root bridge <strong>{r.root}</strong> · <strong>{r.blocked}</strong> port{r.blocked === 1 ? '' : 's'} blocked ·{' '}
          {links.length - (BRIDGES.length - 1)} redundant link{links.length - (BRIDGES.length - 1) === 1 ? '' : 's'} folded away,
          leaving {BRIDGES.length - 1} forwarding edges — a tree. No loop survives, so no broadcast storm.
        </div>
      </section>
    </div>
  );
}
