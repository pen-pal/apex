// Treap, made visible. Each node shows its key (top) and a bar for its random priority. Two invariants hold at
// once: keys are a BST (in-order sorted), priorities are a max-heap (the bar shrinks as you go down). Add keys
// — including a sorted run that would turn a plain BST into a linked list — and watch the treap stay shallow
// with no rebalancing rules. Because the priority is a hash of the key, the tree's shape depends only on WHICH
// keys are present, not the order you added them. Real model from treap.ts.
import { useMemo, useState } from 'react';
import { insert, inorder, height, type TNode } from './treap';

export function TreapSection() {
  const [keys, setKeys] = useState<number[]>([50, 30, 70, 20, 40, 60, 80, 10, 25, 65]);
  const [input, setInput] = useState('');

  const root = useMemo(() => keys.reduce<TNode | null>((r, k) => insert(r, k), null), [keys]);
  const add = (k: number) => { if (Number.isFinite(k) && !keys.includes(k)) setKeys((ks) => [...ks, k]); };
  const addSortedRun = () => { const base = Math.max(0, ...keys); setKeys((ks) => [...ks, ...Array.from({ length: 6 }, (_, i) => base + (i + 1) * 3)]); };
  const reset = () => setKeys([50, 30, 70, 20, 40, 60, 80, 10, 25, 65]);

  const { pos, cols, rows } = useMemo(() => {
    const p = new Map<TNode, { x: number; d: number }>(); let col = 0, maxD = 0;
    const go = (n: TNode | null, d: number) => { if (!n) return; go(n.left, d + 1); p.set(n, { x: col++, d }); maxD = Math.max(maxD, d); go(n.right, d + 1); };
    go(root, 0);
    return { pos: p, cols: Math.max(1, col), rows: maxD + 1 };
  }, [root]);
  const nodes = [...pos.entries()];
  const edges: [TNode, TNode][] = [];
  nodes.forEach(([n]) => { if (n.left) edges.push([n, n.left]); if (n.right) edges.push([n, n.right]); });
  const px = (x: number) => ((x + 0.5) / cols) * 100;
  const py = (d: number) => ((d + 0.5) / rows) * 100;

  const h = height(root);
  const ideal = Math.max(1, Math.ceil(Math.log2(keys.length + 1)));

  return (
    <div className="trp">
      <p className="trp-intro">
        A treap keeps a BST balanced by giving each node a <strong>random priority</strong> and enforcing
        <strong> heap order</strong> on those priorities on top of BST order on the keys. There's exactly one
        tree that satisfies both — and because the priorities are random, it's balanced with no rotations to
        track. Add keys (the sorted-run button is the case that ruins a plain BST):
      </p>

      <div className="trp-controls">
        <input className="trp-in" type="number" value={input} placeholder="key" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && input) { add(+input); setInput(''); } }} />
        <button type="button" className="trp-btn" onClick={() => { if (input) { add(+input); setInput(''); } }}>add</button>
        <button type="button" className="trp-btn warn" onClick={addSortedRun}>+ sorted run (BST killer)</button>
        <button type="button" className="trp-btn ghost" onClick={reset}>reset</button>
      </div>

      <div className="trp-treewrap">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trp-svg">
          {edges.map(([a, b], i) => { const pa = pos.get(a)!, pb = pos.get(b)!; return <line key={i} x1={px(pa.x)} y1={py(pa.d)} x2={px(pb.x)} y2={py(pb.d)} className="trp-edge" />; })}
        </svg>
        {nodes.map(([n], i) => {
          const p = pos.get(n)!;
          const frac = n.prio / 0x100000000; // priority as a fraction (bar height)
          return (
            <div key={i} className={`trp-node ${p.d === 0 ? 'root' : ''}`} style={{ left: `${px(p.x)}%`, top: `${py(p.d)}%` }}>
              <span className="trp-key">{n.key}</span>
              <span className="trp-priobar"><i style={{ width: `${frac * 100}%` }} /></span>
            </div>
          );
        })}
      </div>

      <div className="trp-stats">
        <div className={`trp-stat ${h <= ideal * 2.5 ? 'ok' : 'bad'}`}><span>height</span><b>{h}</b></div>
        <div className="trp-stat"><span>ideal (log₂)</span><b>{ideal}</b></div>
        <div className="trp-stat"><span>plain BST, sorted insert</span><b>{keys.length}</b></div>
        <div className="trp-stat"><span>keys · in order</span><b className="trp-inorder">{inorder(root).join(' ')}</b></div>
      </div>

      <p className="trp-foot">
        The elegance is in what's <em>absent</em>: no balance factors (AVL), no red/black bits, no case analysis
        — just "insert as a leaf, rotate up while your priority beats your parent's." The randomness does the
        balancing for free, giving expected O(log n) search/insert/delete, and the worst case (a bad run of
        priorities) is astronomically unlikely rather than triggerable by adversarial input order the way a
        naive BST is. Deriving the priority from a <strong>hash of the key</strong> buys a second gift:
        <strong> the tree is a pure function of the key set</strong>, so two replicas that saw the same keys in
        different orders converge to byte-identical trees — handy for caching and for anti-entropy. Treaps also
        <strong> split</strong> and <strong>merge</strong> whole subtrees by key in O(log n), which makes them a
        go-to for order-statistics, implicit-key sequences (a rope/gap-buffer that supports insert-at-index), and
        persistent/immutable variants. The same randomization idea powers <em>skip lists</em>, which trade the
        tree for stacked linked lists but get the same expected-log behaviour. (Seidel &amp; Aragon, 1996.)
      </p>
    </div>
  );
}
