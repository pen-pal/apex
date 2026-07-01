// The pairing heap, made visible. Insert keys (each is O(1) — meld a one-node heap onto the root) and watch the
// multi-way tree grow; delete-min removes the root and two-pass merges its child forest back into one tree. The
// caption narrates the two passes. Real model from pairingheap.ts.
import { useMemo, useState } from 'react';
import { insert, deleteMin, findMin, fromKeys, type Heap, type PNode } from './pairingheap';

interface Placed { key: number; x: number; y: number; id: string }
interface Edge { x1: number; y1: number; x2: number; y2: number }

function layout(h: Heap): { nodes: Placed[]; edges: Edge[]; w: number; depth: number } {
  const nodes: Placed[] = [], edges: Edge[] = [];
  let leaf = 0, maxDepth = 0;
  const place = (n: PNode, depth: number, id: string): number => {
    maxDepth = Math.max(maxDepth, depth);
    let x: number;
    if (n.children.length === 0) x = leaf++;
    else {
      const xs = n.children.map((c, i) => place(c, depth + 1, `${id}.${i}`));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    nodes.push({ key: n.key, x, y: depth, id });
    for (let i = 0; i < n.children.length; i++) {
      const cx = nodes.find((p) => p.id === `${id}.${i}`)!;
      edges.push({ x1: x, y1: depth, x2: cx.x, y2: depth + 1 });
    }
    return x;
  };
  if (h) place(h, 0, 'r');
  return { nodes, edges, w: Math.max(1, leaf), depth: maxDepth };
}

export function PairingHeapSection() {
  const [heap, setHeap] = useState<Heap>(() => fromKeys([5, 8, 2, 9, 4, 7, 1, 6, 3]));
  const [val, setVal] = useState(0);
  const [note, setNote] = useState('9 keys inserted — each melds a one-node heap onto the root.');

  const { nodes, edges, w, depth } = useMemo(() => layout(heap), [heap]);
  const min = findMin(heap);

  const doInsert = (k: number) => { setHeap((h) => insert(h, k)); setNote(`inserted ${k} — O(1) meld: the smaller of {${k}} and the root keeps the crown.`); };
  const doDelete = () => {
    if (!heap) return;
    const kids = heap.children.length;
    const { min: m, heap: nh } = deleteMin(heap);
    setHeap(nh);
    setNote(`deleted min ${m} — its ${kids} child${kids === 1 ? '' : 'ren'} were two-pass merged (pair left→right, then fold right→left) back into one tree.`);
  };
  const reset = () => { setHeap(fromKeys([5, 8, 2, 9, 4, 7, 1, 6, 3])); setNote('reset.'); };

  const PAD = 22, GX = Math.min(60, 560 / Math.max(1, w)), GY = 56;
  const W = Math.max(320, w * GX + PAD * 2), H = (depth + 1) * GY + PAD * 2;
  const sx = (x: number) => PAD + x * GX + GX / 2;
  const sy = (y: number) => PAD + y * GY;

  return (
    <div className="prh">
      <p className="prh-intro">
        A pairing heap is one multi-way tree with the heap property (every key ≤ its children's). Everything is
        built from <strong>meld</strong>: to merge two heaps, the smaller root adopts the other tree as its first
        child — O(1). <strong>insert</strong> melds a one-node heap; <strong>find-min</strong> is the root. Only
        <strong> delete-min</strong> works: remove the root, then <strong>two-pass merge</strong> its children —
        pair them left→right, then fold right→left.
      </p>

      <div className="prh-controls">
        <input type="number" className="prh-num" value={val} onChange={(e) => setVal(+e.target.value)} />
        <button type="button" className="prh-btn" onClick={() => doInsert(val)}>insert</button>
        <button type="button" className="prh-btn" onClick={() => doInsert(Math.floor(Math.abs(Math.sin(nodes.length * 13.7)) * 99))}>+ random</button>
        <button type="button" className="prh-btn danger" onClick={doDelete} disabled={!heap}>delete-min{min !== null ? ` (${min})` : ''}</button>
        <button type="button" className="prh-btn ghost" onClick={reset}>reset</button>
        <span className="prh-min">min = <b>{min ?? '∅'}</b></span>
      </div>

      <div className="prh-caption">{note}</div>

      <svg viewBox={`0 0 ${W} ${H}`} className="prh-tree" style={{ maxWidth: W }}>
        {edges.map((e, i) => <line key={i} x1={sx(e.x1)} y1={sy(e.y1)} x2={sx(e.x2)} y2={sy(e.y2)} className="prh-edge" />)}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={sx(n.x)} cy={sy(n.y)} r={14} className={`prh-node ${n.id === 'r' ? 'root' : ''}`} />
            <text x={sx(n.x)} y={sy(n.y) + 4} className="prh-nk" textAnchor="middle">{n.key}</text>
          </g>
        ))}
      </svg>

      <p className="prh-foot">
        Why the two-pass merge, and not just meld the children left to right? The naive way builds a long spine
        that degrades later deletes to O(n); pairing them first halves the depth each round, and that one change
        is what buys the O(log n) amortized delete-min. The payoff over a binary heap is <strong>meld in O(1)</strong>
        and a cheap <strong>decrease-key</strong> (cut the node's subtree out and meld it back at the root) — the
        operations Dijkstra and Prim hammer, since relaxing an edge is a decrease-key. Its complexity is one of
        the loveliest open problems in data structures: pairing heaps are <em>conjectured</em> to match the
        Fibonacci heap's O(1) amortized decrease-key, proven to be at least O(log log n), and no one has closed
        the gap in nearly 40 years. Yet in practice they usually beat Fibonacci heaps outright — no parent
        pointers, no mark bits, no rank bookkeeping, just tiny nodes and great cache behavior — which is the
        recurring lesson that asymptotics and wall-clock can disagree. The same "self-adjusting, do the cleanup
        lazily during the expensive operation" philosophy powers <strong>splay trees</strong> and
        <strong> skew heaps</strong>; pairing heaps are its heap incarnation. (Fredman, Sedgewick, Sleator &amp;
        Tarjan, 1986; the decrease-key lower bound is Fredman, 1999 and Iacono, 2000.) The O(1) meld/insert
        figures are for the classic in-place heap; this model is <em>persistent</em> (immutable nodes), so each
        meld copies the winning root's child list — a standard functional-implementation trade-off that doesn't
        change the algorithm.
      </p>
    </div>
  );
}
