// Splay tree, made visible. Click any node to "access" it and watch it rotate all the way to the root,
// dragging its neighbours into a new shape — no balance factors, just "move what you touched to the top."
// Access a key twice and the second lookup costs nothing (it's already the root): temporal locality for free.
// The in-order order never changes, so it's always a valid BST. Real model from splaytree.ts.
import { useMemo, useRef, useState } from 'react';
import { SplayTree, type SNode } from './splaytree';

export function SplayTreeSection() {
  const treeRef = useRef<SplayTree | null>(null);
  if (!treeRef.current) { const t = new SplayTree(); [50, 30, 70, 20, 40, 60, 80, 10, 25, 65].forEach((k) => t.insert(k)); treeRef.current = t; }
  const t = treeRef.current;
  const [, setTick] = useState(0);
  const [lastCost, setLastCost] = useState<{ key: number; cost: number } | null>(null);

  const access = (key: number) => { const r = t.find(key); setLastCost({ key, cost: r.cost }); setTick((x) => x + 1); };
  const reset = () => { const nt = new SplayTree(); [50, 30, 70, 20, 40, 60, 80, 10, 25, 65].forEach((k) => nt.insert(k)); treeRef.current = nt; setLastCost(null); setTick((x) => x + 1); };

  const { nodes, edges, cols, rows } = useMemo(() => {
    const pos = new Map<number, { x: number; d: number }>();
    let col = 0, maxD = 0;
    const assign = (n: SNode | null, d: number) => { if (!n) return; assign(n.left, d + 1); pos.set(n.key, { x: col++, d }); maxD = Math.max(maxD, d); assign(n.right, d + 1); };
    assign(t.root, 0);
    const edges: { a: number; b: number }[] = [];
    const walk = (n: SNode | null) => { if (!n) return; if (n.left) { edges.push({ a: n.key, b: n.left.key }); walk(n.left); } if (n.right) { edges.push({ a: n.key, b: n.right.key }); walk(n.right); } };
    walk(t.root);
    const nodes = [...pos.entries()].map(([key, p]) => ({ key, ...p }));
    return { nodes, edges, cols: Math.max(1, col), rows: maxD + 1 };
  }, [lastCost, t.root]);

  const W = 100, colW = W / cols, rowH = 100 / Math.max(1, rows);
  const px = (x: number) => (x + 0.5) * colW;
  const py = (d: number) => (d + 0.5) * rowH;

  return (
    <div className="spl">
      <p className="spl-intro">
        A binary search tree that <strong>rebalances around whatever you touch</strong>. Every lookup rotates
        that node all the way to the <strong>root</strong> (zig / zig-zig / zig-zag) — no colours, no balance
        factors. A key you access often sits near the top and is found in O(1); the tree molds itself to your
        access pattern. Click a node to access it.
      </p>

      <div className="spl-treewrap">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="spl-svg">
          {edges.map((e, i) => {
            const a = nodes.find((n) => n.key === e.a)!, b = nodes.find((n) => n.key === e.b)!;
            return <line key={i} x1={px(a.x)} y1={py(a.d)} x2={px(b.x)} y2={py(b.d)} className="spl-edge" />;
          })}
        </svg>
        {nodes.map((n) => (
          <button key={n.key} type="button" className={`spl-node ${n.d === 0 ? 'root' : ''} ${lastCost?.key === n.key ? 'hot' : ''}`}
            style={{ left: `${px(n.x)}%`, top: `${py(n.d)}%` }} onClick={() => access(n.key)}>
            {n.key}
          </button>
        ))}
      </div>

      <div className="spl-bar">
        {lastCost && (
          <div className={`spl-cost ${lastCost.cost === 0 ? 'free' : ''}`}>
            accessed <b>{lastCost.key}</b> — traversed <b>{lastCost.cost}</b> level{lastCost.cost === 1 ? '' : 's'}, now at the root.
            {lastCost.cost === 0 ? ' It was already the root — a repeat access is free.' : ' Access it again and it costs 0.'}
          </div>
        )}
        <div className="spl-facts">
          <span>root: <b>{t.rootKey()}</b></span>
          <span>height: <b>{t.height()}</b></span>
          <span className="spl-io">in-order: {t.inorder().join(' ')}</span>
          <button type="button" className="spl-reset" onClick={reset}>reset</button>
        </div>
      </div>

      <p className="spl-foot">
        Why it works: the zig-zig/zig-zag rotations don't just move the target up — they roughly <strong>halve
        the depth</strong> of everything along the access path, so a long path you paid for once gets cheaper
        for everyone next time. Any single operation can be O(n) (access the deepest node in a stick), but the
        <strong> amortized</strong> cost over any sequence is O(log n), and there is no bookkeeping to store or
        maintain. It also gives the <strong>working-set</strong> property: the cost of accessing a key is
        logarithmic in how many <em>distinct</em> keys you've touched since you last touched it — so on skewed,
        bursty workloads (exactly what caches see) it can beat a strictly-balanced AVL/red-black tree. The
        cost: every read <em>writes</em> (rotations), which is bad for concurrency and for read-only memory.
        (Sleator &amp; Tarjan, 1985.)
      </p>
    </div>
  );
}
