// HAMT, made visible. A small persistent map drawn as a bitmap trie. Insert or update a key and the view
// shows the NEW version: the nodes copied along the path to the changed key are highlighted, while every other
// subtree is REUSED (shared) from the previous version — the same objects, not copies. The old version is
// still valid and unchanged; both coexist, sharing almost all their memory. That's structural sharing, the
// reason immutable maps are cheap. Real model from hamt.ts.
import { useMemo, useState } from 'react';
import { emptyNode, set, get, sharedNodes, type Node, type Entry, type Collision } from './hamt';

type Child = Node | Entry | Collision;
const isEntry = (x: Child): x is Entry => 'key' in x;
const isNode = (x: Child): x is Node => 'bitmap' in x;
const PRESET = ['apple', 'banana', 'cherry', 'date', 'fig', 'grape'];

const EntryChip = ({ e }: { e: Entry }) => <div className="hamt-entry"><span className="hamt-key">{e.key}</span><span className="hamt-val">{e.value}</span></div>;

function NodeView({ node, oldSet }: { node: Node; oldSet: Set<Node> }) {
  const shared = oldSet.has(node);
  return (
    <div className={`hamt-node ${shared ? 'shared' : 'copied'}`}>
      <span className="hamt-nlabel">{shared ? 'shared' : 'copied'} · {node.children.length}</span>
      <div className="hamt-kids">
        {node.children.map((c, i) => isEntry(c)
          ? <EntryChip key={i} e={c} />
          : isNode(c)
            ? <NodeView key={i} node={c} oldSet={oldSet} />
            : <div key={i} className="hamt-collide">collision{c.bucket.map((e, j) => <EntryChip key={j} e={e} />)}</div>)}
      </div>
    </div>
  );
}

export function HamtSection() {
  const base = useMemo(() => { let r = emptyNode(); PRESET.forEach((k, i) => (r = set(r, k, (i + 1) * 10))); return r; }, []);
  const [prev, setPrev] = useState<Node>(base);
  const [root, setRoot] = useState<Node>(base);
  const [key, setKey] = useState('cherry');
  const [value, setValue] = useState(99);

  const oldSet = useMemo(() => {
    const s = new Set<Node>();
    const collect = (n: Node) => { s.add(n); n.children.forEach((c) => { if (isNode(c)) collect(c); }); };
    collect(prev);
    return s;
  }, [prev]);

  const doSet = () => { if (!key) return; setPrev(root); setRoot(set(root, key, value)); setValue((v) => v + 1); };
  const reset = () => { setPrev(base); setRoot(base); };

  const share = sharedNodes(prev, root);
  const changed = prev !== root;

  return (
    <div className="hamt">
      <p className="hamt-intro">
        An immutable map stored as a <strong>bitmap trie</strong>: a key's hash is chopped into 5-bit chunks
        that pick a slot at each level. Insert or update a key — the new version <strong>copies only the nodes
        on the path</strong> to that key and <strong>shares</strong> every other subtree with the old version,
        which stays valid and unchanged.
      </p>

      <div className="hamt-controls">
        <input className="hamt-in" value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" spellCheck={false} />
        <input className="hamt-in num" type="number" value={value} onChange={(e) => setValue(+e.target.value)} />
        <button type="button" className="hamt-btn" onClick={doSet}>set →</button>
        <button type="button" className="hamt-btn ghost" onClick={reset}>reset</button>
      </div>

      {changed && (
        <div className="hamt-stat">
          this update <b>copied {share.copied}</b> node{share.copied === 1 ? '' : 's'} and
          <b> shared {share.shared}</b> — {Math.round((share.shared / share.total) * 100)}% of the tree reused.
          The old version still holds <code>{key} = {get(prev, key) ?? '∅'}</code>; the new one holds <code>{key} = {get(root, key)}</code>.
        </div>
      )}

      <div className="hamt-legend"><span><i className="hamt-sw copied" /> copied this update</span><span><i className="hamt-sw shared" /> shared with old version</span></div>

      <div className="hamt-tree">
        <NodeView node={root} oldSet={oldSet} />
      </div>

      <p className="hamt-foot">
        Because only the path is copied, an "update" to a map of a million entries touches ~<strong>log₃₂(n) ≈ 4
        nodes</strong>, not a million — so persistent maps give you O(log n) copies instead of O(n), and the old
        snapshot is free to keep. That's what makes immutable collections practical: undo/redo histories,
        lock-free readers that hold a stable snapshot while writers move on, React/Redux state that can be
        compared by reference, and Git-like versioning. The two other tricks that make it fast: the
        <strong> bitmap + popcount</strong> keeps each node as small as its actual children (no 32-wide sparse
        arrays), and 5-bit chunks keep the tree shallow. Clojure's maps, Scala's <code>HashMap</code>,
        <code> immutable.js</code>, and Erlang's maps are all HAMTs. (Bagwell, "Ideal Hash Trees," 2001.)
      </p>
    </div>
  );
}
