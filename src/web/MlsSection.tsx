// MLS / TreeKEM, made visible. Eight members are the leaves of a binary ratchet tree; the group key is at the root.
// Click a member to commit an update (or remove it) and watch only its direct path re-key (leaf→root) and its copath
// receive the new secret — O(log n), not O(n). Model + tests in treekem.ts.
import { useMemo, useState } from 'react';
import { directPath, copath, updateCost, canDeriveRoot, type Node } from './treekem';

const N = 8;
const LEVELS = 3;
const W = 620, H = 300, U = W / N, PAD = 26, ROW = (H - 2 * PAD) / LEVELS;
const key = (n: Node) => `${n.level}-${n.index}`;
const pos = (level: number, index: number) => ({
  x: (index + 0.5) * Math.pow(2, level) * U,
  y: PAD + (LEVELS - level) * ROW,
});

export function MlsSection() {
  const [sel, setSel] = useState(2);
  const [removed, setRemoved] = useState(false);

  const path = useMemo(() => new Set(directPath(sel, N).map(key)), [sel]);
  const co = useMemo(() => new Set(copath(sel, N).map(key)), [sel]);
  const cost = updateCost(N);
  const big = updateCost(1024);

  // Build every node with its position + role.
  const nodes: { n: Node; role: string }[] = [];
  for (let level = 0; level <= LEVELS; level++) {
    for (let index = 0; index < Math.pow(2, LEVELS - level); index++) {
      const k = key({ level, index });
      let role = 'idle';
      if (level === 0 && index === sel) role = removed ? 'removed' : 'commit';
      else if (path.has(k)) role = 'rekey';
      else if (co.has(k)) role = 'copath';
      nodes.push({ n: { level, index }, role });
    }
  }
  const edges: [Node, Node][] = [];
  for (let level = 1; level <= LEVELS; level++)
    for (let index = 0; index < Math.pow(2, LEVELS - level); index++) {
      edges.push([{ level, index }, { level: level - 1, index: index * 2 }]);
      edges.push([{ level, index }, { level: level - 1, index: index * 2 + 1 }]);
    }

  return (
    <div className="mls">
      <div className="mls-controls">
        <span className="mls-lbl">click a member, then:</span>
        <button type="button" className={!removed ? 'on' : ''} onClick={() => setRemoved(false)}>update its key</button>
        <button type="button" className={removed ? 'on' : ''} onClick={() => setRemoved(true)}>remove it</button>
      </div>

      <svg className="mls-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ratchet tree">
        {edges.map(([a, b], i) => {
          const pa = pos(a.level, a.index), pb = pos(b.level, b.index);
          const on = (path.has(key(a)) || (b.level === 0 && b.index === sel)) && (path.has(key(b)) || (b.level === 0 && b.index === sel && !removed));
          return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} className={`mls-edge ${on ? 'mls-edge-on' : ''}`} />;
        })}
        {nodes.map(({ n, role }) => {
          const p = pos(n.level, n.index);
          return (
            <g key={key(n)} onClick={n.level === 0 ? () => setSel(n.index) : undefined} style={n.level === 0 ? { cursor: 'pointer' } : undefined}>
              <circle cx={p.x} cy={p.y} r={n.level === LEVELS ? 13 : 10} className={`mls-node mls-${role} ${n.level === LEVELS ? 'mls-root' : ''}`} />
              {n.level === 0 && <text x={p.x} y={p.y + 26} className="mls-mlabel" textAnchor="middle">m{n.index}</text>}
              {n.level === LEVELS && <text x={p.x} y={p.y + 4} className="mls-rootlbl" textAnchor="middle">🔑</text>}
            </g>
          );
        })}
      </svg>

      <div className="mls-legend">
        <span><i className="mls-sw mls-commit" /> the member (committer)</span>
        <span><i className="mls-sw mls-rekey" /> direct path — re-keyed</span>
        <span><i className="mls-sw mls-copath" /> copath — sent the new secret</span>
        {removed && <span><i className="mls-sw mls-removed" /> removed — blanked</span>}
      </div>

      <div className="mls-verdict">
        {removed
          ? <>Member <b>m{sel}</b> is removed: its leaf is blanked and its direct path re-keyed, so the new root secret is one it <b>can’t derive</b> — {canDeriveRoot(sel, sel) ? '' : 'locked out'} (post-compromise security). Everyone else recomputes the root from the copath secrets.</>
          : <>Updating <b>m{sel}</b> re-keys <b>{cost.reKeyed} nodes</b> (leaf → root) and sends <b>{cost.encryptions} encryptions</b> (one per copath subtree) — not the <b>{cost.naivePairwise}</b> a pairwise re-key would need. In a 1024-member group that’s <b>{big.encryptions}</b> encryptions, not <b>{big.naivePairwise}</b>.</>}
      </div>

      <p className="mls-foot">
        Signal’s double ratchet keeps a <em>two-party</em> chat forward-secret; doing that for a group by running a
        ratchet between every pair is O(n²) keys and O(n) work per message. <strong>MLS</strong> (RFC 9420) puts the
        members at the leaves of a <strong>ratchet tree</strong>: each holds the secrets up its path to the root, and the
        group key is the root. Any change touches only one leaf-to-root <strong>path</strong> — <strong>O(log n)</strong>
        re-keys, each encrypted to the sibling subtree so everyone can recompute the root. That’s what makes it scale to
        huge groups, and it’s why removing a member (blanking its leaf and re-keying the path) gives real
        <strong> post-compromise security</strong>: an attacker who stole its keys is locked out at the next commit. It’s
        the standard behind interoperable group messaging (Cisco, Wire, and the EU’s DMA interop push). (MLS / TreeKEM.)
      </p>
    </div>
  );
}
