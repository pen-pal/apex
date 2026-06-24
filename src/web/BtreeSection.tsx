// B+tree, made visible. Insert keys one at a time and watch leaves fill, split, and push
// separators up — and the whole tree grow a level when the root splits. Every leaf always
// ends at the same depth, which is why a database index lookup is O(log n) no matter the
// key. Real B+tree in btree.ts (tested for balance, order, and separator correctness).
import { useMemo, useState } from 'react';
import { build, insert, emptyTree, height, type Node } from './btree';

const ORDER = 4;
const INITIAL = [50, 20, 70, 10, 30, 60, 80, 5, 15];

function NodeView({ node }: { node: Node }) {
  return (
    <div className="bpt-subtree">
      <div className={`bpt-node ${node.kind}`}>
        {node.keys.length === 0 ? <span className="bpt-empty">∅</span> : node.keys.map((k, i) => <span key={i} className="bpt-key">{k}</span>)}
      </div>
      {node.kind === 'internal' && (
        <div className="bpt-children">{node.children.map((c, i) => <NodeView key={i} node={c} />)}</div>
      )}
    </div>
  );
}

export function BtreeSection() {
  const [tree, setTree] = useState<Node>(() => build(INITIAL, ORDER));
  const [next, setNext] = useState('42');

  const add = () => { const k = parseInt(next, 10); if (!isNaN(k)) setTree((t) => insert(t, k, ORDER)); };
  const addRandom = () => setTree((t) => insert(t, Math.floor(Math.random() * 99) + 1, ORDER));
  const reset = () => setTree(emptyTree());
  const h = useMemo(() => height(tree), [tree]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>B+tree — the index under every database</h2></div>
        <p className="jsec-sub">
          A B+tree keeps millions of keys sorted and balanced so any lookup touches only a handful of nodes. Keys live in the
          <strong> leaves</strong>; the <strong>internal</strong> nodes are just signposts. Insert a key and it lands in a leaf — and
          when a node fills up (order {ORDER}, so {ORDER - 1} keys max) it <strong>splits</strong>, pushing a separator up. Splits ripple
          upward, and a root split makes the whole tree taller.
        </p>

        <div className="bpt-controls">
          <input value={next} onChange={(e) => setNext(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} inputMode="numeric" />
          <button onClick={add}>+ insert</button>
          <button onClick={addRandom}>+ random</button>
          <button onClick={reset} className="bpt-reset">reset</button>
          <span className="bpt-stat">height <b>{h}</b></span>
        </div>

        <div className="bpt-tree">
          <NodeView node={tree} />
        </div>

        <div className="bpt-legend"><span><i className="bpt-node internal" /> internal (separators)</span><span><i className="bpt-node leaf" /> leaf (data)</span></div>

        <p className="bpt-foot">
          The fan-out is the trick: real database pages hold hundreds of keys, so even a billion rows sit in a tree only 3–4 levels deep
          — a handful of disk reads per lookup. Leaves are chained left-to-right, so a range query (<code>WHERE x BETWEEN …</code>) finds
          one leaf then walks sideways. Splits keep it balanced on insert; deletes do the reverse (merge/redistribute on underflow). This
          is the workhorse behind PostgreSQL, MySQL/InnoDB, and SQLite indexes — the read-optimized counterpart to the LSM-tree.
        </p>
      </section>
    </div>
  );
}
