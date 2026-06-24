// AVL tree, made visible. Insert keys and watch the binary search tree rotate itself back
// into balance — each node labeled with its balance factor, the tree drawn with real edges.
// A "sorted insert" button shows the key point: feeding 1,2,3,… would make a plain BST into
// a linked list, but the AVL stays log-deep. Real AVL in avl.ts (tested).
import { useMemo, useState } from 'react';
import { insert, height, balanceFactor, build, type Node } from './avl';

interface Pos { node: Node; x: number; y: number }

function layout(root: Node | null): { positions: Pos[]; edges: [Pos, Pos][]; w: number } {
  const positions: Pos[] = [];
  let nextX = 0;
  const place = (n: Node | null, depth: number): Pos | null => {
    if (!n) return null;
    const left = place(n.left, depth + 1);
    const x = nextX++;          // in-order x assigns columns left→right (no overlaps)
    const p: Pos = { node: n, x, y: depth };
    positions.push(p);
    place(n.right, depth + 1);
    void left;
    return p;
  };
  place(root, 0);
  const byNode = new Map(positions.map((p) => [p.node, p]));
  const edges: [Pos, Pos][] = [];
  for (const p of positions) { if (p.node.left) edges.push([p, byNode.get(p.node.left)!]); if (p.node.right) edges.push([p, byNode.get(p.node.right)!]); }
  return { positions, edges, w: nextX };
}

export function AvlSection() {
  const [root, setRoot] = useState<Node | null>(() => build([50, 30, 70, 20, 40, 60, 80, 10]));
  const [next, setNext] = useState('45');

  const add = () => { const k = parseInt(next, 10); if (!isNaN(k)) setRoot((r) => insert(r ? structuredClone(r) : null, k)); };
  const sortedInsert = () => setRoot((r) => { let t = r ? structuredClone(r) : null; const base = t ? Math.max(...inkeys(t)) : 0; for (let i = 1; i <= 7; i++) t = insert(t, base + i); return t; });
  const reset = () => setRoot(build([50, 30, 70, 20, 40, 60, 80, 10]));

  const { positions, edges, w } = useMemo(() => layout(root), [root]);
  const COL = 46, ROW = 60, PAD = 24;
  const px = (x: number) => PAD + x * COL, py = (y: number) => PAD + y * ROW;
  const width = Math.max(1, w) * COL + PAD;
  const heightPx = (height(root) + 0.5) * ROW + PAD;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>AVL tree — a search tree that rebalances itself</h2></div>
        <p className="jsec-sub">
          A binary search tree is only fast if it stays bushy; feed it sorted keys and a naive BST becomes a slow linked list. An AVL
          tree fixes this after every insert: it tracks each node’s <strong>balance factor</strong> (left height − right height) and, the
          moment one hits ±2, performs a <strong>rotation</strong> that restores balance while keeping the keys in order. Insert some keys:
        </p>

        <div className="avl-ops">
          <input value={next} onChange={(e) => setNext(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} inputMode="numeric" />
          <button onClick={add}>+ insert</button>
          <button onClick={sortedInsert}>+ 7 sorted keys</button>
          <button onClick={reset} className="avl-reset">reset</button>
          <span className="avl-stat">height <b>{height(root)}</b> · {positions.length} nodes</span>
        </div>

        <div className="avl-treewrap">
          <svg viewBox={`0 0 ${width} ${heightPx}`} width={width} style={{ maxWidth: '100%' }} height={heightPx}>
            {edges.map(([a, b], i) => <line key={i} x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} className="avl-edge" />)}
            {positions.map((p, i) => {
              const f = balanceFactor(p.node);
              return (
                <g key={i}>
                  <circle cx={px(p.x)} cy={py(p.y)} r={15} className={`avl-node ${Math.abs(f) === 1 ? 'tilt' : ''}`} />
                  <text x={px(p.x)} y={py(p.y) + 4} className="avl-key" textAnchor="middle">{p.node.key}</text>
                  <text x={px(p.x) + 17} y={py(p.y) - 10} className="avl-bf" textAnchor="start">{f > 0 ? `+${f}` : f}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="avl-foot">
          Because each rotation is O(1) and at most one is needed per insert, the tree stays within ~1.44·log₂n height — so 31 nodes are
          never deeper than 6 levels, even from fully-sorted input (try the button). The cost vs a plain BST is the bookkeeping; the cost
          vs a B-tree is poorer cache behaviour (one key per node, lots of pointer-chasing), which is why databases prefer wide B+trees on
          disk and reserve balanced binary trees (AVL, red-black) for in-memory structures like C++ <code>std::map</code> and the Linux
          kernel’s scheduler.
        </p>
      </section>
    </div>
  );
}

function inkeys(n: Node | null, out: number[] = []): number[] { if (n) { inkeys(n.left, out); out.push(n.key); inkeys(n.right, out); } return out; }
